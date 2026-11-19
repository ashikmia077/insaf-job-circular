import {
  type AdminRole,
  type CanonicalAdminRole,
  type Permission,
  normalizeAdminRole,
  roleHasPermission,
} from "@/config/permissions.config";
import type { JobVerificationStatus } from "@/types/database.types";

export interface AuthenticatedAdminContext {
  adminId: string;
  email: string;
  fullName?: string;
  role: CanonicalAdminRole | AdminRole;
  isActive: boolean;
}

export class AuthorizationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(
    message: string,
    statusCode = 403,
    code = "AUTHORIZATION_DENIED"
  ) {
    super(message);
    this.name = "AuthorizationError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Enforces that an administrator is authenticated, active, and holds a valid governance role.
 */
export function assertActiveAdmin(
  context: AuthenticatedAdminContext | null | undefined
): AuthenticatedAdminContext & { canonicalRole: CanonicalAdminRole } {
  if (!context) {
    throw new AuthorizationError(
      "Authentication required.",
      401,
      "UNAUTHENTICATED"
    );
  }
  if (!context.isActive) {
    throw new AuthorizationError(
      "Administrator account is deactivated or suspended.",
      403,
      "ADMIN_DEACTIVATED"
    );
  }
  const canonicalRole = normalizeAdminRole(context.role);
  if (!canonicalRole) {
    throw new AuthorizationError(
      `Invalid administrator role '${String(context.role)}'.`,
      403,
      "INVALID_ADMIN_ROLE"
    );
  }
  return { ...context, canonicalRole };
}

/**
 * Enforces that an administrator holds a specific RBAC permission.
 */
export function assertAdminPermission(
  context: AuthenticatedAdminContext | null | undefined,
  requiredPermission: Permission
): AuthenticatedAdminContext & { canonicalRole: CanonicalAdminRole } {
  const verified = assertActiveAdmin(context);
  if (!roleHasPermission(verified.canonicalRole, requiredPermission)) {
    throw new AuthorizationError(
      `Role '${verified.canonicalRole}' lacks required permission '${requiredPermission}'.`,
      403,
      "INSUFFICIENT_PERMISSION"
    );
  }
  return verified;
}

/**
 * Enforces that an administrator belongs to one of the allowed canonical roles.
 */
export function assertAdminRole(
  context: AuthenticatedAdminContext | null | undefined,
  allowedRoles: readonly (CanonicalAdminRole | AdminRole)[]
): AuthenticatedAdminContext & { canonicalRole: CanonicalAdminRole } {
  const verified = assertActiveAdmin(context);
  const normalizedAllowed = allowedRoles
    .map((r) => normalizeAdminRole(r))
    .filter((r): r is CanonicalAdminRole => r !== null);

  if (!normalizedAllowed.includes(verified.canonicalRole)) {
    throw new AuthorizationError(
      `Role '${verified.canonicalRole}' is not authorized. Allowed roles: ${normalizedAllowed.join(", ")}.`,
      403,
      "ROLE_NOT_ALLOWED"
    );
  }
  return verified;
}

/**
 * Enforces Phase 2 publication governance:
 * - EDITOR_ADMIN can never transition a job to 'published' or 'verified_official'.
 * - Only VERIFICATION_ADMIN or SUPER_ADMIN can approve/publish jobs.
 */
export function assertJobTransitionAllowed(
  context: AuthenticatedAdminContext | null | undefined,
  targetStatus: JobVerificationStatus
): AuthenticatedAdminContext & { canonicalRole: CanonicalAdminRole } {
  const verified = assertActiveAdmin(context);

  if (
    targetStatus === "published" ||
    targetStatus === "verified_official" ||
    targetStatus === "rejected_duplicate" ||
    targetStatus === "rejected_unverified"
  ) {
    if (verified.canonicalRole === "EDITOR_ADMIN") {
      throw new AuthorizationError(
        "EDITOR_ADMIN cannot independently verify, reject, or publish job circulars. Verification requires VERIFICATION_ADMIN or SUPER_ADMIN.",
        403,
        "EDITOR_CANNOT_PUBLISH"
      );
    }
    return assertAdminPermission(verified, "jobs:publish");
  }

  return assertAdminPermission(verified, "jobs:edit");
}
