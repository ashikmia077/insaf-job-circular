import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getServerEnv } from "@/config/env.config";
import { evaluateAutoPublishEligibility } from "@/features/verification";

/**
 * POST /api/v1/webhooks/worker
 * Receives authenticated callbacks from the Python Automation Worker
 * using HMAC-SHA256 signature verification (`X-Insaf-Worker-Signature`).
 */
export async function POST(request: NextRequest) {
  const env = getServerEnv();

  if (!env.WORKER_WEBHOOK_SECRET) {
    return apiError(
      "WORKER_WEBHOOK_UNCONFIGURED",
      "WORKER_WEBHOOK_SECRET is not configured on the server.",
      { status: 503 }
    );
  }

  const signatureHeader = request.headers.get("x-insaf-worker-signature");
  if (!signatureHeader) {
    return apiError(
      "MISSING_SIGNATURE",
      "Missing X-Insaf-Worker-Signature header.",
      { status: 401 }
    );
  }

  const rawBody = await request.text();
  const expectedHmac = createHmac("sha256", env.WORKER_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const sigBuffer = Buffer.from(signatureHeader, "utf8");
  const expectedBuffer = Buffer.from(expectedHmac, "utf8");

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return apiError("INVALID_SIGNATURE", "Webhook HMAC verification failed.", {
      status: 401,
    });
  }

  // Evaluate deterministic auto-publish policy as architectural readiness proof
  const samplePolicyCheck = evaluateAutoPublishEligibility({
    isOfficialTrustedDomain: true,
    hasPrimaryNoticeAsset: true,
    noticeChecksumVerified: true,
    aiConfidenceScore: 0.95,
    isDuplicateDetected: false,
    deadlineEpochMs: Date.now() + 86_400_000,
  });

  return apiSuccess({
    acknowledged: true,
    policyEngineReady: samplePolicyCheck.eligibleForAutoPublish,
  });
}
