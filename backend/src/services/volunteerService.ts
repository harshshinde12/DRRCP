import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { writeAuditLog } from '../utils/audit.js';
import { canTransitionVolunteerTask, type VolunteerTaskStatus } from '../utils/enums.js';
import { tokenize } from '../utils/geo.js';
import { HttpError } from '../utils/httpErrors.js';
import { notify } from '../utils/notify.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';
import { createTaskSchema, updateVolunteerSchema, VOLUNTEER_TASK_TYPES } from '../schemas/volunteer.schema.js';

type CreateTaskInput = z.infer<typeof createTaskSchema>;
type UpdateVolunteerInput = z.infer<typeof updateVolunteerSchema>;

const VOLUNTEER_PUBLIC = {
  id: true, name: true, email: true, phone: true, skills: true, availability: true, serviceArea: true, createdAt: true,
} as const;

export async function listVolunteers(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const where = {
    role: 'VOLUNTEER',
    isActive: true,
    ...(query.skills ? { skills: { contains: query.skills as string } } : {}),
    ...(query.availability ? { availability: query.availability as string } : {}),
    ...(query.serviceArea ? { serviceArea: { contains: query.serviceArea as string } } : {}),
    ...((query.search as string | undefined)?.trim()
      ? { OR: [{ name: { contains: query.search as string } }, { email: { contains: query.search as string } }] }
      : {}),
  };
  const [total, volunteers] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, select: VOLUNTEER_PUBLIC, orderBy: { createdAt: 'desc' }, skip, take: limit }),
  ]);
  return { volunteers, meta: pageMeta(total, { page, limit, skip }) };
}

export async function getVolunteer(viewerId: string, viewerRole: string, id: string) {
  if (viewerRole === 'VOLUNTEER' && viewerId !== id) throw new HttpError(403, 'You can only view your own profile');
  const volunteer = await prisma.user.findUnique({ where: { id }, select: { ...VOLUNTEER_PUBLIC, role: true } });
  if (!volunteer || volunteer.role !== 'VOLUNTEER') throw new HttpError(404, 'Volunteer not found');
  return volunteer;
}

export async function updateVolunteer(actorId: string, actorRole: string, id: string, input: UpdateVolunteerInput) {
  if (actorRole === 'VOLUNTEER' && actorId !== id) throw new HttpError(403, 'You can only update your own profile');
  const volunteer = await prisma.user.findUnique({ where: { id } });
  if (!volunteer || volunteer.role !== 'VOLUNTEER') throw new HttpError(404, 'Volunteer not found');
  const updated = await prisma.user.update({ where: { id }, data: input, select: VOLUNTEER_PUBLIC });
  await writeAuditLog({ actorId, action: 'VOLUNTEER_UPDATE', target: 'User', targetId: id, metadata: input as Record<string, unknown> });
  return updated;
}

/**
 * Rank volunteers for a task: skill overlap first, then availability weight,
 * then service-area token overlap with the task location. (Volunteers carry
 * no GPS coords in R1 — ranking is skill + textual area match, documented.)
 * BE-12: skill prefilter + bounded filler run in the DB; JS ranks the capped
 * set instead of the whole volunteer table.
 */
export async function suggestVolunteers(taskType: string, location: string, limit: number) {
  const CAP = 200;
  const base = { role: 'VOLUNTEER', isActive: true } as const;
  const [matched, filler] = await Promise.all([
    prisma.user.findMany({ where: { ...base, skills: { contains: taskType } }, select: { ...VOLUNTEER_PUBLIC }, take: CAP }),
    // NULL skills fail the contains comparison either way — include them explicitly.
    prisma.user.findMany({
      where: { ...base, OR: [{ skills: null }, { NOT: { skills: { contains: taskType } } }] },
      select: { ...VOLUNTEER_PUBLIC },
      take: CAP,
    }),
  ]);
  const volunteers = [...matched, ...filler];
  const locTokens = new Set(location.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean));
  const availabilityWeight = (a?: string | null) =>
    a === 'FULL_TIME' ? 5 : a === 'WEEKDAYS' || a === 'WEEKENDS' ? 2 : 0;
  const ranked = volunteers
    .map((v) => {
      const skills = tokenize(v.skills);
      const skillMatch = skills.includes(taskType) ? 10 : 0;
      const areaTokens = tokenize((v.serviceArea ?? '').replace(/[^a-zA-Z0-9, ]/g, ''));
      const areaOverlap = areaTokens.filter((t) => locTokens.has(t)).length * 3;
      const score = skillMatch + areaOverlap + availabilityWeight(v.availability);
      return { ...v, score, scoreBreakdown: { skillMatch, areaOverlap, availabilityBonus: availabilityWeight(v.availability) } };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return { taskType, location, volunteers: ranked };
}

export async function createTask(adminId: string, input: CreateTaskInput) {
  if (!(VOLUNTEER_TASK_TYPES as readonly string[]).includes(input.taskType)) {
    throw new HttpError(422, `Volunteers are restricted to low-risk tasks (${VOLUNTEER_TASK_TYPES.join(', ')}) — ${input.taskType} is not permitted (SF-2)`);
  }
  const volunteer = await prisma.user.findUnique({ where: { id: input.volunteerId } });
  if (!volunteer || volunteer.role !== 'VOLUNTEER' || !volunteer.isActive) {
    throw new HttpError(404, 'Active volunteer not found');
  }
  if (!tokenize(volunteer.skills).includes(input.taskType)) {
    throw new HttpError(422, `Volunteer skills (${volunteer.skills ?? 'none'}) do not match task type ${input.taskType}`);
  }
  const task = await prisma.volunteerTask.create({
    data: { volunteerId: input.volunteerId, title: input.title, taskType: input.taskType, location: input.location, assignedById: adminId, status: 'ASSIGNED' },
  });
  await writeAuditLog({ actorId: adminId, action: 'VOLUNTEER_TASK_ASSIGN', target: 'VolunteerTask', targetId: task.id, metadata: { volunteerId: input.volunteerId, taskType: input.taskType } });
  await notify(input.volunteerId, `New task assigned: ${input.title} (${input.taskType}) at ${input.location}.`, 'ASSIGNMENT');
  return task;
}

export async function listTasks(viewerId: string, viewerRole: string, query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const where = {
    ...(viewerRole === 'VOLUNTEER' ? { volunteerId: viewerId } : {}),
    ...(query.status ? { status: query.status as string } : {}),
    ...(query.taskType ? { taskType: query.taskType as string } : {}),
  };
  const [total, tasks] = await Promise.all([
    prisma.volunteerTask.count({ where }),
    prisma.volunteerTask.findMany({ where, include: { volunteer: { select: VOLUNTEER_PUBLIC } }, orderBy: { assignedAt: 'desc' }, skip, take: limit }),
  ]);
  return { tasks, meta: pageMeta(total, { page, limit, skip }) };
}

export async function getTask(viewerId: string, viewerRole: string, id: string) {
  const task = await prisma.volunteerTask.findUnique({ where: { id }, include: { volunteer: { select: VOLUNTEER_PUBLIC } } });
  if (!task) throw new HttpError(404, 'Volunteer task not found');
  if (viewerRole === 'VOLUNTEER' && task.volunteerId !== viewerId) throw new HttpError(403, 'This task belongs to another volunteer');
  return task;
}

export async function acceptTask(volunteerId: string, id: string) {
  return progressTask(volunteerId, 'VOLUNTEER', id, 'ACCEPTED', 'VOLUNTEER_TASK_ACCEPT');
}

export async function declineTask(volunteerId: string, id: string) {
  return progressTask(volunteerId, 'VOLUNTEER', id, 'DECLINED', 'VOLUNTEER_TASK_DECLINE');
}

export async function progressTask(actorId: string, actorRole: string, id: string, to: VolunteerTaskStatus, action: string) {
  const task = await getTask(actorId, actorRole, id);
  if (actorRole === 'VOLUNTEER' && !['ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED'].includes(to)) {
    throw new HttpError(403, 'Volunteers can only move tasks to ACCEPTED, DECLINED, IN_PROGRESS or COMPLETED');
  }
  if (!canTransitionVolunteerTask(task.status as VolunteerTaskStatus, to)) {
    throw new HttpError(422, `Invalid task transition: ${task.status} → ${to}`);
  }
  // BE-15: conditional write on the observed state — concurrent movers 409.
  const applied = await prisma.volunteerTask.updateMany({ where: { id, status: task.status }, data: { status: to } });
  if (applied.count === 0) {
    throw new HttpError(409, `Task ${id} was modified concurrently (expected ${task.status}); please retry`);
  }
  const updated = await prisma.volunteerTask.findUnique({ where: { id } });
  await writeAuditLog({ actorId, action, target: 'VolunteerTask', targetId: id, metadata: { from: task.status, to } });
  return updated;
}
