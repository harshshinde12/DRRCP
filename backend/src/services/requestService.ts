import { z } from 'zod';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { writeAuditLog } from '../utils/audit.js';
import {
  assertRequestTransition,
  deriveDisplayStatus,
  type AssignmentStatus,
  type Priority,
  type RequestStatus,
} from '../utils/enums.js';
import { HttpError } from '../utils/httpErrors.js';
import { notify } from '../utils/notify.js';
import { pageMeta, parsePagination, parseSort } from '../utils/pagination.js';
import { createRequestSchema } from '../schemas/request.schema.js';

type CreateInput = z.infer<typeof createRequestSchema>;

const REQUEST_SORTS = ['createdAt', 'updatedAt', 'priority', 'peopleAffected'] as const;

type AssignmentLite = { id: string; status: string; teamId: string; assignedAt: Date };

/** Prisma client or an interactive-transaction client — state writes accept either (BE-01/02/03). */
export type DbClient = PrismaClient | Prisma.TransactionClient;

type TransitionExtra = { priority?: Priority; duplicateOfId?: string; metadata?: Record<string, unknown> };

export type ViewerCtx = { id: string; role: string; teamId: string | null };

export async function viewerContext(viewerId: string, viewerRole: string): Promise<ViewerCtx> {
  let teamId: string | null = null;
  if (viewerRole === 'RESCUE_TEAM') {
    const team = await prisma.rescueTeam.findUnique({ where: { userId: viewerId }, select: { id: true } });
    teamId = team?.id ?? null;
  }
  return { id: viewerId, role: viewerRole, teamId };
}

/**
 * Enrich a request with:
 * - missionStatus: status of the latest assignment (null when undispatched)
 * - displayStatus: citizen-friendly label (no new states — derived only)
 * - privacy masking (SRS SE-5): requester phone + exact coords are visible
 *   ONLY to ADMIN, the owning CITIZEN, and the assigned RESCUE_TEAM.
 */
export function decorateRequest<T extends { requesterId: string; status: string; latitude: number | null; longitude: number | null; requester: { phone?: string | null; [key: string]: unknown } | null; assignments: AssignmentLite[] }>(
  viewer: ViewerCtx,
  req: T,
) {
  const latest = [...req.assignments].sort((a, b) => b.assignedAt.getTime() - a.assignedAt.getTime())[0];
  const missionStatus = (latest?.status ?? null) as AssignmentStatus | null;
  const displayStatus = deriveDisplayStatus(req.status as RequestStatus, missionStatus);
  const canSeePrivate =
    viewer.role === 'ADMIN' ||
    req.requesterId === viewer.id ||
    (viewer.role === 'RESCUE_TEAM' && viewer.teamId != null && req.assignments.some((a) => a.teamId === viewer.teamId));
  return {
    ...req,
    missionStatus,
    displayStatus,
    latitude: canSeePrivate ? req.latitude : null,
    longitude: canSeePrivate ? req.longitude : null,
    requester: req.requester ? { ...req.requester, phone: canSeePrivate ? (req.requester.phone ?? null) : null } : req.requester,
  };
}

/**
 * THE request state machine. Every EmergencyRequest status change in the
 * system funnels through here: validates against REQUEST_TRANSITIONS,
 * persists, audits (FR-18) and notifies the requesting citizen (FR-05).
 * RESOLVED is only reachable via the rescue-report flow (no direct resolve API).
 */
export async function transitionRequest(
  id: string,
  to: RequestStatus,
  actorId: string,
  action: string,
  extra: TransitionExtra = {},
) {
  const { from, updated, requesterId } = await applyRequestTransition(prisma, id, to, extra);
  await logRequestTransition(actorId, id, requesterId, action, from, to, extra);
  return updated;
}

/**
 * Pure state change behind transitionRequest. Accepts a transaction client so
 * multi-entity flows (assign / mission progress / report) can move the
 * assignment, the team AND the request inside ONE database transaction
 * (BE-01/02/03). Audit + notify stay with the caller (after commit).
 */
export async function applyRequestTransition(
  db: DbClient,
  id: string,
  to: RequestStatus,
  extra: TransitionExtra = {},
) {
  const current = await db.emergencyRequest.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, 'Emergency request not found');
  const from = current.status as RequestStatus;
  assertRequestTransition(from, to);

  // BE-15: conditional write on the observed state — a concurrent transition
  // wins, the loser gets 409 instead of silently double-applying.
  const applied = await db.emergencyRequest.updateMany({
    where: { id, status: from },
    data: {
      status: to,
      ...(extra.priority ? { priority: extra.priority } : {}),
      ...(extra.duplicateOfId ? { duplicateOfId: extra.duplicateOfId } : {}),
    },
  });
  if (applied.count === 0) {
    throw new HttpError(409, `Request ${id} was modified concurrently (expected ${from}); please retry`);
  }
  const updated = await db.emergencyRequest.findUnique({ where: { id } });
  return { from, updated: updated!, requesterId: current.requesterId };
}

/** Audit (FR-18) + citizen notify (FR-05) for a committed request transition. */
export async function logRequestTransition(
  actorId: string,
  id: string,
  requesterId: string,
  action: string,
  from: RequestStatus,
  to: RequestStatus,
  extra: TransitionExtra = {},
) {
  await writeAuditLog({
    actorId,
    action,
    target: 'EmergencyRequest',
    targetId: id,
    metadata: { from, to, ...(extra.priority ? { priority: extra.priority } : {}), ...extra.metadata },
  });
  await notify(
    requesterId,
    `Your emergency request is now ${to}${extra.priority ? ` (priority ${extra.priority})` : ''}.`,
    'REQUEST_UPDATE',
  );
}

export async function submitRequest(citizenId: string, input: CreateInput) {
  let disasterId = input.disasterId;
  if (!disasterId) {
    const active = await prisma.disaster.findFirst({ where: { status: 'ACTIVE' }, orderBy: { startDate: 'desc' } });
    disasterId = active?.id;
  } else {
    const disaster = await prisma.disaster.findUnique({ where: { id: disasterId } });
    if (!disaster) throw new HttpError(404, 'Disaster not found');
  }
  const request = await prisma.emergencyRequest.create({
    data: {
      requesterId: citizenId,
      disasterId,
      emergencyType: input.emergencyType,
      description: input.description,
      location: input.location,
      latitude: input.latitude,
      longitude: input.longitude,
      peopleAffected: input.peopleAffected,
      injuryPresent: input.injuryPresent,
      injurySeverity: input.injuryPresent ? (input.injurySeverity ?? 'UNKNOWN') : 'NONE',
      status: 'SUBMITTED',
    },
  });
  await writeAuditLog({ actorId: citizenId, action: 'REQUEST_SUBMIT', target: 'EmergencyRequest', targetId: request.id });
  await notify(citizenId, 'Your emergency request was received and is awaiting verification.', 'REQUEST_UPDATE');
  return request;
}

export async function listRequests(viewerId: string, viewerRole: string, query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const { sort, order } = parseSort(query, REQUEST_SORTS, 'createdAt');
  const status = query.status as string | undefined;
  const priority = query.priority as string | undefined;
  const emergencyType = query.emergencyType as string | undefined;
  const disasterId = query.disasterId as string | undefined;
  const search = (query.search as string | undefined)?.trim();

  const viewer = await viewerContext(viewerId, viewerRole);
  const scoped =
    viewerRole === 'CITIZEN'
      ? { requesterId: viewerId }
      : viewerRole === 'RESCUE_TEAM'
        ? viewer.teamId
          ? { assignments: { some: { teamId: viewer.teamId } } }
          : { id: '__no-team-profile__' } // team login without a RescueTeam row sees nothing
        : {};
  const where = {
    ...scoped,
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(emergencyType ? { emergencyType } : {}),
    ...(disasterId ? { disasterId } : {}),
    ...(search ? { OR: [{ description: { contains: search } }, { location: { contains: search } }] } : {}),
  };
  const [total, requests] = await Promise.all([
    prisma.emergencyRequest.count({ where }),
    prisma.emergencyRequest.findMany({
      where,
      include: {
        requester: { select: { id: true, name: true, email: true } },
        assignments: { select: { id: true, status: true, teamId: true, assignedAt: true }, orderBy: { assignedAt: 'desc' } },
        _count: { select: { assignments: true } },
      },
      orderBy: { [sort]: order },
      skip,
      take: limit,
    }),
  ]);
  return { requests: requests.map((r) => decorateRequest(viewer, r)), meta: pageMeta(total, { page, limit, skip }) };
}

/** Owner (citizen), ADMIN, or the assigned rescue team may view (S-02: teams see only own work). */
export async function getRequest(viewerId: string, viewerRole: string, id: string) {
  const request = await prisma.emergencyRequest.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, name: true, email: true, phone: true } },
      disaster: true,
      assignments: { include: { team: true, report: true }, orderBy: { assignedAt: 'desc' } },
    },
  });
  if (!request) throw new HttpError(404, 'Emergency request not found');
  if (viewerRole === 'CITIZEN' && request.requesterId !== viewerId) {
    throw new HttpError(403, 'You can only view your own requests');
  }
  const viewer = await viewerContext(viewerId, viewerRole);
  if (viewerRole === 'RESCUE_TEAM') {
    const linked = viewer.teamId != null && request.assignments.some((a) => a.teamId === viewer.teamId);
    if (!linked) throw new HttpError(403, 'This request is not assigned to your team');
  }
  return decorateRequest(viewer, request);
}

export async function getRequestHistory(viewerId: string, viewerRole: string, id: string) {
  const request = await getRequest(viewerId, viewerRole, id); // enforces visibility
  const assignmentIds = request.assignments.map((a) => a.id);
  const reportIds = request.assignments.map((a) => a.report?.id).filter((r): r is string => Boolean(r));
  const or: Array<Record<string, unknown>> = [{ target: 'EmergencyRequest', targetId: id }];
  if (assignmentIds.length > 0) or.push({ target: 'RescueAssignment', targetId: { in: assignmentIds } });
  if (reportIds.length > 0) or.push({ target: 'RescueReport', targetId: { in: reportIds } });
  return prisma.auditLog.findMany({ where: { OR: or }, orderBy: { timestamp: 'asc' } });
}

/** Citizen cancels their own request while SUBMITTED or VERIFIED (SRS App. B). */
export async function cancelRequest(citizenId: string, id: string) {
  const request = await prisma.emergencyRequest.findUnique({ where: { id } });
  if (!request) throw new HttpError(404, 'Emergency request not found');
  if (request.requesterId !== citizenId) throw new HttpError(403, 'You can only cancel your own requests');
  return transitionRequest(id, 'CANCELLED', citizenId, 'REQUEST_CANCEL');
}

/** Admin triage: VERIFIED (+priority) | DUPLICATE (link required) | REJECTED. */
export async function verifyRequest(adminId: string, id: string, decision: RequestStatus, priority: Priority, duplicateOfId?: string) {
  if (!['VERIFIED', 'DUPLICATE', 'REJECTED'].includes(decision)) {
    throw new HttpError(422, 'Decision must be VERIFIED, DUPLICATE or REJECTED');
  }
  if (decision === 'DUPLICATE') {
    if (!duplicateOfId) throw new HttpError(422, 'duplicateOfId is required when marking DUPLICATE');
    const original = await prisma.emergencyRequest.findUnique({ where: { id: duplicateOfId } });
    if (!original) throw new HttpError(404, 'Original request (duplicateOfId) not found');
    if (original.id === id) throw new HttpError(422, 'A request cannot duplicate itself');
  }
  return transitionRequest(id, decision, adminId, 'REQUEST_VERIFY', { priority, duplicateOfId });
}

/** Admin priority change — rejected on terminal states (BE-05). */
const TERMINAL_REQUEST_STATUSES: RequestStatus[] = ['RESOLVED', 'REJECTED', 'DUPLICATE', 'CANCELLED'];

export async function setPriority(adminId: string, id: string, priority: Priority) {
  const request = await prisma.emergencyRequest.findUnique({ where: { id } });
  if (!request) throw new HttpError(404, 'Emergency request not found');
  if ((TERMINAL_REQUEST_STATUSES as string[]).includes(request.status)) {
    throw new HttpError(422, `Cannot change priority of a ${request.status} request`);
  }
  const updated = await prisma.emergencyRequest.update({ where: { id }, data: { priority } });
  await writeAuditLog({
    actorId: adminId,
    action: 'REQUEST_PRIORITY',
    target: 'EmergencyRequest',
    targetId: id,
    metadata: { from: request.priority, to: priority },
  });
  await notify(request.requesterId, `Priority of your emergency request was set to ${priority}.`, 'REQUEST_UPDATE');
  return updated;
}
