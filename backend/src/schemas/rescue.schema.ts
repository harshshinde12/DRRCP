import { z } from 'zod';
import { ASSIGNMENT_STATUSES, TEAM_AVAILABILITY } from '../utils/enums.js';

export const createTeamSchema = z.object({
  name: z.string().min(2).max(100),
  teamType: z.string().min(2).max(50),
  memberCount: z.coerce.number().int().min(1).max(1000),
  capability: z.string().min(1).max(500),
  currentLocation: z.string().min(1).max(300),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  userId: z.string().min(1).optional(),
});

export const updateTeamSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  teamType: z.string().min(2).max(50).optional(),
  memberCount: z.coerce.number().int().min(1).max(1000).optional(),
  capability: z.string().min(1).max(500).optional(),
  currentLocation: z.string().min(1).max(300).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  availabilityStatus: z.enum(TEAM_AVAILABILITY).optional(),
});

export const listTeamsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  availabilityStatus: z.enum(TEAM_AVAILABILITY).optional(),
  teamType: z.string().max(50).optional(),
  capability: z.string().max(100).optional(),
  search: z.string().max(100).optional(),
});

export const assignTeamSchema = z.object({
  teamId: z.string().min(1),
  /** SRS Team.Assign.Block: assigning a non-AVAILABLE team needs an explicit, logged override. */
  override: z.coerce.boolean().default(false),
  /** Mandatory when override:true — recorded in the audit trail. */
  overrideReason: z.string().min(5).max(500).optional(),
});

export const assignmentStatusSchema = z.object({
  status: z.enum(ASSIGNMENT_STATUSES),
});

export const reportSchema = z.object({
  peopleRescued: z.coerce.number().int().min(0).max(100000),
  injuredPeople: z.coerce.number().int().min(0).max(100000),
  notes: z.string().max(2000).optional(),
});

export const supportSchema = z.object({
  notes: z.string().min(5).max(2000),
});

export const listAssignmentsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(ASSIGNMENT_STATUSES).optional(),
  teamId: z.string().min(1).optional(),
  requestId: z.string().min(1).optional(),
});
