import { z } from "zod";
import type { DatabaseRepository } from "@/services/database/repository.types";
import {
  type AuthenticatedAdminContext,
  assertAdminPermission,
} from "@/lib/security/rbac";
import { recordAdminAuditLog } from "@/lib/security/audit";
import { jobCategorySchema } from "@/features/jobs";
import { generateSlug } from "@/lib/utils";
import type { Organization } from "@/types/database.types";

const TRUSTED_BD_INSTITUTIONAL_SUFFIXES = [
  ".gov.bd",
  ".org.bd",
  ".edu.bd",
  ".ac.bd",
  ".mil.bd",
] as const;

export const createOrganizationInputSchema = z.object({
  nameEn: z.string().trim().min(2).max(200),
  nameBn: z.string().trim().min(2).max(200).nullable().optional(),
  slug: z.string().trim().min(2).max(120).optional(),
  category: jobCategorySchema,
  categoryId: z.string().uuid().nullable().optional(),
  officialDomain: z.string().trim().max(120).nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  logoStoragePath: z.string().trim().max(300).nullable().optional(),
});

export const updateOrganizationInputSchema =
  createOrganizationInputSchema.partial();

export type CreateOrganizationInput = z.infer<
  typeof createOrganizationInputSchema
>;
export type UpdateOrganizationInput = z.infer<
  typeof updateOrganizationInputSchema
>;

export function isTrustedBangladeshGovDomain(
  domain: string | null | undefined
): boolean {
  if (!domain) return false;
  const clean = domain.trim().toLowerCase();
  return TRUSTED_BD_INSTITUTIONAL_SUFFIXES.some((suffix) =>
    clean.endsWith(suffix)
  );
}

export class OrganizationsService {
  constructor(private readonly repo: DatabaseRepository) {}

  async listOrganizations(): Promise<Organization[]> {
    return this.repo.listOrganizations();
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    return this.repo.getOrganizationById(id);
  }

  async createOrganization(
    actor: AuthenticatedAdminContext | null,
    rawInput: CreateOrganizationInput
  ): Promise<Organization> {
    const admin = assertAdminPermission(actor, "organizations:manage");
    const input = createOrganizationInputSchema.parse(rawInput);
    const slug = input.slug
      ? generateSlug(input.slug)
      : generateSlug(input.nameEn);
    const trustedGov = isTrustedBangladeshGovDomain(input.officialDomain);

    const created = await this.repo.createOrganization({
      name_en: input.nameEn,
      name_bn: input.nameBn ?? null,
      slug,
      category: input.category,
      category_id: input.categoryId ?? null,
      official_domain: input.officialDomain ?? null,
      website_url: input.websiteUrl ?? null,
      is_trusted_government_domain: trustedGov,
      is_verified_organization:
        trustedGov && admin.canonicalRole !== "EDITOR_ADMIN",
      logo_storage_path: input.logoStoragePath ?? null,
    });

    await recordAdminAuditLog(this.repo, {
      actorAdminId: admin.adminId,
      actorRole: admin.canonicalRole,
      action: "organization.create",
      resource: "organizations",
      entityId: created.id,
      previousState: null,
      newState: created as unknown as Record<string, unknown>,
    });

    return created;
  }

  async verifyOrganization(
    actor: AuthenticatedAdminContext | null,
    organizationId: string,
    isVerified: boolean
  ): Promise<Organization> {
    // Only VERIFICATION_ADMIN or SUPER_ADMIN can mark an organization verified
    const admin = assertAdminPermission(actor, "sources:validate");
    const existing = await this.repo.getOrganizationById(organizationId);
    if (!existing) {
      throw new Error(`Organization '${organizationId}' not found.`);
    }

    const updated = await this.repo.updateOrganization(organizationId, {
      is_verified_organization: isVerified,
    });

    await recordAdminAuditLog(this.repo, {
      actorAdminId: admin.adminId,
      actorRole: admin.canonicalRole,
      action: "organization.verify",
      resource: "organizations",
      entityId: organizationId,
      previousState: existing as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }
}
