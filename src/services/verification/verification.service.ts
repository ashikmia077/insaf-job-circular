import { z } from "zod";
import type { DatabaseRepository } from "@/services/database/repository.types";
import {
  type AuthenticatedAdminContext,
  assertAdminPermission,
  assertJobTransitionAllowed,
} from "@/lib/security/rbac";
import { recordAdminAuditLog } from "@/lib/security/audit";
import type {
  JobCircularRecord,
  JobVerificationRecord,
  JobVerificationStatus,
} from "@/types/database.types";

export const verificationDecisionSchema = z.object({
  jobId: z.string().uuid(),
  decision: z.enum([
    "approve_and_publish",
    "mark_verified_official",
    "reject_duplicate",
    "reject_unverified",
  ]),
  domainVerified: z.boolean().default(true),
  checksumVerified: z.boolean().default(true),
  notes: z.string().trim().min(3).max(1000),
});

export type VerificationDecisionInput = z.infer<
  typeof verificationDecisionSchema
>;

export class VerificationService {
  constructor(private readonly repo: DatabaseRepository) {}

  async listVerificationHistory(
    actor: AuthenticatedAdminContext | null,
    jobId: string
  ): Promise<JobVerificationRecord[]> {
    assertAdminPermission(actor, "analytics:view");
    return this.repo.listVerificationsByJobId(jobId);
  }

  /**
   * Executes a verification decision and transitions the job status.
   * Strictly restricted to VERIFICATION_ADMIN and SUPER_ADMIN.
   * EDITOR_ADMIN is blocked both here and by PostgreSQL trigger `trg_jobs_publish_governance`.
   */
  async submitVerificationDecision(
    actor: AuthenticatedAdminContext | null,
    rawInput: VerificationDecisionInput
  ): Promise<{
    job: JobCircularRecord;
    verificationRecord: JobVerificationRecord;
  }> {
    const input = verificationDecisionSchema.parse(rawInput);

    let targetStatus: JobVerificationStatus;
    switch (input.decision) {
      case "approve_and_publish":
        targetStatus = "published";
        break;
      case "mark_verified_official":
        targetStatus = "verified_official";
        break;
      case "reject_duplicate":
        targetStatus = "rejected_duplicate";
        break;
      case "reject_unverified":
        targetStatus = "rejected_unverified";
        break;
    }

    // Enforces that EDITOR_ADMIN cannot approve, reject, or publish
    const admin = assertJobTransitionAllowed(actor, targetStatus);

    if (
      targetStatus === "published" ||
      targetStatus === "verified_official"
    ) {
      assertAdminPermission(admin, "verification:approve");
    } else {
      assertAdminPermission(admin, "verification:reject");
    }

    const existingJob = await this.repo.getJobById(input.jobId);
    if (!existingJob) {
      throw new Error(`Job circular '${input.jobId}' not found.`);
    }

    // Require at least one official notice before approving/publishing
    if (targetStatus === "published") {
      const notices = await this.repo.listNoticesByJobId(input.jobId);
      if (notices.length === 0) {
        throw new Error(
          "PUBLICATION_BLOCKED: Cannot publish a job circular without an attached official notice asset."
        );
      }
    }

    const nowIso = new Date().toISOString();
    const updatedJob = await this.repo.updateJob(input.jobId, {
      verification_status: targetStatus,
      verified_by_admin_id: admin.adminId,
      verified_at: nowIso,
      ...(targetStatus === "published" ? { published_at: nowIso } : {}),
    });

    const verificationRecord = await this.repo.createJobVerification({
      job_id: input.jobId,
      reviewer_admin_id: admin.adminId,
      is_automated_check: false,
      previous_status: existingJob.verification_status,
      new_status: targetStatus,
      domain_verified: input.domainVerified,
      checksum_verified: input.checksumVerified,
      notes: input.notes,
    });

    await recordAdminAuditLog(this.repo, {
      actorAdminId: admin.adminId,
      actorRole: admin.canonicalRole,
      action: `verification.${input.decision}`,
      resource: "jobs",
      entityId: input.jobId,
      previousState: existingJob as unknown as Record<string, unknown>,
      newState: updatedJob as unknown as Record<string, unknown>,
      metadata: {
        verificationId: verificationRecord.id,
        domainVerified: input.domainVerified,
        checksumVerified: input.checksumVerified,
        notes: input.notes,
      },
    });

    return { job: updatedJob, verificationRecord };
  }
}
