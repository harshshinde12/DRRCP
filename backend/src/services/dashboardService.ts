import { prisma } from '../lib/prisma.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';

const TERMINAL_REQUEST = ['RESOLVED', 'REJECTED', 'DUPLICATE', 'CANCELLED'];
const OPEN_RESOURCE = ['PENDING', 'APPROVED', 'PARTIALLY_FULFILLED'];

/** BE-11: every figure below is a DB-side aggregate (groupBy/count/sum). No unbounded row loading. */
export async function summary() {
  const [
    requestTotal,
    active,
    pending,
    critical,
    resolved,
    byStatus,
    byPriority,
    byType,
    teamTotal,
    byAvailability,
    shelterSums,
    shelterTotal,
    shelterByStatus,
    inventorySums,
    inventoryCount,
    openResource,
    // avg response needs (updatedAt − createdAt): Prisma has no date-diff
    // aggregate, so this stays a narrow two-column select (no full rows).
    resolvedForAvg,
  ] = await Promise.all([
    prisma.emergencyRequest.count(),
    prisma.emergencyRequest.count({ where: { status: { notIn: TERMINAL_REQUEST } } }),
    prisma.emergencyRequest.count({ where: { status: 'SUBMITTED' } }),
    prisma.emergencyRequest.count({ where: { priority: 'CRITICAL', status: { notIn: TERMINAL_REQUEST } } }),
    prisma.emergencyRequest.count({ where: { status: 'RESOLVED' } }),
    prisma.emergencyRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.emergencyRequest.groupBy({ by: ['priority'], _count: { _all: true } }),
    prisma.emergencyRequest.groupBy({ by: ['emergencyType'], _count: { _all: true } }),
    prisma.rescueTeam.count(),
    prisma.rescueTeam.groupBy({ by: ['availabilityStatus'], _count: { _all: true } }),
    prisma.shelter.aggregate({ _sum: { totalCapacity: true, currentOccupancy: true } }),
    prisma.shelter.count(),
    prisma.shelter.groupBy({ by: ['operatingStatus'], _count: { _all: true } }),
    prisma.inventory.aggregate({ _sum: { quantityAvailable: true } }),
    prisma.inventory.count(),
    prisma.resourceRequest.count({ where: { status: { in: OPEN_RESOURCE } } }),
    prisma.emergencyRequest.findMany({ where: { status: 'RESOLVED' }, select: { createdAt: true, updatedAt: true } }),
  ]);

  const asRecord = <K extends string>(rows: Array<Record<K, string> & { _count: { _all: number } }>, key: K) => {
    const m: Record<string, number> = {};
    for (const r of rows) m[r[key]] = r._count._all;
    return m;
  };

  const responseHours = resolvedForAvg.map((r) => (r.updatedAt.getTime() - r.createdAt.getTime()) / 3_600_000);
  const avgResponseHours = responseHours.length ? responseHours.reduce((a, b) => a + b, 0) / responseHours.length : null;

  const totalCapacity = shelterSums._sum.totalCapacity ?? 0;
  const totalOccupancy = shelterSums._sum.currentOccupancy ?? 0;

  return {
    requests: {
      total: requestTotal,
      active,
      pending,
      critical,
      resolved,
      byStatus: asRecord(byStatus, 'status'),
      byPriority: asRecord(byPriority, 'priority'),
      byType: asRecord(byType, 'emergencyType'),
    },
    teams: { total: teamTotal, byAvailability: asRecord(byAvailability, 'availabilityStatus') },
    shelters: {
      total: shelterTotal,
      totalCapacity,
      totalOccupancy,
      availableCapacity: totalCapacity - totalOccupancy,
      occupancyRate: totalCapacity ? totalOccupancy / totalCapacity : 0,
      byStatus: asRecord(shelterByStatus, 'operatingStatus'),
    },
    inventory: {
      records: inventoryCount,
      totalUnits: inventorySums._sum.quantityAvailable ?? 0,
      openResourceRequests: openResource,
    },
    performance: { avgResponseHours, resolvedCount: resolved },
  };
}

/**
 * Requests-per-day series for charts (SRS Dashboard.Charts).
 * BE-11: date bucketing runs DB-side — one indexed status-groupBy per day
 * window (no row loading at all).
 */
export async function timeseries(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  const perDay = await Promise.all(
    Array.from({ length: days }, (_, i) => {
      const start = new Date(since);
      start.setDate(since.getDate() + i);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      return prisma.emergencyRequest
        .groupBy({ by: ['status'], where: { createdAt: { gte: start, lt: end } }, _count: { _all: true } })
        .then((groups) => {
          let total = 0;
          let resolved = 0;
          for (const g of groups) {
            total += g._count._all;
            if (g.status === 'RESOLVED') resolved = g._count._all;
          }
          return { date: start.toISOString().slice(0, 10), total, resolved };
        });
    }),
  );
  return perDay;
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
