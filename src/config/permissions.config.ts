/**
 * Role-Based Access Control (RBAC) Matrix for Insaf Job Circular
 */

export const ADMIN_ROLES = [
  "super_admin",
  "verifier_admin",
  "editor_admin",
  "ad_manager",
  "analyst",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const PERMISSIONS = [
  "jobs:create",
  "jobs:edit",
  "jobs:publish",
  "jobs:delete",
  "notices:upload",
  "notices:verify",
  "sources:manage",
  "workers:trigger",
  "ads:manage",
  "notifications:send",
  "analytics:view",
  "admins:manage",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSION_MATRIX: Record<AdminRole, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  verifier_admin: [
    "jobs:create",
    "jobs:edit",
    "jobs:publish",
    "notices:upload",
    "notices:verify",
    "notifications:send",
    "analytics:view",
  ],
  editor_admin: [
    "jobs:create",
    "jobs:edit",
    "notices:upload",
    "analytics:view",
  ],
  ad_manager: [
    "ads:manage",
    "analytics:view",
  ],
  analyst: [
    "analytics:view",
    "audit:read",
  ],
};

export function roleHasPermission(
  role: AdminRole | undefined | null,
  permission: Permission
): boolean {
  if (!role) return false;
  return ROLE_PERMISSION_MATRIX[role]?.includes(permission) ?? false;
}
