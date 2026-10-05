import { z } from 'zod';
import { RoleEnum } from './auth.schema.js';

export const adminCreateUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  phone: z.string().max(20).optional(),
  role: RoleEnum,
  address: z.string().max(500).optional(),
  skills: z.string().max(500).optional(),
  availability: z.string().max(100).optional(),
  serviceArea: z.string().max(200).optional(),
  organizationName: z.string().max(200).optional(),
  registrationNumber: z.string().max(200).optional(),
  authority: z.string().max(200).optional(),
  contactNumber: z.string().max(20).optional(),
  // Required when role === RESCUE_TEAM: also provisions the RescueTeam record.
  team: z
    .object({
      name: z.string().min(2).max(100),
      teamType: z.string().min(2).max(50),
      memberCount: z.coerce.number().int().min(1).max(1000),
      capability: z.string().min(1).max(500),
      currentLocation: z.string().min(1).max(300),
      latitude: z.coerce.number().min(-90).max(90).optional(),
      longitude: z.coerce.number().min(-180).max(180).optional(),
    })
    .optional(),
});

export const adminListUsersQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  role: RoleEnum.optional(),
  search: z.string().max(100).optional(),
});
