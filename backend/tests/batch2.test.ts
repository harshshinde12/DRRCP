import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { decorateRequest } from '../src/services/requestService.js';
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

describe('S-01: shelter manager email is never public', () => {
  it('unauthenticated listings hide email; ADMIN and owner see it', async () => {
    const list = await request(app).get('/api/shelters');
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThan(0);
    expect(list.body.data[0].manager.id).toBeTruthy();
    expect(list.body.data[0].manager.name).toBeTruthy();
    expect(list.body.data[0].manager).not.toHaveProperty('email');

    const one = await request(app).get(`/api/shelters/${fx.shelter.id}`);
    expect(one.status).toBe(200);
    expect(one.body.data.shelter.manager).not.toHaveProperty('email');

    const asAdmin = await request(app).get(`/api/shelters/${fx.shelter.id}`).set(bearer(tok.admin));
    expect(asAdmin.body.data.shelter.manager.email).toBe(fx.manager.email);

    const asOwner = await request(app).get(`/api/shelters/${fx.shelter.id}`).set(bearer(tok.manager));
    expect(asOwner.body.data.shelter.manager.email).toBe(fx.manager.email);

    const asStranger = await request(app).get(`/api/shelters/${fx.shelter.id}`).set(bearer(tok.citizen));
    expect(asStranger.body.data.shelter.manager).not.toHaveProperty('email');
  });
});

describe('BE-04: SE-5 masking on nested assignment requests', () => {
  it('masks phone + coords for non-assigned viewers via the shared helper', () => {
    const nested = {
      requesterId: 'cit-1',
      status: 'ASSIGNED',
      latitude: 19.13,
      longitude: 72.82,
      requester: { id: 'cit-1', name: 'C', phone: '+91-999' },
      assignments: [{ id: 'a1', status: 'ASSIGNED', teamId: 'team-A', assignedAt: new Date() }],
    };
    const masked = decorateRequest({ id: 'u-other', role: 'RESCUE_TEAM', teamId: 'team-B' }, nested);
    expect(masked.latitude).toBeNull();
    expect(masked.longitude).toBeNull();
    expect(masked.requester!.phone).toBeNull();

    const assigned = decorateRequest({ id: 'u-a', role: 'RESCUE_TEAM', teamId: 'team-A' }, nested);
    expect(assigned.latitude).toBeCloseTo(19.13);
    expect(assigned.requester!.phone).toBe('+91-999');

    const admin = decorateRequest({ id: 'u-admin', role: 'ADMIN', teamId: null }, nested);
    expect(admin.latitude).toBeCloseTo(19.13);
  });

  it('assigned team and ADMIN still see raw values over HTTP', async () => {
    const sub = await request(app).post('/api/requests').set(bearer(tok.citizen)).send({
      emergencyType: 'RESCUE', description: 'Trapped family needs rescue', location: 'Andheri West',
      latitude: 19.13, longitude: 72.82, peopleAffected: 2,
    });
    const reqId = sub.body.data.request.id as string;
    await request(app).post(`/api/requests/${reqId}/verify`).set(bearer(tok.admin)).send({ decision: 'VERIFIED' });
    const asg = await request(app).post(`/api/requests/${reqId}/assign`).set(bearer(tok.admin)).send({ teamId: fx.team.id });
    const asgId = asg.body.data.assignment.id as string;

    const byTeam = (await request(app).get(`/api/assignments/${asgId}`).set(bearer(tok.team))).body.data.assignment;
    expect(byTeam.request.latitude).toBeCloseTo(19.13);

    const byAdmin = (await request(app).get(`/api/assignments/${asgId}`).set(bearer(tok.admin))).body.data.assignment;
    expect(byAdmin.request.latitude).toBeCloseTo(19.13);
  });
});

describe('S-02: rescue teams see only own-assigned requests', () => {
  it('scopes list and blocks unassigned detail; ADMIN/citizen unchanged', async () => {
    const mk = (loc: string) =>
      request(app).post('/api/requests').set(bearer(tok.citizen)).send({
        emergencyType: 'RESCUE', description: `Incident at ${loc} needs help`, location: loc, peopleAffected: 2,
      });
    const reqA = (await mk('Lane A')).body.data.request.id as string;
    const reqB = (await mk('Lane B')).body.data.request.id as string;
    for (const id of [reqA, reqB]) {
      await request(app).post(`/api/requests/${id}/verify`).set(bearer(tok.admin)).send({ decision: 'VERIFIED' });
    }
    await request(app).post(`/api/requests/${reqA}/assign`).set(bearer(tok.admin)).send({ teamId: fx.team.id });

    const teamList = (await request(app).get('/api/requests').set(bearer(tok.team))).body;
    expect(teamList.meta.total).toBe(1);
    expect(teamList.data[0].id).toBe(reqA);

    expect((await request(app).get(`/api/requests/${reqA}`).set(bearer(tok.team))).status).toBe(200);
    expect((await request(app).get(`/api/requests/${reqB}`).set(bearer(tok.team))).status).toBe(403);

    expect((await request(app).get('/api/requests').set(bearer(tok.admin))).body.meta.total).toBe(2);
    expect((await request(app).get('/api/requests').set(bearer(tok.citizen))).body.meta.total).toBe(2);
  });
});

describe('BE-07/BE-14: duplicate team name is a clean 409', () => {
  it('maps P2002 without leaking Prisma internals', async () => {
    const payload = { name: 'DupUnit', teamType: 'MEDICAL', memberCount: 5, capability: 'TRIAGE', currentLocation: 'Depot' };
    expect((await request(app).post('/api/teams').set(bearer(tok.admin)).send(payload)).status).toBe(201);
    const dup = await request(app).post('/api/teams').set(bearer(tok.admin)).send(payload);
    expect(dup.status).toBe(409);
    expect(JSON.stringify(dup.body)).not.toMatch(/prisma/i);
  });
});

describe('BE-08/F-02: injured without severity submits as UNKNOWN', () => {
  it('accepts omitted and explicit UNKNOWN; non-injured stays NONE', async () => {
    const noSev = await request(app).post('/api/requests').set(bearer(tok.citizen)).send({
      emergencyType: 'MEDICAL', description: 'Worker fell from scaffolding', location: 'Bandra',
      peopleAffected: 1, injuryPresent: true,
    });
    expect(noSev.status).toBe(201);
    expect(noSev.body.data.request.injurySeverity).toBe('UNKNOWN');

    const explicit = await request(app).post('/api/requests').set(bearer(tok.citizen)).send({
      emergencyType: 'MEDICAL', description: 'Another fall at same site', location: 'Bandra',
      peopleAffected: 1, injuryPresent: true, injurySeverity: 'UNKNOWN',
    });
    expect(explicit.status).toBe(201);

    const plain = await request(app).post('/api/requests').set(bearer(tok.citizen)).send({
      emergencyType: 'FOOD', description: 'Need food packets for a family', location: 'Kurla', peopleAffected: 4,
    });
    expect(plain.body.data.request.injurySeverity).toBe('NONE');
  });
});
