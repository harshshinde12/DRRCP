import { z } from 'zod';
import { EMERGENCY_TYPES, PRIORITIES, REQUEST_STATUSES, VERIFY_DECISIONS } from '../utils/enums.js';
import { strictBoolean } from './common.schema.js';

export const createRequestSchema = z.object({
  emergencyType: z.enum(EMERGENCY_TYPES),
  description: z.string().min(5).max(2000),
  location: z.string().min(2).max(500),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  peopleAffected: z.coerce.number().int().min(1).max(100000),
  injuryPresent: strictBoolean.default(false),
  injurySeverity: z.enum(['NONE', 'MINOR', 'MODERATE', 'SEVERE', 'UNKNOWN']).optional(),
  disasterId: z.string().min(1).optional(),
});

export const listRequestsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().max(50).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  status: z.enum(REQUEST_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  emergencyType: z.enum(EMERGENCY_TYPES).optional(),
  disasterId: z.string().min(1).optional(),
  search: z.string().max(100).optional(),
});

export const verifyRequestSchema = z.object({
  decision: z.enum(VERIFY_DECISIONS),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
  duplicateOfId: z.string().min(1).optional(),
});

export const setPrioritySchema = z.object({
  priority: z.enum(PRIORITIES),
});
