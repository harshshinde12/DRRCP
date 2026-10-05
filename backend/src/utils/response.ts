import type { Response } from 'express';

// Consistent JSON envelope: { success, data, error, meta }
// Success: { success: true, data }
// Failure (via error handler): { success: false, error: { message, details? } }

export function ok<T>(res: Response, data: T, status = 200, meta?: Record<string, unknown>) {
  return res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function created<T>(res: Response, data: T, meta?: Record<string, unknown>) {
  return ok(res, data, 201, meta);
}

export function fail(res: Response, message: string, status = 400, details?: unknown) {
  return res.status(status).json({ success: false, error: { message, ...(details ? { details } : {}) } });
}
