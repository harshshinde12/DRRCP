# DRRCP — Disaster Relief & Rescue Coordination Platform

Central coordination layer for disaster response (Software Engineering course
project, Release 1.0). Citizens raise emergency requests, admins verify,
prioritize and dispatch rescue teams with human confirmation, volunteers take
low-risk tasks, shelter managers track capacity, NGOs/admins manage relief
inventory — everyone gets in-app notifications, admins get a live command
center, dashboard and audit log.

Contract & internals: [`AGENTS.md`](./AGENTS.md) · API: [`docs/API.md`](./docs/API.md)
· Architecture: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) ·
Traceability: [`docs/TRACEABILITY.md`](./docs/TRACEABILITY.md) ·
Tests: [`docs/TESTING.md`](./docs/TESTING.md) · Viva script: [`docs/DEMO_SCRIPT.md`](./docs/DEMO_SCRIPT.md)

## Quickstart (Windows one-command)

```bat
start-dev.bat
```

That installs dependencies (if needed), applies migrations, resets the demo
database and starts backend `:4000` + frontend `:5173`. Manual equivalent:

```bash
npm install
cp backend/.env.example backend/.env        # or: Copy-Item backend\.env.example backend\.env
cp frontend/.env.example frontend/.env
npm run prisma:migrate --workspace=backend  # creates backend/prisma/dev.db
npm run seed:demo                            # clean, idempotent demo data
npm run dev
```

- App: http://localhost:5173 · API: http://localhost:4000/api
- API docs (Swagger, works on seeded DB): http://localhost:4000/api/docs
- Health: http://localhost:4000/api/health · Display metadata: `/api/meta`

## Demo logins (password for ALL: `Password@123`)

| Role | Email | Lands on |
|------|-------|----------|
| Admin | admin@drrcp.local | Command center |
| Citizen ×3 | citizen1@drrcp.local, citizen2@drrcp.local, citizen3@drrcp.local | My requests |
| Volunteer ×4 | volunteer1@drrcp.local … volunteer4@drrcp.local | Tasks |
| Rescue team ×3 | team.alpha@drrcp.local, team.bravo@drrcp.local, team.charlie@drrcp.local | Missions |
| Shelter manager | shelter.manager@drrcp.local | My shelters |
| NGO ×2 | ngo1@drrcp.local, ngo2@drrcp.local | Inventory |

Active disaster: **Mumbai Floods 2026** with requests across SUBMITTED,
VERIFIED, ASSIGNED, RESCUE_IN_PROGRESS, RESOLVED and DUPLICATE. Follow
[`docs/DEMO_SCRIPT.md`](./docs/DEMO_SCRIPT.md) for the 5-minute viva walkthrough.

> Public registration allows CITIZEN, VOLUNTEER, SHELTER_MANAGER, NGO.
> ADMIN/RESCUE_TEAM accounts are provisioned by an administrator
> (Users page or `POST /admin/users`) — see Future Enhancements below.

## Scripts

| Command | What |
|---------|------|
| `npm run dev` | backend :4000 + frontend :5173 (concurrently) |
| `npm run build` | typecheck + compile both apps |
| `npm run seed` / `npm run seed:demo` | reset DB to clean demo state (safe to re-run) |
| `npm run test --workspace=backend` | 43 Vitest API tests (isolated test DB) |
| `npm run test:e2e` | 30 Playwright checks (boots servers, reseeds) + screenshots + axe a11y |
| `start-dev.bat` | Windows one-command: install → migrate → seed → dev |

## Screenshots

Captured automatically by `e2e/tests/screenshots.spec.ts` (desktop 1440 +
mobile 390) into [`docs/screenshots/`](./docs/screenshots/) — 15 pages × 2
widths. Regenerate anytime: `npm run test --workspace=e2e -- tests/screenshots.spec.ts`.

## Ops & deployment notes

- Dev DB is a SQLite file (`backend/prisma/dev.db`) — **back it up by copying
  the file**; production swap is one Prisma provider change (no raw SQL used).
- Terminate TLS at a reverse proxy (Caddy/Nginx) for SE-1/CI-1; set a strong
  `JWT_SECRET` (production refuses to boot on the dev default).
- Tune `API|AUTH_RATE_LIMIT_MAX|_WINDOW_MS` in `backend/.env` (RMMM R5).

## Future Enhancements

Deferred from Release 1.0 (SRS §6 scope + report), in suggested order:

1. **Admin approval for non-citizen roles.** Today VOLUNTEER/SHELTER_MANAGER/NGO
   self-register and are immediately active. Add `verificationStatus`
   (PENDING → APPROVED/REJECTED) with an admin review queue + notification on
   decision (extends SRS AS-2; UI: Users page badge + approve action).
2. **Push/SMS gateway.** `notify()`/`notifyRoles()` is already the single send
   path — plug in SMS/email behind it (RMMM R8, SI-2).
3. **Live GPS + ETAs.** Team/user coordinates already exist; stream positions
   over sockets/SSE instead of 10s polling.
4. **Load test PE-1.** k6 scenario for 500 concurrent users; consider Postgres
   + read replicas if SQLite becomes the bottleneck.
5. **First-login tour (UD-2)** and per-screen help links (UI-2) on top of the
   existing Help page.
6. **Offline-first submission queue** for intermittent connectivity (AS-1):
   outbox in IndexedDB with retry.
7. **Standby deployment** for the 99% availability target; automated DB backups.
8. **Firefox/WebKit E2E projects**, Lighthouse CI perf budgets, i18n
   (Hindi/Marathi) for citizen-facing pages.
