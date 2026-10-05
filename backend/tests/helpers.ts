import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import request from 'supertest';
import { prisma } from '../src/lib/prisma.js';

export { prisma };
export const PASSWORD = 'Password@123';

export async function cleanDb() {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.rescueReport.deleteMany();
  await prisma.rescueAssignment.deleteMany();
  await prisma.resourceAllocation.deleteMany();
  await prisma.resourceRequest.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.reliefItem.deleteMany();
  await prisma.volunteerTask.deleteMany();
  await prisma.emergencyRequest.deleteMany();
  await prisma.shelter.deleteMany();
  await prisma.rescueTeam.deleteMany();
  await prisma.disaster.deleteMany();
  await prisma.user.deleteMany();
}

async function hash() {
  return bcrypt.hash(PASSWORD, 4);
}

/** Create a user directly (fast path around the API). */
export async function makeUser(data: Record<string, string>) {
  const passwordHash = await hash();
  return prisma.user.create({ data: { passwordHash, ...data } as never });
}

export type Fixture = {
  admin: { id: string; email: string };
  citizen: { id: string; email: string };
  volunteer: { id: string; email: string };
  teamUser: { id: string; email: string };
  team: { id: string };
  manager: { id: string; email: string };
  ngo: { id: string; email: string };
  disaster: { id: string };
  item: { id: string };
  inventory: { id: string };
  shelter: { id: string };
};

/** One of everything the flows need. Call in beforeEach after cleanDb(). */
export async function seedBase(): Promise<Fixture> {
  const passwordHash = await hash();
  const create = (data: Record<string, string>) => prisma.user.create({ data: { passwordHash, ...data } as never });
  const admin = await create({ name: 'Admin', email: 'admin@t.local', role: 'ADMIN' });
  const citizen = await create({ name: 'Cit', email: 'cit@t.local', role: 'CITIZEN', address: 'Andheri West' });
  const volunteer = await create({ name: 'Vol', email: 'vol@t.local', role: 'VOLUNTEER', skills: 'FIRST_AID,LOGISTICS', availability: 'FULL_TIME', serviceArea: 'Andheri' });
  const teamUser = await create({ name: 'Team', email: 'team@t.local', role: 'RESCUE_TEAM', serviceArea: 'West' });
  const manager = await create({ name: 'Mgr', email: 'mgr@t.local', role: 'SHELTER_MANAGER' });
  const ngo = await create({ name: 'Ngo', email: 'ngo@t.local', role: 'NGO', organizationName: 'Ngo Org' });
  const disaster = await prisma.disaster.create({
    data: { name: 'Test Floods', type: 'FLOOD', affectedArea: 'Zone 1', severity: 'SEVERE', status: 'ACTIVE', startDate: new Date() },
  });
  const team = await prisma.rescueTeam.create({
    data: { name: 'T1', teamType: 'FLOOD_RESCUE', memberCount: 6, capability: 'BOAT_RESCUE,FIRST_AID', currentLocation: 'Base', latitude: 19.1, longitude: 72.8, userId: teamUser.id },
  });
  const item = await prisma.reliefItem.create({ data: { itemName: 'Rice', category: 'FOOD', unit: 'kg' } });
  const inventory = await prisma.inventory.create({ data: { itemId: item.id, location: 'Depot', quantityAvailable: 1000, managedById: ngo.id } });
  const shelter = await prisma.shelter.create({
    data: { managerId: manager.id, name: 'S1', location: 'Andheri', latitude: 19.13, longitude: 72.82, totalCapacity: 100, currentOccupancy: 10, facilities: 'FOOD,WATER', operatingStatus: 'OPEN' },
  });
  return { admin, citizen, volunteer, teamUser, team, manager, ngo, disaster, item, inventory, shelter };
}

export async function tokenFor(app: Express, email: string, password = PASSWORD): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.token as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
