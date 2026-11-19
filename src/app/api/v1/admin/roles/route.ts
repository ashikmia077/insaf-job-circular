import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getServerEnv } from "@/config/env.config";
import { AuthorizationError } from "@/lib/security/rbac";
import { getCurrentAdminContext } from "@/lib/supabase/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseDatabaseRepository } from "@/services/database/supabase.repository";
import {
  AdminsService,
  updateAdminRoleSchema,
} from "@/services/admins/admins.service";

export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  const rateLimit = await checkRateLimit({
    identifier: `admin:roles:get:${clientIp}`,
    limitPerMinute: env.RATE_LIMIT_ADMIN_RPM,
  });

  if (!rateLimit.allowed) {
    return apiError("RATE_LIMIT_EXCEEDED", "Rate limit exceeded.", {
      status: 429,
      rateLimit,
    });
  }

  try {
    const actor = await getCurrentAdminContext();
    const supabase = createSupabaseServerClient();
    const service = new AdminsService(new SupabaseDatabaseRepository(supabase));
    const admins = await service.listAdmins(actor);
    return apiSuccess({ admins }, { rateLimit });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return apiError(err.code, err.message, {
        status: err.statusCode,
        rateLimit,
      });
    }
    return apiError(
      "ADMIN_ROLES_FETCH_FAILED",
      err instanceof Error ? err.message : "Failed to list administrators.",
      { status: 500, rateLimit }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const env = getServerEnv();
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  const rateLimit = await checkRateLimit({
    identifier: `admin:roles:patch:${clientIp}`,
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

  const parsed = updateAdminRoleSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid role update payload.", {
      status: 422,
      details: parsed.error.flatten(),
      rateLimit,
    });
  }

  try {
    const actor = await getCurrentAdminContext();
    const supabase = createSupabaseServerClient();
    const service = new AdminsService(new SupabaseDatabaseRepository(supabase));
    const updated = await service.updateAdminGovernance(actor, parsed.data);
    return apiSuccess({ admin: updated }, { rateLimit });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return apiError(err.code, err.message, {
        status: err.statusCode,
        rateLimit,
      });
    }
    return apiError(
      "ADMIN_ROLE_UPDATE_FAILED",
      err instanceof Error ? err.message : "Failed to update administrator role.",
      { status: 400, rateLimit }
    );
  }
}
