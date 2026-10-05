import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Role } from './enums.js';

export type JwtPayload = { sub: string; role: Role };

export function signToken(payload: JwtPayload): string {
  // @ts-expect-error jsonwebtoken expiresIn typing varies across versions
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
