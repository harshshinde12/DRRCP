import type { Request, Response } from 'express';
import { created, ok } from '../utils/response.js';
import {
  allocationStatusSchema,
  createAllocationSchema,
  createInventorySchema,
  createItemSchema,
  createResourceRequestSchema,
  listAllocationsQuery,
  listInventoryQuery,
  listItemsQuery,
  listResourceRequestsQuery,
  updateInventorySchema,
  updateItemSchema,
} from '../schemas/relief.schema.js';
import * as reliefService from '../services/reliefService.js';

export async function createItem(req: Request, res: Response) {
  return created(res, { item: await reliefService.createItem(req.user!.id, createItemSchema.parse(req.body)) });
}

export async function listItems(req: Request, res: Response) {
  const query = listItemsQuery.parse(req.query);
  const { items, meta } = await reliefService.listItems(query as Record<string, unknown>);
  return ok(res, items, 200, meta);
}

export async function getItem(req: Request, res: Response) {
  return ok(res, { item: await reliefService.getItem(req.params.id) });
}

export async function updateItem(req: Request, res: Response) {
  return ok(res, { item: await reliefService.updateItem(req.user!.id, req.params.id, updateItemSchema.parse(req.body)) });
}

export async function deleteItem(req: Request, res: Response) {
  return ok(res, await reliefService.deleteItem(req.user!.id, req.params.id));
}

export async function createInventory(req: Request, res: Response) {
  const record = await reliefService.createInventory(req.user!.id, req.user!.name, createInventorySchema.parse(req.body));
  return created(res, { inventory: record });
}

export async function listInventory(req: Request, res: Response) {
  const query = listInventoryQuery.parse(req.query);
  const { records, meta } = await reliefService.listInventory(query as Record<string, unknown>);
  return ok(res, records, 200, meta);
}

export async function getInventory(req: Request, res: Response) {
  return ok(res, { inventory: await reliefService.getInventory(req.params.id) });
}

export async function updateInventory(req: Request, res: Response) {
  const record = await reliefService.updateInventory(req.user!.id, req.user!.role, req.params.id, updateInventorySchema.parse(req.body));
  return ok(res, { inventory: record });
}

export async function shortages(_req: Request, res: Response) {
  return ok(res, await reliefService.shortages());
}

export async function createResourceRequest(req: Request, res: Response) {
  const rr = await reliefService.createResourceRequest(req.user!.id, req.user!.role, createResourceRequestSchema.parse(req.body));
  return created(res, { resourceRequest: rr });
}

export async function listResourceRequests(req: Request, res: Response) {
  const query = listResourceRequestsQuery.parse(req.query);
  const { requests, meta } = await reliefService.listResourceRequests(req.user!.id, req.user!.role, query as Record<string, unknown>);
  return ok(res, requests, 200, meta);
}

export async function getResourceRequest(req: Request, res: Response) {
  return ok(res, { resourceRequest: await reliefService.getResourceRequest(req.user!.id, req.user!.role, req.params.id) });
}

export async function approveResourceRequest(req: Request, res: Response) {
  return ok(res, { resourceRequest: await reliefService.approveResourceRequest(req.user!.id, req.params.id) });
}

export async function rejectResourceRequest(req: Request, res: Response) {
  return ok(res, { resourceRequest: await reliefService.rejectResourceRequest(req.user!.id, req.params.id) });
}

export async function cancelResourceRequest(req: Request, res: Response) {
  return ok(res, { resourceRequest: await reliefService.cancelResourceRequest(req.user!.id, req.user!.role, req.params.id) });
}

export async function createAllocation(req: Request, res: Response) {
  const { resourceRequestId, inventoryId, quantity } = createAllocationSchema.parse(req.body);
  const allocation = await reliefService.createAllocation(req.user!.id, resourceRequestId, inventoryId, quantity);
  return created(res, { allocation });
}

export async function listAllocations(req: Request, res: Response) {
  const query = listAllocationsQuery.parse(req.query);
  const { allocations, meta } = await reliefService.listAllocations(query as Record<string, unknown>);
  return ok(res, allocations, 200, meta);
}

export async function getAllocation(req: Request, res: Response) {
  return ok(res, { allocation: await reliefService.getAllocation(req.params.id) });
}

export async function updateAllocationStatus(req: Request, res: Response) {
  const { status } = allocationStatusSchema.parse(req.body);
  return ok(res, { allocation: await reliefService.updateAllocationStatus(req.user!.id, req.params.id, status) });
}
