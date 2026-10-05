import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { writeAuditLog } from '../utils/audit.js';
import type { Role } from '../utils/enums.js';
import { HttpError } from '../utils/httpErrors.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';
import { adminCreateUserSchema } from '../schemas/admin.schema.js';

type CreateUserInput = z.infer<typeof adminCreateUserSchema>;

const PUBLIC_USER = { id: true, name: true, email: true, role: true, phone: true, createdAt: true } as const;

/**
 * Admin-provision any account (SRS AS-2: teams/admins are onboarded by an authority).
 * role RESCUE_TEAM additionally creates the linked RescueTeam row, atomically.
 */
export async function createUserAsAdmin(actorId: string, input: CreateUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new HttpError(409, 'Email already registered');

  if (input.role === 'RESCUE_TEAM' && !input.team) {
    throw new HttpError(422, 'team profile (name, teamType, memberCount, capability, currentLocation) is required for RESCUE_TEAM users');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash,
        role: input.role,
        address: input.address,
        skills: input.skills,
        availability: input.availability,
        serviceArea: input.serviceArea,
        organizationName: input.organizationName,
        registrationNumber: input.registrationNumber,
        authority: input.authority,
        contactNumber: input.contactNumber,
      },
      select: PUBLIC_USER,
    });
    if (input.role === 'RESCUE_TEAM' && input.team) {
      await tx.rescueTeam.create({
        data: {
          name: input.team.name,
          teamType: input.team.teamType,
          memberCount: input.team.memberCount,
          capability: input.team.capability,
          currentLocation: input.team.currentLocation,
          latitude: input.team.latitude,
          longitude: input.team.longitude,
          userId: created.id,
        },
      });
    }
    return created;
  });

  await writeAuditLog({
    actorId,
    action: 'ADMIN_USER_CREATE',
    target: 'User',
    targetId: user.id,
    metadata: { role: input.role, email: input.email },
  });
  return user;
}

export async function listUsers(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const role = query.role as Role | undefined;
  const search = (query.search as string | undefined)?.trim();
  const where = {
    ...(role ? { role } : {}),
    ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {}),
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, select: PUBLIC_USER, orderBy: { createdAt: 'desc' }, skip, take: limit }),
  ]);
  return { users, meta: pageMeta(total, { page, limit, skip }) };
}
