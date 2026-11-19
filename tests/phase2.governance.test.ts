import fs from "fs";
import path from "path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import {
  normalizeAdminRole,
  roleHasPermission,
} from "@/config/permissions.config";
import {
  AuthorizationError,
  type AuthenticatedAdminContext,
  assertActiveAdmin,
  assertAdminPermission,
  assertJobTransitionAllowed,
} from "@/lib/security/rbac";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  adminLoginSchema,
  passwordResetRequestSchema,
  passwordUpdateSchema,
} from "@/features/admin";
import type { DatabaseRepository } from "@/services/database/repository.types";
import { CategoriesService } from "@/services/categories/categories.service";
import { OrganizationsService } from "@/services/organizations/organizations.service";
import { SourcesService } from "@/services/sources/sources.service";
import { JobsService } from "@/services/jobs/jobs.service";
import { NoticesService } from "@/services/notices/notices.service";
import { VerificationService } from "@/services/verification/verification.service";
import { AdminsService } from "@/services/admins/admins.service";
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

const REQUIRED_PHASE2_TABLES = [
  "jobs",
  "job_categories",
  "organizations",
  "job_sources",
  "job_source_links",
  "job_notices",
  "job_verifications",
  "job_updates",
  "duplicate_reports",
  "admin_profiles",
  "profiles",
  "saved_jobs",
  "notifications",
  "push_subscriptions",
  "source_scans",
  "insaf_ad_campaigns",
  "analytics_events",
  "visitor_sessions",
  "reports",
  "audit_logs",
] as const;

const SUPER_ADMIN_CTX: AuthenticatedAdminContext = {
  adminId: "11111111-1111-4111-8111-111111111111",
  email: "super@insafjobcircular.com",
  fullName: "Super Admin",
  role: "SUPER_ADMIN",
  isActive: true,
};

const EDITOR_ADMIN_CTX: AuthenticatedAdminContext = {
  adminId: "22222222-2222-4222-8222-222222222222",
  email: "editor@insafjobcircular.com",
  fullName: "Editor Admin",
  role: "EDITOR_ADMIN",
  isActive: true,
};

const VERIFICATION_ADMIN_CTX: AuthenticatedAdminContext = {
  adminId: "33333333-3333-4333-8333-333333333333",
  email: "verifier@insafjobcircular.com",
  fullName: "Verification Admin",
  role: "VERIFICATION_ADMIN",
  isActive: true,
};

/**
 * In-memory PostgreSQL-backed repository for deterministic service-layer CRUD + Audit tests
 */
class InMemoryTestRepository implements DatabaseRepository {
  public categories: JobCategoryRecord[] = [];
  public organizations: Organization[] = [];
  public sources: JobSourceRecord[] = [];
  public scans: SourceScanRecord[] = [];
  public jobs: JobCircularRecord[] = [];
  public notices: OfficialNoticeAsset[] = [];
  public verifications: JobVerificationRecord[] = [];
  public duplicates: DuplicateReportRecord[] = [];
  public admins: AdminProfile[] = [
    {
      id: SUPER_ADMIN_CTX.adminId,
      email: SUPER_ADMIN_CTX.email,
      full_name: "Super Admin",
      role: "super_admin",
      is_active: true,
      created_by_admin_id: null,
      last_active_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: EDITOR_ADMIN_CTX.adminId,
      email: EDITOR_ADMIN_CTX.email,
      full_name: "Editor Admin",
      role: "editor_admin",
      is_active: true,
      created_by_admin_id: SUPER_ADMIN_CTX.adminId,
      last_active_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: VERIFICATION_ADMIN_CTX.adminId,
      email: VERIFICATION_ADMIN_CTX.email,
      full_name: "Verification Admin",
      role: "verification_admin",
      is_active: true,
      created_by_admin_id: SUPER_ADMIN_CTX.adminId,
      last_active_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  public auditLogs: AuditLogRecord[] = [];

  async listCategories(includeInactive = false): Promise<JobCategoryRecord[]> {
    return this.categories.filter(
      (c) => !c.deleted_at && (includeInactive || c.is_active)
    );
  }
  async getCategoryById(id: string): Promise<JobCategoryRecord | null> {
    return this.categories.find((c) => c.id === id && !c.deleted_at) ?? null;
  }
  async createCategory(
    data: Omit<
      JobCategoryRecord,
      "id" | "deleted_at" | "created_at" | "updated_at"
    >
  ): Promise<JobCategoryRecord> {
    const now = new Date().toISOString();
    const record: JobCategoryRecord = {
      ...data,
      id: crypto.randomUUID(),
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };
    this.categories.push(record);
    return record;
  }
  async updateCategory(
    id: string,
    patch: Partial<Omit<JobCategoryRecord, "id" | "created_at" | "updated_at">>
  ): Promise<JobCategoryRecord> {
    const idx = this.categories.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Category not found");
    const updated: JobCategoryRecord = {
      ...this.categories[idx]!,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.categories[idx] = updated;
    return updated;
  }

  async listOrganizations(): Promise<Organization[]> {
    return this.organizations.filter((o) => !o.deleted_at);
  }
  async getOrganizationById(id: string): Promise<Organization | null> {
    return this.organizations.find((o) => o.id === id && !o.deleted_at) ?? null;
  }
  async createOrganization(
    data: Omit<Organization, "id" | "deleted_at" | "created_at" | "updated_at">
  ): Promise<Organization> {
    const now = new Date().toISOString();
    const record: Organization = {
      ...data,
      id: crypto.randomUUID(),
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };
    this.organizations.push(record);
    return record;
  }
  async updateOrganization(
    id: string,
    patch: Partial<Omit<Organization, "id" | "created_at" | "updated_at">>
  ): Promise<Organization> {
    const idx = this.organizations.findIndex((o) => o.id === id);
    if (idx === -1) throw new Error("Organization not found");
    const updated: Organization = {
      ...this.organizations[idx]!,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.organizations[idx] = updated;
    return updated;
  }

  async listJobSources(): Promise<JobSourceRecord[]> {
    return this.sources.filter((s) => !s.deleted_at);
  }
  async getJobSourceById(id: string): Promise<JobSourceRecord | null> {
    return this.sources.find((s) => s.id === id && !s.deleted_at) ?? null;
  }
  async createJobSource(
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
  ): Promise<JobSourceRecord> {
    const now = new Date().toISOString();
    const record: JobSourceRecord = {
      ...data,
      id: crypto.randomUUID(),
      failure_count: 0,
      last_error_message: null,
      last_polled_at: null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };
    this.sources.push(record);
    return record;
  }
  async updateJobSource(
    id: string,
    patch: Partial<Omit<JobSourceRecord, "id" | "created_at" | "updated_at">>
  ): Promise<JobSourceRecord> {
    const idx = this.sources.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("Source not found");
    const updated: JobSourceRecord = {
      ...this.sources[idx]!,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.sources[idx] = updated;
    return updated;
  }
  async createSourceScan(
    data: Omit<SourceScanRecord, "id" | "created_at">
  ): Promise<SourceScanRecord> {
    const record: SourceScanRecord = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.scans.push(record);
    return record;
  }

  async listJobs(filter?: {
    category?: string;
    verificationStatus?: string;
    onlyPublished?: boolean;
  }): Promise<JobCircularRecord[]> {
    return this.jobs.filter((j) => {
      if (j.deleted_at) return false;
      if (filter?.category && j.category !== filter.category) return false;
      if (filter?.onlyPublished && j.verification_status !== "published")
        return false;
      if (
        filter?.verificationStatus &&
        j.verification_status !== filter.verificationStatus
      )
        return false;
      return true;
    });
  }
  async getJobById(id: string): Promise<JobCircularRecord | null> {
    return this.jobs.find((j) => j.id === id && !j.deleted_at) ?? null;
  }
  async getJobByFingerprint(
    fingerprint: string
  ): Promise<JobCircularRecord | null> {
    return (
      this.jobs.find(
        (j) => j.canonical_fingerprint === fingerprint && !j.deleted_at
      ) ?? null
    );
  }
  async createJob(
    data: Omit<
      JobCircularRecord,
      "id" | "views_count" | "deleted_at" | "created_at" | "updated_at"
    >
  ): Promise<JobCircularRecord> {
    const now = new Date().toISOString();
    const record: JobCircularRecord = {
      ...data,
      id: crypto.randomUUID(),
      views_count: 0,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };
    this.jobs.push(record);
    return record;
  }
  async updateJob(
    id: string,
    patch: Partial<Omit<JobCircularRecord, "id" | "created_at" | "updated_at">>
  ): Promise<JobCircularRecord> {
    const idx = this.jobs.findIndex((j) => j.id === id);
    if (idx === -1) throw new Error("Job not found");
    const updated: JobCircularRecord = {
      ...this.jobs[idx]!,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.jobs[idx] = updated;
    return updated;
  }

  async listNoticesByJobId(jobId: string): Promise<OfficialNoticeAsset[]> {
    return this.notices.filter((n) => n.job_id === jobId && !n.deleted_at);
  }
  async getNoticeById(id: string): Promise<OfficialNoticeAsset | null> {
    return this.notices.find((n) => n.id === id && !n.deleted_at) ?? null;
  }
  async getNoticeBySha256(
    fileSha256: string
  ): Promise<OfficialNoticeAsset | null> {
    return (
      this.notices.find(
        (n) => n.file_sha256 === fileSha256 && !n.deleted_at
      ) ?? null
    );
  }
  async createNotice(
    data: Omit<
      OfficialNoticeAsset,
      "id" | "deleted_at" | "created_at" | "updated_at"
    >
  ): Promise<OfficialNoticeAsset> {
    const now = new Date().toISOString();
    const record: OfficialNoticeAsset = {
      ...data,
      id: crypto.randomUUID(),
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };
    this.notices.push(record);
    return record;
  }
  async updateNotice(
    id: string,
    patch: Partial<
      Omit<OfficialNoticeAsset, "id" | "created_at" | "updated_at">
    >
  ): Promise<OfficialNoticeAsset> {
    const idx = this.notices.findIndex((n) => n.id === id);
    if (idx === -1) throw new Error("Notice not found");
    const updated: OfficialNoticeAsset = {
      ...this.notices[idx]!,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.notices[idx] = updated;
    return updated;
  }

  async listVerificationsByJobId(
    jobId: string
  ): Promise<JobVerificationRecord[]> {
    return this.verifications.filter((v) => v.job_id === jobId);
  }
  async createJobVerification(
    data: Omit<JobVerificationRecord, "id" | "created_at">
  ): Promise<JobVerificationRecord> {
    const record: JobVerificationRecord = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.verifications.push(record);
    return record;
  }
  async createDuplicateReport(
    data: Omit<DuplicateReportRecord, "id" | "detected_at">
  ): Promise<DuplicateReportRecord> {
    const record: DuplicateReportRecord = {
      ...data,
      id: crypto.randomUUID(),
      detected_at: new Date().toISOString(),
    };
    this.duplicates.push(record);
    return record;
  }

  async listAdminProfiles(): Promise<AdminProfile[]> {
    return this.admins.filter((a) => !a.deleted_at);
  }
  async getAdminProfileById(id: string): Promise<AdminProfile | null> {
    return this.admins.find((a) => a.id === id && !a.deleted_at) ?? null;
  }
  async createAdminProfile(
    data: Omit<AdminProfile, "deleted_at" | "created_at" | "updated_at">
  ): Promise<AdminProfile> {
    const now = new Date().toISOString();
    const record: AdminProfile = {
      ...data,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };
    this.admins.push(record);
    return record;
  }
  async updateAdminProfile(
    id: string,
    patch: Partial<Omit<AdminProfile, "id" | "created_at" | "updated_at">>
  ): Promise<AdminProfile> {
    const idx = this.admins.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("Admin not found");
    const updated: AdminProfile = {
      ...this.admins[idx]!,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    this.admins[idx] = updated;
    return updated;
  }

  async insertAuditLog(
    entry: Omit<AuditLogRecord, "id" | "created_at">
  ): Promise<AuditLogRecord> {
    const record: AuditLogRecord = {
      ...entry,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.auditLogs.push(record);
    return record;
  }
  async listAuditLogs(limit = 100): Promise<AuditLogRecord[]> {
    return this.auditLogs.slice(-limit).reverse();
  }
}

describe("Phase 2 — Database Migrations, RLS, Auth, RBAC & Service Layer", () => {
  let pg: PGlite;

  beforeAll(async () => {
    pg = new PGlite({
      extensions: {
        pg_trgm,
      },
    });

    // Bootstrap Supabase-compatible auth schema and roles for embedded PostgreSQL verification
    await pg.exec(`
      DO $$ BEGIN
        CREATE ROLE anon NOLOGIN;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE ROLE authenticated NOLOGIN;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY,
        email TEXT UNIQUE
      );

      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID
      LANGUAGE sql
      STABLE
      AS $fn$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
      $fn$;

      GRANT USAGE ON SCHEMA public TO anon, authenticated;
      GRANT USAGE ON SCHEMA auth TO anon, authenticated;
      GRANT SELECT ON auth.users TO anon, authenticated;
    `);

    const migrationsDir = path.resolve(__dirname, "../database/migrations");
    const migrationFiles = [
      "0001_initial_enums_and_extensions.sql",
      "0002_core_tables.sql",
      "0003_rls_policies_and_indexes.sql",
      "0004_phase2_schema_extensions_and_tables.sql",
      "0005_phase2_rls_triggers_and_audit_protection.sql",
    ];

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      // PGlite natively provides gen_random_uuid() in pg_catalog; strip `CREATE EXTENSION IF NOT EXISTS "pgcrypto";` if pgcrypto contrib isn't loaded
      const sanitizedSql = sql.replace(
        /CREATE EXTENSION IF NOT EXISTS "pgcrypto";/g,
        "-- pgcrypto gen_random_uuid provided natively in PG 16"
      );
      await pg.exec(sanitizedSql);
    }

    await pg.exec(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
    `);
  });

  it("executes all 5 SQL migrations cleanly and creates all 20 required tables with RLS enabled", async () => {
    const res = await pg.query<{ tablename: string; rowsecurity: boolean }>(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
    `);

    const tableMap = new Map(
      res.rows.map((r) => [r.tablename, r.rowsecurity])
    );

    for (const tableName of REQUIRED_PHASE2_TABLES) {
      expect(
        tableMap.has(tableName),
        `Expected table public.${tableName} to exist`
      ).toBe(true);
      expect(
        tableMap.get(tableName),
        `Expected RLS (rowsecurity) to be enabled on public.${tableName}`
      ).toBe(true);
    }

    // Verify seeded 7 Bangladesh job categories
    const catCount = await pg.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count FROM public.job_categories WHERE is_active = TRUE`
    );
    expect(Number(catCount.rows[0]?.count)).toBe(7);
  });

  it("enforces database-level RLS policies, immutable audit_logs trigger, and EDITOR_ADMIN publish restrictions in PostgreSQL", async () => {
    // Seed users in auth.users and admin_profiles
    await pg.exec(`
      INSERT INTO auth.users (id, email) VALUES
        ('${SUPER_ADMIN_CTX.adminId}', '${SUPER_ADMIN_CTX.email}'),
        ('${EDITOR_ADMIN_CTX.adminId}', '${EDITOR_ADMIN_CTX.email}'),
        ('${VERIFICATION_ADMIN_CTX.adminId}', '${VERIFICATION_ADMIN_CTX.email}');

      INSERT INTO public.admin_profiles (id, email, full_name, role, is_active) VALUES
        ('${SUPER_ADMIN_CTX.adminId}', '${SUPER_ADMIN_CTX.email}', 'Super Admin', 'SUPER_ADMIN', TRUE),
        ('${EDITOR_ADMIN_CTX.adminId}', '${EDITOR_ADMIN_CTX.email}', 'Editor Admin', 'EDITOR_ADMIN', TRUE),
        ('${VERIFICATION_ADMIN_CTX.adminId}', '${VERIFICATION_ADMIN_CTX.email}', 'Verification Admin', 'VERIFICATION_ADMIN', TRUE);

      INSERT INTO public.organizations (id, name_en, slug, category, official_domain, is_trusted_government_domain)
      VALUES ('44444444-4444-4444-8444-444444444444', 'Bangladesh Public Service Commission', 'bpsc', 'government', 'bpsc.gov.bd', TRUE);
    `);

    // 1. Test immutable audit_logs trigger (UPDATE & DELETE must fail)
    await pg.exec(`
      INSERT INTO public.audit_logs (id, actor_admin_id, actor_role, action, resource, entity_type, entity_id)
      VALUES ('55555555-5555-4555-8555-555555555555', '${SUPER_ADMIN_CTX.adminId}', 'SUPER_ADMIN', 'test.action', 'jobs', 'jobs', 'job-1');
    `);

    await expect(
      pg.exec(`UPDATE public.audit_logs SET action = 'tampered' WHERE id = '55555555-5555-4555-8555-555555555555';`)
    ).rejects.toThrow(/append-only/);

    await expect(
      pg.exec(`DELETE FROM public.audit_logs WHERE id = '55555555-5555-4555-8555-555555555555';`)
    ).rejects.toThrow(/append-only/);

    // 2. Simulate authenticated EDITOR_ADMIN session in PostgreSQL
    await pg.exec(`
      SET LOCAL ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub', '${EDITOR_ADMIN_CTX.adminId}', false);
    `);

    // EDITOR_ADMIN can insert a draft job in pending_verification
    await pg.exec(`
      INSERT INTO public.jobs (
        id, slug, title_en, organization_id, category, official_source_url,
        application_deadline_at, verification_status, canonical_fingerprint
      ) VALUES (
        '66666666-6666-4666-8666-666666666666',
        'bpsc-assistant-engineer',
        'Assistant Engineer (Civil)',
        '44444444-4444-4444-8444-444444444444',
        'government',
        'https://bpsc.gov.bd/notice-1.pdf',
        NOW() + INTERVAL '14 days',
        'pending_verification',
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      );
    `);

    // EDITOR_ADMIN CANNOT publish a job directly in PostgreSQL (blocked by trigger & RLS)
    await expect(
      pg.exec(`
        UPDATE public.jobs
        SET verification_status = 'published'
        WHERE id = '66666666-6666-4666-8666-666666666666';
      `)
    ).rejects.toThrow(/EDITOR_ADMIN cannot independently verify or publish/);

    // EDITOR_ADMIN CANNOT escalate their own role to SUPER_ADMIN in PostgreSQL
    await expect(
      pg.exec(`
        UPDATE public.admin_profiles
        SET role = 'SUPER_ADMIN'
        WHERE id = '${EDITOR_ADMIN_CTX.adminId}';
      `)
    ).rejects.toThrow();

    // 3. Anonymous user (anon) cannot see pending_verification jobs
    await pg.exec(`
      RESET ROLE;
      SELECT set_config('request.jwt.claim.sub', '', false);
      SET ROLE anon;
    `);

    const anonPendingRes = await pg.query(
      `SELECT id FROM public.jobs WHERE id = '66666666-6666-4666-8666-666666666666'`
    );
    expect(anonPendingRes.rows.length).toBe(0);

    // 4. VERIFICATION_ADMIN can approve and publish the job in PostgreSQL
    await pg.exec(`
      RESET ROLE;
      SELECT set_config('request.jwt.claim.sub', '${VERIFICATION_ADMIN_CTX.adminId}', false);
      SET ROLE authenticated;
      UPDATE public.jobs
      SET verification_status = 'published'
      WHERE id = '66666666-6666-4666-8666-666666666666';
    `);

    // 5. Anonymous user CAN now read the published job
    await pg.exec(`
      RESET ROLE;
      SELECT set_config('request.jwt.claim.sub', '', false);
      SET ROLE anon;
    `);
    const anonPublishedRes = await pg.query<{
      id: string;
      published_at: string | null;
    }>(
      `SELECT id, published_at FROM public.jobs WHERE id = '66666666-6666-4666-8666-666666666666'`
    );
    expect(anonPublishedRes.rows.length).toBe(1);
    expect(anonPublishedRes.rows[0]?.published_at).toBeTruthy();

    await pg.exec(`RESET ROLE;`);
  });

  it("validates authentication schemas, rate limits, and unauthorized access guards", async () => {
    // Valid & invalid login inputs
    expect(
      adminLoginSchema.safeParse({
        email: "admin@insafjobcircular.com",
        password: "StrongPassword123",
      }).success
    ).toBe(true);

    expect(
      adminLoginSchema.safeParse({
        email: "not-an-email",
        password: "short",
      }).success
    ).toBe(false);

    // Password reset & complexity check
    expect(
      passwordResetRequestSchema.safeParse({
        email: "verifier@insafjobcircular.com",
      }).success
    ).toBe(true);

    expect(
      passwordUpdateSchema.safeParse({
        password: "SecurePassword99",
        confirmPassword: "SecurePassword99",
      }).success
    ).toBe(true);

    expect(
      passwordUpdateSchema.safeParse({
        password: "alllowercase123",
        confirmPassword: "alllowercase123",
      }).success
    ).toBe(false);

    // Rate limiting check
    const bucketId = `test-auth-rate-limit-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      const r = await checkRateLimit({ identifier: bucketId, limitPerMinute: 3 });
      expect(r.allowed).toBe(true);
    }
    const blocked = await checkRateLimit({
      identifier: bucketId,
      limitPerMinute: 3,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);

    // Unauthorized & deactivated admin access checks
    expect(() => assertActiveAdmin(null)).toThrowError(AuthorizationError);
    expect(() =>
      assertActiveAdmin({
        ...EDITOR_ADMIN_CTX,
        isActive: false,
      })
    ).toThrow(/deactivated/);
  });

  it("enforces exact RBAC permission matrix across SUPER_ADMIN, EDITOR_ADMIN, and VERIFICATION_ADMIN", () => {
    expect(normalizeAdminRole("super_admin")).toBe("SUPER_ADMIN");
    expect(normalizeAdminRole("verifier_admin")).toBe("VERIFICATION_ADMIN");
    expect(normalizeAdminRole("verification_admin")).toBe("VERIFICATION_ADMIN");
    expect(normalizeAdminRole("editor_admin")).toBe("EDITOR_ADMIN");

    // SUPER_ADMIN has full system access
    expect(roleHasPermission("SUPER_ADMIN", "security:manage")).toBe(true);
    expect(roleHasPermission("SUPER_ADMIN", "admins:manage")).toBe(true);
    expect(roleHasPermission("SUPER_ADMIN", "jobs:publish")).toBe(true);
    expect(roleHasPermission("SUPER_ADMIN", "jobs:delete")).toBe(true);

    // EDITOR_ADMIN can manage jobs/notices/categories, CANNOT publish or manage security
    expect(roleHasPermission("EDITOR_ADMIN", "jobs:create")).toBe(true);
    expect(roleHasPermission("EDITOR_ADMIN", "jobs:edit")).toBe(true);
    expect(roleHasPermission("EDITOR_ADMIN", "notices:upload")).toBe(true);
    expect(roleHasPermission("EDITOR_ADMIN", "jobs:publish")).toBe(false);
    expect(roleHasPermission("EDITOR_ADMIN", "verification:approve")).toBe(
      false
    );
    expect(roleHasPermission("EDITOR_ADMIN", "security:manage")).toBe(false);
    expect(roleHasPermission("EDITOR_ADMIN", "admins:manage")).toBe(false);

    // VERIFICATION_ADMIN can verify notices, validate sources, and approve publication
    expect(roleHasPermission("VERIFICATION_ADMIN", "notices:verify")).toBe(true);
    expect(roleHasPermission("VERIFICATION_ADMIN", "sources:validate")).toBe(
      true
    );
    expect(
      roleHasPermission("VERIFICATION_ADMIN", "verification:approve")
    ).toBe(true);
    expect(roleHasPermission("VERIFICATION_ADMIN", "jobs:publish")).toBe(true);
    expect(roleHasPermission("VERIFICATION_ADMIN", "security:manage")).toBe(
      false
    );
    expect(roleHasPermission("VERIFICATION_ADMIN", "admins:manage")).toBe(
      false
    );

    // Transition assertions
    expect(() =>
      assertJobTransitionAllowed(EDITOR_ADMIN_CTX, "published")
    ).toThrow(/EDITOR_ADMIN cannot independently verify/);
    expect(() =>
      assertAdminPermission(VERIFICATION_ADMIN_CTX, "admins:manage")
    ).toThrow(/lacks required permission/);
  });

  it("executes full CRUD, verification workflow, duplicate blocking, and audit logging across all 7 modular services", async () => {
    const repo = new InMemoryTestRepository();
    const categoriesService = new CategoriesService(repo);
    const organizationsService = new OrganizationsService(repo);
    const sourcesService = new SourcesService(repo);
    const jobsService = new JobsService(repo);
    const noticesService = new NoticesService(repo);
    const verificationService = new VerificationService(repo);
    const adminsService = new AdminsService(repo);

    // 1. CategoriesService (EDITOR_ADMIN creates category)
    const category = await categoriesService.createCategory(EDITOR_ADMIN_CTX, {
      categoryEnum: "government",
      nameEn: "Government Jobs",
      nameBn: "সরকারি চাকরি",
      iconName: "Landmark",
      displayOrder: 1,
      isActive: true,
    });
    expect(category.slug).toBe("government-jobs");

    // 2. OrganizationsService (EDITOR_ADMIN creates organization; VERIFICATION_ADMIN verifies it)
    const org = await organizationsService.createOrganization(
      EDITOR_ADMIN_CTX,
      {
        nameEn: "Bangladesh Bank",
        nameBn: "বাংলাদেশ ব্যাংক",
        category: "bank",
        categoryId: category.id,
        officialDomain: "bb.org.bd",
        websiteUrl: "https://erecruitment.bb.org.bd",
      }
    );
    expect(org.is_trusted_government_domain).toBe(true);
    // Created by EDITOR_ADMIN, so is_verified_organization starts false until verified
    expect(org.is_verified_organization).toBe(false);

    const verifiedOrg = await organizationsService.verifyOrganization(
      VERIFICATION_ADMIN_CTX,
      org.id,
      true
    );
    expect(verifiedOrg.is_verified_organization).toBe(true);

    // 3. SourcesService (Only SUPER_ADMIN can create source; VERIFICATION_ADMIN validates & scans)
    await expect(
      sourcesService.createSource(EDITOR_ADMIN_CTX, {
        organizationId: org.id,
        sourceName: "BB Recruitment Portal",
        sourceUrl: "https://erecruitment.bb.org.bd/circulars",
        officialDomain: "bb.org.bd",
        robotsTxtVerified: false,
        isEnabled: true,
        pollIntervalMinutes: 60,
      })
    ).rejects.toThrow(AuthorizationError);

    const source = await sourcesService.createSource(SUPER_ADMIN_CTX, {
      organizationId: org.id,
      sourceName: "BB Recruitment Portal",
      sourceUrl: "https://erecruitment.bb.org.bd/circulars",
      officialDomain: "bb.org.bd",
      robotsTxtVerified: false,
      isEnabled: true,
      pollIntervalMinutes: 60,
    });

    const validatedSource = await sourcesService.validateSourceCompliance(
      VERIFICATION_ADMIN_CTX,
      source.id,
      { robotsTxtVerified: true, isEnabled: true }
    );
    expect(validatedSource.robots_txt_verified).toBe(true);

    const scan = await sourcesService.queueSourceScan(
      VERIFICATION_ADMIN_CTX,
      source.id
    );
    expect(scan.scan_status).toBe("queued");

    // 4. JobsService (EDITOR_ADMIN creates job draft; duplicate creation is blocked)
    const futureDeadline = new Date(
      Date.now() + 10 * 86_400_000
    ).toISOString();
    const jobDraft = await jobsService.createJobDraft(EDITOR_ADMIN_CTX, {
      titleEn: "Assistant Director (General)",
      titleBn: "সহকারী পরিচালক (জেনারেল)",
      organizationId: org.id,
      category: "bank",
      categoryId: category.id,
      sourceId: source.id,
      vacancyCount: 100,
      officialSourceUrl: "https://erecruitment.bb.org.bd/ad-general-2026.pdf",
      applicationDeadlineAt: futureDeadline,
    });
    expect(jobDraft.verification_status).toBe("pending_verification");

    // Attempting to create the same job again triggers DUPLICATE_JOB_DETECTED
    await expect(
      jobsService.createJobDraft(EDITOR_ADMIN_CTX, {
        titleEn: "Assistant Director (General)",
        organizationId: org.id,
        category: "bank",
        vacancyCount: 100,
        officialSourceUrl: "https://erecruitment.bb.org.bd/ad-general-2026.pdf",
        applicationDeadlineAt: futureDeadline,
      })
    ).rejects.toThrow(/DUPLICATE_JOB_DETECTED/);

    // 5. VerificationService: Publishing without an attached notice is blocked
    await expect(
      verificationService.submitVerificationDecision(VERIFICATION_ADMIN_CTX, {
        jobId: jobDraft.id,
        decision: "approve_and_publish",
        domainVerified: true,
        checksumVerified: true,
        notes: "Attempting publish before notice upload",
      })
    ).rejects.toThrow(/PUBLICATION_BLOCKED/);

    // 6. NoticesService: EDITOR_ADMIN attaches notice; VERIFICATION_ADMIN verifies notice authenticity
    const notice = await noticesService.attachNotice(EDITOR_ADMIN_CTX, {
      jobId: jobDraft.id,
      fileType: "pdf",
      fileName: "bb-ad-2026.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 512_000,
      storageBucket: "job-notices",
      storagePath: "2026/bangladesh-bank/ad-general.pdf",
      fileSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      pageCount: 2,
      isPrimaryNotice: true,
    });
    expect(notice.verified_authentic).toBe(false);

    // EDITOR_ADMIN cannot verify notice authenticity
    await expect(
      noticesService.verifyNoticeAuthenticity(
        EDITOR_ADMIN_CTX,
        notice.id,
        true
      )
    ).rejects.toThrow(AuthorizationError);

    const verifiedNotice = await noticesService.verifyNoticeAuthenticity(
      VERIFICATION_ADMIN_CTX,
      notice.id,
      true
    );
    expect(verifiedNotice.verified_authentic).toBe(true);

    // 7. VerificationService: EDITOR_ADMIN cannot publish; VERIFICATION_ADMIN approves & publishes
    await expect(
      verificationService.submitVerificationDecision(EDITOR_ADMIN_CTX, {
        jobId: jobDraft.id,
        decision: "approve_and_publish",
        domainVerified: true,
        checksumVerified: true,
        notes: "Editor trying to publish",
      })
    ).rejects.toThrow(/EDITOR_ADMIN cannot independently verify/);

    const decisionResult = await verificationService.submitVerificationDecision(
      VERIFICATION_ADMIN_CTX,
      {
        jobId: jobDraft.id,
        decision: "approve_and_publish",
        domainVerified: true,
        checksumVerified: true,
        notes: "Verified against official Bangladesh Bank portal and SHA-256 notice.",
      }
    );
    expect(decisionResult.job.verification_status).toBe("published");
    expect(decisionResult.job.published_at).toBeTruthy();
    expect(decisionResult.verificationRecord.new_status).toBe("published");

    // 8. AdminsService: SUPER_ADMIN can update roles, cannot self-lockout; Audit logs recorded
    await expect(
      adminsService.updateAdminGovernance(SUPER_ADMIN_CTX, {
        targetAdminId: SUPER_ADMIN_CTX.adminId,
        newRole: "EDITOR_ADMIN",
        reason: "Accidental self demotion",
      })
    ).rejects.toThrow(/SUPER_ADMIN cannot demote or deactivate their own account/);

    const updatedEditor = await adminsService.updateAdminGovernance(
      SUPER_ADMIN_CTX,
      {
        targetAdminId: EDITOR_ADMIN_CTX.adminId,
        newRole: "VERIFICATION_ADMIN",
        reason: "Promoted to verification team after training",
      }
    );
    expect(normalizeAdminRole(updatedEditor.role)).toBe("VERIFICATION_ADMIN");

    const auditLogs = await adminsService.listAuditLogs(SUPER_ADMIN_CTX, 50);
    expect(auditLogs.length).toBeGreaterThanOrEqual(8);

    const latestAudit = auditLogs[0]!;
    expect(latestAudit.actor_admin_id).toBe(SUPER_ADMIN_CTX.adminId);
    expect(latestAudit.action).toBe("admin.update_governance");
    expect(latestAudit.resource).toBe("admin_profiles");
    expect(latestAudit.previous_state).toEqual({
      role: "EDITOR_ADMIN",
      is_active: true,
    });
    expect(latestAudit.new_state).toEqual({
      role: "VERIFICATION_ADMIN",
      is_active: true,
    });
  });
});
