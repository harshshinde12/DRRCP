import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from './helpers.js';
import { bearer, cleanDb, seedBase, tokenFor, type Fixture } from './helpers.js';

let app: Express;
let fx: Fixture;
const tok: Record<string, string> = {};

beforeAll(() => {
  app = buildApp();
});

beforeEach(async () => {
  await cleanDb();
  fx = await seedBase();
  tok.admin = await tokenFor(app, fx.admin.email);
  tok.manager = await tokenFor(app, fx.manager.email);
  tok.ngo = await tokenFor(app, fx.ngo.email);
  tok.volunteer = await tokenFor(app, fx.volunteer.email);
  tok.citizen = await tokenFor(app, fx.citizen.email);
});

describe('relief: atomic allocation + over-allocation block', () => {
  it('partial then full allocation moves PENDING → APPROVED → PARTIALLY_FULFILLED → FULFILLED', async () => {
    const rr = await request(app).post('/api/resource-requests').set(bearer(tok.manager)).send({
      shelterId: fx.shelter.id, itemId: fx.item.id, quantityRequired: 400, priority: 'HIGH',
    });
    expect(rr.status).toBe(201);
    const rrId = rr.body.data.resourceRequest.id as string;

    expect((await request(app).post(`/api/resource-requests/${rrId}/approve`).set(bearer(tok.ngo))).status).toBe(200);

    const a1 = await request(app).post('/api/allocations').set(bearer(tok.ngo)).send({ resourceRequestId: rrId, inventoryId: fx.inventory.id, quantity: 150 });
    expect(a1.status).toBe(201);
    expect((await prisma.resourceRequest.findUnique({ where: { id: rrId } }))!.status).toBe('PARTIALLY_FULFILLED');
    expect((await prisma.inventory.findUnique({ where: { id: fx.inventory.id } }))!.quantityAvailable).toBe(850);

    // over the remaining need (250) is blocked…
    expect((await request(app).post('/api/allocations').set(bearer(tok.admin)).send({ resourceRequestId: rrId, inventoryId: fx.inventory.id, quantity: 300 })).status).toBe(422);

    const a2 = await request(app).post('/api/allocations').set(bearer(tok.admin)).send({ resourceRequestId: rrId, inventoryId: fx.inventory.id, quantity: 250 });
    expect(a2.status).toBe(201);
    const done = await prisma.resourceRequest.findUnique({ where: { id: rrId } });
    expect(done!.status).toBe('FULFILLED');
    expect(done!.quantityFulfilled).toBe(400);

    // cancelling an allocation restores stock and reopens the request
    await request(app).patch(`/api/allocations/${a2.body.data.allocation.id}/status`).set(bearer(tok.admin)).send({ status: 'IN_TRANSIT' });
    expect((await request(app).patch(`/api/allocations/${a2.body.data.allocation.id}/status`).set(bearer(tok.admin)).send({ status: 'CANCELLED' })).status).toBe(200);
    expect((await prisma.inventory.findUnique({ where: { id: fx.inventory.id } }))!.quantityAvailable).toBe(850);
    expect((await prisma.resourceRequest.findUnique({ where: { id: rrId } }))!.status).toBe('PARTIALLY_FULFILLED');
  });

  it('cannot allocate beyond physical stock (Allocation.Block)', async () => {
    const rr = await request(app).post('/api/resource-requests').set(bearer(tok.manager)).send({ itemId: fx.item.id, quantityRequired: 5000 });
    await request(app).post(`/api/resource-requests/${rr.body.data.resourceRequest.id}/approve`).set(bearer(tok.admin));
    const res = await request(app).post('/api/allocations').set(bearer(tok.admin)).send({
      resourceRequestId: rr.body.data.resourceRequest.id, inventoryId: fx.inventory.id, quantity: 1001,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/over-allocation/i);
    expect((await prisma.inventory.findUnique({ where: { id: fx.inventory.id } }))!.quantityAvailable).toBe(1000);
  });

  it('cannot allocate to a PENDING (unapproved) request', async () => {
    const rr = await request(app).post('/api/resource-requests').set(bearer(tok.manager)).send({ itemId: fx.item.id, quantityRequired: 10 });
    const res = await request(app).post('/api/allocations').set(bearer(tok.admin)).send({
      resourceRequestId: rr.body.data.resourceRequest.id, inventoryId: fx.inventory.id, quantity: 10,
    });
    expect(res.status).toBe(422);
  });

  it('shortage report flags demand above stock', async () => {
    const rr = await request(app).post('/api/resource-requests').set(bearer(tok.manager)).send({ itemId: fx.item.id, quantityRequired: 5000 });
    await request(app).post(`/api/resource-requests/${rr.body.data.resourceRequest.id}/approve`).set(bearer(tok.admin));
    const sh = await request(app).get('/api/inventory/shortages').set(bearer(tok.admin));
    const row = (sh.body.data as Array<{ itemId: string; shortage: number }>).find((r) => r.itemId === fx.item.id);
    expect(row).toBeDefined();
    expect(row!.shortage).toBe(4000);
  });
});

describe('shelters: capacity block + nearby + low-stock alert', () => {
  it('occupancy beyond capacity is blocked unless emergencyOverride', async () => {
    const over = await request(app).patch(`/api/shelters/${fx.shelter.id}`).set(bearer(tok.manager)).send({ currentOccupancy: 101 });
    expect(over.status).toBe(422);
    const okRes = await request(app).patch(`/api/shelters/${fx.shelter.id}`).set(bearer(tok.manager)).send({ currentOccupancy: 101, emergencyOverride: true });
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.shelter.availableCapacity).toBe(-1);
  });

  it('nearby returns OPEN shelters with beds, nearest first (public, no token)', async () => {
    const res = await request(app).get('/api/shelters/nearby?lat=19.13&lng=72.82&radiusKm=50');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].distanceKm).toBeLessThan(5);
  });

  it('filling the last beds alerts admins', async () => {
    await request(app).patch(`/api/shelters/${fx.shelter.id}`).set(bearer(tok.manager)).send({ currentOccupancy: 100 });
    const alert = await prisma.notification.findFirst({ where: { recipientId: fx.admin.id, type: 'SHELTER_ALERT' } });
    expect(alert).not.toBeNull();
  });

  it('a manager cannot touch another manager’s shelter', async () => {
    const reg = await request(app).post('/api/auth/register').send({ name: 'Mgr2', email: 'mgr2@t.local', password: 'Password@123', role: 'SHELTER_MANAGER' });
    const other = (await request(app).post('/api/shelters').set(bearer(reg.body.data.token)).send({
      name: 'Other', location: 'Thane', totalCapacity: 50, facilities: 'FOOD',
    }));
    expect((await request(app).patch(`/api/shelters/${other.body.data.shelter.id}`).set(bearer(tok.manager)).send({ currentOccupancy: 5 })).status).toBe(403);
  });
});

describe('volunteers: skill match, low-risk only, accept flow, suggest', () => {
  it('rejects skill mismatch and high-risk task types', async () => {
    expect((await request(app).post('/api/volunteer-tasks').set(bearer(tok.admin)).send({
      volunteerId: fx.volunteer.id, title: 'Cook meals', taskType: 'COOKING', location: 'Kurla',
    })).status).toBe(422);
    expect((await request(app).post('/api/volunteer-tasks').set(bearer(tok.admin)).send({
      volunteerId: fx.volunteer.id, title: 'Rope rescue', taskType: 'RESCUE', location: 'Kurla',
    })).status).toBe(422);
  });

  it('accept → in-progress → completed, with notifications', async () => {
    const t = await request(app).post('/api/volunteer-tasks').set(bearer(tok.admin)).send({
      volunteerId: fx.volunteer.id, title: 'First-aid post', taskType: 'FIRST_AID', location: 'Andheri camp',
    });
    const id = t.body.data.task.id as string;
    expect((await request(app).post(`/api/volunteer-tasks/${id}/accept`).set(bearer(tok.volunteer))).status).toBe(200);
    // cannot jump ASSIGNED → COMPLETED directly
    const t2 = await request(app).post('/api/volunteer-tasks').set(bearer(tok.admin)).send({
      volunteerId: fx.volunteer.id, title: 'Distribute kits', taskType: 'LOGISTICS', location: 'Andheri camp',
    });
    expect((await request(app).patch(`/api/volunteer-tasks/${t2.body.data.task.id}/status`).set(bearer(tok.volunteer)).send({ status: 'COMPLETED' })).status).toBe(422);
    expect((await request(app).patch(`/api/volunteer-tasks/${id}/status`).set(bearer(tok.volunteer)).send({ status: 'IN_PROGRESS' })).status).toBe(200);
    expect((await request(app).patch(`/api/volunteer-tasks/${id}/status`).set(bearer(tok.volunteer)).send({ status: 'COMPLETED' })).status).toBe(200);
  });

  it('suggest ranks the skill-matched volunteer first', async () => {
    const res = await request(app).get('/api/volunteers/suggest?taskType=FIRST_AID&location=Andheri%20camp').set(bearer(tok.admin));
    expect(res.status).toBe(200);
    expect(res.body.data.volunteers[0].id).toBe(fx.volunteer.id);
    expect(res.body.data.volunteers[0].score).toBeGreaterThan(0);
  });
});

describe('cross-module RBAC + public surface', () => {
  it('citizens/NGOs are fenced out of foreign modules', async () => {
    expect((await request(app).post('/api/teams').set(bearer(tok.citizen)).send({ name: 'X', teamType: 'FIRE', memberCount: 3, capability: 'C', currentLocation: 'L' })).status).toBe(403);
    expect((await request(app).post('/api/allocations').set(bearer(tok.ngo)).send({ resourceRequestId: 'x', inventoryId: 'y', quantity: 1 })).status).not.toBe(401);
    expect((await request(app).get('/api/volunteers').set(bearer(tok.volunteer))).status).toBe(403);
    expect((await request(app).post('/api/alerts/broadcast').set(bearer(tok.ngo)).send({ message: 'hello world' })).status).toBe(403);
  });

  it('shelter listings are public; writes need auth', async () => {
    expect((await request(app).get('/api/shelters')).status).toBe(200);
    expect((await request(app).post('/api/shelters').send({ name: 'X', location: 'Y', totalCapacity: 10, facilities: 'FOOD' })).status).toBe(401);
  });

  it('broadcast reaches citizens; pagination meta is present', async () => {
    const bc = await request(app).post('/api/alerts/broadcast').set(bearer(tok.admin)).send({ message: 'Heavy rain warning for tonight' });
    expect(bc.status).toBe(201);
    const inbox = await request(app).get('/api/notifications?limit=5').set(bearer(tok.citizen));
    expect(inbox.body.meta.total).toBeGreaterThan(0);
    expect(inbox.body.meta.page).toBe(1);
  });
});
