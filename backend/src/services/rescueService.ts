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
import { applyRequestTransition, decorateRequest, logRequestTransition, viewerContext } from './requestService.js';

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

/**
 * BE-06: audited admin action to return a team to AVAILABLE. Mission states
 * (ASSIGNED/ON_THE_WAY/RESCUE_IN_PROGRESS) move only through the mission
 * flow — never here. Marking AVAILABLE while active assignments exist is
 * rejected (409), so dispatch state can never be faked.
 */
export async function setTeamAvailability(adminId: string, id: string, status: TeamAvailability) {
  if (status !== 'AVAILABLE') {
    throw new HttpError(422, 'Only AVAILABLE is supported here; mission states change through the mission flow');
  }
  const team = await getTeam(id);
  const active = await prisma.rescueAssignment.count({
    where: { teamId: id, status: { in: [...ACTIVE_ASSIGNMENT] } },
  });
  if (active > 0) {
    throw new HttpError(409, `Team ${team.name} has ${active} active assignment(s); cannot mark AVAILABLE until missions complete`);
  }
  const updated = await prisma.rescueTeam.update({ where: { id }, data: { availabilityStatus: 'AVAILABLE' } });
  await writeAuditLog({ actorId: adminId, action: 'TEAM_AVAILABILITY', target: 'RescueTeam', targetId: id, metadata: { from: team.availabilityStatus, to: 'AVAILABLE' } });
  return updated;
}

/** Team.Match: AVAILABLE teams for a request, ranked by capability overlap then distance. */
export async function matchingTeams(requestId: string) {
  const request = await prisma.emergencyRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new HttpError(404, 'Emergency request not found');
  // BE-12: coarse filters run in the DB (type-hit UNION city bbox, capped) —
  // JS only ranks the bounded candidate set instead of the whole table.
  const TOP_K = 100;
  const hasCoords = request.latitude != null && request.longitude != null;
  // ±1.5° ≈ 165km coarse box: always contains the metro area, bounds the scan.
  const bbox = hasCoords
    ? {
        latitude: { gte: (request.latitude as number) - 1.5, lte: (request.latitude as number) + 1.5 },
        longitude: { gte: (request.longitude as number) - 1.5, lte: (request.longitude as number) + 1.5 },
      }
    : {};
  const [typeHits, boxed] = await Promise.all([
    prisma.rescueTeam.findMany({
      where: {
        availabilityStatus: 'AVAILABLE',
        OR: [{ teamType: { contains: request.emergencyType } }, { capability: { contains: request.emergencyType } }],
      },
      take: TOP_K,
    }),
    prisma.rescueTeam.findMany({ where: { availabilityStatus: 'AVAILABLE', ...bbox }, take: TOP_K }),
  ]);
  const seen = new Set<string>();
  const candidates = [...typeHits, ...boxed].filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  const needTokens = tokenize(request.emergencyType);
  const ranked = candidates
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
  // BE-01: assignment + team mirror + request transition commit atomically —
  // a failed request transition can no longer orphan an ASSIGNED assignment.
  const { assignment, transition } = await prisma.$transaction(async (tx) => {
    const created = await tx.rescueAssignment.create({
      data: { requestId, teamId, assignedById: adminId, status: 'ASSIGNED' },
      include: { team: true },
    });
    await tx.rescueTeam.update({ where: { id: teamId }, data: { availabilityStatus: 'ASSIGNED' } });
    const extra = { metadata: { teamId, team: team.name, override, ...(overrideReason ? { overrideReason } : {}) } };
    const moved = firstAssignment ? await applyRequestTransition(tx, requestId, 'ASSIGNED', extra) : null;
    return { assignment: created, transition: moved ? { ...moved, extra } : null };
  });

  if (transition) {
    await logRequestTransition(adminId, requestId, transition.requesterId, 'TEAM_ASSIGN', transition.from, 'ASSIGNED', transition.extra);
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
  const viewer = await viewerContext(viewerId, viewerRole);
  const [total, assignments] = await Promise.all([
    prisma.rescueAssignment.count({ where }),
    prisma.rescueAssignment.findMany({
      where,
      include: {
        team: true,
        request: {
          include: {
            requester: { select: { id: true, name: true, phone: true } },
            assignments: { select: { id: true, status: true, teamId: true, assignedAt: true }, orderBy: { assignedAt: 'desc' } },
          },
        },
        report: true,
      },
      orderBy: { assignedAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);
  // SE-5 also applies to the nested request: phone + exact coords are visible
  // only to ADMIN, the requester, and the assigned team (BE-04).
  return { assignments: assignments.map((a) => ({ ...a, request: decorateRequest(viewer, a.request) })), meta: pageMeta(total, { page, limit, skip }) };
}

export async function getAssignment(viewerId: string, viewerRole: string, id: string) {
  const assignment = await prisma.rescueAssignment.findUnique({
    where: { id },
    include: {
      team: true,
      request: {
        include: {
          requester: { select: { id: true, name: true, phone: true } },
          assignments: { select: { id: true, status: true, teamId: true, assignedAt: true }, orderBy: { assignedAt: 'desc' } },
        },
      },
      report: true,
      assignedBy: { select: { id: true, name: true } },
    },
  });
  if (!assignment) throw new HttpError(404, 'Assignment not found');
  if (viewerRole === 'RESCUE_TEAM') {
    const mine = await teamOfUser(viewerId);
    if (!mine || mine.id !== assignment.teamId) throw new HttpError(403, 'This assignment belongs to another team');
  }
  const viewer = await viewerContext(viewerId, viewerRole);
  return { ...assignment, request: decorateRequest(viewer, assignment.request) };
}

async function progressAssignment(actorId: string, id: string, to: AssignmentStatus, action: string) {
  const assignment = await prisma.rescueAssignment.findUnique({ where: { id }, include: { request: true, team: true } });
  if (!assignment) throw new HttpError(404, 'Assignment not found');
  if (!canTransitionAssignment(assignment.status as AssignmentStatus, to)) {
    throw new HttpError(422, `Invalid assignment transition: ${assignment.status} → ${to}`);
  }
  // BE-02: mission + team mirror + request transition commit atomically.
  const driveRequest = to === 'RESCUE_IN_PROGRESS' && assignment.request.status === 'ASSIGNED';
  const { updated, transition } = await prisma.$transaction(async (tx) => {
    const moved = await tx.rescueAssignment.updateMany({
      where: { id, status: assignment.status },
      data: { status: to, ...(to === 'COMPLETED' || to === 'CANCELLED' ? { completedAt: new Date() } : {}) },
    });
    if (moved.count === 0) {
      throw new HttpError(409, `Assignment ${id} was modified concurrently (expected ${assignment.status}); please retry`);
    }
    const mirror = TEAM_MIRROR[to];
    if (mirror) await tx.rescueTeam.update({ where: { id: assignment.teamId }, data: { availabilityStatus: mirror } });
    // Mission underway ⇒ request becomes RESCUE_IN_PROGRESS (drives citizen tracking).
    const reqMoved = driveRequest
      ? await applyRequestTransition(tx, assignment.requestId, 'RESCUE_IN_PROGRESS', { metadata: { assignmentId: id } })
      : null;
    const next = await tx.rescueAssignment.findUnique({ where: { id } });
    return { updated: next!, transition: reqMoved };
  });
  await writeAuditLog({ actorId, action, target: 'RescueAssignment', targetId: id, metadata: { from: assignment.status, to } });
  if (transition) {
    await logRequestTransition(actorId, assignment.requestId, transition.requesterId, 'MISSION_PROGRESS', transition.from, 'RESCUE_IN_PROGRESS', { metadata: { assignmentId: id } });
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
  // BE-03: validate the request state BEFORE writing — a COMPLETED report must
  // never exist with an unresolved request (stale ASSIGNED ⇒ 422, no orphan).
  if (assignment.request.status !== 'RESCUE_IN_PROGRESS') {
    throw new HttpError(422, `Report requires request RESCUE_IN_PROGRESS (now ${assignment.request.status}); progress the mission first`);
  }

  // Single transaction: report + COMPLETED + AVAILABLE + RESOLVED (the ONLY
  // path to RESOLVED). The in-txn transition re-validates, so even a race
  // between the pre-check and the write cannot orphan a COMPLETED report.
  const { result, transition } = await prisma.$transaction(async (tx) => {
    const report = await tx.rescueReport.create({
      data: { assignmentId: id, peopleRescued: input.peopleRescued, injuredPeople: input.injuredPeople, notes: input.notes },
    });
    const moved = await tx.rescueAssignment.updateMany({
      where: { id, status: 'RESCUE_IN_PROGRESS' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    if (moved.count === 0) {
      throw new HttpError(409, `Assignment ${id} was modified concurrently; please retry`);
    }
    await tx.rescueTeam.update({ where: { id: assignment.teamId }, data: { availabilityStatus: 'AVAILABLE' } });
    const reqMoved = await applyRequestTransition(tx, assignment.requestId, 'RESOLVED', { metadata: { assignmentId: id, reportId: report.id } });
    return { result: report, transition: reqMoved };
  });
  await writeAuditLog({ actorId: teamUserId, action: 'RESCUE_REPORT', target: 'RescueReport', targetId: result.id, metadata: { assignmentId: id, ...input } });
  await logRequestTransition(teamUserId, assignment.requestId, transition.requesterId, 'REQUEST_RESOLVE', transition.from, 'RESOLVED', { metadata: { assignmentId: id, reportId: result.id } });
  // FR-16: the generated mission report goes to every admin for review/record.
  // (Previously only the citizen was notified — admins never saw that a mission
  // finished. Same ASSIGNMENT channel as support requests, so it lands in the
  // admin bell + /notifications inbox; full text lives on GET /requests/:id.)
  const notesExcerpt = (input.notes ?? '').trim().slice(0, 500);
  await notifyAdmins(
    `Mission report — Team ${assignment.team.name} completed "${assignment.request.location}" ` +
    `(request ${assignment.requestId}): ${input.peopleRescued} rescued, ${input.injuredPeople} injured.` +
    (notesExcerpt ? ` Notes: ${notesExcerpt}` : ' No notes filed.') +
    ` [report ${result.id}]`,
    'ASSIGNMENT',
  );
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
