import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getServerEnv } from "@/config/env.config";
import { AuthorizationError } from "@/lib/security/rbac";
import { getCurrentAdminContext } from "@/lib/supabase/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseDatabaseRepository } from "@/services/database/supabase.repository";
import {
  VerificationService,
  verificationDecisionSchema,
} from "@/services/verification/verification.service";

/**
 * POST /api/v1/admin/verify
 * Allows VERIFICATION_ADMIN or SUPER_ADMIN to verify, approve & publish, or reject a job circular.
 * Explicitly blocks EDITOR_ADMIN.
 */
export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  const rateLimit = await checkRateLimit({
    identifier: `admin:verify:${clientIp}`,
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

  const parsed = verificationDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid verification decision payload.", {
      status: 422,
      details: parsed.error.flatten(),
      rateLimit,
    });
  }

  try {
    const actor = await getCurrentAdminContext();
    const supabase = createSupabaseServerClient();
    const service = new VerificationService(
      new SupabaseDatabaseRepository(supabase)
    );
    const result = await service.submitVerificationDecision(actor, parsed.data);
    return apiSuccess(result, { rateLimit });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return apiError(err.code, err.message, {
        status: err.statusCode,
        rateLimit,
      });
    }
    return apiError(
      "VERIFICATION_DECISION_FAILED",
      err instanceof Error ? err.message : "Failed to process verification decision.",
      { status: 400, rateLimit }
    );
  }
}
