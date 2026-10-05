import { z } from 'zod';
import { DISASTER_STATUSES } from '../utils/enums.js';

export const createDisasterSchema = z.object({
  name: z.string().min(2).max(200),
  type: z.string().min(2).max(50),
  affectedArea: z.string().min(2).max(500),
  severity: z.enum(['LOW', 'MODERATE', 'SEVERE', 'CRITICAL']),
  status: z.enum(DISASTER_STATUSES).default('ACTIVE'),
  startDate: z.coerce.date(),
});

export const updateDisasterSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  type: z.string().min(2).max(50).optional(),
  affectedArea: z.string().min(2).max(500).optional(),
  severity: z.enum(['LOW', 'MODERATE', 'SEVERE', 'CRITICAL']).optional(),
  status: z.enum(DISASTER_STATUSES).optional(),
  startDate: z.coerce.date().optional(),
});

export const listDisastersQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(DISASTER_STATUSES).optional(),
});
