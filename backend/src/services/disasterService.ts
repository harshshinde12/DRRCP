import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { writeAuditLog } from '../utils/audit.js';
import { HttpError } from '../utils/httpErrors.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';
import { createDisasterSchema, updateDisasterSchema } from '../schemas/disaster.schema.js';

type CreateInput = z.infer<typeof createDisasterSchema>;
type UpdateInput = z.infer<typeof updateDisasterSchema>;

export async function createDisaster(actorId: string, input: CreateInput) {
  const disaster = await prisma.$transaction(async (tx) => {
    if (input.status === 'ACTIVE') {
      // Single-active-disaster invariant: activating one demotes the rest to MONITORING.
      await tx.disaster.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'MONITORING' } });
    }
    return tx.disaster.create({ data: input });
  });
  await writeAuditLog({ actorId, action: 'DISASTER_CREATE', target: 'Disaster', targetId: disaster.id, metadata: { name: disaster.name } });
  return disaster;
}

export async function listDisasters(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const where = query.status ? { status: query.status as string } : {};
  const [total, disasters] = await Promise.all([
    prisma.disaster.count({ where }),
    prisma.disaster.findMany({ where, orderBy: { startDate: 'desc' }, skip, take: limit }),
  ]);
  return { disasters, meta: pageMeta(total, { page, limit, skip }) };
}

export async function getActiveDisaster() {
  return prisma.disaster.findFirst({ where: { status: 'ACTIVE' }, orderBy: { startDate: 'desc' } });
}

export async function getDisaster(id: string) {
  const disaster = await prisma.disaster.findUnique({ where: { id } });
  if (!disaster) throw new HttpError(404, 'Disaster not found');
  return disaster;
}

export async function updateDisaster(actorId: string, id: string, input: UpdateInput) {
  await getDisaster(id);
  const disaster = await prisma.$transaction(async (tx) => {
    if (input.status === 'ACTIVE') {
      await tx.disaster.updateMany({ where: { status: 'ACTIVE', NOT: { id } }, data: { status: 'MONITORING' } });
    }
    return tx.disaster.update({ where: { id }, data: input });
  });
  await writeAuditLog({ actorId, action: 'DISASTER_UPDATE', target: 'Disaster', targetId: id, metadata: input as Record<string, unknown> });
  return disaster;
}

export async function activateDisaster(actorId: string, id: string) {
  return updateDisaster(actorId, id, { status: 'ACTIVE' });
}

export async function closeDisaster(actorId: string, id: string) {
  return updateDisaster(actorId, id, { status: 'RESOLVED' });
}
