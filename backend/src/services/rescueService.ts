import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { writeAuditLog } from '../utils/audit.js';
import {
  canTransitionAssignment,
  type AssignmentStatus,
  type TeamAvailability,
} from '../utils/enums.js';
import { haversineKm, tokenize } from '../utils/geo.js';
import { HttpError } from '../utils/httpErrors.js';
import { notify, notifyAdmins } from '../utils/notify.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';
import { createTeamSchema, updateTeamSchema } from '../schemas/rescue.schema.js';
import { transitionRequest } from './requestService.js';

type CreateTeamInput = z.infer<typeof createTeamSchema>;
type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

/** Mirror of assignment progress onto team availability (SRS §3.2). */
const TEAM_MIRROR: Partial<Record<AssignmentStatus, TeamAvailability>> = {
  ASSIGNED: 'ASSIGNED',
  ACKNOWLEDGED: 'ASSIGNED',
  ON_THE_WAY: 'ON_THE_WAY',
  RESCUE_IN_PROGRESS: 'RESCUE_IN_PROGRESS',
  COMPLETED: 'AVAILABLE',
  CANCELLED: 'AVAILABLE',
};

const ACTIVE_ASSIGNMENT = ['ASSIGNED', 'ACKNOWLEDGED', 'ON_THE_WAY', 'RESCUE_IN_PROGRESS'];

// ── Teams ──

export async function createTeam(actorId: string, input: CreateTeamInput) {
  if (input.userId) {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw new HttpError(404, 'Linked user not found');
    if (user.role !== 'RESCUE_TEAM') throw new HttpError(422, 'Linked user must have RESCUE_TEAM role');
  }
  const team = await prisma.rescueTeam.create({ data: input });
  await writeAuditLog({ actorId, action: 'TEAM_REGISTER', target: 'RescueTeam', targetId: team.id, metadata: { name: team.name } });
  return team;
}

export async function listTeams(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const where = {
    ...(query.availabilityStatus ? { availabilityStatus: query.availabilityStatus as string } : {}),
    ...(query.teamType ? { teamType: query.teamType as string } : {}),
    ...(query.capability ? { capability: { contains: query.capability as string } } : {}),
    ...((query.search as string | undefined)?.trim()
      ? { OR: [{ name: { contains: query.search as string } }, { currentLocation: { contains: query.search as string } }] }
      : {}),
  };
  const [total, teams] = await Promise.all([
    prisma.rescueTeam.count({ where }),
    prisma.rescueTeam.findMany({ where, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { updatedAt: 'desc' }, skip, take: limit }),
  ]);
  return { teams, meta: pageMeta(total, { page, limit, skip }) };
}

export async function getTeam(id: string) {
  const team = await prisma.rescueTeam.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } }, assignments: { orderBy: { assignedAt: 'desc' }, take: 20 } },
  });
  if (!team) throw new HttpError(404, 'Rescue team not found');
  return team;
}

export async function updateTeam(actorId: string, id: string, input: UpdateTeamInput) {
  await getTeam(id);
  const team = await prisma.rescueTeam.update({ where: { id }, data: input });
  await writeAuditLog({ actorId, action: 'TEAM_UPDATE', target: 'RescueTeam', targetId: id, metadata: input as Record<string, unknown> });
  return team;
}

/** Team.Match: AVAILABLE teams for a request, ranked by capability overlap then distance. */
export async function matchingTeams(requestId: string) {
  const request = await prisma.emergencyRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new HttpError(404, 'Emergency request not found');
  const teams = await prisma.rescueTeam.findMany({ where: { availabilityStatus: 'AVAILABLE' } });
  const needTokens = tokenize(request.emergencyType);
  const ranked = teams
    .map((t) => {
      const caps = tokenize(t.capability);
      const typeHit = t.teamType.toUpperCase().includes(request.emergencyType) || caps.some((c) => needTokens.includes(c));
      const distanceKm =
        request.latitude != null && request.longitude != null && t.latitude != null && t.longitude != null
          ? haversineKm(request.latitude, request.longitude, t.latitude, t.longitude)
          : null;
      return { ...t, capabilityMatch: typeHit, distanceKm };
    })
    .sort((a, b) => Number(b.capabilityMatch) - Number(a.capabilityMatch) || (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  return { request: { id: request.id, emergencyType: request.emergencyType, location: request.location }, teams: ranked };
}

// ── Assignments ──

function teamOfUser(userId: string) {
  return prisma.rescueTeam.findUnique({ where: { userId } });
}

/** Admin assigns a team (human-confirmed dispatch, SF-1). Drives request VERIFIED→ASSIGNED. */
export async function assignTeam(adminId: string, requestId: string, teamId: string, override = false, overrideReason?: string) {
  const request = await prisma.emergencyRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new HttpError(404, 'Emergency request not found');
  if (!['VERIFIED', 'ASSIGNED', 'RESCUE_IN_PROGRESS'].includes(request.status)) {
    throw new HttpError(422, `Cannot assign a team to a request in status ${request.status}`);
  }
  const team = await prisma.rescueTeam.findUnique({ where: { id: teamId } });
  if (!team) throw new HttpError(404, 'Rescue team not found');
  if (team.availabilityStatus !== 'AVAILABLE' && !override) {
    throw new HttpError(409, `Team ${team.name} is ${team.availabilityStatus}. Pass override:true to force-assign (will be logged).`);
  }
  if (override && (!overrideReason || !overrideReason.trim())) {
    throw new HttpError(422, 'An override reason is required when force-assigning an unavailable team.');
  }

  const firstAssignment = request.status === 'VERIFIED';
  const assignment = await prisma.$transaction(async (tx) => {
    const created = await tx.rescueAssignment.create({
      data: { requestId, teamId, assignedById: adminId, status: 'ASSIGNED' },
      include: { team: true },
    });
    await tx.rescueTeam.update({ where: { id: teamId }, data: { availabilityStatus: 'ASSIGNED' } });
    return created;
  });

  if (firstAssignment) {
    await transitionRequest(requestId, 'ASSIGNED', adminId, 'TEAM_ASSIGN', { metadata: { teamId, team: team.name, override, ...(overrideReason ? { overrideReason } : {}) } });
  } else {
    // Additional support on an already-active request (SRS allows multiple teams).
    await writeAuditLog({ actorId: adminId, action: 'TEAM_ASSIGN', target: 'RescueAssignment', targetId: assignment.id, metadata: { requestId, teamId, team: team.name, override, additionalSupport: true, ...(overrideReason ? { overrideReason } : {}) } });
  }
  if (override) {
    await writeAuditLog({ actorId: adminId, action: 'TEAM_ASSIGN_OVERRIDE', target: 'RescueTeam', targetId: teamId, metadata: { was: team.availabilityStatus, requestId, reason: overrideReason } });
  }
  if (team.userId) await notify(team.userId, `New incident assigned: ${request.location} (${request.emergencyType}, ${request.peopleAffected} people).`, 'ASSIGNMENT');
  return assignment;
}

export async function listAssignments(viewerId: string, viewerRole: string, query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  let teamScope: string | undefined = query.teamId as string | undefined;
  if (viewerRole === 'RESCUE_TEAM') {
    const mine = await teamOfUser(viewerId);
    if (!mine) throw new HttpError(403, 'No rescue-team profile linked to this account');
    teamScope = mine.id;
  }
  const where = {
    ...(teamScope ? { teamId: teamScope } : {}),
    ...(query.status ? { status: query.status as string } : {}),
    ...(query.requestId ? { requestId: query.requestId as string } : {}),
  };
  const [total, assignments] = await Promise.all([
    prisma.rescueAssignment.count({ where }),
    prisma.rescueAssignment.findMany({ where, include: { team: true, request: true, report: true }, orderBy: { assignedAt: 'desc' }, skip, take: limit }),
  ]);
  return { assignments, meta: pageMeta(total, { page, limit, skip }) };
}

export async function getAssignment(viewerId: string, viewerRole: string, id: string) {
  const assignment = await prisma.rescueAssignment.findUnique({
    where: { id },
    include: { team: true, request: true, report: true, assignedBy: { select: { id: true, name: true } } },
  });
  if (!assignment) throw new HttpError(404, 'Assignment not found');
  if (viewerRole === 'RESCUE_TEAM') {
    const mine = await teamOfUser(viewerId);
    if (!mine || mine.id !== assignment.teamId) throw new HttpError(403, 'This assignment belongs to another team');
  }
  return assignment;
}

async function progressAssignment(actorId: string, id: string, to: AssignmentStatus, action: string) {
  const assignment = await prisma.rescueAssignment.findUnique({ where: { id }, include: { request: true, team: true } });
  if (!assignment) throw new HttpError(404, 'Assignment not found');
  if (!canTransitionAssignment(assignment.status as AssignmentStatus, to)) {
    throw new HttpError(422, `Invalid assignment transition: ${assignment.status} → ${to}`);
  }
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.rescueAssignment.update({
      where: { id },
      data: { status: to, ...(to === 'COMPLETED' || to === 'CANCELLED' ? { completedAt: new Date() } : {}) },
    });
    const mirror = TEAM_MIRROR[to];
    if (mirror) await tx.rescueTeam.update({ where: { id: assignment.teamId }, data: { availabilityStatus: mirror } });
    return next;
  });
  await writeAuditLog({ actorId, action, target: 'RescueAssignment', targetId: id, metadata: { from: assignment.status, to } });

  // Mission underway ⇒ request becomes RESCUE_IN_PROGRESS (drives citizen tracking).
  if (to === 'RESCUE_IN_PROGRESS' && assignment.request.status === 'ASSIGNED') {
    await transitionRequest(assignment.requestId, 'RESCUE_IN_PROGRESS', actorId, 'MISSION_PROGRESS', { metadata: { assignmentId: id } });
  }
  return updated;
}

export async function acknowledgeAssignment(teamUserId: string, id: string) {
  const assignment = await getAssignment(teamUserId, 'RESCUE_TEAM', id);
  if (assignment.status !== 'ASSIGNED') throw new HttpError(422, `Only ASSIGNED missions can be acknowledged (now ${assignment.status})`);
  return progressAssignment(teamUserId, id, 'ACKNOWLEDGED', 'ASSIGNMENT_ACK');
}

export async function updateAssignmentStatus(teamUserId: string, id: string, to: AssignmentStatus) {
  await getAssignment(teamUserId, 'RESCUE_TEAM', id); // ownership check
  if (to === 'COMPLETED') throw new HttpError(422, 'COMPLETED requires a rescue report — use POST /assignments/:id/report');
  return progressAssignment(teamUserId, id, to, 'MISSION_STATUS');
}

/** "Rescue unsuccessful → request additional support" (activity diagram): alerts admins, mission stays open. */
export async function requestSupport(teamUserId: string, id: string, notes: string) {
  const assignment = await getAssignment(teamUserId, 'RESCUE_TEAM', id);
  if (!ACTIVE_ASSIGNMENT.includes(assignment.status)) {
    throw new HttpError(422, `Cannot request support for a ${assignment.status} assignment`);
  }
  await writeAuditLog({ actorId: teamUserId, action: 'SUPPORT_REQUESTED', target: 'RescueAssignment', targetId: id, metadata: { requestId: assignment.requestId, notes } });
  await notifyAdmins(`Team ${assignment.team.name} requests additional support on request ${assignment.requestId}: ${notes}`, 'ASSIGNMENT');
  return { assignmentId: id, status: assignment.status, supportRequested: true };
}

/**
 * Rescue report: exactly one per assignment (409 on repeat). Completing the
 * report frees the team and marks the request RESOLVED — the ONLY path to
 * RESOLVED (request becomes RESOLVED only after the report).
 */
export async function submitReport(teamUserId: string, id: string, input: { peopleRescued: number; injuredPeople: number; notes?: string }) {
  const assignment = await getAssignment(teamUserId, 'RESCUE_TEAM', id);
  if (assignment.report) throw new HttpError(409, 'A report already exists for this assignment');
  if (assignment.status !== 'RESCUE_IN_PROGRESS') {
    throw new HttpError(422, `Report requires mission RESCUE_IN_PROGRESS (now ${assignment.status})`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const report = await tx.rescueReport.create({
      data: { assignmentId: id, peopleRescued: input.peopleRescued, injuredPeople: input.injuredPeople, notes: input.notes },
    });
    await tx.rescueAssignment.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    await tx.rescueTeam.update({ where: { id: assignment.teamId }, data: { availabilityStatus: 'AVAILABLE' } });
    return report;
  });
  await writeAuditLog({ actorId: teamUserId, action: 'RESCUE_REPORT', target: 'RescueReport', targetId: result.id, metadata: { assignmentId: id, ...input } });
  await transitionRequest(assignment.requestId, 'RESOLVED', teamUserId, 'REQUEST_RESOLVE', { metadata: { assignmentId: id, reportId: result.id } });
  return result;
}

export async function cancelAssignment(adminId: string, id: string) {
  const assignment = await prisma.rescueAssignment.findUnique({ where: { id } });
  if (!assignment) throw new HttpError(404, 'Assignment not found');
  if (![...ACTIVE_ASSIGNMENT, 'ASSIGNED'].includes(assignment.status)) {
    throw new HttpError(422, `Cannot cancel a ${assignment.status} assignment`);
  }
  return progressAssignment(adminId, id, 'CANCELLED', 'ASSIGNMENT_CANCEL');
}
