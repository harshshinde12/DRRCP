import { prisma } from '../lib/prisma.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';

/** Admin operational dashboard (SRS Dashboard.*). */
export async function summary() {
  const [requests, teams, shelters, inventories, openResource, resolved] = await Promise.all([
    prisma.emergencyRequest.findMany({ select: { status: true, priority: true, emergencyType: true, createdAt: true } }),
    prisma.rescueTeam.findMany({ select: { availabilityStatus: true } }),
    prisma.shelter.findMany(),
    prisma.inventory.findMany({ include: { item: true } }),
    prisma.resourceRequest.count({ where: { status: { in: ['PENDING', 'APPROVED', 'PARTIALLY_FULFILLED'] } } }),
    prisma.emergencyRequest.findMany({ where: { status: 'RESOLVED' }, select: { createdAt: true, updatedAt: true } }),
  ]);

  const countBy = (rows: Array<Record<string, unknown>>, key: string) => {
    const m: Record<string, number> = {};
    for (const r of rows) {
      const k = String(r[key]);
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  };

  const active = requests.filter((r) => !['RESOLVED', 'REJECTED', 'DUPLICATE', 'CANCELLED'].includes(r.status)).length;
  const pending = requests.filter((r) => r.status === 'SUBMITTED').length;
  const critical = requests.filter((r) => r.priority === 'CRITICAL' && !['RESOLVED', 'REJECTED', 'DUPLICATE', 'CANCELLED'].includes(r.status)).length;

  const responseHours = resolved.map((r) => (r.updatedAt.getTime() - r.createdAt.getTime()) / 3_600_000);
  const avgResponseHours = responseHours.length ? responseHours.reduce((a, b) => a + b, 0) / responseHours.length : null;

  const totalCapacity = shelters.reduce((a, s) => a + s.totalCapacity, 0);
  const totalOccupancy = shelters.reduce((a, s) => a + s.currentOccupancy, 0);

  return {
    requests: {
      total: requests.length,
      active,
      pending,
      critical,
      resolved: resolved.length,
      byStatus: countBy(requests, 'status'),
      byPriority: countBy(requests, 'priority'),
      byType: countBy(requests, 'emergencyType'),
    },
    teams: { total: teams.length, byAvailability: countBy(teams, 'availabilityStatus') },
    shelters: {
      total: shelters.length,
      totalCapacity,
      totalOccupancy,
      availableCapacity: totalCapacity - totalOccupancy,
      occupancyRate: totalCapacity ? totalOccupancy / totalCapacity : 0,
      byStatus: countBy(shelters, 'operatingStatus'),
    },
    inventory: {
      records: inventories.length,
      totalUnits: inventories.reduce((a, i) => a + i.quantityAvailable, 0),
      openResourceRequests: openResource,
    },
    performance: { avgResponseHours, resolvedCount: resolved.length },
  };
}

/** Requests-per-day series for charts (SRS Dashboard.Charts). */
export async function timeseries(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  const requests = await prisma.emergencyRequest.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, status: true },
  });
  const buckets = new Map<string, { date: string; total: number; resolved: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: key, total: 0, resolved: 0 });
  }
  for (const r of requests) {
    const key = r.createdAt.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (!b) continue;
    b.total += 1;
    if (r.status === 'RESOLVED') b.resolved += 1;
  }
  return [...buckets.values()];
}

export async function listAuditLogs(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const where = {
    ...(query.action ? { action: { contains: query.action as string } } : {}),
    ...(query.actorId ? { actorId: query.actorId as string } : {}),
    ...(query.target ? { target: query.target as string } : {}),
    ...(query.targetId ? { targetId: query.targetId as string } : {}),
  };
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    }),
  ]);
  return { logs, meta: pageMeta(total, { page, limit, skip }) };
}
