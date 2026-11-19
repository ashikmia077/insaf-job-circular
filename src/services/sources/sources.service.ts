import { z } from "zod";
import type { DatabaseRepository } from "@/services/database/repository.types";
import {
  type AuthenticatedAdminContext,
  assertAdminPermission,
} from "@/lib/security/rbac";
import { recordAdminAuditLog } from "@/lib/security/audit";
import type { JobSourceRecord, SourceScanRecord } from "@/types/database.types";

export const createJobSourceInputSchema = z.object({
  organizationId: z.string().uuid().nullable().optional(),
  sourceName: z.string().trim().min(3).max(160),
  sourceUrl: z.string().url(),
  officialDomain: z.string().trim().min(3).max(120),
  robotsTxtVerified: z.boolean().default(false),
  isEnabled: z.boolean().default(true),
  pollIntervalMinutes: z.number().int().min(15).max(1440).default(60),
});

export type CreateJobSourceInput = z.infer<typeof createJobSourceInputSchema>;

export class SourcesService {
  constructor(private readonly repo: DatabaseRepository) {}

  async listSources(
    actor: AuthenticatedAdminContext | null
  ): Promise<JobSourceRecord[]> {
    assertAdminPermission(actor, "analytics:view");
    return this.repo.listJobSources();
  }

  async createSource(
    actor: AuthenticatedAdminContext | null,
    rawInput: CreateJobSourceInput
  ): Promise<JobSourceRecord> {
    // Only SUPER_ADMIN has sources:manage to add new automated crawl sources
    const admin = assertAdminPermission(actor, "sources:manage");
    const input = createJobSourceInputSchema.parse(rawInput);

    const created = await this.repo.createJobSource({
      organization_id: input.organizationId ?? null,
      source_name: input.sourceName,
      source_url: input.sourceUrl,
      official_domain: input.officialDomain.toLowerCase(),
      robots_txt_verified: input.robotsTxtVerified,
      is_enabled: input.isEnabled,
      poll_interval_minutes: input.pollIntervalMinutes,
      created_by_admin_id: admin.adminId,
    });

    await recordAdminAuditLog(this.repo, {
      actorAdminId: admin.adminId,
      actorRole: admin.canonicalRole,
      action: "source.create",
      resource: "job_sources",
      entityId: created.id,
      previousState: null,
      newState: created as unknown as Record<string, unknown>,
    });

    return created;
  }

  async validateSourceCompliance(
    actor: AuthenticatedAdminContext | null,
    sourceId: string,
    options: { robotsTxtVerified: boolean; isEnabled: boolean }
  ): Promise<JobSourceRecord> {
    // VERIFICATION_ADMIN and SUPER_ADMIN hold sources:validate
    const admin = assertAdminPermission(actor, "sources:validate");
    const existing = await this.repo.getJobSourceById(sourceId);
    if (!existing) {
      throw new Error(`Job source '${sourceId}' not found.`);
    }

    const updated = await this.repo.updateJobSource(sourceId, {
      robots_txt_verified: options.robotsTxtVerified,
      is_enabled: options.robotsTxtVerified ? options.isEnabled : false,
    });

    await recordAdminAuditLog(this.repo, {
      actorAdminId: admin.adminId,
      actorRole: admin.canonicalRole,
      action: "source.validate_compliance",
      resource: "job_sources",
      entityId: sourceId,
      previousState: existing as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async queueSourceScan(
    actor: AuthenticatedAdminContext | null,
    sourceId: string
  ): Promise<SourceScanRecord> {
    const admin = assertAdminPermission(actor, "sources:scan");
    const source = await this.repo.getJobSourceById(sourceId);
    if (!source) {
      throw new Error(`Job source '${sourceId}' not found.`);
    }
    if (!source.robots_txt_verified || !source.is_enabled) {
      throw new Error(
        `Cannot scan source '${source.source_name}': source must be enabled and have robots.txt compliance verified.`
      );
    }

    const scan = await this.repo.createSourceScan({
      source_id: sourceId,
      triggered_by_admin_id: admin.adminId,
      scan_status: "queued",
      links_discovered: 0,
      new_jobs_ingested: 0,
      duplicates_skipped: 0,
      error_message: null,
      started_at: new Date().toISOString(),
      completed_at: null,
    });

    await recordAdminAuditLog(this.repo, {
      actorAdminId: admin.adminId,
      actorRole: admin.canonicalRole,
      action: "source.queue_scan",
      resource: "source_scans",
      entityId: scan.id,
      previousState: null,
      newState: scan as unknown as Record<string, unknown>,
    });

    return scan;
  }
}
