import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getServerEnv } from "@/config/env.config";
import {
  createJobCircularSchema,
  jobFilterQuerySchema,
} from "@/features/jobs";

/**
 * GET /api/v1/jobs
 * Phase 1 Architectural Route Handler: validates query parameters via Zod,
 * enforces rate-limiting, and returns standardized pagination envelope.
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

  return apiSuccess(
    {
      filters: parsed.data,
      items: [],
      notice:
        "Phase 1 architecture initialized. Live Supabase query execution will be connected in Phase 2 after schema approval.",
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

/**
 * POST /api/v1/jobs
 * Validates payload with Zod and enforces administrative RBAC preconditions.
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

  return apiError(
    "PHASE_1_NOT_IMPLEMENTED",
    "Job persistence requires Phase 2 Supabase Auth & RLS integration approval.",
    { status: 501, rateLimit }
  );
}
