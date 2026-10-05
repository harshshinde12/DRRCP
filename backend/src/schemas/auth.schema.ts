import { z } from 'zod';

export const RoleEnum = z.enum(['CITIZEN', 'VOLUNTEER', 'RESCUE_TEAM', 'SHELTER_MANAGER', 'NGO', 'ADMIN']);

/** Roles allowed through PUBLIC self-registration (ADMIN/RESCUE_TEAM are admin-provisioned). */
export const PublicRoleEnum = z.enum(['CITIZEN', 'VOLUNTEER', 'SHELTER_MANAGER', 'NGO']);

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  phone: z.string().max(20).optional(),
  // Accepted but ADMIN/RESCUE_TEAM are rejected with 403 in the controller
  // (so the denial is explicit, not a silent validation error).
  role: RoleEnum.default('CITIZEN'),
  // Optional role-profile fields
  address: z.string().max(500).optional(),
  skills: z.string().max(500).optional(),
  availability: z.string().max(100).optional(),
  serviceArea: z.string().max(200).optional(),
  organizationName: z.string().max(200).optional(),
  contactNumber: z.string().max(20).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
