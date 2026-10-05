import type { Request, Response } from 'express';
import { created, ok } from '../utils/response.js';
import {
  createTaskSchema,
  listTasksQuery,
  listVolunteersQuery,
  suggestVolunteersQuery,
  taskStatusSchema,
  updateVolunteerSchema,
} from '../schemas/volunteer.schema.js';
import * as volunteerService from '../services/volunteerService.js';

export async function listVolunteers(req: Request, res: Response) {
  const query = listVolunteersQuery.parse(req.query);
  const { volunteers, meta } = await volunteerService.listVolunteers(query as Record<string, unknown>);
  return ok(res, volunteers, 200, meta);
}

export async function getVolunteer(req: Request, res: Response) {
  const volunteer = await volunteerService.getVolunteer(req.user!.id, req.user!.role, req.params.id);
  return ok(res, { volunteer });
}

export async function updateVolunteer(req: Request, res: Response) {
  const volunteer = await volunteerService.updateVolunteer(req.user!.id, req.user!.role, req.params.id, updateVolunteerSchema.parse(req.body));
  return ok(res, { volunteer });
}

export async function suggestVolunteers(req: Request, res: Response) {
  const { taskType, location, limit } = suggestVolunteersQuery.parse(req.query);
  return ok(res, await volunteerService.suggestVolunteers(taskType, location, limit));
}

export async function createTask(req: Request, res: Response) {
  const task = await volunteerService.createTask(req.user!.id, createTaskSchema.parse(req.body));
  return created(res, { task });
}

export async function listTasks(req: Request, res: Response) {
  const query = listTasksQuery.parse(req.query);
  const { tasks, meta } = await volunteerService.listTasks(req.user!.id, req.user!.role, query as Record<string, unknown>);
  return ok(res, tasks, 200, meta);
}

export async function getTask(req: Request, res: Response) {
  const task = await volunteerService.getTask(req.user!.id, req.user!.role, req.params.id);
  return ok(res, { task });
}

export async function acceptTask(req: Request, res: Response) {
  const task = await volunteerService.acceptTask(req.user!.id, req.params.id);
  return ok(res, { task });
}

export async function declineTask(req: Request, res: Response) {
  const task = await volunteerService.declineTask(req.user!.id, req.params.id);
  return ok(res, { task });
}

export async function updateTaskStatus(req: Request, res: Response) {
  const { status } = taskStatusSchema.parse(req.body);
  const action = req.user!.role === 'ADMIN' ? 'VOLUNTEER_TASK_STATUS_ADMIN' : 'VOLUNTEER_TASK_STATUS';
  const task = await volunteerService.progressTask(req.user!.id, req.user!.role, req.params.id, status, action);
  return ok(res, { task });
}
