import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

// Central error handler → consistent { success:false, error:{message} } envelope.
// Must be registered LAST (after routes). eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error('[error]', err);
  if (res.headersSent) return;
  if (err instanceof ZodError) {
    return res
      .status(400)
      .json({ success: false, error: { message: 'Validation failed', details: err.flatten().fieldErrors } });
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  const status = (err as { status?: number }).status ?? 500;
  const details = (err as { details?: unknown }).details;
  res.status(status).json({ success: false, error: { message, ...(details ? { details } : {}) } });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ success: false, error: { message: 'Not found' } });
}
