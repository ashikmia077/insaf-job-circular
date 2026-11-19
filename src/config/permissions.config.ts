/**
 * Role-Based Access Control (RBAC) Governance Matrix for Insaf Job Circular (Phase 2)
 *
 * Canonical Governance Roles:
 * - SUPER_ADMIN: Full system access, admin role management, security settings, and destructive actions.
 * - EDITOR_ADMIN: Manage job drafts, categories, organizations, notices, and content; CANNOT independently
 *                 verify or publish unverified jobs or modify system security settings.
 * - VERIFICATION_ADMIN: Manage verification records, source validation, duplicate resolution, and
 *                       approved publication decisions; CANNOT modify system security settings or admin roles.
 */

export const CANONICAL_ADMIN_ROLES = [
  "SUPER_ADMIN",
  "EDITOR_ADMIN",
  "VERIFICATION_ADMIN",
] as const;

export type CanonicalAdminRole = (typeof CANONICAL_ADMIN_ROLES)[number];

/**
 * Includes both canonical uppercase identifiers and PostgreSQL enum aliases for seamless interoperability.
 */
export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "EDITOR_ADMIN",
  "VERIFICATION_ADMIN",
  "super_admin",
  "editor_admin",
  "verification_admin",
  "verifier_admin",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const PERMISSIONS = [
  "jobs:create",
  "jobs:edit",
  "jobs:publish",
  "jobs:delete",
  "categories:manage",
  "organizations:manage",
  "notices:upload",
  "notices:verify",
  "verification:approve",
  "verification:reject",
  "sources:manage",
  "sources:validate",
  "sources:scan",
  "workers:trigger",
  "ads:manage",
  "reports:resolve",
  "notifications:send",
  "analytics:view",
  "admins:manage",
  "security:manage",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Normalizes any database or JWT role string into its canonical Phase 2 governance role.
 */
export function normalizeAdminRole(
  rawRole: string | undefined | null
): CanonicalAdminRole | null {
  if (!rawRole) return null;
  const upper = rawRole.trim().toUpperCase();
  switch (upper) {
    case "SUPER_ADMIN":
      return "SUPER_ADMIN";
    case "VERIFICATION_ADMIN":
    case "VERIFIER_ADMIN":
      return "VERIFICATION_ADMIN";
    case "EDITOR_ADMIN":
      return "EDITOR_ADMIN";
    default:
      return null;
  }
}

/**
 * Maps a canonical role back to the lowercase PostgreSQL enum value for database persistence.
 */
export function toDatabaseAdminRole(
  role: AdminRole | CanonicalAdminRole
): "super_admin" | "editor_admin" | "verification_admin" {
  const normalized = normalizeAdminRole(role);
  switch (normalized) {
    case "SUPER_ADMIN":
      return "super_admin";
    case "VERIFICATION_ADMIN":
      return "verification_admin";
    case "EDITOR_ADMIN":
    default:
      return "editor_admin";
  }
}

export const ROLE_PERMISSION_MATRIX: Record<
  CanonicalAdminRole,
  readonly Permission[]
> = {
  SUPER_ADMIN: PERMISSIONS,
  VERIFICATION_ADMIN: [
    "jobs:create",
    "jobs:edit",
    "jobs:publish",
    "organizations:manage",
    "notices:upload",
    "notices:verify",
    "verification:approve",
    "verification:reject",
    "sources:validate",
    "sources:scan",
    "reports:resolve",
    "notifications:send",
    "analytics:view",
  ],
  EDITOR_ADMIN: [
    "jobs:create",
    "jobs:edit",
    "categories:manage",
    "organizations:manage",
    "notices:upload",
    "analytics:view",
  ],
};

export function roleHasPermission(
  role: AdminRole | string | undefined | null,
  permission: Permission
): boolean {
  const canonical = normalizeAdminRole(role);
  if (!canonical) return false;
  return ROLE_PERMISSION_MATRIX[canonical].includes(permission);
}
