import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from './helpers.js';
import { cleanDb } from './helpers.js';
import { bearer, seedBase, tokenFor, type Fixture } from './helpers.js';

let app: Express;
let fx: Fixture;
let adminTok = '';
let citizenTok = '';

beforeAll(() => {
  app = buildApp();
});

beforeEach(async () => {
  await cleanDb();
  fx = await seedBase();
  adminTok = await tokenFor(app, fx.admin.email);
  citizenTok = await tokenFor(app, fx.citizen.email);
});

describe('STEP 0 — registration lockdown', () => {
  it.each(['CITIZEN', 'VOLUNTEER', 'SHELTER_MANAGER', 'NGO'])('allows public self-registration for %s', async (role) => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: `${role} User`, email: `${role.toLowerCase()}.new@t.local`, password: 'Password@123', role });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe(role);
  });

  it.each(['ADMIN', 'RESCUE_TEAM'])('rejects public self-registration for %s with 403', async (role) => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email: `sneaky-${role}@t.local`, password: 'Password@123', role });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/not allowed/i);
  });

  it('removed /admin/ping returns 404', async () => {
    const res = await request(app).get('/api/admin/ping').set(bearer(adminTok));
    expect(res.status).toBe(404);
  });
});

describe('STEP 0 — admin provisioning', () => {
  it('401 without token, 403 for non-admin', async () => {
    const payload = { name: 'X', email: 'x@t.local', password: 'Password@123', role: 'ADMIN' };
    expect((await request(app).post('/api/admin/users').send(payload)).status).toBe(401);
    expect((await request(app).post('/api/admin/users').set(bearer(citizenTok)).send(payload)).status).toBe(403);
  });

  it('admin creates an ADMIN who can log in', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set(bearer(adminTok))
      .send({ name: 'New Admin', email: 'newadmin@t.local', password: 'Password@123', role: 'ADMIN' });
    expect(res.status).toBe(201);
    const login = await request(app).post('/api/auth/login').send({ email: 'newadmin@t.local', password: 'Password@123' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('ADMIN');
  });

  it('admin creates a RESCUE_TEAM user together with its RescueTeam record', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set(bearer(adminTok))
      .send({
        name: 'Delta Team', email: 'delta@t.local', password: 'Password@123', role: 'RESCUE_TEAM',
        team: { name: 'Delta Unit', teamType: 'MEDICAL', memberCount: 5, capability: 'TRIAGE', currentLocation: 'Depot', latitude: 19.0, longitude: 72.8 },
      });
    expect(res.status).toBe(201);
    const team = await prisma.rescueTeam.findUnique({ where: { name: 'Delta Unit' } });
    expect(team).not.toBeNull();
    expect(team!.userId).toBe(res.body.data.user.id);
  });

  it('RESCUE_TEAM without team profile is rejected with 422', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set(bearer(adminTok))
      .send({ name: 'No Team', email: 'noteam@t.local', password: 'Password@123', role: 'RESCUE_TEAM' });
    expect(res.status).toBe(422);
  });

  it('admin can list users with role filter', async () => {
    const res = await request(app).get('/api/admin/users?role=CITIZEN').set(bearer(adminTok));
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
  });
});

describe('STEP 0 — auth rate limit disabled in test env', () => {
  it('60 rapid logins are never 429', async () => {
    for (let i = 0; i < 60; i++) {
      const res = await request(app).post('/api/auth/login').send({ email: fx.citizen.email, password: 'Password@123' });
      expect(res.status).not.toBe(429);
      expect(res.status).toBe(200);
    }
  });
});
