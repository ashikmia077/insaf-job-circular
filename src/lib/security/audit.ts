import type {
  AdminRole,
  CanonicalAdminRole,
} from "@/config/permissions.config";
import type { AuditLogRecord } from "@/types/database.types";

export interface CreateAuditLogInput {
  actorAdminId: string | null;
  actorRole: CanonicalAdminRole | AdminRole | "system_worker";
  action: string;
  resource: string;
  entityType?: string;
  entityId: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Builds an immutable audit log entry payload ready for persistence in `public.audit_logs`.
 * Captures Admin ID, Action, Resource, Previous State, New State, and Timestamp metadata.
 */
export function buildAuditLogEntry(
  input: CreateAuditLogInput
): Omit<AuditLogRecord, "id" | "created_at"> {
  return {
    actor_admin_id: input.actorAdminId,
    actor_role: input.actorRole,
    action: input.action,
    resource: input.resource,
    entity_type: input.entityType ?? input.resource,
    entity_id: input.entityId,
    previous_state: input.previousState ?? null,
    new_state: input.newState ?? null,
    metadata: input.metadata ?? {},
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  };
}

export interface AuditLogWriter {
  insertAuditLog(
    entry: Omit<AuditLogRecord, "id" | "created_at">
  ): Promise<AuditLogRecord>;
}

/**
 * Persists an administrative audit log entry via the provided repository/writer.
 */
export async function recordAdminAuditLog(
  writer: AuditLogWriter,
  input: CreateAuditLogInput
): Promise<AuditLogRecord> {
  const payload = buildAuditLogEntry(input);
  return writer.insertAuditLog(payload);
}
