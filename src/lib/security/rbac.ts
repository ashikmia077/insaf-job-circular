import {
  type AdminRole,
  type Permission,
  roleHasPermission,
} from "@/config/permissions.config";

export interface AuthenticatedAdminContext {
  adminId: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
}

export class AuthorizationError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.statusCode = statusCode;
  }
}

/**
 * Enforces that an administrator is active and holds the required RBAC permission.
 */
export function assertAdminPermission(
  context: AuthenticatedAdminContext | null,
  requiredPermission: Permission
): AuthenticatedAdminContext {
  if (!context) {
    throw new AuthorizationError("Authentication required.", 401);
  }
  if (!context.isActive) {
    throw new AuthorizationError("Administrator account is suspended.", 403);
  }
  if (!roleHasPermission(context.role, requiredPermission)) {
    throw new AuthorizationError(
      `Role '${context.role}' lacks required permission '${requiredPermission}'.`,
      403
    );
  }
  return context;
}
