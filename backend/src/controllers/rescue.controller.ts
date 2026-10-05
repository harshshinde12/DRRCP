import type { Request, Response } from 'express';
import { created, ok } from '../utils/response.js';
import {
  assignTeamSchema,
  assignmentStatusSchema,
  createTeamSchema,
  listAssignmentsQuery,
  listTeamsQuery,
  reportSchema,
  supportSchema,
  updateTeamSchema,
} from '../schemas/rescue.schema.js';
import * as rescueService from '../services/rescueService.js';

export async function createTeam(req: Request, res: Response) {
  const team = await rescueService.createTeam(req.user!.id, createTeamSchema.parse(req.body));
  return created(res, { team });
}

export async function listTeams(req: Request, res: Response) {
  const query = listTeamsQuery.parse(req.query);
  const { teams, meta } = await rescueService.listTeams(query as Record<string, unknown>);
  return ok(res, teams, 200, meta);
}

export async function getTeam(req: Request, res: Response) {
  return ok(res, { team: await rescueService.getTeam(req.params.id) });
}

export async function updateTeam(req: Request, res: Response) {
  const team = await rescueService.updateTeam(req.user!.id, req.params.id, updateTeamSchema.parse(req.body));
  return ok(res, { team });
}

export async function matchingTeams(req: Request, res: Response) {
  const { request, teams } = await rescueService.matchingTeams(req.params.id);
  return ok(res, { request, teams });
}

export async function assignTeam(req: Request, res: Response) {
  const { teamId, override, overrideReason } = assignTeamSchema.parse(req.body);
  const assignment = await rescueService.assignTeam(req.user!.id, req.params.id, teamId, override, overrideReason);
  return created(res, { assignment });
}

export async function listAssignments(req: Request, res: Response) {
  const query = listAssignmentsQuery.parse(req.query);
  const { assignments, meta } = await rescueService.listAssignments(req.user!.id, req.user!.role, query as Record<string, unknown>);
  return ok(res, assignments, 200, meta);
}

export async function getAssignment(req: Request, res: Response) {
  const assignment = await rescueService.getAssignment(req.user!.id, req.user!.role, req.params.id);
  return ok(res, { assignment });
}

export async function acknowledge(req: Request, res: Response) {
  const assignment = await rescueService.acknowledgeAssignment(req.user!.id, req.params.id);
  return ok(res, { assignment });
}

export async function updateStatus(req: Request, res: Response) {
  const { status } = assignmentStatusSchema.parse(req.body);
  const assignment = await rescueService.updateAssignmentStatus(req.user!.id, req.params.id, status);
  return ok(res, { assignment });
}

export async function requestSupport(req: Request, res: Response) {
  const { notes } = supportSchema.parse(req.body);
  return ok(res, await rescueService.requestSupport(req.user!.id, req.params.id, notes));
}

export async function submitReport(req: Request, res: Response) {
  const report = await rescueService.submitReport(req.user!.id, req.params.id, reportSchema.parse(req.body));
  return created(res, { report });
}

export async function cancelAssignment(req: Request, res: Response) {
  const assignment = await rescueService.cancelAssignment(req.user!.id, req.params.id);
  return ok(res, { assignment });
}
