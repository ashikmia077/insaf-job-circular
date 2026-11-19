import { z } from "zod";
import type { DatabaseRepository } from "@/services/database/repository.types";
import {
  type AuthenticatedAdminContext,
  assertAdminPermission,
} from "@/lib/security/rbac";
import { recordAdminAuditLog } from "@/lib/security/audit";
import { officialNoticeSchema } from "@/features/notices";
import type { OfficialNoticeAsset } from "@/types/database.types";

export const attachNoticeInputSchema = officialNoticeSchema.extend({
  fileName: z.string().trim().min(1).max(240).nullable().optional(),
  mimeType: z
    .enum(["application/pdf", "image/jpeg", "image/png", "image/webp"])
    .nullable()
    .optional(),
  fileSizeBytes: z.number().int().positive().max(25 * 1024 * 1024).nullable().optional(),
});

export type AttachNoticeInput = z.infer<typeof attachNoticeInputSchema>;

export class NoticesService {
  constructor(private readonly repo: DatabaseRepository) {}

  async listNoticesForJob(jobId: string): Promise<OfficialNoticeAsset[]> {
    return this.repo.listNoticesByJobId(jobId);
  }

  /**
   * Attaches a PDF or image notice to a job circular and enforces SHA-256 deduplication.
   */
  async attachNotice(
    actor: AuthenticatedAdminContext | null,
    rawInput: AttachNoticeInput
  ): Promise<OfficialNoticeAsset> {
    const admin = assertAdminPermission(actor, "notices:upload");
    const input = attachNoticeInputSchema.parse(rawInput);

    const existingHash = await this.repo.getNoticeBySha256(
      input.fileSha256.toLowerCase()
    );
    if (existingHash) {
      throw new Error(
        `DUPLICATE_NOTICE_SHA256: Notice with SHA-256 '${input.fileSha256}' already exists on job '${existingHash.job_id}'.`
      );
    }

    const created = await this.repo.createNotice({
      job_id: input.jobId,
      file_type: input.fileType,
      file_name: input.fileName ?? null,
      mime_type: input.mimeType ?? null,
      file_size_bytes: input.fileSizeBytes ?? null,
      storage_bucket: input.storageBucket,
      storage_path: input.storagePath,
      file_sha256: input.fileSha256.toLowerCase(),
      page_count: input.pageCount,
      ocr_raw_text: input.ocrRawText ?? null,
      is_primary_notice: input.isPrimaryNotice,
      verified_authentic: false,
      uploaded_by_admin_id: admin.adminId,
      verified_by_admin_id: null,
      verified_at: null,
    });

    await recordAdminAuditLog(this.repo, {
      actorAdminId: admin.adminId,
      actorRole: admin.canonicalRole,
      action: "notice.attach",
      resource: "job_notices",
      entityId: created.id,
      previousState: null,
      newState: created as unknown as Record<string, unknown>,
    });

    return created;
  }

  /**
   * Marks an official notice PDF/image as cryptographically & visually verified.
   * Restricted to VERIFICATION_ADMIN and SUPER_ADMIN (`notices:verify`).
   */
  async verifyNoticeAuthenticity(
    actor: AuthenticatedAdminContext | null,
    noticeId: string,
    verifiedAuthentic: boolean
  ): Promise<OfficialNoticeAsset> {
    const admin = assertAdminPermission(actor, "notices:verify");
    const existing = await this.repo.getNoticeById(noticeId);
    if (!existing) {
      throw new Error(`Notice '${noticeId}' not found.`);
    }

    const updated = await this.repo.updateNotice(noticeId, {
      verified_authentic: verifiedAuthentic,
      verified_by_admin_id: verifiedAuthentic ? admin.adminId : null,
      verified_at: verifiedAuthentic ? new Date().toISOString() : null,
    });

    await recordAdminAuditLog(this.repo, {
      actorAdminId: admin.adminId,
      actorRole: admin.canonicalRole,
      action: "notice.verify_authenticity",
      resource: "job_notices",
      entityId: noticeId,
      previousState: existing as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }
}
