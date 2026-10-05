# Requirement Traceability Matrix — DRRCP Release 1.0

Source of truth: `SRS_Disaster_Relief_Rescue_Coordination_Platform_Sejal__Harsh.pdf`
(SRS v1.0, §3–§5, Appendices A/B). FR-01…FR-18 are the team's distilled IDs
(see `AGENTS.md` §6); the SRS's own IDs are shown in the second column so every
row traces back to the exact SRS clause.

Legend for coverage columns: **E** = REST endpoint · **UI** = frontend page ·
**UT** = backend Vitest unit/integration test · **E2E** = Playwright spec.
A ✅ means covered; ⚠️ means partial — see §4 Gaps.

## 1. Functional requirements

| FR | SRS ID(s) | Requirement (short) | Endpoints | UI pages | UT | E2E | Status |
|----|-----------|---------------------|-----------|----------|----|-----|--------|
| FR-01 | §1.2, SE-3 | Register / login / logout / `/me`; bcrypt hashes; JWT | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /admin/users` | Login, Register | `authLockdown` | `roles`, `full-story` (register) | ✅ |
| FR-02 | SE-4 | RBAC → 401/403; citizens see only own data | `authenticate` + `authorize()` on every route; scope filters in services | `RequireAuth`, `RequireRole`, role sidebars | `authLockdown`, `lifecycle`, `relief`, `metaDisplay` | `roles` (redirects) | ✅ |
| FR-03 | Request.Submit.* (Type, Location, People, Injury, Confirm, Store) | Citizen submits request (type+location+people+injury, confirm step) | `POST /api/requests` (Zod-validated, auto-links ACTIVE disaster) | `NewRequest` 3-step wizard | `lifecycle` | `full-story`, `exception-paths` | ✅ |
| FR-04 | Request.Verify, Request.Verify.Duplicate, Request.Priority | Admin verifies VERIFIED/DUPLICATE(link)/REJECTED + priority | `POST /:id/verify`, `PATCH /:id/priority` | RequestQueue triage drawer | `lifecycle` | `full-story`, `exception-paths` (duplicate) | ✅ |
| FR-05 | Request.Status.Track, Request.Status.Notify, Request.History | Citizen tracks own status + history; notified on change | `GET /requests` (own-scope), `GET /:id`, `GET /:id/history`, notify on `transitionRequest` | MyRequests, RequestDetail (StatusTimeline + history) | `lifecycle`, `metaDisplay` | `full-story` (live timeline) | ✅ |
| FR-06 | Team.Register | Admin registers rescue teams | `POST /api/teams`, `POST /admin/users` (RESCUE_TEAM bundle) | Teams (register modal), Users (provision) | `authLockdown` | — (admin UI create covered in roles smoke) | ✅ |
| FR-07 | Team.Availability, Team.Match, Team.Assign.Block, Team.Status.Update | Assign AVAILABLE teams (override logged); team updates mission status | `GET /requests/:id/matching-teams`, `POST /:id/assign` (409/override+reason), `POST /assignments/:id/acknowledge`, `PATCH /assignments/:id/status` | RequestQueue assign + override modal; MissionDetail one-tap updates | `lifecycle` | `full-story`, `exception-paths` (override, support) | ✅ |
| FR-08 | Team.Report | Team files rescue report on completion | `POST /assignments/:id/report` (exactly one; 409 on repeat) | MissionDetail report form | `lifecycle` | `full-story` | ✅ |
| FR-09 | Volunteer.Register | Volunteer registration with skills/availability/service-area | `POST /auth/register` (role=VOLUNTEER + profile fields) | Register (role-specific fields), Profile | `authLockdown` | `full-story` (register), `workflows` (profile) | ✅ |
| FR-10 | Volunteer.Task.Assign, .Restrict (SF-2), .Accept, .Status | Admin assigns skill-matched low-risk tasks; volunteer accept/decline/status | `POST /volunteer-tasks` (skill-match + low-risk 422), `POST /:id/accept\|decline`, `PATCH /:id/status`, `GET /volunteers/suggest` | Volunteers (suggest+assign), Tasks (accept/decline/start/complete) | `relief` | `workflows` | ✅ |
| FR-11 | Shelter.Register, .Occupancy.Update, .Capacity.Block, .Status | Shelter register + occupancy/facilities/status; capacity block + override | `POST /shelters`, `PATCH /shelters/:id` (422 unless `emergencyOverride`), `DELETE /shelters/:id` | ShelterManagerHome (gauge+check-in/out), Shelters (admin modal+override) | `relief` | `exception-paths` (block + override), `workflows` | ✅ |
| FR-12 | Shelter.Search | Citizen shelter search (OPEN + available > 0) | `GET /shelters` (`openOnly`), `GET /shelters/nearby?lat&lng&radiusKm` (public, Haversine) | Shelters (map+list+geolocate) | `relief` | `full-story` (page load) | ✅ |
| FR-13 | Shelter.Resource.Request | Shelter manager raises resource requests | `POST /resource-requests` (own-shelter enforced) | ShelterManagerHome (raise modal), ShelterRequests | `relief` | `workflows` | ✅ |
| FR-14 | Inventory.Register, Inventory.Shortage | NGO/admin registers items + inventory; shortage detection | `POST /relief-items`, `POST /inventory`, `GET /inventory/shortages` | NgoInventory, NgoFieldRequests, Relief (shortages panel) | `relief` | `workflows` | ✅ |
| FR-15 | Allocation.Create, Allocation.Block, Allocation.History | Admin/NGO allocates stock (block over-allocation), full history | `POST /allocations` (atomic txn; 422 over stock/need), `PATCH /:id/status` (cancel restores), `GET /allocations` | NgoAllocations, Relief (allocate modal) | `relief` | `workflows`, `exception-paths` (block) | ✅ |
| FR-16 | Notify.Request, .Assignment, .ShelterCapacity, .Alert; CI-2 | In-app notifications (request/assignment/capacity/public alert) | notify on submit/verify/assign/progress/resolve/support/capacity/allocate; `POST /alerts/broadcast`; inbox endpoints | Bell (10s poll), Notifications, Alerts | `lifecycle` | `full-story`, `workflows` (broadcast) | ✅ |
| FR-17 | Dashboard.Requests, Dashboard.Resources, Dashboard.Charts | Admin dashboard (counts, availability, occupancy, shortages, charts) | `GET /dashboard/summary`, `GET /dashboard/timeseries` | Dashboard (StatCards, Recharts, live Leaflet map) | `lifecycle` | `roles` (heading), screenshots | ✅ |
| FR-18 | SE-6 | Audit log on priority changes, assignments, allocations (+auth events) | `writeAuditLog` in every mutating service; `GET /audit-logs` | Audit viewer; RequestDetail history | `lifecycle`, `metaDisplay` | `full-story` (history) | ✅ |

State machines enforced in exactly one place — `backend/src/utils/enums.ts`
(`REQUEST_TRANSITIONS`, `ASSIGNMENT_TRANSITIONS`, `VOLUNTEER_TASK_TRANSITIONS`,
`RESOURCE_REQUEST_TRANSITIONS`, `ALLOCATION_TRANSITIONS`) — and reused by every
service (unit-tested in `requestTransitions.test.ts`).

## 2. Non-functional requirements

| ID | Requirement | Implementation | Evidence | Status |
|----|-------------|----------------|----------|--------|
| PE-1 | 500 concurrent users, no degradation | Stateless Express + indexed SQLite reads; 10s UI polling instead of sockets | ⚠️ **Gap:** no load test run (see §4) | ⚠️ |
| PE-2 | Pages load < 5s on broadband/4G | Code-split bundles (vendor 275KB, charts 402KB lazy, maps 155KB lazy); skeletons | Build output; screenshots | ✅ |
| PE-3 | Submission confirmed < 3s | Single-transaction submit; measured ~250ms login / few-ms writes in E2E logs | E2E timings | ✅ |
| PE-4 | Dashboard refresh < 5s | Aggregated single-pass summary query + 10s poll | E2E dashboard load | ✅ |
| SF-1 | Human-confirmed dispatch only | No auto-assign code path exists; assign requires ADMIN JWT | `rescueService.assignTeam`; E2E override flow | ✅ |
| SF-2 | Volunteers never get rescue ops | `VOLUNTEER_TASK_TYPES` allowlist; 422 on mismatch/skill gap | `relief.test.ts`; `workflows` | ✅ |
| SE-1 | TLS in transit | Helmet + CORS allowlist; deployment note in README (TLS termination) | `app.ts`; docs | ⚠️ deployment concern, see §4 |
| SE-2 | Auth except public alerts/shelter listings | Public: `/health`, `/meta`, `/docs`, shelter reads, register/login | `roles.spec` (401 redirect) | ✅ |
| SE-3 | Salted hashes, never plaintext | bcrypt cost 12; hash never selected into responses | grep audit; `authLockdown` | ✅ |
| SE-4 | RBAC everywhere | `authenticate`+`authorize` per route; UI guards mirror | All specs | ✅ |
| SE-5 | Victim contact/location privacy | `decorateRequest` masks phone+coords unless ADMIN/owner/assigned-team | `metaDisplay.test.ts`; `privacy.spec.ts` | ✅ |
| SE-6 | Audit log (FR-18) | see above | see above | ✅ |
| OE-1 | Chrome/Firefox/Edge + mobile browsers | Responsive Tailwind; tested Chromium + mobile viewport | 30 screenshots | ✅ (FF/Edge untested — §4) |
| OE-2 | Linux + Node runtime | Node 24 + Express; `npm run` scripts; no OS-specific code except `start-dev.bat` helper | `package.json` | ✅ |
| OE-3 | Public internet access | CORS allowlist is env-configurable (`FRONTEND_URL`) | `.env.example` | ✅ |
| CO-1 | Coding/documentation standard | AGENTS.md contract; uniform envelope/errors; Swagger | This repo | ✅ |
| CO-2 | Relational DB for transactions | SQLite dev (Postgres-ready: no raw SQL); Prisma migrations committed | `prisma/` | ⚠️ engine differs from SRS options — documented |
| CO-3 | HTML5 + WCAG where practical | axe wcag2a+wcag2aa suite green; labels, focus rings, keyboard flows | `a11y.spec.ts` | ✅ |
| CO-4 | Single backend language | TypeScript/Express only | `backend/` | ✅ |
| UD-1 | In-app help section | Help page (role guides + helplines) linked from every sidebar | E2E nav | ✅ |
| UD-2 | First-login guided walkthrough | ⚠️ **Gap:** role guides exist, but no first-login tour overlay | §4 | ⚠️ |
| UI-1 | Consistent visual style | Design tokens + shared `ui.tsx` kit on all 25 pages | Screenshots | ✅ |
| UI-2 | Context help link every screen | ⚠️ **Gap:** global Help page only; no per-screen help links | §4 | ⚠️ |
| UI-3 | Request form ≤ 5 steps | 3-step wizard (type → location → details/confirm) | `full-story` | ✅ |
| UI-4 | Keyboard-only operation | Focus-visible rings; native controls; drawer/modal Esc; axe keyboard checks | `a11y.spec.ts` | ✅ |
| SI-1 | Map/geocoding interface | Leaflet + OSM tiles; `Maps.tsx` wrappers; Haversine in `geo.ts` | Dashboard, Shelters | ✅ |
| SI-2 | Future SMS/email gateway interface | `notify()`/`notifyRoles()` central send path; Release 1.0 in-app only | `utils/notify.ts` | ✅ (by design) |
| SI-3 | Relational data layer | Prisma ORM, no raw SQL | `backend/src` | ✅ |
| CI-1 | HTTPS for client-server | Same as SE-1 | docs | ⚠️ deployment concern |
| CI-2 | Outcome message on Resolved/Rejected/Duplicate | `transitionRequest` always notifies requester | `lifecycle`, `full-story` | ✅ |
| Availability 99% | Best-effort single instance; backups = SQLite file copy | README ops note | ⚠️ single-instance — §4 | ⚠️ |
| Reliability | No silent loss: transactions, envelope errors, toasts, retries | E2E error paths (422 toasts, not silent) | exception-paths | ✅ |
| Usability | First-time citizen succeeds unaided | 3-step wizard + help + demo in E2E | `full-story` | ✅ |
| Maintainability | Separated modules | `routes/services/schemas/utils` split; AGENTS.md | repo layout | ✅ |
| Scalability | Horizontal app-tier scaling | Stateless JWT auth; no server sessions | `auth.ts` | ✅ (arch ready; single deploy) |

## 3. RMMM coverage (R1–R8 → implementation)

| Risk | Mitigation in this build |
|------|--------------------------|
| R1 data loss | Prisma transactions on every multi-write; FK-safe deletes; file-DB backup note in README |
| R2 downtime | Rate limits (R5-tuned), indexed reads, code-split UI, `/health` probe |
| R3 bad request data | Zod on API + RHF mirror on UI, required types/coords option, confirm step, verify triage |
| R4 assignment delay | Availability block + live matching rank, support-request escalation path, queue SLA view (pending count) |
| R5 unauthorized access | JWT + per-route RBAC + SE-5 masking + audit; covered by `authLockdown` + `privacy` suites |
| R6 wrong capacity/stock | Capacity block + override audit; atomic allocation block; shortage report; low-stock alerts |
| R7 schedule delay | WBS/schedule artifacts in repo; phased AGENTS.md checklist (all phases landed) |
| R8 notification failure | Central notify path (never throws — degrades gracefully); in-app only, no external dependency |

## 4. Gaps and accepted deviations

1. **PE-1 load test not run** — no 500-user simulation. SQLite + stateless design should cope with classroom demo loads; flag for staging with k6.
2. **TLS (SE-1/CI-1)** — dev runs HTTP; production must terminate TLS at reverse proxy (documented in README). HSTS comes free with Helmet once deployed.
3. **UD-2 first-login tour** — role guides live on the Help page; no overlay tour. Low cost to add later (e.g. driver.js).
4. **UI-2 per-screen help** — global Help link in every sidebar instead of per-screen links; acceptable interpretation, noted.
5. **Request.Cancel wording** — SRS §3.1.3 says "only while Submitted" but Appendix B allows Submitted *or* Verified → Cancelled; code follows Appendix B + `REQUEST_TRANSITIONS` (documented choice).
6. **CO-2 engine** — SRS names MySQL/PostgreSQL; build uses SQLite file DB with portable ORM code (one-line provider swap). Accepted for academic scope.
7. **Browsers** — E2E runs Chromium; Firefox/WebKit not in CI (Playwright projects ready to add).
8. **Availability 99%** — single instance; no standby. Fine for Release 1.0 demo scope.
