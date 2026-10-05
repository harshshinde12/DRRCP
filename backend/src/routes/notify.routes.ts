import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../utils/httpErrors.js';
import * as notifyController from '../controllers/notify.controller.js';

export const notifyRouter = Router();

// NOTE: per-route authenticate (not router.use) — shared `/` mount with public routers.
const auth = authenticate;

notifyRouter.get('/notifications', auth, asyncHandler(notifyController.listNotifications));
notifyRouter.get('/notifications/unread-count', auth, asyncHandler(notifyController.unreadCount));
notifyRouter.patch('/notifications/:id/read', auth, asyncHandler(notifyController.markRead));
notifyRouter.patch('/notifications/read-all', auth, asyncHandler(notifyController.markAllRead));

notifyRouter.post('/alerts/broadcast', auth, authorize('ADMIN'), asyncHandler(notifyController.broadcast));

notifyRouter.get('/dashboard/summary', auth, authorize('ADMIN'), asyncHandler(notifyController.summary));
notifyRouter.get('/dashboard/timeseries', auth, authorize('ADMIN'), asyncHandler(notifyController.timeseries));
notifyRouter.get('/audit-logs', auth, authorize('ADMIN'), asyncHandler(notifyController.listAuditLogs));
