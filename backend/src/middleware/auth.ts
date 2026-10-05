import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import type { Role } from '../utils/enums.js';
import { verifyToken } from '../utils/jwt.js';

export type AuthUser = { id: string; role: Role; email: string; name: string };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function getToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  // Header-only auth: no cookie-parser is registered, so there is no cookie path.
  return null;
}

/** Require a valid JWT. Attaches req.user. (FR-01) */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }
    req.user = { id: user.id, role: user.role as Role, email: user.email, name: user.name };
    next();
  } catch {
    return res.status(401).json({ success: false, error: { message: 'Invalid or expired token' } });
  }
}

/**
 * Attach req.user when a valid token is present, otherwise continue
 * anonymously (never 401s). For public routes that personalize output
 * (e.g. shelter manager email visible to ADMIN/owner only, S-01).
 */
export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const token = getToken(req);
  if (token) {
    try {
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (user && user.isActive) {
        req.user = { id: user.id, role: user.role as Role, email: user.email, name: user.name };
      }
    } catch {
      // Invalid token on a public route → stay anonymous.
    }
  }
  next();
}

/** Require one of the given roles. Must be used after authenticate. (FR-02) */
export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, error: { message: `Forbidden: requires role ${roles.join(' or ')}` } });
    }
    next();
  };
}
