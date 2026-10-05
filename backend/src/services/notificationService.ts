import { prisma } from '../lib/prisma.js';
import { writeAuditLog } from '../utils/audit.js';
import type { Role } from '../utils/enums.js';
import { HttpError } from '../utils/httpErrors.js';
import { notifyRoles } from '../utils/notify.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';

export async function listNotifications(userId: string, query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const where = {
    recipientId: userId,
    ...(query.isRead !== undefined ? { isRead: query.isRead as boolean } : {}),
    ...(query.type ? { type: query.type as string } : {}),
  };
  const [total, unread, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { recipientId: userId, isRead: false } }),
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
  ]);
  return { notifications, meta: { ...pageMeta(total, { page, limit, skip }), unread } };
}

export async function unreadCount(userId: string) {
  const unread = await prisma.notification.count({ where: { recipientId: userId, isRead: false } });
  return { unread };
}

export async function markRead(userId: string, id: string) {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) throw new HttpError(404, 'Notification not found');
  if (notification.recipientId !== userId) throw new HttpError(403, 'This notification is not yours');
  return prisma.notification.update({ where: { id }, data: { isRead: true } });
}

export async function markAllRead(userId: string) {
  const { count } = await prisma.notification.updateMany({ where: { recipientId: userId, isRead: false }, data: { isRead: true } });
  return { marked: count };
}

/** Admin publishes a public alert / safety instruction (SRS Notify.Alert). */
export async function broadcast(adminId: string, message: string, type: string, roles?: Role[]) {
  const targets = roles ?? (['CITIZEN', 'VOLUNTEER', 'RESCUE_TEAM', 'SHELTER_MANAGER', 'NGO', 'ADMIN'] as Role[]);
  await notifyRoles(targets, message, type as never);
  await writeAuditLog({ actorId: adminId, action: 'ALERT_BROADCAST', target: 'Notification', metadata: { message, type, roles: targets } });
  return { message, type, roles: targets };
}
