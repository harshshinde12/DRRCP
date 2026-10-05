import type { Request, Response } from 'express';
import { created, ok } from '../utils/response.js';
import {
  createShelterSchema,
  listSheltersQuery,
  nearbySheltersQuery,
  updateShelterSchema,
} from '../schemas/shelter.schema.js';
import * as shelterService from '../services/shelterService.js';

export async function createShelter(req: Request, res: Response) {
  const shelter = await shelterService.createShelter(req.user!.id, req.user!.role, createShelterSchema.parse(req.body));
  return created(res, { shelter });
}

export async function listShelters(req: Request, res: Response) {
  const query = listSheltersQuery.parse(req.query);
  const { shelters, meta } = await shelterService.listShelters(query as Record<string, unknown>);
  return ok(res, shelters, 200, meta);
}

export async function nearbyShelters(req: Request, res: Response) {
  const { lat, lng, radiusKm, limit } = nearbySheltersQuery.parse(req.query);
  return ok(res, await shelterService.nearbyShelters(lat, lng, radiusKm, limit));
}

export async function getShelter(req: Request, res: Response) {
  return ok(res, { shelter: await shelterService.getShelter(req.params.id) });
}

export async function updateShelter(req: Request, res: Response) {
  const shelter = await shelterService.updateShelter(req.user!.id, req.user!.role, req.params.id, updateShelterSchema.parse(req.body));
  return ok(res, { shelter });
}

export async function deleteShelter(req: Request, res: Response) {
  return ok(res, await shelterService.deleteShelter(req.user!.id, req.params.id));
}
