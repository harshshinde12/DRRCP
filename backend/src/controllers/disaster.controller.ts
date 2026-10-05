import type { Request, Response } from 'express';
import { created, ok } from '../utils/response.js';
import { createDisasterSchema, listDisastersQuery, updateDisasterSchema } from '../schemas/disaster.schema.js';
import * as disasterService from '../services/disasterService.js';
import { HttpError } from '../utils/httpErrors.js';

export async function createDisaster(req: Request, res: Response) {
  const disaster = await disasterService.createDisaster(req.user!.id, createDisasterSchema.parse(req.body));
  return created(res, { disaster });
}

export async function listDisasters(req: Request, res: Response) {
  const query = listDisastersQuery.parse(req.query);
  const { disasters, meta } = await disasterService.listDisasters(query as Record<string, unknown>);
  return ok(res, disasters, 200, meta);
}

export async function getActiveDisaster(_req: Request, res: Response) {
  const disaster = await disasterService.getActiveDisaster();
  if (!disaster) throw new HttpError(404, 'No active disaster');
  return ok(res, { disaster });
}

export async function getDisaster(req: Request, res: Response) {
  return ok(res, { disaster: await disasterService.getDisaster(req.params.id) });
}

export async function updateDisaster(req: Request, res: Response) {
  const disaster = await disasterService.updateDisaster(req.user!.id, req.params.id, updateDisasterSchema.parse(req.body));
  return ok(res, { disaster });
}

export async function activateDisaster(req: Request, res: Response) {
  const disaster = await disasterService.activateDisaster(req.user!.id, req.params.id);
  return ok(res, { disaster });
}

export async function closeDisaster(req: Request, res: Response) {
  const disaster = await disasterService.closeDisaster(req.user!.id, req.params.id);
  return ok(res, { disaster });
}
