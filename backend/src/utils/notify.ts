import { prisma } from '../lib/prisma.js';
import type { NotificationType } from './enums.js';

/** Create an in-app notification (FR-16). Never throws. */
export async function notify(recipientId: string, message: string, type: NotificationType = 'SYSTEM'): Promise<void> {
  try {
    await prisma.notification.create({ data: { recipientId, message, type } });
  } catch (err) {
    console.error('[notify] failed', err);
  }
}

/** Fan-out a notification to every active user with one of the given roles. */
export async function notifyRoles(roles: string[], message: string, type: NotificationType = 'SYSTEM'): Promise<void> {
  try {
    const users = await prisma.user.findMany({ where: { role: { in: roles }, isActive: true }, select: { id: true } });
    if (users.length === 0) return;
    await prisma.notification.createMany({ data: users.map((u) => ({ recipientId: u.id, message, type })) });
  } catch (err) {
    console.error('[notifyRoles] failed', err);
  }
}

/** Notify all active admins (capacity alerts, support requests, …). */
export async function notifyAdmins(message: string, type: NotificationType = 'SYSTEM'): Promise<void> {
  return notifyRoles(['ADMIN'], message, type);
}
