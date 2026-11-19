/**
 * Deterministic Auto-Publish Eligibility Policy for Insaf Job Circular.
 *
 * A job circular may ONLY be auto-published without manual human intervention when ALL
 * safety and authenticity criteria below pass. Otherwise it is routed to `pending_verification`.
 */

export interface AutoPublishEvaluationInput {
  isOfficialTrustedDomain: boolean;
  hasPrimaryNoticeAsset: boolean;
  noticeChecksumVerified: boolean;
  aiConfidenceScore: number;
  isDuplicateDetected: boolean;
  deadlineEpochMs: number;
}

export interface AutoPublishDecision {
  eligibleForAutoPublish: boolean;
  targetStatus: "published" | "pending_verification" | "rejected_duplicate";
  reasons: string[];
}

export const AUTO_PUBLISH_MIN_AI_CONFIDENCE = 0.92;

export function evaluateAutoPublishEligibility(
  input: AutoPublishEvaluationInput
): AutoPublishDecision {
  const reasons: string[] = [];

  if (input.isDuplicateDetected) {
    return {
      eligibleForAutoPublish: false,
      targetStatus: "rejected_duplicate",
      reasons: ["Canonical fingerprint or notice SHA-256 matches an existing job circular."],
    };
  }

  if (!input.isOfficialTrustedDomain) {
    reasons.push("Source domain is not on the verified government/institutional allowlist.");
  }
  if (!input.hasPrimaryNoticeAsset || !input.noticeChecksumVerified) {
    reasons.push("Primary official PDF/image notice or SHA-256 integrity check is missing.");
  }
  if (input.aiConfidenceScore < AUTO_PUBLISH_MIN_AI_CONFIDENCE) {
    reasons.push(
      `AI extraction confidence (${input.aiConfidenceScore.toFixed(2)}) is below threshold (${AUTO_PUBLISH_MIN_AI_CONFIDENCE}).`
    );
  }
  if (input.deadlineEpochMs <= Date.now()) {
    reasons.push("Application deadline has already passed.");
  }

  if (reasons.length === 0) {
    return {
      eligibleForAutoPublish: true,
      targetStatus: "published",
      reasons: ["All official domain, notice checksum, deadline, and AI confidence checks passed."],
    };
  }

  return {
    eligibleForAutoPublish: false,
    targetStatus: "pending_verification",
    reasons,
  };
}
