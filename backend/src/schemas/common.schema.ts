import { z } from 'zod';

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().max(50).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export const cuid = z.string().min(1).max(50);

/**
 * Strict boolean parser (BE-09). Accepts real booleans and the exact
 * strings "true"/"false" (query params always arrive as strings); anything
 * else is rejected. Unlike z.coerce.boolean() — where Boolean("false")
 * is === true — the string "false" is false here.
 */
export const strictBoolean = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true');
