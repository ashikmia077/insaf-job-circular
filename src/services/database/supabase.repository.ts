import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatabaseRepository } from "@/services/database/repository.types";
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

/**
 * Production Supabase PostgreSQL implementation of `DatabaseRepository`.
 * Respects Supabase RLS when instantiated with a user-scoped server client,
 * or executes privileged administrative workflows when instantiated with the service role client.
 */
export class SupabaseDatabaseRepository implements DatabaseRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listCategories(includeInactive = false): Promise<JobCategoryRecord[]> {
    let query = this.client
      .from("job_categories")
      .select("*")
      .is("deleted_at", null)
      .order("display_order", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list categories: ${error.message}`);
    return (data ?? []) as JobCategoryRecord[];
  }

  async getCategoryById(id: string): Promise<JobCategoryRecord | null> {
    const { data, error } = await this.client
      .from("job_categories")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch category: ${error.message}`);
    return (data as JobCategoryRecord | null) ?? null;
  }

  async createCategory(
    payload: Omit<
      JobCategoryRecord,
      "id" | "deleted_at" | "created_at" | "updated_at"
    >
  ): Promise<JobCategoryRecord> {
    const { data, error } = await this.client
      .from("job_categories")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create category: ${error.message}`);
    return data as JobCategoryRecord;
  }

  async updateCategory(
    id: string,
    patch: Partial<Omit<JobCategoryRecord, "id" | "created_at" | "updated_at">>
  ): Promise<JobCategoryRecord> {
    const { data, error } = await this.client
      .from("job_categories")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to update category: ${error.message}`);
    return data as JobCategoryRecord;
  }

  async listOrganizations(): Promise<Organization[]> {
    const { data, error } = await this.client
      .from("organizations")
      .select("*")
      .is("deleted_at", null)
      .order("name_en", { ascending: true });

    if (error)
      throw new Error(`Failed to list organizations: ${error.message}`);
    return (data ?? []) as Organization[];
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    const { data, error } = await this.client
      .from("organizations")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error)
      throw new Error(`Failed to fetch organization: ${error.message}`);
    return (data as Organization | null) ?? null;
  }

  async createOrganization(
    payload: Omit<Organization, "id" | "deleted_at" | "created_at" | "updated_at">
  ): Promise<Organization> {
    const { data, error } = await this.client
      .from("organizations")
      .insert(payload)
      .select("*")
      .single();

    if (error)
      throw new Error(`Failed to create organization: ${error.message}`);
    return data as Organization;
  }

  async updateOrganization(
    id: string,
    patch: Partial<Omit<Organization, "id" | "created_at" | "updated_at">>
  ): Promise<Organization> {
    const { data, error } = await this.client
      .from("organizations")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error)
      throw new Error(`Failed to update organization: ${error.message}`);
    return data as Organization;
  }

  async listJobSources(): Promise<JobSourceRecord[]> {
    const { data, error } = await this.client
      .from("job_sources")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to list job sources: ${error.message}`);
    return (data ?? []) as JobSourceRecord[];
  }

  async getJobSourceById(id: string): Promise<JobSourceRecord | null> {
    const { data, error } = await this.client
      .from("job_sources")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch job source: ${error.message}`);
    return (data as JobSourceRecord | null) ?? null;
  }

  async createJobSource(
    payload: Omit<
      JobSourceRecord,
      | "id"
      | "failure_count"
      | "last_error_message"
      | "last_polled_at"
      | "deleted_at"
      | "created_at"
      | "updated_at"
    >
  ): Promise<JobSourceRecord> {
    const { data, error } = await this.client
      .from("job_sources")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create job source: ${error.message}`);
    return data as JobSourceRecord;
  }

  async updateJobSource(
    id: string,
    patch: Partial<Omit<JobSourceRecord, "id" | "created_at" | "updated_at">>
  ): Promise<JobSourceRecord> {
    const { data, error } = await this.client
      .from("job_sources")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to update job source: ${error.message}`);
    return data as JobSourceRecord;
  }

  async createSourceScan(
    payload: Omit<SourceScanRecord, "id" | "created_at">
  ): Promise<SourceScanRecord> {
    const { data, error } = await this.client
      .from("source_scans")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create source scan: ${error.message}`);
    return data as SourceScanRecord;
  }

  async listJobs(filter?: {
    category?: string;
    verificationStatus?: string;
    onlyPublished?: boolean;
  }): Promise<JobCircularRecord[]> {
    let query = this.client
      .from("jobs")
      .select("*")
      .is("deleted_at", null)
      .order("application_deadline_at", { ascending: true });

    if (filter?.category) {
      query = query.eq("category", filter.category);
    }
    if (filter?.onlyPublished) {
      query = query.eq("verification_status", "published");
    } else if (filter?.verificationStatus) {
      query = query.eq("verification_status", filter.verificationStatus);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list jobs: ${error.message}`);
    return (data ?? []) as JobCircularRecord[];
  }

  async getJobById(id: string): Promise<JobCircularRecord | null> {
    const { data, error } = await this.client
      .from("jobs")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch job: ${error.message}`);
    return (data as JobCircularRecord | null) ?? null;
  }

  async getJobByFingerprint(
    fingerprint: string
  ): Promise<JobCircularRecord | null> {
    const { data, error } = await this.client
      .from("jobs")
      .select("*")
      .eq("canonical_fingerprint", fingerprint)
      .is("deleted_at", null)
      .maybeSingle();

    if (error)
      throw new Error(`Failed to fetch job by fingerprint: ${error.message}`);
    return (data as JobCircularRecord | null) ?? null;
  }

  async createJob(
    payload: Omit<
      JobCircularRecord,
      "id" | "views_count" | "deleted_at" | "created_at" | "updated_at"
    >
  ): Promise<JobCircularRecord> {
    const { data, error } = await this.client
      .from("jobs")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create job: ${error.message}`);
    return data as JobCircularRecord;
  }

  async updateJob(
    id: string,
    patch: Partial<Omit<JobCircularRecord, "id" | "created_at" | "updated_at">>
  ): Promise<JobCircularRecord> {
    const { data, error } = await this.client
      .from("jobs")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to update job: ${error.message}`);
    return data as JobCircularRecord;
  }

  async listNoticesByJobId(jobId: string): Promise<OfficialNoticeAsset[]> {
    const { data, error } = await this.client
      .from("job_notices")
      .select("*")
      .eq("job_id", jobId)
      .is("deleted_at", null)
      .order("is_primary_notice", { ascending: false });

    if (error) throw new Error(`Failed to list notices: ${error.message}`);
    return (data ?? []) as OfficialNoticeAsset[];
  }

  async getNoticeById(id: string): Promise<OfficialNoticeAsset | null> {
    const { data, error } = await this.client
      .from("job_notices")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch notice: ${error.message}`);
    return (data as OfficialNoticeAsset | null) ?? null;
  }

  async getNoticeBySha256(
    fileSha256: string
  ): Promise<OfficialNoticeAsset | null> {
    const { data, error } = await this.client
      .from("job_notices")
      .select("*")
      .eq("file_sha256", fileSha256)
      .is("deleted_at", null)
      .maybeSingle();

    if (error)
      throw new Error(`Failed to fetch notice by SHA-256: ${error.message}`);
    return (data as OfficialNoticeAsset | null) ?? null;
  }

  async createNotice(
    payload: Omit<
      OfficialNoticeAsset,
      "id" | "deleted_at" | "created_at" | "updated_at"
    >
  ): Promise<OfficialNoticeAsset> {
    const { data, error } = await this.client
      .from("job_notices")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create notice: ${error.message}`);
    return data as OfficialNoticeAsset;
  }

  async updateNotice(
    id: string,
    patch: Partial<
      Omit<OfficialNoticeAsset, "id" | "created_at" | "updated_at">
    >
  ): Promise<OfficialNoticeAsset> {
    const { data, error } = await this.client
      .from("job_notices")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to update notice: ${error.message}`);
    return data as OfficialNoticeAsset;
  }

  async listVerificationsByJobId(
    jobId: string
  ): Promise<JobVerificationRecord[]> {
    const { data, error } = await this.client
      .from("job_verifications")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });

    if (error)
      throw new Error(`Failed to list verifications: ${error.message}`);
    return (data ?? []) as JobVerificationRecord[];
  }

  async createJobVerification(
    payload: Omit<JobVerificationRecord, "id" | "created_at">
  ): Promise<JobVerificationRecord> {
    const { data, error } = await this.client
      .from("job_verifications")
      .insert(payload)
      .select("*")
      .single();

    if (error)
      throw new Error(`Failed to create job verification: ${error.message}`);
    return data as JobVerificationRecord;
  }

  async createDuplicateReport(
    payload: Omit<DuplicateReportRecord, "id" | "detected_at">
  ): Promise<DuplicateReportRecord> {
    const { data, error } = await this.client
      .from("duplicate_reports")
      .insert(payload)
      .select("*")
      .single();

    if (error)
      throw new Error(`Failed to create duplicate report: ${error.message}`);
    return data as DuplicateReportRecord;
  }

  async listAdminProfiles(): Promise<AdminProfile[]> {
    const { data, error } = await this.client
      .from("admin_profiles")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) throw new Error(`Failed to list admins: ${error.message}`);
    return (data ?? []) as AdminProfile[];
  }

  async getAdminProfileById(id: string): Promise<AdminProfile | null> {
    const { data, error } = await this.client
      .from("admin_profiles")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error)
      throw new Error(`Failed to fetch admin profile: ${error.message}`);
    return (data as AdminProfile | null) ?? null;
  }

  async createAdminProfile(
    payload: Omit<AdminProfile, "deleted_at" | "created_at" | "updated_at">
  ): Promise<AdminProfile> {
    const { data, error } = await this.client
      .from("admin_profiles")
      .insert(payload)
      .select("*")
      .single();

    if (error)
      throw new Error(`Failed to create admin profile: ${error.message}`);
    return data as AdminProfile;
  }

  async updateAdminProfile(
    id: string,
    patch: Partial<Omit<AdminProfile, "id" | "created_at" | "updated_at">>
  ): Promise<AdminProfile> {
    const { data, error } = await this.client
      .from("admin_profiles")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error)
      throw new Error(`Failed to update admin profile: ${error.message}`);
    return data as AdminProfile;
  }

  async insertAuditLog(
    entry: Omit<AuditLogRecord, "id" | "created_at">
  ): Promise<AuditLogRecord> {
    const { data, error } = await this.client
      .from("audit_logs")
      .insert(entry)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to insert audit log: ${error.message}`);
    return data as AuditLogRecord;
  }

  async listAuditLogs(limit = 100): Promise<AuditLogRecord[]> {
    const { data, error } = await this.client
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to list audit logs: ${error.message}`);
    return (data ?? []) as AuditLogRecord[];
  }
}
