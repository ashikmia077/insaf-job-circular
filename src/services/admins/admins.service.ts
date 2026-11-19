import { z } from "zod";
import type { DatabaseRepository } from "@/services/database/repository.types";
import {
  type AuthenticatedAdminContext,
  AuthorizationError,
  assertAdminPermission,
  assertAdminRole,
} from "@/lib/security/rbac";
import { recordAdminAuditLog } from "@/lib/security/audit";
import {
  CANONICAL_ADMIN_ROLES,
  normalizeAdminRole,
  toDatabaseAdminRole,
} from "@/config/permissions.config";
import type { AdminProfile, AuditLogRecord } from "@/types/database.types";

export const createAdminProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(CANONICAL_ADMIN_ROLES),
});

export const updateAdminRoleSchema = z.object({
  targetAdminId: z.string().uuid(),
  newRole: z.enum(CANONICAL_ADMIN_ROLES),
  isActive: z.boolean().optional(),
  reason: z.string().trim().min(5).max(500),
});

export type CreateAdminProfileInput = z.infer<typeof createAdminProfileSchema>;
export type UpdateAdminRoleInput = z.infer<typeof updateAdminRoleSchema>;

export class AdminsService {
  constructor(private readonly repo: DatabaseRepository) {}

  async listAdmins(
    actor: AuthenticatedAdminContext | null
  ): Promise<AdminProfile[]> {
    assertAdminRole(actor, ["SUPER_ADMIN"]);
    return this.repo.listAdminProfiles();
  }

  async createAdmin(
    actor: AuthenticatedAdminContext | null,
    rawInput: CreateAdminProfileInput
  ): Promise<AdminProfile> {
    const superAdmin = assertAdminPermission(actor, "admins:manage");
    const input = createAdminProfileSchema.parse(rawInput);

    const created = await this.repo.createAdminProfile({
      id: input.id,
      email: input.email.toLowerCase(),
      full_name: input.fullName,
      role: toDatabaseAdminRole(input.role),
      is_active: true,
      created_by_admin_id: superAdmin.adminId,
      last_active_at: null,
    });

    await recordAdminAuditLog(this.repo, {
      actorAdminId: superAdmin.adminId,
      actorRole: superAdmin.canonicalRole,
      action: "admin.create",
      resource: "admin_profiles",
      entityId: created.id,
      previousState: null,
      newState: created as unknown as Record<string, unknown>,
    });

    return created;
  }

  /**
   * Updates an administrator's role or activation status.
   * Enforces:
   * 1. Only SUPER_ADMIN (`admins:manage` + `security:manage`) can invoke this.
   * 2. Prevents a SUPER_ADMIN from demoting or deactivating their own active account (anti-lockout).
   */
  async updateAdminGovernance(
    actor: AuthenticatedAdminContext | null,
    rawInput: UpdateAdminRoleInput
  ): Promise<AdminProfile> {
    const superAdmin = assertAdminPermission(actor, "admins:manage");
    assertAdminPermission(superAdmin, "security:manage");

    const input = updateAdminRoleSchema.parse(rawInput);
    const existing = await this.repo.getAdminProfileById(input.targetAdminId);
    if (!existing) {
      throw new Error(`Admin profile '${input.targetAdminId}' not found.`);
    }

    if (
      superAdmin.adminId === input.targetAdminId &&
      (input.newRole !== "SUPER_ADMIN" || input.isActive === false)
    ) {
      throw new AuthorizationError(
        "SUPER_ADMIN cannot demote or deactivate their own account.",
        400,
        "SELF_LOCKOUT_PREVENTED"
      );
    }

    const updated = await this.repo.updateAdminProfile(input.targetAdminId, {
      role: toDatabaseAdminRole(input.newRole),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    });

    await recordAdminAuditLog(this.repo, {
      actorAdminId: superAdmin.adminId,
      actorRole: superAdmin.canonicalRole,
      action: "admin.update_governance",
      resource: "admin_profiles",
      entityId: input.targetAdminId,
      previousState: {
        role: normalizeAdminRole(existing.role),
        is_active: existing.is_active,
      },
      newState: {
        role: normalizeAdminRole(updated.role),
        is_active: updated.is_active,
      },
      metadata: {
        reason: input.reason,
      },
    });

    return updated;
  }

  async listAuditLogs(
    actor: AuthenticatedAdminContext | null,
    limit = 100
  ): Promise<AuditLogRecord[]> {
    assertAdminPermission(actor, "audit:read");
    return this.repo.listAuditLogs(limit);
  }
}
