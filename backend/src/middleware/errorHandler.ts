import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

// Central error handler → consistent { success:false, error:{message} } envelope.
// Must be registered LAST (after routes). eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error('[error]', err); // server-side log keeps full details (incl. Prisma internals)
  if (res.headersSent) return;
  if (err instanceof ZodError) {
    return res
      .status(400)
      .json({ success: false, error: { message: 'Validation failed', details: err.flatten().fieldErrors } });
  }
  const status = (err as { status?: number }).status;
  if (status && status >= 400 && status < 500) {
    // Intentional app error (HttpError): the message is authored, safe to return.
    const message = err instanceof Error ? err.message : 'Request failed';
    const details = (err as { details?: unknown }).details;
    return res.status(status).json({ success: false, error: { message, ...(details ? { details } : {}) } });
  }
  const code = (err as { code?: string }).code;
  if (code === 'P2002') return res.status(409).json({ success: false, error: { message: 'A record with these unique values already exists' } });
  if (code === 'P2025') return res.status(404).json({ success: false, error: { message: 'Record not found' } });
  if (code === 'P2003' || code === 'P2014') {
    return res.status(409).json({ success: false, error: { message: 'Operation conflicts with linked records' } });
  }
  // 5xx and unknown errors: never return raw messages (Prisma internals leak, BE-14).
  res.status(status && status >= 500 ? status : 500).json({ success: false, error: { message: 'Internal server error' } });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ success: false, error: { message: 'Not found' } });
}
