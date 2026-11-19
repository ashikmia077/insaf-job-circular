import { z } from "zod";
import type { DatabaseRepository } from "@/services/database/repository.types";
import {
  type AuthenticatedAdminContext,
  assertAdminPermission,
} from "@/lib/security/rbac";
import { recordAdminAuditLog } from "@/lib/security/audit";
import { jobCategorySchema } from "@/features/jobs";
import { generateSlug } from "@/lib/utils";
import type { JobCategoryRecord } from "@/types/database.types";

export const createCategoryInputSchema = z.object({
  slug: z.string().trim().min(2).max(60).optional(),
  categoryEnum: jobCategorySchema,
  nameEn: z.string().trim().min(2).max(120),
  nameBn: z.string().trim().min(2).max(120),
  descriptionEn: z.string().trim().max(500).nullable().optional(),
  descriptionBn: z.string().trim().max(500).nullable().optional(),
  iconName: z.string().trim().min(2).max(60).default("Briefcase"),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateCategoryInputSchema = createCategoryInputSchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;

export class CategoriesService {
  constructor(private readonly repo: DatabaseRepository) {}

  async listPublicCategories(): Promise<JobCategoryRecord[]> {
    return this.repo.listCategories(false);
  }

  async listAllCategories(
    actor: AuthenticatedAdminContext | null
  ): Promise<JobCategoryRecord[]> {
    assertAdminPermission(actor, "analytics:view");
    return this.repo.listCategories(true);
  }

  async createCategory(
    actor: AuthenticatedAdminContext | null,
    rawInput: CreateCategoryInput
  ): Promise<JobCategoryRecord> {
    const admin = assertAdminPermission(actor, "categories:manage");
    const input = createCategoryInputSchema.parse(rawInput);
    const slug = input.slug ? generateSlug(input.slug) : generateSlug(input.nameEn);

    const created = await this.repo.createCategory({
      slug,
      category_enum: input.categoryEnum,
      name_en: input.nameEn,
      name_bn: input.nameBn,
      description_en: input.descriptionEn ?? null,
      description_bn: input.descriptionBn ?? null,
      icon_name: input.iconName,
      display_order: input.displayOrder,
      is_active: input.isActive,
    });

    await recordAdminAuditLog(this.repo, {
      actorAdminId: admin.adminId,
      actorRole: admin.canonicalRole,
      action: "category.create",
      resource: "job_categories",
      entityId: created.id,
      previousState: null,
      newState: created as unknown as Record<string, unknown>,
    });

    return created;
  }

  async updateCategory(
    actor: AuthenticatedAdminContext | null,
    categoryId: string,
    rawPatch: UpdateCategoryInput
  ): Promise<JobCategoryRecord> {
    const admin = assertAdminPermission(actor, "categories:manage");
    const patch = updateCategoryInputSchema.parse(rawPatch);
    const existing = await this.repo.getCategoryById(categoryId);
    if (!existing) {
      throw new Error(`Category '${categoryId}' not found.`);
    }

    const updated = await this.repo.updateCategory(categoryId, {
      ...(patch.slug ? { slug: generateSlug(patch.slug) } : {}),
      ...(patch.categoryEnum ? { category_enum: patch.categoryEnum } : {}),
      ...(patch.nameEn !== undefined ? { name_en: patch.nameEn } : {}),
      ...(patch.nameBn !== undefined ? { name_bn: patch.nameBn } : {}),
      ...(patch.descriptionEn !== undefined
        ? { description_en: patch.descriptionEn }
        : {}),
      ...(patch.descriptionBn !== undefined
        ? { description_bn: patch.descriptionBn }
        : {}),
      ...(patch.iconName !== undefined ? { icon_name: patch.iconName } : {}),
      ...(patch.displayOrder !== undefined
        ? { display_order: patch.displayOrder }
        : {}),
      ...(patch.isActive !== undefined ? { is_active: patch.isActive } : {}),
    });

    await recordAdminAuditLog(this.repo, {
      actorAdminId: admin.adminId,
      actorRole: admin.canonicalRole,
      action: "category.update",
      resource: "job_categories",
      entityId: categoryId,
      previousState: existing as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async softDeleteCategory(
    actor: AuthenticatedAdminContext | null,
    categoryId: string
  ): Promise<JobCategoryRecord> {
    const admin = assertAdminPermission(actor, "categories:manage");
    const existing = await this.repo.getCategoryById(categoryId);
    if (!existing) {
      throw new Error(`Category '${categoryId}' not found.`);
    }

    const deleted = await this.repo.updateCategory(categoryId, {
      is_active: false,
      deleted_at: new Date().toISOString(),
    });

    await recordAdminAuditLog(this.repo, {
      actorAdminId: admin.adminId,
      actorRole: admin.canonicalRole,
      action: "category.soft_delete",
      resource: "job_categories",
      entityId: categoryId,
      previousState: existing as unknown as Record<string, unknown>,
      newState: deleted as unknown as Record<string, unknown>,
    });

    return deleted;
  }
}
