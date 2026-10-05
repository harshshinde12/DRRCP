import { z } from 'zod';
import { VOLUNTEER_TASK_STATUSES } from '../utils/enums.js';

/** Low-risk categories only (SRS Volunteer.Task.Restrict / SF-2). */
export const VOLUNTEER_TASK_TYPES = ['FIRST_AID', 'LOGISTICS', 'COOKING', 'COMMUNICATION', 'DISTRIBUTION'] as const;

export const updateVolunteerSchema = z.object({
  skills: z.string().max(500).optional(),
  availability: z.string().max(100).optional(),
  serviceArea: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
});

export const listVolunteersQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  skills: z.string().max(100).optional(),
  availability: z.string().max(100).optional(),
  serviceArea: z.string().max(100).optional(),
  search: z.string().max(100).optional(),
});

export const suggestVolunteersQuery = z.object({
  taskType: z.enum(VOLUNTEER_TASK_TYPES),
  location: z.string().min(1).max(300),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const createTaskSchema = z.object({
  volunteerId: z.string().min(1),
  title: z.string().min(3).max(200),
  taskType: z.string().min(1).max(50),
  location: z.string().min(1).max(300),
});

export const listTasksQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(VOLUNTEER_TASK_STATUSES).optional(),
  taskType: z.string().max(50).optional(),
});

export const taskStatusSchema = z.object({
  status: z.enum(VOLUNTEER_TASK_STATUSES),
});
