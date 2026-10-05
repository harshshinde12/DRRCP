import type { Request, Response } from 'express';
import { created, ok } from '../utils/response.js';
import {
  createRequestSchema,
  listRequestsQuery,
  setPrioritySchema,
  verifyRequestSchema,
} from '../schemas/request.schema.js';
import * as requestService from '../services/requestService.js';

export async function submitRequest(req: Request, res: Response) {
  const request = await requestService.submitRequest(req.user!.id, createRequestSchema.parse(req.body));
  return created(res, { request });
}

export async function listRequests(req: Request, res: Response) {
  const query = listRequestsQuery.parse(req.query);
  const { requests, meta } = await requestService.listRequests(
    req.user!.id,
    req.user!.role,
    query as Record<string, unknown>,
  );
  return ok(res, requests, 200, meta);
}

export async function getRequest(req: Request, res: Response) {
  const request = await requestService.getRequest(req.user!.id, req.user!.role, req.params.id);
  return ok(res, { request });
}

export async function getHistory(req: Request, res: Response) {
  const history = await requestService.getRequestHistory(req.user!.id, req.user!.role, req.params.id);
  return ok(res, history);
}

export async function cancelRequest(req: Request, res: Response) {
  const request = await requestService.cancelRequest(req.user!.id, req.params.id);
  return ok(res, { request });
}

export async function verifyRequest(req: Request, res: Response) {
  const { decision, priority, duplicateOfId } = verifyRequestSchema.parse(req.body);
  const request = await requestService.verifyRequest(req.user!.id, req.params.id, decision, priority, duplicateOfId);
  return ok(res, { request });
}

export async function setPriority(req: Request, res: Response) {
  const { priority } = setPrioritySchema.parse(req.body);
  const request = await requestService.setPriority(req.user!.id, req.params.id, priority);
  return ok(res, { request });
}
