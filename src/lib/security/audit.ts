import type { AdminRole } from "@/config/permissions.config";
import type { AuditLogRecord } from "@/types/database.types";

export interface CreateAuditLogInput {
  actorAdminId: string | null;
  actorRole: AdminRole | "system_worker";
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

/**
 * Builds an immutable audit log entry payload ready for persistence in `public.audit_logs`.
 * Every administrative state change (job approval, notice verification, role update, ad change)
 * must emit an audit record.
 */
export function buildAuditLogEntry(
  input: CreateAuditLogInput
): Omit<AuditLogRecord, "id" | "created_at"> {
  return {
    actor_admin_id: input.actorAdminId,
    actor_role: input.actorRole,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    metadata: input.metadata ?? {},
    ip_address: input.ipAddress ?? null,
  };
}
