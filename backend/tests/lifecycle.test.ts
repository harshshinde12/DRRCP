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
});

describe('full lifecycle: submit → verify → assign → mission → report → resolve', () => {
  it('walks the whole flow with notifications + audit at every step', async () => {
    // 1. citizen submits (auto-links the ACTIVE disaster)
    const sub = await request(app).post('/api/requests').set(bearer(tok.citizen)).send({
      emergencyType: 'RESCUE', description: 'Family stranded on rooftop in flood water',
      location: 'Andheri West', latitude: 19.13, longitude: 72.82, peopleAffected: 4, injuryPresent: false,
    });
    expect(sub.status).toBe(201);
    const reqId = sub.body.data.request.id as string;
    expect(sub.body.data.request.status).toBe('SUBMITTED');
    expect(sub.body.data.request.disasterId).toBe(fx.disaster.id);

    // citizen sees own request; history has the submit entry
    const mine = await request(app).get('/api/requests').set(bearer(tok.citizen));
    expect(mine.body.meta.total).toBe(1);

    // 2. invalid skip SUBMITTED → ASSIGNED is impossible via verify (only VERIFIED/DUPLICATE/REJECTED)
    const badVerify = await request(app).post(`/api/requests/${reqId}/verify`).set(bearer(tok.admin)).send({ decision: 'ASSIGNED' });
    expect(badVerify.status).toBe(400);

    // 3. admin verifies with priority
    const ver = await request(app).post(`/api/requests/${reqId}/verify`).set(bearer(tok.admin)).send({ decision: 'VERIFIED', priority: 'CRITICAL' });
    expect(ver.status).toBe(200);
    expect(ver.body.data.request.status).toBe('VERIFIED');

    // citizen cancel after verify is still allowed (SRS App. B) — but NOT after assign; check later
    // 4. matching teams suggests the AVAILABLE fixture team
    const match = await request(app).get(`/api/requests/${reqId}/matching-teams`).set(bearer(tok.admin));
    expect(match.status).toBe(200);
    expect(match.body.data.teams.some((t: { id: string }) => t.id === fx.team.id)).toBe(true);

    // 5. admin assigns → request ASSIGNED, team ASSIGNED
    const asg = await request(app).post(`/api/requests/${reqId}/assign`).set(bearer(tok.admin)).send({ teamId: fx.team.id });
    expect(asg.status).toBe(201);
    const asgId = asg.body.data.assignment.id as string;
    expect((await prisma.emergencyRequest.findUnique({ where: { id: reqId } }))!.status).toBe('ASSIGNED');
    expect((await prisma.rescueTeam.findUnique({ where: { id: fx.team.id } }))!.availabilityStatus).toBe('ASSIGNED');

    // citizen can no longer cancel once assigned
    const cancelLate = await request(app).post(`/api/requests/${reqId}/cancel`).set(bearer(tok.citizen));
    expect(cancelLate.status).toBe(422);

    // 6. second assignment to the same busy team is rejected…
    const dup = await request(app).post(`/api/requests/${reqId}/assign`).set(bearer(tok.admin)).send({ teamId: fx.team.id });
    expect(dup.status).toBe(409);

    // …unless explicitly overridden with a mandatory reason (additional-support path, logged)
    const over = await request(app).post(`/api/requests/${reqId}/assign`).set(bearer(tok.admin)).send({ teamId: fx.team.id, override: true, overrideReason: 'Second crew needed for wide area' });
    expect(over.status).toBe(201);
    const overrideAudit = await prisma.auditLog.findFirst({ where: { action: 'TEAM_ASSIGN_OVERRIDE' } });
    expect(overrideAudit).not.toBeNull();

    // 7. team acknowledges → on the way → in progress (request follows to RESCUE_IN_PROGRESS)
    expect((await request(app).post(`/api/assignments/${asgId}/acknowledge`).set(bearer(tok.team))).status).toBe(200);
    expect((await request(app).patch(`/api/assignments/${asgId}/status`).set(bearer(tok.team)).send({ status: 'ON_THE_WAY' })).status).toBe(200);
    expect((await request(app).patch(`/api/assignments/${asgId}/status`).set(bearer(tok.team)).send({ status: 'RESCUE_IN_PROGRESS' })).status).toBe(200);
    expect((await prisma.emergencyRequest.findUnique({ where: { id: reqId } }))!.status).toBe('RESCUE_IN_PROGRESS');

    // 8. rescue unsuccessful → request additional support (admins alerted, mission stays open)
    const sup = await request(app).post(`/api/assignments/${asgId}/request-support`).set(bearer(tok.team)).send({ notes: 'Need a second boat, water rising' });
    expect(sup.status).toBe(200);
    const adminNotif = await prisma.notification.findFirst({ where: { recipientId: fx.admin.id, type: 'ASSIGNMENT', message: { contains: 'additional support' } } });
    expect(adminNotif?.message).toMatch(/additional support/i);

    // 9. report → COMPLETED + team AVAILABLE + request RESOLVED (the ONLY path to RESOLVED)
    const rep = await request(app).post(`/api/assignments/${asgId}/report`).set(bearer(tok.team)).send({ peopleRescued: 4, injuredPeople: 0, notes: 'All safe' });
    expect(rep.status).toBe(201);
    expect((await prisma.emergencyRequest.findUnique({ where: { id: reqId } }))!.status).toBe('RESOLVED');
    expect((await prisma.rescueTeam.findUnique({ where: { id: fx.team.id } }))!.availabilityStatus).toBe('AVAILABLE');

    // 9b. the generated report reaches the admin inbox for review/record
    const reportNotif = await prisma.notification.findFirst({ where: { recipientId: fx.admin.id, type: 'ASSIGNMENT', message: { contains: 'Mission report' } } });
    expect(reportNotif?.message).toMatch(/All safe/);
    expect(reportNotif?.message).toContain(reqId);

    // repeat report is rejected
    expect((await request(app).post(`/api/assignments/${asgId}/report`).set(bearer(tok.team)).send({ peopleRescued: 1, injuredPeople: 0 })).status).toBe(409);

    // 10. citizen inbox got every status change; unread count works; mark-all-read works
    const inbox = await request(app).get('/api/notifications').set(bearer(tok.citizen));
    expect(inbox.status).toBe(200);
    expect(inbox.body.meta.unread).toBeGreaterThan(0);
    expect((await request(app).patch('/api/notifications/read-all').set(bearer(tok.citizen))).status).toBe(200);
    expect((await request(app).get('/api/notifications/unread-count').set(bearer(tok.citizen))).body.data.unread).toBe(0);

    // 11. full audit trail for the request
    const hist = await request(app).get(`/api/requests/${reqId}/history`).set(bearer(tok.citizen));
    const actions = (hist.body as { data: Array<{ action: string }> }).data.map((h) => h.action);
    for (const a of ['REQUEST_SUBMIT', 'REQUEST_VERIFY', 'TEAM_ASSIGN', 'MISSION_PROGRESS', 'RESCUE_REPORT', 'REQUEST_RESOLVE']) {
      expect(actions).toContain(a);
    }

    // 12. dashboard reflects the resolved request; audit-log viewer works
    const dash = await request(app).get('/api/dashboard/summary').set(bearer(tok.admin));
    expect(dash.body.data.requests.resolved).toBe(1);
    const ts = await request(app).get('/api/dashboard/timeseries?days=7').set(bearer(tok.admin));
    expect(ts.body.data).toHaveLength(7);
    const logs = await request(app).get('/api/audit-logs?action=TEAM_ASSIGN').set(bearer(tok.admin));
    expect(logs.body.meta.total).toBeGreaterThan(0);
  });

  it('citizen can cancel a SUBMITTED request; duplicate links to the original', async () => {
    const a = await request(app).post('/api/requests').set(bearer(tok.citizen)).send({
      emergencyType: 'FOOD', description: 'Need food packets for 20 people', location: 'Kurla', peopleAffected: 20,
    });
    expect((await request(app).post(`/api/requests/${a.body.data.request.id}/cancel`).set(bearer(tok.citizen))).status).toBe(200);

    const b = await request(app).post('/api/requests').set(bearer(tok.citizen)).send({
      emergencyType: 'FOOD', description: 'Same lane also needs food', location: 'Kurla', peopleAffected: 5,
    });
    const dup = await request(app).post(`/api/requests/${b.body.data.request.id}/verify`).set(bearer(tok.admin)).send({
      decision: 'DUPLICATE', priority: 'LOW', duplicateOfId: a.body.data.request.id,
    });
    expect(dup.status).toBe(200);
    expect(dup.body.data.request.status).toBe('DUPLICATE');

    const noLink = await request(app).post(`/api/requests/${b.body.data.request.id}/verify`).set(bearer(tok.admin)).send({ decision: 'DUPLICATE' });
    expect(noLink.status).toBe(422);
  });

  it('RBAC: citizens cannot triage/assign; volunteers cannot touch requests; teams see assignments', async () => {
    const volTok = await tokenFor(app, fx.volunteer.email);
    const sub = await request(app).post('/api/requests').set(bearer(tok.citizen)).send({
      emergencyType: 'MEDICAL', description: 'Need oxygen cylinder urgently', location: 'Dadar', peopleAffected: 1, injuryPresent: true, injurySeverity: 'SEVERE',
    });
    const reqId = sub.body.data.request.id as string;
    expect((await request(app).post(`/api/requests/${reqId}/verify`).set(bearer(tok.citizen)).send({ decision: 'VERIFIED' })).status).toBe(403);
    expect((await request(app).post(`/api/requests/${reqId}/assign`).set(bearer(tok.citizen)).send({ teamId: fx.team.id })).status).toBe(403);
    expect((await request(app).get('/api/requests').set(bearer(volTok))).status).toBe(403);
    expect((await request(app).get('/api/dashboard/summary').set(bearer(tok.citizen))).status).toBe(403);

    await request(app).post(`/api/requests/${reqId}/verify`).set(bearer(tok.admin)).send({ decision: 'VERIFIED', priority: 'HIGH' });
    await request(app).post(`/api/requests/${reqId}/assign`).set(bearer(tok.admin)).send({ teamId: fx.team.id });
    const teamList = await request(app).get('/api/assignments').set(bearer(tok.team));
    expect(teamList.body.meta.total).toBe(1);

    // another citizen cannot read or cancel it
    const otherReg = await request(app).post('/api/auth/register').send({ name: 'Other', email: 'other2@t.local', password: 'Password@123' });
    const otherTok = otherReg.body.data.token as string;
    expect((await request(app).get(`/api/requests/${reqId}`).set(bearer(otherTok))).status).toBe(403);
    expect((await request(app).post(`/api/requests/${reqId}/cancel`).set(bearer(otherTok))).status).toBe(403);
  });
});
