import { prisma } from '../lib/prisma.js';

type AuditInput = {
  actorId?: string | null;
  action: string;
  target?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

/** Persist an audit entry. Never throws — audit must not break the main flow. */
export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        target: input.target ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (err) {
    console.error('[audit] failed to write entry', err);
  }
}
