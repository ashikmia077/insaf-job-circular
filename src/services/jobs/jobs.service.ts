import { createHash } from "crypto";
import { z } from "zod";
import type { DatabaseRepository } from "@/services/database/repository.types";
import {
  type AuthenticatedAdminContext,
  assertAdminPermission,
  assertJobTransitionAllowed,
} from "@/lib/security/rbac";
import { recordAdminAuditLog } from "@/lib/security/audit";
import {
  createJobCircularSchema,
  type CreateJobCircularInput,
} from "@/features/jobs";
import { generateSlug } from "@/lib/utils";
import type {
  JobCircularRecord,
  JobVerificationStatus,
} from "@/types/database.types";

export const updateJobCircularSchema = createJobCircularSchema
  .partial()
  .extend({
    isFeatured: z.boolean().optional(),
  });

export type UpdateJobCircularInput = z.infer<typeof updateJobCircularSchema>;

/**
 * Computes a deterministic 64-char SHA-256 canonical fingerprint for duplicate job detection.
 */
export function computeCanonicalJobFingerprint(params: {
  organizationId: string;
  titleEn: string;
  applicationDeadlineAt: string;
  vacancyCount?: number | null;
}): string {
  const normalizedTitle = params.titleEn
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const deadlineDay = params.applicationDeadlineAt.slice(0, 10);
  const raw = `${params.organizationId.toLowerCase()}|${normalizedTitle}|${deadlineDay}|${params.vacancyCount ?? 0}`;
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export class JobsService {
  constructor(private readonly repo: DatabaseRepository) {}

  async listPublishedJobs(category?: string): Promise<JobCircularRecord[]> {
    return this.repo.listJobs({ category, onlyPublished: true });
  }

  async listAdminJobs(
    actor: AuthenticatedAdminContext | null,
    filter?: { category?: string; verificationStatus?: string }
  ): Promise<JobCircularRecord[]> {
    assertAdminPermission(actor, "analytics:view");
    return this.repo.listJobs({
      category: filter?.category,
      verificationStatus: filter?.verificationStatus,
      onlyPublished: false,
    });
  }

  async getJobById(id: string): Promise<JobCircularRecord | null> {
    return this.repo.getJobById(id);
  }

  /**
   * Creates a new job circular in `pending_verification` status.
   * Note: EDITOR_ADMIN can create drafts (`pending_verification`), but cannot directly create a `published` job.
   */
  async createJobDraft(
    actor: AuthenticatedAdminContext | null,
    rawInput: CreateJobCircularInput & {
      categoryId?: string | null;
      sourceId?: string | null;
    }
  ): Promise<JobCircularRecord> {
    const admin = assertAdminPermission(actor, "jobs:create");
    const parsed = createJobCircularSchema.parse(rawInput);

    const fingerprint = computeCanonicalJobFingerprint({
      organizationId: parsed.organizationId,
      titleEn: parsed.titleEn,
      applicationDeadlineAt: parsed.applicationDeadlineAt,
      vacancyCount: parsed.vacancyCount ?? null,
    });

    const existingDuplicate = await this.repo.getJobByFingerprint(fingerprint);
    if (existingDuplicate) {
      throw new Error(
        `DUPLICATE_JOB_DETECTED: A job circular with canonical fingerprint '${fingerprint}' already exists (id: ${existingDuplicate.id}).`
      );
    }

    const baseSlug = generateSlug(parsed.titleEn);
    const uniqueSlug = `${baseSlug}-${fingerprint.slice(0, 8)}`;

    const created = await this.repo.createJob({
      slug: uniqueSlug,
      title_en: parsed.titleEn,
      title_bn: parsed.titleBn ?? null,
      organization_id: parsed.organizationId,
      source_id: rawInput.sourceId ?? null,
      category: parsed.category,
      category_id: rawInput.categoryId ?? null,
      vacancy_count: parsed.vacancyCount ?? null,
      salary_range_text: parsed.salaryRangeText ?? null,
      educational_requirements: parsed.educationalRequirements ?? null,
      experience_requirements: parsed.experienceRequirements ?? null,
      age_limit_text: parsed.ageLimitText ?? null,
      application_fee_text: parsed.applicationFeeText ?? null,
      application_url: parsed.applicationUrl ?? null,
      official_source_url: parsed.officialSourceUrl,
      published_on_source_at: null,
      application_start_at: parsed.applicationStartAt ?? null,
      application_deadline_at: parsed.applicationDeadlineAt,
      verification_status: "pending_verification",
      ai_confidence_score: null,
      canonical_fingerprint: fingerprint,
      auto_published: false,
      is_featured: false,
      created_by_admin_id: admin.adminId,
      verified_by_admin_id: null,
      verified_at: null,
      published_at: null,
    });

    await recordAdminAuditLog(this.repo, {
      actorAdminId: admin.adminId,
      actorRole: admin.canonicalRole,
      action: "job.create_draft",
      resource: "jobs",
      entityId: created.id,
      previousState: null,
      newState: created as unknown as Record<string, unknown>,
    });

    return created;
  }

  /**
   * Updates editable job fields. Enforces that EDITOR_ADMIN cannot publish or edit a job into a published state.
   */
  async updateJobContent(
    actor: AuthenticatedAdminContext | null,
    jobId: string,
    rawPatch: UpdateJobCircularInput,
    targetStatus?: JobVerificationStatus
  ): Promise<JobCircularRecord> {
    const admin = targetStatus
      ? assertJobTransitionAllowed(actor, targetStatus)
      : assertAdminPermission(actor, "jobs:edit");

    const patch = updateJobCircularSchema.parse(rawPatch);
    const existing = await this.repo.getJobById(jobId);
    if (!existing) {
      throw new Error(`Job circular '${jobId}' not found.`);
    }

    // EDITOR_ADMIN cannot modify an already published job without demoting it to pending_verification
    const nextStatus =
      targetStatus ??
      (admin.canonicalRole === "EDITOR_ADMIN" &&
      existing.verification_status === "published"
        ? "pending_verification"
        : existing.verification_status);

    assertJobTransitionAllowed(actor, nextStatus);

    const updated = await this.repo.updateJob(jobId, {
      ...(patch.titleEn !== undefined ? { title_en: patch.titleEn } : {}),
      ...(patch.titleBn !== undefined ? { title_bn: patch.titleBn } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.vacancyCount !== undefined
        ? { vacancy_count: patch.vacancyCount }
        : {}),
      ...(patch.salaryRangeText !== undefined
        ? { salary_range_text: patch.salaryRangeText }
        : {}),
      ...(patch.educationalRequirements !== undefined
        ? { educational_requirements: patch.educationalRequirements }
        : {}),
      ...(patch.experienceRequirements !== undefined
        ? { experience_requirements: patch.experienceRequirements }
        : {}),
      ...(patch.ageLimitText !== undefined
        ? { age_limit_text: patch.ageLimitText }
        : {}),
      ...(patch.applicationFeeText !== undefined
        ? { application_fee_text: patch.applicationFeeText }
        : {}),
      ...(patch.applicationUrl !== undefined
        ? { application_url: patch.applicationUrl }
        : {}),
      ...(patch.officialSourceUrl !== undefined
        ? { official_source_url: patch.officialSourceUrl }
        : {}),
      ...(patch.applicationStartAt !== undefined
        ? { application_start_at: patch.applicationStartAt }
        : {}),
      ...(patch.applicationDeadlineAt !== undefined
        ? { application_deadline_at: patch.applicationDeadlineAt }
        : {}),
      ...(patch.isFeatured !== undefined
        ? { is_featured: patch.isFeatured }
        : {}),
      verification_status: nextStatus,
      ...(nextStatus === "published" && !existing.published_at
        ? { published_at: new Date().toISOString() }
        : {}),
    });

    await recordAdminAuditLog(this.repo, {
      actorAdminId: admin.adminId,
      actorRole: admin.canonicalRole,
      action: "job.update_content",
      resource: "jobs",
      entityId: jobId,
      previousState: existing as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  /**
   * Soft-deletes a job circular. Restricted strictly to SUPER_ADMIN (`jobs:delete`).
   */
  async softDeleteJob(
    actor: AuthenticatedAdminContext | null,
    jobId: string
  ): Promise<JobCircularRecord> {
    const admin = assertAdminPermission(actor, "jobs:delete");
    const existing = await this.repo.getJobById(jobId);
    if (!existing) {
      throw new Error(`Job circular '${jobId}' not found.`);
    }

    const deleted = await this.repo.updateJob(jobId, {
      deleted_at: new Date().toISOString(),
    });

    await recordAdminAuditLog(this.repo, {
      actorAdminId: admin.adminId,
      actorRole: admin.canonicalRole,
      action: "job.soft_delete",
      resource: "jobs",
      entityId: jobId,
      previousState: existing as unknown as Record<string, unknown>,
      newState: deleted as unknown as Record<string, unknown>,
    });

    return deleted;
  }
}
