import type {
  AdminProfile,
  AuditLogRecord,
  DuplicateReportRecord,
  JobCategoryRecord,
  JobCircularRecord,
  JobSourceRecord,
  JobVerificationRecord,
  OfficialNoticeAsset,
  Organization,
  SourceScanRecord,
} from "@/types/database.types";
import type { AuditLogWriter } from "@/lib/security/audit";

export interface DatabaseRepository extends AuditLogWriter {
  // Categories
  listCategories(includeInactive?: boolean): Promise<JobCategoryRecord[]>;
  getCategoryById(id: string): Promise<JobCategoryRecord | null>;
  createCategory(
    data: Omit<
      JobCategoryRecord,
      "id" | "deleted_at" | "created_at" | "updated_at"
    >
  ): Promise<JobCategoryRecord>;
  updateCategory(
    id: string,
    patch: Partial<
      Omit<JobCategoryRecord, "id" | "created_at" | "updated_at">
    >
  ): Promise<JobCategoryRecord>;

  // Organizations
  listOrganizations(): Promise<Organization[]>;
  getOrganizationById(id: string): Promise<Organization | null>;
  createOrganization(
    data: Omit<Organization, "id" | "deleted_at" | "created_at" | "updated_at">
  ): Promise<Organization>;
  updateOrganization(
    id: string,
    patch: Partial<Omit<Organization, "id" | "created_at" | "updated_at">>
  ): Promise<Organization>;

  // Sources
  listJobSources(): Promise<JobSourceRecord[]>;
  getJobSourceById(id: string): Promise<JobSourceRecord | null>;
  createJobSource(
    data: Omit<
      JobSourceRecord,
      | "id"
      | "failure_count"
      | "last_error_message"
      | "last_polled_at"
      | "deleted_at"
      | "created_at"
      | "updated_at"
    >
  ): Promise<JobSourceRecord>;
  updateJobSource(
    id: string,
    patch: Partial<Omit<JobSourceRecord, "id" | "created_at" | "updated_at">>
  ): Promise<JobSourceRecord>;
  createSourceScan(
    data: Omit<SourceScanRecord, "id" | "created_at">
  ): Promise<SourceScanRecord>;

  // Jobs
  listJobs(filter?: {
    category?: string;
    verificationStatus?: string;
    onlyPublished?: boolean;
  }): Promise<JobCircularRecord[]>;
  getJobById(id: string): Promise<JobCircularRecord | null>;
  getJobByFingerprint(fingerprint: string): Promise<JobCircularRecord | null>;
  createJob(
    data: Omit<
      JobCircularRecord,
      "id" | "views_count" | "deleted_at" | "created_at" | "updated_at"
    >
  ): Promise<JobCircularRecord>;
  updateJob(
    id: string,
    patch: Partial<Omit<JobCircularRecord, "id" | "created_at" | "updated_at">>
  ): Promise<JobCircularRecord>;

  // Notices
  listNoticesByJobId(jobId: string): Promise<OfficialNoticeAsset[]>;
  getNoticeById(id: string): Promise<OfficialNoticeAsset | null>;
  getNoticeBySha256(fileSha256: string): Promise<OfficialNoticeAsset | null>;
  createNotice(
    data: Omit<
      OfficialNoticeAsset,
      "id" | "deleted_at" | "created_at" | "updated_at"
    >
  ): Promise<OfficialNoticeAsset>;
  updateNotice(
    id: string,
    patch: Partial<
      Omit<OfficialNoticeAsset, "id" | "created_at" | "updated_at">
    >
  ): Promise<OfficialNoticeAsset>;

  // Verifications & Duplicates
  listVerificationsByJobId(jobId: string): Promise<JobVerificationRecord[]>;
  createJobVerification(
    data: Omit<JobVerificationRecord, "id" | "created_at">
  ): Promise<JobVerificationRecord>;
  createDuplicateReport(
    data: Omit<DuplicateReportRecord, "id" | "detected_at">
  ): Promise<DuplicateReportRecord>;

  // Admins & Audit Logs
  listAdminProfiles(): Promise<AdminProfile[]>;
  getAdminProfileById(id: string): Promise<AdminProfile | null>;
  createAdminProfile(
    data: Omit<AdminProfile, "deleted_at" | "created_at" | "updated_at">
  ): Promise<AdminProfile>;
  updateAdminProfile(
    id: string,
    patch: Partial<Omit<AdminProfile, "id" | "created_at" | "updated_at">>
  ): Promise<AdminProfile>;
  listAuditLogs(limit?: number): Promise<AuditLogRecord[]>;
}
