import type { Request, Response } from 'express';
import { created, ok } from '../utils/response.js';
import { adminCreateUserSchema, adminListUsersQuery } from '../schemas/admin.schema.js';
import * as adminService from '../services/adminService.js';

export async function createUser(req: Request, res: Response) {
  const input = adminCreateUserSchema.parse(req.body);
  const user = await adminService.createUserAsAdmin(req.user!.id, input);
  return created(res, { user });
}

export async function listUsers(req: Request, res: Response) {
  const query = adminListUsersQuery.parse(req.query);
  const { users, meta } = await adminService.listUsers(query as Record<string, unknown>);
  return ok(res, users, 200, meta);
}
