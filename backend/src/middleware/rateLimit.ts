import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const passThrough = (_req: Request, _res: Response, next: NextFunction) => next();

// Rate limiting is disabled in tests (NODE_ENV=test) so suites never get 429s.
function makeLimiter(max: number, windowMs: number, message: string) {
  if (env.NODE_ENV === 'test') return passThrough;
  return rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, error: { message } },
  });
}

// Global API limiter (generous for classroom demo; RMMM R5).
export const apiLimiter = makeLimiter(
  env.API_RATE_LIMIT_MAX,
  env.API_RATE_LIMIT_WINDOW_MS,
  'Too many requests, please try again later',
);

// Stricter limiter for auth endpoints to slow brute force (RMMM R5).
export const authLimiter = makeLimiter(
  env.AUTH_RATE_LIMIT_MAX,
  env.AUTH_RATE_LIMIT_WINDOW_MS,
  'Too many auth attempts, please try again later',
);
