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
  tok.citizen = await tokenFor(app, fx.citizen.email);
  tok.team = await tokenFor(app, fx.teamUser.email);
  tok.manager = await tokenFor(app, fx.manager.email);
});

async function submit(loc: string, extra: Record<string, unknown> = {}) {
  const res = await request(app).post('/api/requests').set(bearer(tok.citizen)).send({
    emergencyType: 'RESCUE', description: `Incident at ${loc} needs help`, location: loc, peopleAffected: 2, ...extra,
  });
  expect(res.status).toBe(201);
  return res.body.data.request.id as string;
}

describe('pre-step: assignment payloads expose no secrets', () => {
  it('GET /assignments and /assignments/:id never leak passwordHash or requester email', async () => {
    const reqId = await submit('Secret Lane');
    await request(app).post(`/api/requests/${reqId}/verify`).set(bearer(tok.admin)).send({ decision: 'VERIFIED' });
    const asg = await request(app).post(`/api/requests/${reqId}/assign`).set(bearer(tok.admin)).send({ teamId: fx.team.id });
    const asgId = asg.body.data.assignment.id as string;

    const list = await request(app).get('/api/assignments').set(bearer(tok.admin));
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toMatch(/passwordHash/i);
    expect(JSON.stringify(list.body)).not.toMatch(/"email"/);

    const one = await request(app).get(`/api/assignments/${asgId}`).set(bearer(tok.team));
    expect(one.status).toBe(200);
    expect(JSON.stringify(one.body)).not.toMatch(/passwordHash/i);
    expect(JSON.stringify(one.body)).not.toMatch(/"email"/);
    // …while the assigned team still sees operational fields
    expect(one.body.data.assignment.request.latitude).toBeNull(); // fixture submit had no coords
    expect(one.body.data.assignment.request.location).toBe('Secret Lane');
  });
});

describe('BE-15: conflicting concurrent transitions cannot double-apply', () => {
  it('double-verify race: exactly one decision wins', async () => {
    const reqId = await submit('Race Lane');
    const [r1, r2] = await Promise.all([
      request(app).post(`/api/requests/${reqId}/verify`).set(bearer(tok.admin)).send({ decision: 'VERIFIED', priority: 'HIGH' }),
      request(app).post(`/api/requests/${reqId}/verify`).set(bearer(tok.admin)).send({ decision: 'REJECTED' }),
    ]);
    const wins = [r1, r2].filter((r) => r.status === 200);
    const losses = [r1, r2].filter((r) => r.status !== 200);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect([409, 422]).toContain(losses[0].status); // stale reader 409s, fresh reader 422s — never double-applies
    const final = await prisma.emergencyRequest.findUnique({ where: { id: reqId } });
    expect(['VERIFIED', 'REJECTED']).toContain(final!.status);
  });

  it('concurrent allocations never over-allocate stock or need', async () => {
    const rr = await request(app).post('/api/resource-requests').set(bearer(tok.manager)).send({
      shelterId: fx.shelter.id, itemId: fx.item.id, quantityRequired: 100, priority: 'HIGH',
    });
    const rrId = rr.body.data.resourceRequest.id as string;
    await request(app).post(`/api/resource-requests/${rrId}/approve`).set(bearer(tok.admin));
    await prisma.inventory.update({ where: { id: fx.inventory.id }, data: { quantityAvailable: 100 } });

    const [a, b] = await Promise.all([
      request(app).post('/api/allocations').set(bearer(tok.admin)).send({ resourceRequestId: rrId, inventoryId: fx.inventory.id, quantity: 100 }),
      request(app).post('/api/allocations').set(bearer(tok.admin)).send({ resourceRequestId: rrId, inventoryId: fx.inventory.id, quantity: 100 }),
    ]);
    const wins = [a, b].filter((r) => r.status === 201);
    expect(wins).toHaveLength(1);
    expect([a.status, b.status].find((s) => s !== 201)).not.toBe(201);

    const done = (await prisma.resourceRequest.findUnique({ where: { id: rrId } }))!;
    const inv = (await prisma.inventory.findUnique({ where: { id: fx.inventory.id } }))!;
    expect(done.quantityFulfilled).toBeLessThanOrEqual(100);
    expect(inv.quantityAvailable).toBeGreaterThanOrEqual(0);
    expect(done.quantityFulfilled + inv.quantityAvailable).toBe(100);
  });
});

describe('BE-03: report after a failed progression leaves no orphan', () => {
  it('stale request state blocks the report; nothing is written', async () => {
    const reqId = await submit('Orphan Lane');
    await request(app).post(`/api/requests/${reqId}/verify`).set(bearer(tok.admin)).send({ decision: 'VERIFIED' });
    const asg = await request(app).post(`/api/requests/${reqId}/assign`).set(bearer(tok.admin)).send({ teamId: fx.team.id });
    const asgId = asg.body.data.assignment.id as string;

    // Simulate a BE-02-style partial failure: mission moved, request left stale.
    await prisma.rescueAssignment.update({ where: { id: asgId }, data: { status: 'RESCUE_IN_PROGRESS' } });
    await prisma.rescueTeam.update({ where: { id: fx.team.id }, data: { availabilityStatus: 'RESCUE_IN_PROGRESS' } });

    const rep = await request(app).post(`/api/assignments/${asgId}/report`).set(bearer(tok.team)).send({ peopleRescued: 2, injuredPeople: 0 });
    expect(rep.status).toBe(422);

    expect(await prisma.rescueReport.findFirst({ where: { assignmentId: asgId } })).toBeNull();
    expect((await prisma.rescueAssignment.findUnique({ where: { id: asgId } }))!.status).toBe('RESCUE_IN_PROGRESS');
    expect((await prisma.emergencyRequest.findUnique({ where: { id: reqId } }))!.status).toBe('ASSIGNED');
  });
});

describe('BE-05: priority is frozen on terminal requests', () => {
  it('REJECTED, DUPLICATE and CANCELLED reject priority changes with 422', async () => {
    const r1 = await submit('Terminal One');
    await request(app).post(`/api/requests/${r1}/verify`).set(bearer(tok.admin)).send({ decision: 'REJECTED' });
    expect((await request(app).patch(`/api/requests/${r1}/priority`).set(bearer(tok.admin)).send({ priority: 'LOW' })).status).toBe(422);

    const r2 = await submit('Terminal Two');
    const r3 = await submit('Terminal Three');
    await request(app).post(`/api/requests/${r3}/verify`).set(bearer(tok.admin)).send({ decision: 'DUPLICATE', duplicateOfId: r2 });
    expect((await request(app).patch(`/api/requests/${r3}/priority`).set(bearer(tok.admin)).send({ priority: 'LOW' })).status).toBe(422);

    const r4 = await submit('Terminal Four');
    await request(app).post(`/api/requests/${r4}/cancel`).set(bearer(tok.citizen));
    expect((await request(app).patch(`/api/requests/${r4}/priority`).set(bearer(tok.admin)).send({ priority: 'LOW' })).status).toBe(422);

    // …while an active request still accepts priority changes
    expect((await request(app).patch(`/api/requests/${r2}/priority`).set(bearer(tok.admin)).send({ priority: 'HIGH' })).status).toBe(200);
  });
});

describe('BE-09: the string "false" is false', () => {
  it('override:"false" does not force-assign; emergencyOverride:"false" does not override', async () => {
    const reqId = await submit('Coerce Lane');
    await request(app).post(`/api/requests/${reqId}/verify`).set(bearer(tok.admin)).send({ decision: 'VERIFIED' });
    await request(app).post(`/api/requests/${reqId}/assign`).set(bearer(tok.admin)).send({ teamId: fx.team.id });

    const req2 = await submit('Coerce Lane Two');
    await request(app).post(`/api/requests/${req2}/verify`).set(bearer(tok.admin)).send({ decision: 'VERIFIED' });
    // Busy team + override:"false" (string) ⇒ treated as no override ⇒ 409, not 422.
    const res = await request(app).post(`/api/requests/${req2}/assign`).set(bearer(tok.admin)).send({ teamId: fx.team.id, override: 'false' });
    expect(res.status).toBe(409);

    // Over capacity + emergencyOverride:"false" (string) ⇒ still blocked ⇒ 422.
    const over = await request(app).patch(`/api/shelters/${fx.shelter.id}`).set(bearer(tok.manager)).send({ currentOccupancy: 101, emergencyOverride: 'false' });
    expect(over.status).toBe(422);
  });
});

describe('BE-06: team availability guard', () => {
  it('blocks AVAILABLE while assigned; ignores PATCH availability; frees after done', async () => {
    const reqId = await submit('Guard Lane');
    await request(app).post(`/api/requests/${reqId}/verify`).set(bearer(tok.admin)).send({ decision: 'VERIFIED' });
    const asg = await request(app).post(`/api/requests/${reqId}/assign`).set(bearer(tok.admin)).send({ teamId: fx.team.id });
    const asgId = asg.body.data.assignment.id as string;

    expect((await request(app).post(`/api/teams/${fx.team.id}/availability`).set(bearer(tok.admin)).send({ availabilityStatus: 'AVAILABLE' })).status).toBe(409);
    expect((await request(app).post(`/api/teams/${fx.team.id}/availability`).set(bearer(tok.admin)).send({ availabilityStatus: 'ASSIGNED' })).status).toBe(422);

    // PATCH can update location but cannot sneak availability through (stripped).
    const patched = await request(app).patch(`/api/teams/${fx.team.id}`).set(bearer(tok.admin)).send({ currentLocation: 'New Base', availabilityStatus: 'AVAILABLE' });
    expect(patched.status).toBe(200);
    expect(patched.body.data.team.currentLocation).toBe('New Base');
    expect(patched.body.data.team.availabilityStatus).toBe('ASSIGNED');

    // Finish the mission → team freed by the report flow → action succeeds.
    await request(app).post(`/api/assignments/${asgId}/acknowledge`).set(bearer(tok.team));
    await request(app).patch(`/api/assignments/${asgId}/status`).set(bearer(tok.team)).send({ status: 'ON_THE_WAY' });
    await request(app).patch(`/api/assignments/${asgId}/status`).set(bearer(tok.team)).send({ status: 'RESCUE_IN_PROGRESS' });
    await request(app).post(`/api/assignments/${asgId}/report`).set(bearer(tok.team)).send({ peopleRescued: 2, injuredPeople: 0 });
    expect((await request(app).post(`/api/teams/${fx.team.id}/availability`).set(bearer(tok.admin)).send({ availabilityStatus: 'AVAILABLE' })).status).toBe(200);
  });
});
