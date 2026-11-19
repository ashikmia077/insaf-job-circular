import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getServerEnv } from "@/config/env.config";
import { adminLoginSchema } from "@/features/admin";
import { isSupabaseConnectionConfigured } from "@/lib/supabase/middleware";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeAdminRole, ROLE_PERMISSION_MATRIX } from "@/config/permissions.config";
import { SupabaseDatabaseRepository } from "@/services/database/supabase.repository";
import { recordAdminAuditLog } from "@/lib/security/audit";

/**
 * POST /api/v1/auth/login
 * Authenticates an administrator with strict rate limiting, Zod validation,
 * active `admin_profiles` verification, session persistence, and audit logging.
 */
export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  const rateLimit = await checkRateLimit({
    identifier: `auth:login:${clientIp}`,
    limitPerMinute: env.RATE_LIMIT_AUTH_RPM,
  });

  if (!rateLimit.allowed) {
    return apiError(
      "AUTH_RATE_LIMIT_EXCEEDED",
      "Too many authentication attempts. Please wait a minute before trying again.",
      { status: 429, rateLimit }
    );
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

  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid login credentials format.", {
      status: 422,
      details: parsed.error.flatten(),
      rateLimit,
    });
  }

  if (!isSupabaseConnectionConfigured()) {
    return apiError(
      "SUPABASE_NOT_CONFIGURED",
      "Supabase environment variables are not configured yet. Follow the Supabase setup guide in docs/SUPABASE_SETUP_AND_GOVERNANCE.md.",
      { status: 503, rateLimit }
    );
  }

  const supabase = createSupabaseServerClient();
  const { data: authData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

  if (signInError || !authData.user) {
    return apiError("INVALID_CREDENTIALS", "Invalid email or password.", {
      status: 401,
      rateLimit,
    });
  }

  const { data: adminProfile, error: profileError } = await supabase
    .from("admin_profiles")
    .select("*")
    .eq("id", authData.user.id)
    .is("deleted_at", null)
    .maybeSingle();

  const canonicalRole = normalizeAdminRole(adminProfile?.role);

  if (
    profileError ||
    !adminProfile ||
    !adminProfile.is_active ||
    !canonicalRole
  ) {
    await supabase.auth.signOut();
    return apiError(
      "UNAUTHORIZED_ADMIN",
      "Your account is not authorized as an active administrator.",
      { status: 403, rateLimit }
    );
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from("admin_profiles")
    .update({ last_active_at: nowIso })
    .eq("id", adminProfile.id);

  try {
    const repo = new SupabaseDatabaseRepository(supabase);
    await recordAdminAuditLog(repo, {
      actorAdminId: adminProfile.id,
      actorRole: canonicalRole,
      action: "auth.admin_login",
      resource: "admin_profiles",
      entityId: adminProfile.id,
      previousState: { last_active_at: adminProfile.last_active_at },
      newState: { last_active_at: nowIso },
      ipAddress: clientIp,
      userAgent: request.headers.get("user-agent"),
    });
  } catch {
    // Non-blocking if audit insert fails due to connection edge case
  }

  return apiSuccess(
    {
      admin: {
        id: adminProfile.id,
        email: adminProfile.email,
        fullName: adminProfile.full_name,
        role: canonicalRole,
        permissions: ROLE_PERMISSION_MATRIX[canonicalRole],
      },
    },
    { rateLimit }
  );
}
