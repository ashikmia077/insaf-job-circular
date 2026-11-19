import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConnectionConfigured } from "@/lib/supabase/middleware";
import {
  type AuthenticatedAdminContext,
  assertActiveAdmin,
  assertAdminPermission,
  assertAdminRole,
} from "@/lib/security/rbac";
import {
  type AdminRole,
  type CanonicalAdminRole,
  type Permission,
  normalizeAdminRole,
} from "@/config/permissions.config";

/**
 * Resolves the currently authenticated administrator session and profile from Supabase.
 * Returns null if unauthenticated or if Supabase is not configured.
 */
export async function getCurrentAdminContext(): Promise<AuthenticatedAdminContext | null> {
  if (!isSupabaseConnectionConfigured()) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("admin_profiles")
    .select("id, email, full_name, role, is_active, deleted_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.deleted_at) {
    return null;
  }

  const canonicalRole = normalizeAdminRole(profile.role);
  if (!canonicalRole) {
    return null;
  }

  return {
    adminId: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: canonicalRole,
    isActive: Boolean(profile.is_active),
  };
}

export async function requireActiveAdminSession() {
  const ctx = await getCurrentAdminContext();
  return assertActiveAdmin(ctx);
}

export async function requireAdminPermissionSession(permission: Permission) {
  const ctx = await getCurrentAdminContext();
  return assertAdminPermission(ctx, permission);
}

export async function requireAdminRoleSession(
  allowedRoles: readonly (CanonicalAdminRole | AdminRole)[]
) {
  const ctx = await getCurrentAdminContext();
  return assertAdminRole(ctx, allowedRoles);
}
