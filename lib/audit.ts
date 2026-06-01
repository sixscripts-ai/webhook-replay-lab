import { prisma } from "./db";

export type AuditInput = {
  actor?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
};

/**
 * Write an audit log row. Errors here should never break the calling
 * request — audit logging is best-effort.
 */
export async function audit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actor: input.actor ?? "system",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: (input.metadata ?? {}) as object,
      },
    });
  } catch (err) {
    // Intentionally swallow — audit logging must never break the primary flow.
    console.error("[audit] failed to write log", err);
  }
}
