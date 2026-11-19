import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getServerEnv } from "@/config/env.config";
import { AuthorizationError } from "@/lib/security/rbac";
import { getCurrentAdminContext } from "@/lib/supabase/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseDatabaseRepository } from "@/services/database/supabase.repository";
import { AdminsService } from "@/services/admins/admins.service";

export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  const rateLimit = await checkRateLimit({
    identifier: `admin:audit:${clientIp}`,
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
    const logs = await service.listAuditLogs(actor, 100);
    return apiSuccess({ auditLogs: logs }, { rateLimit });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return apiError(err.code, err.message, {
        status: err.statusCode,
        rateLimit,
      });
    }
    return apiError(
      "AUDIT_LOGS_FETCH_FAILED",
      err instanceof Error ? err.message : "Failed to read audit logs.",
      { status: 500, rateLimit }
    );
  }
}
