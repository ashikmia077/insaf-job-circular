import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getServerEnv } from "@/config/env.config";
import {
  createJobCircularSchema,
  jobFilterQuerySchema,
} from "@/features/jobs";
import { isSupabaseConnectionConfigured } from "@/lib/supabase/middleware";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAdminContext } from "@/lib/supabase/session";
import { AuthorizationError } from "@/lib/security/rbac";
import { SupabaseDatabaseRepository } from "@/services/database/supabase.repository";
import { JobsService } from "@/services/jobs/jobs.service";

/**
 * GET /api/v1/jobs
 * Validates query parameters via Zod, enforces rate-limiting,
 * and queries published jobs via `JobsService` when Supabase is configured.
 */
export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  const rateLimit = await checkRateLimit({
    identifier: `jobs:get:${clientIp}`,
    limitPerMinute: env.RATE_LIMIT_PUBLIC_RPM,
  });

  if (!rateLimit.allowed) {
    return apiError("RATE_LIMIT_EXCEEDED", "Rate limit exceeded.", {
      status: 429,
      rateLimit,
    });
  }

  const rawQuery = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = jobFilterQuerySchema.safeParse(rawQuery);

  if (!parsed.success) {
    return apiError("INVALID_QUERY_PARAMS", "Invalid job filter parameters.", {
      status: 400,
      details: parsed.error.flatten(),
      rateLimit,
    });
  }

  if (!isSupabaseConnectionConfigured()) {
    return apiSuccess(
      {
        filters: parsed.data,
        items: [],
        supabaseConfigured: false,
      },
      {
        pagination: {
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
          totalItems: 0,
          totalPages: 0,
        },
        rateLimit,
      }
    );
  }

  try {
    const supabase = createSupabaseServerClient();
    const service = new JobsService(new SupabaseDatabaseRepository(supabase));
    const items = await service.listPublishedJobs(parsed.data.category);
    return apiSuccess(
      {
        filters: parsed.data,
        items,
        supabaseConfigured: true,
      },
      {
        pagination: {
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
          totalItems: items.length,
          totalPages: Math.ceil(items.length / parsed.data.pageSize),
        },
        rateLimit,
      }
    );
  } catch (err) {
    return apiError(
      "JOBS_FETCH_FAILED",
      err instanceof Error ? err.message : "Failed to fetch jobs.",
      { status: 500, rateLimit }
    );
  }
}

/**
 * POST /api/v1/jobs
 * Validates payload with Zod, enforces administrative RBAC (`jobs:create`),
 * creates a draft in `pending_verification`, and logs an immutable audit record.
 */
export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  const rateLimit = await checkRateLimit({
    identifier: `jobs:post:${clientIp}`,
    limitPerMinute: env.RATE_LIMIT_ADMIN_RPM,
  });

  if (!rateLimit.allowed) {
    return apiError("RATE_LIMIT_EXCEEDED", "Rate limit exceeded.", {
      status: 429,
      rateLimit,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("MALFORMED_JSON", "Request body must be valid JSON.", {
      status: 400,
      rateLimit,
    });
  }

  const parsed = createJobCircularSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid job circular payload.", {
      status: 422,
      details: parsed.error.flatten(),
      rateLimit,
    });
  }

  if (!isSupabaseConnectionConfigured()) {
    return apiError(
      "SUPABASE_NOT_CONFIGURED",
      "Supabase credentials are not configured in .env.local.",
      { status: 503, rateLimit }
    );
  }

  try {
    const actor = await getCurrentAdminContext();
    const supabase = createSupabaseServerClient();
    const service = new JobsService(new SupabaseDatabaseRepository(supabase));
    const created = await service.createJobDraft(actor, parsed.data);
    return apiSuccess({ job: created }, { status: 201, rateLimit });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return apiError(err.code, err.message, {
        status: err.statusCode,
        rateLimit,
      });
    }
    return apiError(
      "JOB_CREATE_FAILED",
      err instanceof Error ? err.message : "Failed to create job circular.",
      { status: 400, rateLimit }
    );
  }
}
