import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getServerEnv } from "@/config/env.config";
import { getCurrentAdminContext } from "@/lib/supabase/session";
import { isSupabaseConnectionConfigured } from "@/lib/supabase/middleware";
import {
  normalizeAdminRole,
  ROLE_PERMISSION_MATRIX,
} from "@/config/permissions.config";

/**
 * GET /api/v1/auth/session
 * Returns the active administrator session, canonical governance role, and permissions.
 */
export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  const rateLimit = await checkRateLimit({
    identifier: `auth:session:${clientIp}`,
    limitPerMinute: env.RATE_LIMIT_ADMIN_RPM,
  });

  if (!rateLimit.allowed) {
    return apiError("RATE_LIMIT_EXCEEDED", "Rate limit exceeded.", {
      status: 429,
      rateLimit,
    });
  }

  if (!isSupabaseConnectionConfigured()) {
    return apiSuccess(
      {
        authenticated: false,
        supabaseConfigured: false,
        admin: null,
      },
      { rateLimit }
    );
  }

  const admin = await getCurrentAdminContext();
  const canonicalRole = normalizeAdminRole(admin?.role);

  if (!admin || !admin.isActive || !canonicalRole) {
    return apiSuccess(
      {
        authenticated: false,
        supabaseConfigured: true,
        admin: null,
      },
      { rateLimit }
    );
  }

  return apiSuccess(
    {
      authenticated: true,
      supabaseConfigured: true,
      admin: {
        id: admin.adminId,
        email: admin.email,
        fullName: admin.fullName,
        role: canonicalRole,
        permissions: ROLE_PERMISSION_MATRIX[canonicalRole],
      },
    },
    { rateLimit }
  );
}
