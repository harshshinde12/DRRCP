# AGENTS.md — DRRCP (Disaster Relief & Rescue Coordination Platform)

> Read this file at the start of EVERY phase. It is the shared contract.
> Source of truth for requirements: `D:\College\Third Year 2026-2027\SEM-V\SE`
> (SRS v1.0, class diagram, sequence/activity/DFD/WBS, RMMM). If this file and a
> source document disagree, the source document wins — then update this file.

## 1. Project summary

Central coordination layer for disaster response. Citizens raise emergency
requests; admins verify/prioritize and assign rescue teams + volunteers; shelter
managers track capacity and raise resource requests; NGOs/admins manage relief
inventory and allocations; everyone gets in-app notifications; admins get a
dashboard + audit log. Release 1.0 = web app, in-app notifications only,
human-confirmed dispatch (no autonomous dispatch, SRS SF-1).

## 2. Stack

| Layer    | Choice |
|----------|--------|
| Monorepo | npm workspaces: root + `backend` + `frontend`, `concurrently` for `npm run dev` |
| Frontend | React 18 + Vite 5 + TypeScript + Tailwind CSS v3, `VITE_API_URL` · axios + React Query + React Router + RHF/zod + Recharts + Leaflet |
| Backend  | Node 24 + Express 4 + TypeScript, Prisma 5 + SQLite (`dev.db`), JWT (`jsonwebtoken`), `bcryptjs` (cost 12), Zod 3, `cors`, `helmet`, `morgan`, `express-rate-limit` |
| DB file  | `backend/prisma/dev.db` (`DATABASE_URL="file:./dev.db"`) |

## 3. Folder structure

```
se project/
  package.json            # root: dev/build/seed/seed:demo/test:e2e scripts (workspaces)
  start-dev.bat           # Windows one-command: install → migrate → seed:demo → dev
  .env.example            # all env vars
  AGENTS.md               # this file
  README.md               # setup + demo guide + Future Enhancements
  docs/                   # TRACEABILITY, ARCHITECTURE, API, TESTING, DEMO_SCRIPT + screenshots/
  e2e/                    # Playwright suite (`npm run test:e2e`): roles, full-story, exception-paths,
                          # workflows, privacy, screenshots, a11y (+ axe); boots both servers, reseeds
  backend/
    package.json          # dev (tsx watch), build (tsc), start, seed, prisma:* scripts
    .env / .env.example   # DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, PORT, FRONTEND_URL
    prisma/schema.prisma  # 14 models, String-stored enums (SQLite has no native enums)
    prisma/seed.ts        # idempotent demo seed, prints credentials
    prisma/migrations/    # checked in
    src/
      index.ts            # listen(PORT)
      app.ts              # helmet/cors/json/morgan/rate-limit/routes/error-handler
      config/env.ts       # validated env (rate-limit + shelter knobs; JWT_SECRET required in prod)
      lib/prisma.ts       # PrismaClient singleton
      docs/openapi.ts     # hand-maintained OpenAPI 3.0 spec → /api/docs (Swagger UI) + /api/docs.json
      utils/response.ts   # ok()/created()/fail() envelope
      utils/jwt.ts        # signToken/verifyToken ({ sub, role })
      utils/enums.ts      # CANONICAL value sets + *_TRANSITIONS + canTransition* (single state-machine source)
      utils/audit.ts      # writeAuditLog() — never throws
      utils/notify.ts     # notify()/notifyRoles()/notifyAdmins() — never throws
      utils/geo.ts        # haversineKm(), tokenize()
      utils/pagination.ts # parsePagination()/pageMeta()/parseSort()
      utils/httpErrors.ts # HttpError(status) + asyncHandler() (Express 4 needs the wrapper)
      middleware/auth.ts  # authenticate (JWT→req.user), authorize(...roles) (403)
      middleware/validate.ts # validateBody/validateQuery (Zod → 400 + fieldErrors)
      middleware/rateLimit.ts# env-configured limits, OFF when NODE_ENV=test
      middleware/errorHandler.ts # notFound + errorHandler incl. ZodError→400 (must stay last)
      schemas/            # one Zod file per module (auth/admin/disaster/request/rescue/volunteer/shelter/relief/notify/common)
      services/           # business logic + transactions (requestService.transitionRequest is THE request state machine)
      controllers/        # thin req/res adapters (Zod-parse here; ZodError handled centrally)
      routes/             # per-module routers; PER-ROUTE authenticate (routers share `/`, so no blanket router.use(auth))
      routes/index.ts     # GET /health, /docs, /docs.json; feature routers mount here
  api-tests.http          # Thunder/REST-Client walkthrough of the full flow (seeded DB)
  tests/                  # Vitest + Supertest (isolated prisma/test.db; `npm test` in backend)
    globalSetup.ts        # db push to test.db | helpers.ts (cleanDb/seedBase/tokenFor) | *.test.ts (43 total)
  frontend/
    package.json          # dev (5173), build (tsc + vite build, code-split vendor/maps/charts/forms), preview
    vite.config.ts        # /api → localhost:4000 proxy
    tailwind.config.js / postcss.config.js / src/index.css  # Inter font, brand tokens, darkMode:'class'
    .env / .env.example   # VITE_API_URL
    src/main.tsx          # QueryClient + Router + Meta + Auth + Toast providers
    src/App.tsx           # role-guarded routes (RequireAuth/RequireRole), public landing/login/register/shelters
    src/lib/api-client.ts # axios + JWT/401 interceptors, explicit typed envelopes (apiGetOne/apiSendOne per key; no collapsing)
    src/lib/types.ts      # API types (values mirror backend canonical sets)
    src/lib/meta.tsx      # MetaProvider: GET /api/meta → options()/label()/badgeClass(); PRIORITY_DOT hexes
    src/lib/auth.tsx      # AuthProvider (login/register/logout/me), homeForRole()
    src/lib/queryClient.ts# 10s stale, no retry on 401/403/404
    src/lib/queries.ts    # React Query hooks per resource; 10s poll on live data only (requests/missions/notifications/dashboard), static lists via invalidation
    src/components/ui.tsx # Button/Card/Badge/EnumBadge/inputs(forwardRef!)/Modal/DataTable/Toast/Skeleton/StatCard
    src/components/StatusBits.tsx # StatusTimeline (meta lifecycle + displayStatus/missionStatus), AssignmentChip
    src/components/Maps.tsx       # RequestsMap/SheltersMap/LocationPicker (Leaflet DivIcon dots, OSM tiles)
    src/components/Layout.tsx     # useTheme, RequireAuth/Role, Bell (unread, 10s poll), role sidebars, AppShell
    src/pages/Landing.tsx         # mission, live shelter stats, help CTA, helplines, alerts banner (auth)
    src/pages/Login.tsx Register.tsx  # RHF+zod mirroring backend; role select from meta publicRoles; demo logins
    src/pages/Notifications.tsx Help.tsx
    src/pages/citizen/            # NewRequest.tsx (3-step: type→map+geolocate→details/confirm), MyRequests.tsx, RequestDetail.tsx (timeline+history), Shelters.tsx (nearby map+list)
    src/pages/admin/              # Dashboard.tsx (stats+Recharts+live map+queue preview), RequestQueue.tsx (filters+drawer: verify/priority/matching-teams assign + override-reason modal, repeat = "Additional support"), Teams.tsx, Volunteers.tsx (suggest+assign), Shelters.tsx (occupancy gauge), Relief.tsx (items/stock/approve/allocate), Manage.tsx (Alerts/Users/Disasters/Audit)
    src/pages/team/               # Missions.tsx, MissionDetail.tsx (ack → on-the-way → in-progress → support → report)
    src/pages/volunteer/          # Tasks.tsx (accept/decline/start/complete), Profile.tsx (skills + availability toggle)
    src/pages/shelter/            # Shelters.tsx (gauge + check-in/out + raise request), ShelterRequests in same file
    src/pages/ngo/Relief.tsx      # NgoInventory, NgoAllocations, NgoFieldRequests (approve/reject + shortages)
```

## 4. Roles (SRS §2.2, class diagram)

`CITIZEN` · `VOLUNTEER` · `RESCUE_TEAM` · `SHELTER_MANAGER` · `NGO` · `ADMIN`

- CITIZEN: submit/track/cancel-own requests, search open shelters.
- VOLUNTEER: accept/decline + status-update low-risk tasks only (never professional rescue, SF-2).
- RESCUE_TEAM: view assignments, update mission status, file rescue reports.
- SHELTER_MANAGER: manage own shelter(s), update occupancy, raise resource requests.
- NGO: register inventory, view requirements, co-allocate with admin.
- ADMIN: verify/prioritize requests, assign teams + volunteers, manage inventory/allocations, publish alerts, dashboard + audit log.

## 5. Status lifecycle (SRS Appendix A/B, enforced via `*_TRANSITIONS` in `utils/enums.ts`)

```
EmergencyRequest: SUBMITTED → VERIFIED | DUPLICATE | REJECTED | CANCELLED (citizen, pre-verify)
                  VERIFIED → ASSIGNED → RESCUE_IN_PROGRESS → RESOLVED
```

> Lifecycle note (Oct 2026): a Phase-2 brief proposed request statuses
> ON_THE_WAY/IN_PROGRESS, but the SRS source of truth (App. A/B) has no such
> request states — mission movement lives on RescueAssignment/RescueTeam
> (ASSIGNED→ACKNOWLEDGED→ON_THE_WAY→RESCUE_IN_PROGRESS→COMPLETED) and drives
> the request ASSIGNED→RESCUE_IN_PROGRESS. Source doc wins; no new request
> statuses were added. RESOLVED is reachable ONLY through the rescue-report
> flow (no direct-resolve endpoint).
Priority: CRITICAL | HIGH | MEDIUM | LOW (admin sets on verify)
RescueTeam.availability: AVAILABLE | ASSIGNED | ON_THE_WAY | RESCUE_IN_PROGRESS
  (block new assignment unless AVAILABLE; admin override allowed — SRS Team.Assign.Block)
RescueAssignment: ASSIGNED → ACKNOWLEDGED → ON_THE_WAY → RESCUE_IN_PROGRESS → COMPLETED | CANCELLED
  (COMPLETED ⇒ exactly one RescueReport)
VolunteerTask: ASSIGNED → ACCEPTED | DECLINED → IN_PROGRESS → COMPLETED | CANCELLED
Shelter: OPEN | FULL | TEMPORARILY_CLOSED | CLOSED; available = total − occupancy;
  occupancy > total blocked unless emergencyOverride (SRS Shelter.Capacity.Block)
ResourceRequest: PENDING → APPROVED → PARTIALLY_FULFILLED → FULFILLED | REJECTED | CANCELLED
ResourceAllocation: ALLOCATED → IN_TRANSIT → DELIVERED | CANCELLED (never exceed stock — Allocation.Block)
Notifications: REQUEST_UPDATE | ASSIGNMENT | SHELTER_ALERT | PUBLIC_ALERT | RESOURCE_UPDATE | SYSTEM
```

Key invariants for future code: duplicate requests link via `duplicateOfId` (no independent dispatch);
`quantityFulfilled ≤ quantityRequired`; allocation `quantity ≤ inventory.quantityAvailable`;
audit every priority change, assignment, allocation (SE-6).

## 6. Functional requirements FR-01…FR-18 (distilled from SRS §3 + SE-1…SE-6)

| ID | Requirement | Phase |
|----|-------------|-------|
| FR-01 | Register/login/logout/`/me`, bcrypt-hash (never plaintext), JWT. Public register = CITIZEN/VOLUNTEER/SHELTER_MANAGER/NGO only (ADMIN/RESCUE_TEAM → 403); `POST /admin/users` (ADMIN) provisions the rest, incl. RescueTeam row | ✅ done |
| FR-02 | RBAC: `authenticate` + `authorize()` → 401/403; citizens see only own data | ✅ done |
| FR-03 | Citizen submits emergency request (type+location+people+injury, confirm step) | ✅ 2 done |
| FR-04 | Admin verifies: VERIFIED/DUPLICATE(link)/REJECTED + priority | ✅ 2 done |
| FR-05 | Citizen tracks own request status + history; notify on change | ✅ 2 done |
| FR-06 | Admin registers rescue teams (name/type/count/capability/location) | ✅ 2 done |
| FR-07 | Admin assigns AVAILABLE teams (override logged); team updates mission status | ✅ 2 done |
| FR-08 | Team files rescue report (rescued/injured/notes) on completion | ✅ 2 done |
| FR-09 | Volunteer registration with skills/availability/service-area | ✅ 2 done |
| FR-10 | Admin assigns skill-matched low-risk tasks; volunteer accept/decline/status | ✅ 2 done |
| FR-11 | Shelter register + occupancy/facilities/status management | ✅ 2 done |
| FR-12 | Citizen shelter search (OPEN + available > 0) | ✅ 2 done |
| FR-13 | Shelter manager raises resource requests (item/qty/priority) | ✅ 2 done |
| FR-14 | NGO/admin registers relief items + inventory; shortage detection | ✅ 2 done |
| FR-15 | Admin/NGO allocates stock (block over-allocation), full allocation history | ✅ 2 done |
| FR-16 | In-app notifications (request/assignment/capacity-threshold/public alert) | ✅ 2 done |
| FR-17 | Admin dashboard (counts, availability, occupancy, shortages, charts) | ✅ 2 done |
| FR-18 | Audit log on all priority changes, assignments, allocations (+ auth events) | ✅ 2 done |

## 7. API conventions (do not deviate without updating this file)

- Base: `/api`. Envelope: success → `{ success:true, data }`; error → `{ success:false, error:{ message, details? } }` (helpers in `utils/response.ts`).
- Auth: `Authorization: Bearer <JWT>`. 401 = missing/invalid token or inactive user; 403 = wrong role.
- Validation: Zod via `validateBody/validateQuery` → 400 `{ fieldErrors }`. Never trust client enums — validate against `utils/enums.ts`.
- Rate limits: global 300/15 min; `/auth/*` 50/15 min (RMMM R5). All four knobs
  (`API|AUTH_RATE_LIMIT_MAX|_WINDOW_MS`) are env-configurable; limits are OFF when `NODE_ENV=test`.
- Audit: call `writeAuditLog({ actorId, action, target, targetId, metadata })` on every FR-18 event; helper swallows errors.
- Timestamps: `createdAt/updatedAt` (Prisma `@default(now())/@updatedAt`); display ISO-8601 UTC.
- SQLite note: enums are `String` columns; canonical sets live in `utils/enums.ts`. If you add a status, update BOTH files.
- Errors: throw with `.status`, or `fail()`; `errorHandler` is last middleware.

### Existing endpoints (Phase 1)

```
GET  /api/health          → { status, service, time } (public)
GET  /api/meta            → all enum sets { value,label,color } + publicRoles + lifecycles (public; frontend never hardcodes values)
GET  /api/docs            → Swagger UI (works against seeded DB) | /api/docs.json (raw spec)
POST /api/auth/register   → { user, token } | 403 ADMIN/RESCUE_TEAM | 409 email taken | 400 zod
POST /api/auth/login      → { user, token } | 401 bad credentials
POST /api/auth/logout     → { message } (auth)
GET  /api/auth/me         → { user } (auth)
POST /api/admin/users     → provision any role; RESCUE_TEAM also creates RescueTeam (ADMIN)
GET  /api/admin/users     → list w/ role/search (ADMIN)
```

### Phase-2 endpoints (all paginated lists return `meta: { page, limit, total, totalPages }`)

```
# Disasters (ADMIN writes; reads: auth)
POST   /api/disasters  GET /api/disasters  GET /api/disasters/active  GET|PATCH /api/disasters/:id
POST   /api/disasters/:id/activate (demotes other ACTIVE→MONITORING) | POST .../close (→RESOLVED)
# Requests (CITIZEN submit/own; ADMIN triage; RESCUE_TEAM read)
POST   /api/requests (auto-links ACTIVE disaster)  GET /api/requests (status/priority/type/search/sort)
GET    /api/requests/:id  GET /api/requests/:id/history (audit timeline incl. assignment/report events)
POST   /api/requests/:id/cancel (owner, SUBMITTED/VERIFIED)  POST .../verify (VERIFIED|DUPLICATE+link|REJECTED + priority)
PATCH  /api/requests/:id/priority (ADMIN)
# Request detail/list also return missionStatus (latest assignment) + displayStatus (citizen label, derived only).
# Privacy (SE-5): requester phone + exact lat/lng visible ONLY to ADMIN, owner, assigned team (else null).
# Rescue (ADMIN dispatch; RESCUE_TEAM missions)
POST|GET /api/teams  GET|PATCH /api/teams/:id (no availabilityStatus — location/capability only)
POST   /api/teams/:id/availability {AVAILABLE} (ADMIN, audited; 409 while active assignments)
GET    /api/requests/:id/matching-teams (AVAILABLE ranked by capability+distance)
POST   /api/requests/:id/assign { teamId, override?, overrideReason? } (non-AVAILABLE → 409 unless override + reason, logged)
GET    /api/assignments (teams: own only)  GET /api/assignments/:id
POST   /api/assignments/:id/acknowledge | PATCH .../status | POST .../request-support (alerts admins)
POST   /api/assignments/:id/report (→ COMPLETED + team AVAILABLE + request RESOLVED; repeat → 409)
POST   /api/assignments/:id/cancel (ADMIN)
# Volunteers (ADMIN dispatch; VOLUNTEER own tasks)
GET    /api/volunteers  GET /api/volunteers/suggest?taskType&location (skill+area ranked)
GET|PATCH /api/volunteers/:id (self or ADMIN)
POST|GET /api/volunteer-tasks (skill-match + low-risk enforced → 422)  GET /api/volunteer-tasks/:id
POST   /api/volunteer-tasks/:id/accept|decline  PATCH .../status
# Shelters (list/nearby/:id PUBLIC per SE-2; writes: manager-owner or ADMIN)
POST   /api/shelters  GET /api/shelters (status/facility/search/openOnly/managerId + availableCapacity)
GET    /api/shelters/nearby?lat&lng&radiusKm (OPEN + beds, Haversine-sorted)
GET|PATCH /api/shelters/:id (occupancy ≤ capacity unless emergencyOverride + overrideReason → 422, audited)  DELETE ... (ADMIN)
# Relief (items/inventory: NGO+ADMIN; requests: manager+ADMIN(+NGO read); allocations: ADMIN+NGO)
POST|GET /api/relief-items  GET|PATCH|DELETE /api/relief-items/:id (delete: ADMIN)
POST|GET /api/inventory  GET|PATCH /api/inventory/:id  GET /api/inventory/shortages
POST|GET /api/resource-requests  GET .../:id  POST .../:id/approve|reject|cancel
POST|GET /api/allocations (atomic txn; over-stock/need → 422)  GET /api/allocations/:id  PATCH /api/allocations/:id/status (cancel restores stock)
# Notifications (all roles, own inbox) + dashboard/audit (ADMIN)
GET    /api/notifications (isRead/type)  GET /api/notifications/unread-count
PATCH  /api/notifications/:id/read  PATCH /api/notifications/read-all
POST   /api/alerts/broadcast { message, type?, roles? }
GET    /api/dashboard/summary (byStatus/byPriority/byType, teams, occupancy, stock, avgResponseHours)
GET    /api/dashboard/timeseries?days=  GET /api/audit-logs (action/actor/target filters)
```

## 8. Run commands

```bash
# first time (from repo root)
npm install
cp backend/.env.example backend/.env        # or Copy-Item on Windows
cp frontend/.env.example frontend/.env
npx prisma migrate dev --workspace=backend   # creates dev.db
npm run seed                                 # idempotent demo data

# every day
npm run dev        # root: backend :4000 + frontend :5173 (concurrently)
npm run build      # both apps typecheck+compile
```

Ports: backend `4000`, frontend `5173`. `VITE_API_URL=http://localhost:4000/api`.

## 9. Demo credentials (seed; password for ALL: `Password@123`)

admin@drrcp.local · citizen1/2/3@drrcp.local · volunteer1–4@drrcp.local ·
team.alpha/beta…: team.alpha@drrcp.local, team.bravo@drrcp.local, team.charlie@drrcp.local ·
shelter.manager@drrcp.local · ngo1@drrcp.local, ngo2@drrcp.local.
Active disaster: **Mumbai Floods 2026** (ACTIVE). Requests span SUBMITTED, VERIFIED,
ASSIGNED, RESCUE_IN_PROGRESS, RESOLVED, DUPLICATE.

## 10. Progress checklist

- [x] Phase 1 — monorepo, tooling, one-command dev, `.env.example` files
- [x] Phase 1 — Prisma schema: 14 models + String-stored status sets + timestamps
- [x] Phase 1 — auth: register/login/logout/me, bcrypt, JWT, RBAC (FR-01/FR-02)
- [x] Phase 1 — error handler, Zod middleware, response envelope, CORS, rate limits, audit helper
- [x] Phase 1 — seed (admin/citizens/teams/volunteers/shelters/manager/NGOs/disaster/inventory/mixed-status requests) + printed credentials
- [x] Phase 1 — AGENTS.md + README; verified: seed clean, login all roles, 403/401 correct, both builds green
- [x] Phase 2 — Step 0: register lockdown (403 ADMIN/RESCUE_TEAM), `POST /admin/users`, env-configured rate limits off in test, `/admin/ping` removed, REQUEST_TRANSITIONS reused as the single state machine (+ tests)
- [x] Phase 2 — disasters, emergency requests (submit/verify/duplicate/cancel/priority/history), rescue dispatch + mission flow + reports + support path
- [x] Phase 2 — volunteers (+ skill/area suggest), shelters (+ nearby Haversine, capacity block), relief (atomic allocations, shortages), notifications + broadcast, dashboard + audit viewer
- [x] Phase 2 — Swagger at `/api/docs`, `api-tests.http`, Vitest suite (39 tests: full lifecycle, 409/422 rejections, RBAC); no frontend changes
- [x] Phase 3 — Step 0 backend: `GET /api/meta` (labels+colors+lifecycles), request `missionStatus`/`displayStatus` (derived, no new states), SE-5 privacy masking (phone/coords), mandatory `overrideReason` (+4 tests → 43 total)
- [x] Phase 3 — full UI: design system (Inter, dark mode, badges/tables/modals/toasts/timelines), role sidebars + guards, Leaflet maps, landing/auth/citizen-3-step/admin-command-center/team-missions/volunteer/shelter-gauge/NGO pages, 10s polling bell; verified via headless-Chromium E2E (22/22 checks, 0 console errors) after fixing `void handleSubmit` (dead forms) + non-forwardRef inputs (RHF refs dropped)
- [x] Phase 4 — permanent Playwright suite in `e2e/` (30 checks: roles, full flood story w/ live timeline, 5 exception paths, role workflows, SE-5 privacy, 30 screenshots, axe a11y); perf indexes migration + lazy map/chart chunks; UI polish (favicon, titles, 404, transitions, contrast/keyboard-marker a11y fixes); docs (TRACEABILITY/ARCHITECTURE/API/TESTING/DEMO_SCRIPT, README+Future Enhancements); `seed:demo` + `start-dev.bat`
- [ ] Post-release — k6 load test (PE-1), TLS deploy, first-login tour (UD-2), approval queue for non-citizen roles, push/SMS gateway, live GPS, offline outbox (see README Future Enhancements)

## 11. Rules for later phases

1. Read this file + the SRS/DFD/diagrams before coding; keep FR IDs stable.
2. New routes mount in `routes/index.ts`; guard with `authenticate` + `authorize(...)`; Zod-validate; `writeAuditLog` on FR-18 events.
3. Keep the response envelope; add Zod schemas under `schemas/`; keep `utils/enums.ts` ↔ schema comments in sync.
4. SQLite dev / Postgres-ready code (no raw SQL). Migrations committed.
5. Update the checklist above when a phase lands; never leave the repo unseedable or `npm run dev` broken.
