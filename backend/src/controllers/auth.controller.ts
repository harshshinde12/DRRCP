import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { PUBLIC_ROLES, type Role } from '../utils/enums.js';
import { signToken } from '../utils/jwt.js';
import { created, ok } from '../utils/response.js';
import { writeAuditLog } from '../utils/audit.js';

function toPublicUser(u: { id: string; name: string; email: string; role: unknown; phone: string | null }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone };
}

/** Roles that may self-register (single source: enums.PUBLIC_ROLES). ADMIN and RESCUE_TEAM are admin-provisioned (SRS AS-2). */

/** POST /api/auth/register — public self-registration (FR-01). */
export async function register(req: Request, res: Response) {
  const { name, email, password, phone, role, ...profile } = req.body as Record<string, string>;
  const requestedRole = (role ?? 'CITIZEN') as Role;

  if (!PUBLIC_ROLES.includes(requestedRole)) {
    return res.status(403).json({
      success: false,
      error: { message: `Self-registration is not allowed for role ${requestedRole}. Contact an administrator.` },
    });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ success: false, error: { message: 'Email already registered' } });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      passwordHash,
      role: requestedRole,
      address: profile.address,
      skills: profile.skills,
      availability: profile.availability,
      serviceArea: profile.serviceArea,
      organizationName: profile.organizationName,
      contactNumber: profile.contactNumber,
    },
  });

  await writeAuditLog({ actorId: user.id, action: 'AUTH_REGISTER', target: 'User', targetId: user.id });

  const token = signToken({ sub: user.id, role: user.role as Role });
  return created(res, { user: toPublicUser(user), token });
}

/** POST /api/auth/login — credential check + JWT (FR-01). */
export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });

  await writeAuditLog({ actorId: user.id, action: 'AUTH_LOGIN', target: 'User', targetId: user.id });
  const token = signToken({ sub: user.id, role: user.role as Role });
  return ok(res, { user: toPublicUser(user), token });
}

/** POST /api/auth/logout — stateless JWT: client discards token; server logs the event. */
export async function logout(req: Request, res: Response) {
  if (req.user) {
    await writeAuditLog({ actorId: req.user.id, action: 'AUTH_LOGOUT', target: 'User', targetId: req.user.id });
  }
  return ok(res, { message: 'Logged out. Please discard your token on the client.' });
}

/** GET /api/auth/me — current session user. */
export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, name: true, email: true, role: true, phone: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ success: false, error: { message: 'User not found' } });
  return ok(res, { user });
}
