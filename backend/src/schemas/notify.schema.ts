import { z } from 'zod';
import { NOTIFICATION_TYPES } from '../utils/enums.js';
import { strictBoolean } from './common.schema.js';
import { RoleEnum } from './auth.schema.js';

export const listNotificationsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  isRead: strictBoolean.optional(),
  type: z.enum(NOTIFICATION_TYPES).optional(),
});

export const broadcastSchema = z.object({
  message: z.string().min(5).max(1000),
  type: z.enum(NOTIFICATION_TYPES).default('PUBLIC_ALERT'),
  roles: z.array(RoleEnum).min(1).optional(), // default: everyone
});

export const listAuditQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  action: z.string().max(100).optional(),
  actorId: z.string().min(1).optional(),
  target: z.string().max(100).optional(),
  targetId: z.string().min(1).optional(),
});

export const timeseriesQuery = z.object({
  days: z.coerce.number().int().min(1).max(90).default(14),
});
