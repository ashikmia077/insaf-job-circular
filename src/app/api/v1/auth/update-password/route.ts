import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getServerEnv } from "@/config/env.config";
import { passwordUpdateSchema } from "@/features/admin";
import { isSupabaseConnectionConfigured } from "@/lib/supabase/middleware";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAdminContext } from "@/lib/supabase/session";
import { SupabaseDatabaseRepository } from "@/services/database/supabase.repository";
import { recordAdminAuditLog } from "@/lib/security/audit";

/**
 * POST /api/v1/auth/update-password
 * Completes the password reset / update flow for an authenticated administrator.
 */
export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  const rateLimit = await checkRateLimit({
    identifier: `auth:update-pw:${clientIp}`,
    limitPerMinute: env.RATE_LIMIT_AUTH_RPM,
  });

  if (!rateLimit.allowed) {
    return apiError("AUTH_RATE_LIMIT_EXCEEDED", "Rate limit exceeded.", {
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

  const parsed = passwordUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Password complexity check failed.", {
      status: 422,
      details: parsed.error.flatten(),
      rateLimit,
    });
  }

  if (!isSupabaseConnectionConfigured()) {
    return apiError(
      "SUPABASE_NOT_CONFIGURED",
      "Supabase environment variables are not configured yet.",
      { status: 503, rateLimit }
    );
  }

  const admin = await getCurrentAdminContext();
  if (!admin || !admin.isActive) {
    return apiError(
      "UNAUTHENTICATED",
      "An active recovery or administrator session is required to update password.",
      { status: 401, rateLimit }
    );
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return apiError("PASSWORD_UPDATE_FAILED", error.message, {
      status: 400,
      rateLimit,
    });
  }

  try {
    const repo = new SupabaseDatabaseRepository(supabase);
    await recordAdminAuditLog(repo, {
      actorAdminId: admin.adminId,
      actorRole: admin.role,
      action: "auth.password_updated",
      resource: "admin_profiles",
      entityId: admin.adminId,
      ipAddress: clientIp,
      userAgent: request.headers.get("user-agent"),
    });
  } catch {
    // Non-blocking audit log
  }

  return apiSuccess(
    {
      updated: true,
      message: "Administrator password updated successfully.",
    },
    { rateLimit }
  );
}
