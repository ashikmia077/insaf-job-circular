import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { isSupabaseConnectionConfigured } from "@/lib/supabase/middleware";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAdminContext } from "@/lib/supabase/session";
import { SupabaseDatabaseRepository } from "@/services/database/supabase.repository";
import { recordAdminAuditLog } from "@/lib/security/audit";

/**
 * POST /api/v1/auth/logout
 * Terminates the active administrator session and clears auth cookies.
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConnectionConfigured()) {
    return apiSuccess({ loggedOut: true });
  }

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const supabase = createSupabaseServerClient();
  const currentAdmin = await getCurrentAdminContext();

  if (currentAdmin) {
    try {
      const repo = new SupabaseDatabaseRepository(supabase);
      await recordAdminAuditLog(repo, {
        actorAdminId: currentAdmin.adminId,
        actorRole: currentAdmin.role,
        action: "auth.admin_logout",
        resource: "admin_profiles",
        entityId: currentAdmin.adminId,
        ipAddress: clientIp,
        userAgent: request.headers.get("user-agent"),
      });
    } catch {
      // Non-blocking audit write prior to sign-out
    }
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    return apiError("LOGOUT_FAILED", error.message, { status: 500 });
  }

  return apiSuccess({ loggedOut: true });
}
