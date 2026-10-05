import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from './helpers.js';
import { bearer, cleanDb, makeUser, seedBase, tokenFor, type Fixture } from './helpers.js';

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
});

async function submitRaw() {
  await prisma.user.update({ where: { id: fx.citizen.id }, data: { phone: '+91-999' } });
  const sub = await request(app).post('/api/requests').set(bearer(tok.citizen)).send({
    emergencyType: 'RESCUE', description: 'Trapped in basement', location: 'Andheri West',
    latitude: 19.13, longitude: 72.82, peopleAffected: 2,
  });
  return sub.body.data.request.id as string;
}

describe('GET /api/meta', () => {
  it('is public and exposes every value set with labels + color keys', async () => {
    const res = await request(app).get('/api/meta');
    expect(res.status).toBe(200);
    const meta = res.body.data;
    for (const group of ['roles', 'publicRoles', 'requestStatuses', 'priorities', 'emergencyTypes', 'teamAvailability', 'assignmentStatuses', 'volunteerTaskStatuses', 'volunteerTaskTypes', 'shelterStatuses', 'resourceRequestStatuses', 'allocationStatuses', 'notificationTypes', 'disasterStatuses', 'severities', 'injurySeverities']) {
      expect(Array.isArray(meta[group]), group).toBe(true);
      expect(meta[group].length).toBeGreaterThan(0);
      for (const opt of meta[group]) {
        expect(opt).toHaveProperty('value');
        expect(opt).toHaveProperty('label');
        expect(opt).toHaveProperty('color');
      }
    }
    expect(meta.requestLifecycle).toEqual(['SUBMITTED', 'VERIFIED', 'ASSIGNED', 'RESCUE_IN_PROGRESS', 'RESOLVED']);
    expect(meta.publicRoles.map((r: { value: string }) => r.value).sort()).toEqual(['CITIZEN', 'NGO', 'SHELTER_MANAGER', 'VOLUNTEER']);
    expect(meta.priorities.find((p: { value: string }) => p.value === 'CRITICAL')).toMatchObject({ label: 'Critical', color: 'red' });
  });
});

describe('missionStatus + displayStatus (no new states)', () => {
  it('tracks the mission through list and detail', async () => {
    const reqId = await submitRaw();

    let detail = (await request(app).get(`/api/requests/${reqId}`).set(bearer(tok.citizen))).body.data.request;
    expect(detail.missionStatus).toBeNull();
    expect(detail.displayStatus).toBe('Awaiting verification');

    await request(app).post(`/api/requests/${reqId}/verify`).set(bearer(tok.admin)).send({ decision: 'VERIFIED', priority: 'HIGH' });
    detail = (await request(app).get(`/api/requests/${reqId}`).set(bearer(tok.citizen))).body.data.request;
    expect(detail.displayStatus).toBe('Verified — awaiting rescue team');

    const asg = await request(app).post(`/api/requests/${reqId}/assign`).set(bearer(tok.admin)).send({ teamId: fx.team.id });
    const asgId = asg.body.data.assignment.id as string;
    detail = (await request(app).get(`/api/requests/${reqId}`).set(bearer(tok.citizen))).body.data.request;
    expect(detail.missionStatus).toBe('ASSIGNED');
    expect(detail.displayStatus).toBe('Team assigned');

    await request(app).post(`/api/assignments/${asgId}/acknowledge`).set(bearer(tok.team));
    await request(app).patch(`/api/assignments/${asgId}/status`).set(bearer(tok.team)).send({ status: 'ON_THE_WAY' });
    detail = (await request(app).get(`/api/requests/${reqId}`).set(bearer(tok.citizen))).body.data.request;
    expect(detail.missionStatus).toBe('ON_THE_WAY');
    expect(detail.displayStatus).toBe('Team on the way');

    const list = (await request(app).get('/api/requests').set(bearer(tok.citizen))).body.data;
    expect(list[0].missionStatus).toBe('ON_THE_WAY');
    expect(list[0].displayStatus).toBe('Team on the way');
    // raw state machine untouched
    expect(list[0].status).toBe('ASSIGNED');
  });
});

describe('contact/location privacy (SE-5)', () => {
  it('masks phone + coords except for ADMIN, owner, assigned team', async () => {
    const reqId = await submitRaw();
    await request(app).post(`/api/requests/${reqId}/verify`).set(bearer(tok.admin)).send({ decision: 'VERIFIED' });
    await request(app).post(`/api/requests/${reqId}/assign`).set(bearer(tok.admin)).send({ teamId: fx.team.id });

    const owner = (await request(app).get(`/api/requests/${reqId}`).set(bearer(tok.citizen))).body.data.request;
    expect(owner.requester.phone).toBe('+91-999');
    expect(owner.latitude).toBeCloseTo(19.13);

    const admin = (await request(app).get(`/api/requests/${reqId}`).set(bearer(tok.admin))).body.data.request;
    expect(admin.requester.phone).toBe('+91-999');
    expect(admin.latitude).toBeCloseTo(19.13);

    const assigned = (await request(app).get(`/api/requests/${reqId}`).set(bearer(tok.team))).body.data.request;
    expect(assigned.requester.phone).toBe('+91-999');
    expect(assigned.latitude).toBeCloseTo(19.13);

    // a team that is NOT assigned to this request is fenced out entirely (S-02)
    const other = await makeUser({ name: 'Other Team', email: 'other-team@t.local', role: 'RESCUE_TEAM' });
    await prisma.rescueTeam.create({ data: { name: 'T2', teamType: 'MEDICAL', memberCount: 4, capability: 'TRIAGE', currentLocation: 'Base2', userId: other.id } });
    const otherTok = await tokenFor(app, 'other-team@t.local');
    expect((await request(app).get(`/api/requests/${reqId}`).set(bearer(otherTok))).status).toBe(403);
    // …and it is absent from their list (scoped to own assignments)
    const scopedList = (await request(app).get('/api/requests').set(bearer(otherTok))).body;
    expect(scopedList.meta.total).toBe(0);
    expect(scopedList.data).toHaveLength(0);
    // textual address stays visible for dispatch context (assigned viewer still masked-safe)
    const assignedList = (await request(app).get('/api/requests').set(bearer(tok.team))).body.data;
    expect(assignedList[0].location).toBe('Andheri West');
  });
});

describe('override reason', () => {
  it('is mandatory when force-assigning an unavailable team', async () => {
    const reqId = await submitRaw();
    await request(app).post(`/api/requests/${reqId}/verify`).set(bearer(tok.admin)).send({ decision: 'VERIFIED' });
    await request(app).post(`/api/requests/${reqId}/assign`).set(bearer(tok.admin)).send({ teamId: fx.team.id });

    const noReason = await request(app).post(`/api/requests/${reqId}/assign`).set(bearer(tok.admin)).send({ teamId: fx.team.id, override: true });
    expect(noReason.status).toBe(422);

    const withReason = await request(app).post(`/api/requests/${reqId}/assign`).set(bearer(tok.admin)).send({ teamId: fx.team.id, override: true, overrideReason: 'Nearest crew despite engagement' });
    expect(withReason.status).toBe(201);
    const audit = await prisma.auditLog.findFirst({ where: { action: 'TEAM_ASSIGN_OVERRIDE' } });
    expect(JSON.parse(audit!.metadata as string).reason).toBe('Nearest crew despite engagement');
  });
});
