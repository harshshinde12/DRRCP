import { z } from 'zod';
import { ALLOCATION_STATUSES, PRIORITIES, RESOURCE_REQUEST_STATUSES } from '../utils/enums.js';
import { strictBoolean } from './common.schema.js';

export const createItemSchema = z.object({
  itemName: z.string().min(2).max(200),
  category: z.enum(['FOOD', 'WATER', 'MEDICINE', 'CLOTHING', 'HYGIENE', 'EQUIPMENT']),
  unit: z.string().min(1).max(30),
});

export const updateItemSchema = createItemSchema.partial();

export const listItemsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  category: z.string().max(50).optional(),
  search: z.string().max(100).optional(),
});

export const createInventorySchema = z.object({
  itemId: z.string().min(1),
  location: z.string().min(1).max(300),
  organization: z.string().max(200).optional(),
  quantityAvailable: z.coerce.number().int().min(0).max(10000000),
});

export const updateInventorySchema = z.object({
  location: z.string().min(1).max(300).optional(),
  organization: z.string().max(200).optional(),
  quantityAvailable: z.coerce.number().int().min(0).max(10000000).optional(),
});

export const listInventoryQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  itemId: z.string().min(1).optional(),
  location: z.string().max(200).optional(),
  lowStock: strictBoolean.optional(),
});

export const createResourceRequestSchema = z.object({
  shelterId: z.string().min(1).optional(),
  itemId: z.string().min(1),
  quantityRequired: z.coerce.number().int().min(1).max(10000000),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
});

export const listResourceRequestsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(RESOURCE_REQUEST_STATUSES).optional(),
  itemId: z.string().min(1).optional(),
  shelterId: z.string().min(1).optional(),
});

export const createAllocationSchema = z.object({
  resourceRequestId: z.string().min(1),
  inventoryId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(10000000),
});

export const listAllocationsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(ALLOCATION_STATUSES).optional(),
  resourceRequestId: z.string().min(1).optional(),
});

export const allocationStatusSchema = z.object({
  status: z.enum(ALLOCATION_STATUSES),
});
