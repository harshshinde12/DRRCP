import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { writeAuditLog } from '../utils/audit.js';
import { haversineKm } from '../utils/geo.js';
import { HttpError } from '../utils/httpErrors.js';
import { notifyAdmins } from '../utils/notify.js';
import { pageMeta, parsePagination } from '../utils/pagination.js';
import { createShelterSchema, updateShelterSchema } from '../schemas/shelter.schema.js';

type CreateInput = z.infer<typeof createShelterSchema>;
type UpdateInput = z.infer<typeof updateShelterSchema>;

/** Fraction of free beds below which admins are alerted (Notify.ShelterCapacity). */
const LOW_CAPACITY_FRACTION = Number(process.env.SHELTER_LOW_CAPACITY_FRACTION ?? 0.1);

export function withAvailability<T extends { totalCapacity: number; currentOccupancy: number }>(s: T) {
  return { ...s, availableCapacity: s.totalCapacity - s.currentOccupancy };
}

export async function createShelter(actorId: string, actorRole: string, input: CreateInput) {
  const managerId = actorRole === 'ADMIN' ? (input.managerId ?? actorId) : actorId;
  if (actorRole === 'ADMIN' && input.managerId) {
    const manager = await prisma.user.findUnique({ where: { id: input.managerId } });
    if (!manager || manager.role !== 'SHELTER_MANAGER') throw new HttpError(422, 'managerId must belong to a SHELTER_MANAGER');
  }
  if (input.currentOccupancy > input.totalCapacity) {
    throw new HttpError(422, 'Initial occupancy cannot exceed total capacity');
  }
  const shelter = await prisma.shelter.create({
    data: {
      managerId,
      name: input.name,
      location: input.location,
      latitude: input.latitude,
      longitude: input.longitude,
      totalCapacity: input.totalCapacity,
      currentOccupancy: input.currentOccupancy,
      facilities: input.facilities,
      operatingStatus: input.operatingStatus,
    },
  });
  await writeAuditLog({ actorId, action: 'SHELTER_REGISTER', target: 'Shelter', targetId: shelter.id, metadata: { name: shelter.name } });
  return withAvailability(shelter);
}

export async function listShelters(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const where = {
    ...(query.operatingStatus ? { operatingStatus: query.operatingStatus as string } : {}),
    ...(query.openOnly ? { operatingStatus: 'OPEN' } : {}),
    ...(query.facility ? { facilities: { contains: query.facility as string } } : {}),
    ...((query.search as string | undefined)?.trim()
      ? { OR: [{ name: { contains: query.search as string } }, { location: { contains: query.search as string } }] }
      : {}),
  };
  const [total, shelters] = await Promise.all([
    prisma.shelter.count({ where }),
    prisma.shelter.findMany({ where, include: { manager: { select: { id: true, name: true, email: true } } }, orderBy: { updatedAt: 'desc' }, skip, take: limit }),
  ]);
  return { shelters: shelters.map(withAvailability), meta: pageMeta(total, { page, limit, skip }) };
}

export async function getShelter(id: string) {
  const shelter = await prisma.shelter.findUnique({
    where: { id },
    include: { manager: { select: { id: true, name: true, email: true } } },
  });
  if (!shelter) throw new HttpError(404, 'Shelter not found');
  return withAvailability(shelter);
}

function assertCanWrite(actorId: string, actorRole: string, shelterManagerId: string) {
  if (actorRole === 'ADMIN') return;
  if (actorRole === 'SHELTER_MANAGER' && shelterManagerId === actorId) return;
  throw new HttpError(403, 'Only the owning shelter manager or an admin can modify this shelter');
}

export async function updateShelter(actorId: string, actorRole: string, id: string, input: UpdateInput) {
  const shelter = await prisma.shelter.findUnique({ where: { id } });
  if (!shelter) throw new HttpError(404, 'Shelter not found');
  assertCanWrite(actorId, actorRole, shelter.managerId);

  const totalCapacity = input.totalCapacity ?? shelter.totalCapacity;
  const currentOccupancy = input.currentOccupancy ?? shelter.currentOccupancy;
  const override = input.emergencyOverride ?? shelter.emergencyOverride;
  if (currentOccupancy > totalCapacity && !override) {
    throw new HttpError(422, 'Occupancy cannot exceed total capacity without emergencyOverride:true (Shelter.Capacity.Block)');
  }

  const updated = await prisma.shelter.update({
    where: { id },
    data: { ...input, totalCapacity, currentOccupancy },
  });
  await writeAuditLog({ actorId, action: 'SHELTER_UPDATE', target: 'Shelter', targetId: id, metadata: { occupancy: { from: shelter.currentOccupancy, to: currentOccupancy }, ...input } as Record<string, unknown> });

  const enriched = withAvailability(updated);
  const freeFraction = enriched.totalCapacity === 0 ? 0 : enriched.availableCapacity / enriched.totalCapacity;
  if (enriched.availableCapacity <= 0 || freeFraction < LOW_CAPACITY_FRACTION) {
    await notifyAdmins(`Shelter "${enriched.name}" is critically full (${enriched.currentOccupancy}/${enriched.totalCapacity} occupied).`, 'SHELTER_ALERT');
  }
  return enriched;
}

export async function deleteShelter(actorId: string, id: string) {
  const shelter = await prisma.shelter.findUnique({ where: { id } });
  if (!shelter) throw new HttpError(404, 'Shelter not found');
  await prisma.shelter.delete({ where: { id } });
  await writeAuditLog({ actorId, action: 'SHELTER_DELETE', target: 'Shelter', targetId: id, metadata: { name: shelter.name } });
  return { id };
}

/** Nearby OPEN shelters with free beds, sorted by distance (Haversine). Public per SRS SE-2. */
export async function nearbyShelters(lat: number, lng: number, radiusKm: number, limit: number) {
  const shelters = await prisma.shelter.findMany({ where: { operatingStatus: 'OPEN' } });
  return shelters
    .map(withAvailability)
    .filter((s) => s.availableCapacity > 0 && s.latitude != null && s.longitude != null)
    .map((s) => ({ ...s, distanceKm: haversineKm(lat, lng, s.latitude as number, s.longitude as number) }))
    .filter((s) => s.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
