import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getServerEnv } from "@/config/env.config";
import { passwordResetRequestSchema } from "@/features/admin";
import { isSupabaseConnectionConfigured } from "@/lib/supabase/middleware";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/v1/auth/reset-password
 * Initiates a password reset email with strict rate-limiting and anti-enumeration response.
 */
export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  const rateLimit = await checkRateLimit({
    identifier: `auth:reset:${clientIp}`,
    limitPerMinute: env.RATE_LIMIT_AUTH_RPM,
  });

  if (!rateLimit.allowed) {
    return apiError(
      "AUTH_RATE_LIMIT_EXCEEDED",
      "Too many password reset requests. Please try again later.",
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

  const parsed = passwordResetRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid email address.", {
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

  const supabase = createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/admin/update-password`,
  });

  // Always return uniform success message to prevent email enumeration
  return apiSuccess(
    {
      message:
        "If an active administrator account matches this email, a password reset link has been sent.",
    },
    { rateLimit }
  );
}
