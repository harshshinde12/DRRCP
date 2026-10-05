import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { writeAuditLog } from '../utils/audit.js';
import {
  canTransitionAllocation,
  canTransitionResourceRequest,
  type AllocationStatus,
  type ResourceRequestStatus,
} from '../utils/enums.js';
import { HttpError } from '../utils/httpErrors.js';
import { notify } from '../utils/notify.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';
import {
  createInventorySchema,
  createItemSchema,
  createResourceRequestSchema,
  updateInventorySchema,
  updateItemSchema,
} from '../schemas/relief.schema.js';

type CreateItemInput = z.infer<typeof createItemSchema>;
type UpdateItemInput = z.infer<typeof updateItemSchema>;
type CreateInventoryInput = z.infer<typeof createInventorySchema>;
type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
type CreateResourceRequestInput = z.infer<typeof createResourceRequestSchema>;

// ── Relief items ──

export async function createItem(actorId: string, input: CreateItemInput) {
  try {
    const item = await prisma.reliefItem.create({ data: input });
    await writeAuditLog({ actorId, action: 'RELIEF_ITEM_CREATE', target: 'ReliefItem', targetId: item.id, metadata: input as Record<string, unknown> });
    return item;
  } catch {
    throw new HttpError(409, 'A relief item with this name and category already exists');
  }
}

export async function listItems(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const where = {
    ...(query.category ? { category: query.category as string } : {}),
    ...((query.search as string | undefined)?.trim() ? { itemName: { contains: query.search as string } } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.reliefItem.count({ where }),
    prisma.reliefItem.findMany({ where, orderBy: { itemName: 'asc' }, skip, take: limit }),
  ]);
  return { items, meta: pageMeta(total, { page, limit, skip }) };
}

export async function getItem(id: string) {
  const item = await prisma.reliefItem.findUnique({ where: { id }, include: { inventories: true } });
  if (!item) throw new HttpError(404, 'Relief item not found');
  return item;
}

export async function updateItem(actorId: string, id: string, input: UpdateItemInput) {
  await getItem(id);
  const item = await prisma.reliefItem.update({ where: { id }, data: input });
  await writeAuditLog({ actorId, action: 'RELIEF_ITEM_UPDATE', target: 'ReliefItem', targetId: id, metadata: input as Record<string, unknown> });
  return item;
}

export async function deleteItem(actorId: string, id: string) {
  await getItem(id);
  const used = await prisma.inventory.count({ where: { itemId: id } });
  if (used > 0) throw new HttpError(409, 'Cannot delete an item that has inventory records');
  await prisma.reliefItem.delete({ where: { id } });
  await writeAuditLog({ actorId, action: 'RELIEF_ITEM_DELETE', target: 'ReliefItem', targetId: id });
  return { id };
}

// ── Inventory ──

export async function createInventory(actorId: string, actorName: string, input: CreateInventoryInput) {
  const item = await prisma.reliefItem.findUnique({ where: { id: input.itemId } });
  if (!item) throw new HttpError(404, 'Relief item not found');
  const record = await prisma.inventory.create({
    data: { ...input, managedById: actorId, organization: input.organization ?? actorName },
  });
  await writeAuditLog({ actorId, action: 'INVENTORY_CREATE', target: 'Inventory', targetId: record.id, metadata: { itemId: input.itemId, quantity: input.quantityAvailable } });
  return record;
}

export async function listInventory(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const where = {
    ...(query.itemId ? { itemId: query.itemId as string } : {}),
    ...(query.location ? { location: { contains: query.location as string } } : {}),
    ...(query.lowStock ? { quantityAvailable: { lte: 50 } } : {}),
  };
  const [total, records] = await Promise.all([
    prisma.inventory.count({ where }),
    prisma.inventory.findMany({ where, include: { item: true }, orderBy: { updatedAt: 'desc' }, skip, take: limit }),
  ]);
  return { records, meta: pageMeta(total, { page, limit, skip }) };
}

export async function getInventory(id: string) {
  const record = await prisma.inventory.findUnique({ where: { id }, include: { item: true, allocations: true } });
  if (!record) throw new HttpError(404, 'Inventory record not found');
  return record;
}

export async function updateInventory(actorId: string, actorRole: string, id: string, input: UpdateInventoryInput) {
  const record = await getInventory(id);
  if (actorRole !== 'ADMIN' && record.managedById !== actorId) {
    throw new HttpError(403, 'Only the managing NGO or an admin can adjust this stock');
  }
  const updated = await prisma.inventory.update({ where: { id }, data: input });
  await writeAuditLog({ actorId, action: 'INVENTORY_ADJUST', target: 'Inventory', targetId: id, metadata: { from: record.quantityAvailable, ...input } as Record<string, unknown> });
  return updated;
}

/** Shortages: items where verified pending demand exceeds stock on hand. */
export async function shortages() {
  const [inventories, openRequests] = await Promise.all([
    prisma.inventory.findMany({ include: { item: true } }),
    prisma.resourceRequest.findMany({
      where: { status: { in: ['PENDING', 'APPROVED', 'PARTIALLY_FULFILLED'] } },
      include: { item: true },
    }),
  ]);
  const stockByItem = new Map<string, { item: (typeof inventories)[number]['item']; available: number }>();
  for (const inv of inventories) {
    const cur = stockByItem.get(inv.itemId) ?? { item: inv.item, available: 0 };
    cur.available += inv.quantityAvailable;
    stockByItem.set(inv.itemId, cur);
  }
  const demandByItem = new Map<string, { item: (typeof openRequests)[number]['item']; required: number; fulfilled: number }>();
  for (const r of openRequests) {
    const cur = demandByItem.get(r.itemId) ?? { item: r.item, required: 0, fulfilled: 0 };
    cur.required += r.quantityRequired;
    cur.fulfilled += r.quantityFulfilled;
    demandByItem.set(r.itemId, cur);
  }
  const out: Array<{ itemId: string; itemName: string; unit: string; available: number; required: number; fulfilled: number; shortage: number }> = [];
  for (const [itemId, d] of demandByItem) {
    const available = stockByItem.get(itemId)?.available ?? 0;
    const shortage = d.required - d.fulfilled - available;
    if (shortage > 0) out.push({ itemId, itemName: d.item.itemName, unit: d.item.unit, available, required: d.required, fulfilled: d.fulfilled, shortage });
  }
  return out.sort((a, b) => b.shortage - a.shortage);
}

// ── Resource requests ──

export async function createResourceRequest(requesterId: string, requesterRole: string, input: CreateResourceRequestInput) {
  const item = await prisma.reliefItem.findUnique({ where: { id: input.itemId } });
  if (!item) throw new HttpError(404, 'Relief item not found');
  if (input.shelterId) {
    const shelter = await prisma.shelter.findUnique({ where: { id: input.shelterId } });
    if (!shelter) throw new HttpError(404, 'Shelter not found');
    if (requesterRole === 'SHELTER_MANAGER' && shelter.managerId !== requesterId) {
      throw new HttpError(403, 'You can only raise requests for your own shelter');
    }
  }
  const rr = await prisma.resourceRequest.create({
    data: { requesterId, shelterId: input.shelterId, itemId: input.itemId, quantityRequired: input.quantityRequired, priority: input.priority, status: 'PENDING' },
    include: { item: true, shelter: true },
  });
  await writeAuditLog({ actorId: requesterId, action: 'RESOURCE_REQUEST_CREATE', target: 'ResourceRequest', targetId: rr.id, metadata: { itemId: input.itemId, quantity: input.quantityRequired } });
  return rr;
}

export async function listResourceRequests(viewerId: string, viewerRole: string, query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const where = {
    ...(viewerRole === 'SHELTER_MANAGER' ? { requesterId: viewerId } : {}),
    ...(query.status ? { status: query.status as string } : {}),
    ...(query.itemId ? { itemId: query.itemId as string } : {}),
    ...(query.shelterId ? { shelterId: query.shelterId as string } : {}),
  };
  const [total, requests] = await Promise.all([
    prisma.resourceRequest.count({ where }),
    prisma.resourceRequest.findMany({ where, include: { item: true, shelter: true }, orderBy: { requestedAt: 'desc' }, skip, take: limit }),
  ]);
  return { requests, meta: pageMeta(total, { page, limit, skip }) };
}

export async function getResourceRequest(viewerId: string, viewerRole: string, id: string) {
  const rr = await prisma.resourceRequest.findUnique({
    where: { id },
    include: { item: true, shelter: true, allocations: { include: { inventory: true } } },
  });
  if (!rr) throw new HttpError(404, 'Resource request not found');
  if (viewerRole === 'SHELTER_MANAGER' && rr.requesterId !== viewerId) {
    throw new HttpError(403, 'You can only view your own resource requests');
  }
  return rr;
}

async function progressResourceRequest(actorId: string, id: string, to: ResourceRequestStatus, action: string) {
  const rr = await prisma.resourceRequest.findUnique({ where: { id } });
  if (!rr) throw new HttpError(404, 'Resource request not found');
  if (!canTransitionResourceRequest(rr.status as ResourceRequestStatus, to)) {
    throw new HttpError(422, `Invalid resource-request transition: ${rr.status} → ${to}`);
  }
  const updated = await prisma.resourceRequest.update({ where: { id }, data: { status: to } });
  await writeAuditLog({ actorId, action, target: 'ResourceRequest', targetId: id, metadata: { from: rr.status, to } });
  await notify(rr.requesterId, `Your resource request is now ${to}.`, 'RESOURCE_UPDATE');
  return updated;
}

export async function approveResourceRequest(actorId: string, id: string) {
  return progressResourceRequest(actorId, id, 'APPROVED', 'RESOURCE_REQUEST_APPROVE');
}

export async function rejectResourceRequest(actorId: string, id: string) {
  return progressResourceRequest(actorId, id, 'REJECTED', 'RESOURCE_REQUEST_REJECT');
}

export async function cancelResourceRequest(actorId: string, actorRole: string, id: string) {
  const rr = await prisma.resourceRequest.findUnique({ where: { id } });
  if (!rr) throw new HttpError(404, 'Resource request not found');
  if (actorRole === 'SHELTER_MANAGER' && rr.requesterId !== actorId) throw new HttpError(403, 'You can only cancel your own resource requests');
  return progressResourceRequest(actorId, id, 'CANCELLED', 'RESOURCE_REQUEST_CANCEL');
}

// ── Allocations (atomic) ──

export async function createAllocation(actorId: string, resourceRequestId: string, inventoryId: string, quantity: number) {
  const result = await prisma.$transaction(async (tx) => {
    const rr = await tx.resourceRequest.findUnique({ where: { id: resourceRequestId } });
    if (!rr) throw new HttpError(404, 'Resource request not found');
    if (!['APPROVED', 'PARTIALLY_FULFILLED'].includes(rr.status)) {
      throw new HttpError(422, `Can only allocate to APPROVED requests (now ${rr.status})`);
    }
    const inv = await tx.inventory.findUnique({ where: { id: inventoryId } });
    if (!inv) throw new HttpError(404, 'Inventory record not found');
    if (inv.itemId !== rr.itemId) throw new HttpError(422, 'Inventory item does not match the requested item');
    // SRS Allocation.Block — never exceed confirmed stock.
    if (quantity > inv.quantityAvailable) {
      throw new HttpError(422, `Over-allocation blocked: requested ${quantity} but only ${inv.quantityAvailable} available`);
    }
    const remaining = rr.quantityRequired - rr.quantityFulfilled;
    if (quantity > remaining) {
      throw new HttpError(422, `Over-allocation blocked: requested ${quantity} but only ${remaining} still required`);
    }
    const allocation = await tx.resourceAllocation.create({
      data: { resourceRequestId, inventoryId, quantity, allocatedById: actorId, status: 'ALLOCATED' },
    });
    const fulfilled = rr.quantityFulfilled + quantity;
    await tx.inventory.update({ where: { id: inventoryId }, data: { quantityAvailable: inv.quantityAvailable - quantity } });
    await tx.resourceRequest.update({
      where: { id: resourceRequestId },
      data: { quantityFulfilled: fulfilled, status: fulfilled >= rr.quantityRequired ? 'FULFILLED' : 'PARTIALLY_FULFILLED' },
    });
    return allocation;
  });
  await writeAuditLog({ actorId, action: 'RESOURCE_ALLOCATE', target: 'ResourceAllocation', targetId: result.id, metadata: { resourceRequestId, inventoryId, quantity } });
  const rr = await prisma.resourceRequest.findUnique({ where: { id: resourceRequestId } });
  if (rr) await notify(rr.requesterId, `${quantity} units allocated to your resource request.`, 'RESOURCE_UPDATE');
  return result;
}

export async function listAllocations(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const where = {
    ...(query.status ? { status: query.status as string } : {}),
    ...(query.resourceRequestId ? { resourceRequestId: query.resourceRequestId as string } : {}),
  };
  const [total, allocations] = await Promise.all([
    prisma.resourceAllocation.count({ where }),
    prisma.resourceAllocation.findMany({
      where,
      include: { resourceRequest: { include: { item: true, shelter: true } }, inventory: { include: { item: true } }, allocatedBy: { select: { id: true, name: true } } },
      orderBy: { allocationDate: 'desc' },
      skip,
      take: limit,
    }),
  ]);
  return { allocations, meta: pageMeta(total, { page, limit, skip }) };
}

export async function getAllocation(id: string) {
  const allocation = await prisma.resourceAllocation.findUnique({
    where: { id },
    include: { resourceRequest: { include: { item: true } }, inventory: true, allocatedBy: { select: { id: true, name: true } } },
  });
  if (!allocation) throw new HttpError(404, 'Allocation not found');
  return allocation;
}

export async function updateAllocationStatus(actorId: string, id: string, to: AllocationStatus) {
  const allocation = await prisma.resourceAllocation.findUnique({ where: { id } });
  if (!allocation) throw new HttpError(404, 'Allocation not found');
  if (!canTransitionAllocation(allocation.status as AllocationStatus, to)) {
    throw new HttpError(422, `Invalid allocation transition: ${allocation.status} → ${to}`);
  }
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.resourceAllocation.update({ where: { id }, data: { status: to } });
    if (to === 'CANCELLED' && allocation.inventoryId) {
      // Restore stock + roll back fulfilled count (only pre-delivery cancellations reach here).
      const inv = await tx.inventory.findUnique({ where: { id: allocation.inventoryId } });
      const rr = await tx.resourceRequest.findUnique({ where: { id: allocation.resourceRequestId } });
      if (inv) await tx.inventory.update({ where: { id: inv.id }, data: { quantityAvailable: inv.quantityAvailable + allocation.quantity } });
      if (rr) {
        const fulfilled = Math.max(0, rr.quantityFulfilled - allocation.quantity);
        await tx.resourceRequest.update({
          where: { id: rr.id },
          data: { quantityFulfilled: fulfilled, status: fulfilled <= 0 ? 'APPROVED' : 'PARTIALLY_FULFILLED' },
        });
      }
    }
    return next;
  });
  await writeAuditLog({ actorId, action: 'RESOURCE_ALLOCATION_STATUS', target: 'ResourceAllocation', targetId: id, metadata: { to } });
  return updated;
}
