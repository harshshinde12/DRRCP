import type { Request, Response } from 'express';
import { created, ok } from '../utils/response.js';
import { broadcastSchema, listAuditQuery, listNotificationsQuery, timeseriesQuery } from '../schemas/notify.schema.js';
import * as notificationService from '../services/notificationService.js';
import * as dashboardService from '../services/dashboardService.js';

export async function listNotifications(req: Request, res: Response) {
  const query = listNotificationsQuery.parse(req.query);
  const { notifications, meta } = await notificationService.listNotifications(req.user!.id, query as Record<string, unknown>);
  return ok(res, notifications, 200, meta);
}

export async function unreadCount(req: Request, res: Response) {
  return ok(res, await notificationService.unreadCount(req.user!.id));
}

export async function markRead(req: Request, res: Response) {
  return ok(res, { notification: await notificationService.markRead(req.user!.id, req.params.id) });
}

export async function markAllRead(req: Request, res: Response) {
  return ok(res, await notificationService.markAllRead(req.user!.id));
}

export async function broadcast(req: Request, res: Response) {
  const { message, type, roles } = broadcastSchema.parse(req.body);
  const result = await notificationService.broadcast(req.user!.id, message, type, roles);
  return created(res, result);
}

export async function summary(_req: Request, res: Response) {
  return ok(res, await dashboardService.summary());
}

export async function timeseries(req: Request, res: Response) {
  const { days } = timeseriesQuery.parse(req.query);
  return ok(res, await dashboardService.timeseries(days));
}

export async function listAuditLogs(req: Request, res: Response) {
  const query = listAuditQuery.parse(req.query);
  const { logs, meta } = await dashboardService.listAuditLogs(query as Record<string, unknown>);
  return ok(res, logs, 200, meta);
}
