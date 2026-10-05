# DRRCP — Full Project Audit (analysis only, 2026-10-03)

> Method: read code + ran things. `npm install` (clean, 2s), `npm run typecheck`
> (backend + frontend, both clean), `npm run build` (both green, 2.9s),
> `npm test --workspace=backend` (43/43 pass, 7.3s), `npm run seed:demo`
> (clean reseed, credentials printed), `npm run test:e2e` (30/30 pass, ~2.0m),
> live API probes via curl-equivalent against `node --import tsx src/index.ts`
> on :4000 (login all 6 roles, RBAC matrix, privacy, duplicate-name, priority,
> allocations path, public shelters). No source/config/test/DB file was edited;
> `seed:demo` and the e2e harness reseed the dev DB as part of their normal run.
> Nothing was "fixed as you go".
>
> Source truth: `SRS_Disaster_Relief_Rescue_Coordination_Platform_Sejal__Harsh.pdf`
> (SRS v1.0), `Disaster_Relief_Rescue_Coordination_Platform_DETAILED_Experiments_1_to_8_Report.docx`
> (report, FR-01..FR-18 + Tables 0-18), `Class Diagram Updated.png`,
> `UseCaseDiagram.jpg`, RMMM plan, `AGENTS.md`, `docs/*`, code in
> `backend/src` + `frontend/src`.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 11 |
| Medium | 20 |
| Low | 12 |
| **Total** | **45** |

Overall health: **core flows work end-to-end** (register → submit → verify →
assign → mission → report → resolved, plus volunteer/shelter/relief/broadcast;
43 backend + 30 e2e tests green, no console/5xx failures in e2e), but there is
**one prod-deploy blocker** (`npm start` path), **one dead core admin flow**
(relief modals), **two privacy leaks**, and several **transaction-split and
validation inconsistencies** that can leave orphaned assignments or 500s.
Docs over-claim in a few places (page count, "never hardcodes", E2E evidence,
all-✅ status column). Details below; every row was confirmed by reading the
cited code or by running the cited command/probe.

Severity guide: Critical = deploy blocked or core flow completely dead.
High = major feature broken / 500 / privacy leak / data inconsistency.
Medium = degraded, wrong status code, stale data, false doc claim.
Low = polish, dead code, wording, missing index.

## 1. Build and setup

| ID | Severity | Location | Problem | How to reproduce / evidence | Suggested fix | Effort | Status |
|----|----------|----------|---------|-----------------------------|---------------|--------|--------|
| B-01 | Critical | `backend/package.json:9`, `backend/tsconfig.json:11-13`, `backend/dist/` | `npm start` (`node dist/index.js`) can never work: `tsc` uses `rootDir:"."` so output is `dist/src/index.js` (verified `Test-Path backend/dist/src/index.js`=True, `dist/index.js`=False). | `npm run build` then `Test-Path backend/dist/index.js` → False. `node backend/dist/src/index.js` listens (verified). | Set `rootDir:"src"` + `include:["src/**/*"]` (move seed to script) or change `start` to `node dist/src/index.js`. | S | FIXED — rootDir:src, build emits dist/index.js, npm start boots |
| B-02 | High | root `npm audit` | 7 vulnerabilities (1 moderate, 6 high): `braces` stack-exhaustion via `tailwindcss/chokidar`, `esbuild<=0.24.2` dev-server request forgery via `vite`. | `npm install` warns `7 vulnerabilities (1 moderate, 6 high)`; `npm audit` lists GHSA-vfj7-8cjw-p6xm, GHSA-67mh-4wv8-2f99. Fixes need breaking majors (`tailwindcss@4`, `vite@8`). | Schedule major bumps in a branch; at minimum `npm audit fix` non-breaking + document accepted risk. | M | FIXED — non-breaking fix run, 7 vulns recorded in TRACEABILITY §4 |
| B-03 | Medium | `.gitignore:1-23`, `e2e/playwright-report/index.html`, `e2e/test-results/.last-run.json` | Generated artifacts present on disk but not ignored: `.gitignore` has no `playwright-report/`, `test-results/`, `coverage/`. Also repo is **not a git repo** (`git status` → `fatal: not a git repository`), so versioning/deliverable tracking is unverifiable. | `Get-ChildItem e2e` shows report + test-results; `Get-Content .gitignore` lacks them; `git status` fails. | Add `e2e/playwright-report/`, `e2e/test-results/`, `coverage/` to `.gitignore`; `git init` + initial commit (out of scope for audit). | S | FIXED — ignores added, repo init + pre-audit-fixes tag, no .env committed |
| B-04 | Medium | `start-dev.bat:19-28,40-44`, `README.md:28`, `backend/package.json:13` | `start-dev.bat` skips `npm install` when `node_modules` exists (stale deps possible) and runs `prisma:deploy`, while README tells users `npx prisma migrate dev --workspace=backend` (npx workspace forwarding is fragile on Windows; correct is `npm run prisma:migrate --workspace=backend`). | Read files; `start-dev.bat:19` `if not exist node_modules`, `:40` `prisma:deploy` vs README `:28`. | README: replace npx line with `npm run prisma:migrate --workspace=backend`; bat: add `npm outdated`-style staleness note or `--check`. | S | FIXED — README uses npm run prisma:migrate, bat always installs |
| B-05 | Low | `.env.example:1-19`, `backend/.env.example`, `frontend/.env.example`, `backend/.env`, `frontend/.env` | Three overlapping env examples (root + backend + frontend); root file says "copy to backend/.env and frontend/.env" but backend/frontend examples already exist — confusing which is canonical. `backend/.env` on disk holds the weak dev default `JWT_SECRET="change-me…"`. | `Get-Content` all three; `backend/.env` contains dev default (masked check). Prod guard exists (`config/env.ts:23-25`) so risk is promotion of dev file, not code. | Keep only backend+frontend examples; root file becomes pointer. Document "never copy dev `.env` to prod". | S |

## 2. Requirements conformance (SRS / report / UML vs code)

Note: report FR-01..FR-18 numbering **is not** AGENTS.md FR-01..FR-18 (same IDs, different meanings). All cross-doc FR citations are therefore ambiguous.

| ID | Severity | Location | Problem | How to reproduce / evidence | Suggested fix | Effort |
|----|----------|----------|---------|-----------------------------|---------------|--------|
| R-01 | High | report `P58-75` Tables vs `AGENTS.md:144-161` | Same IDs mean different requirements (e.g. report FR-04=store fields, FR-06=assign teams, FR-14=track; AGENTS FR-04=verify, FR-06=register teams, FR-05=track). | Extracted docx Tables 2-3 + `AGENTS.md §6` side-by-side; 18 IDs compared, 14 differ. | Freeze one numbering (AGENTS) and add explicit map table in TRACEABILITY. | S |
| R-02 | Medium | `docs/TRACEABILITY.md:21-23`, SRS §3.1.3/§3.2 | Matrix omits SRS IDs `Request.Assign` (VERIFIED→ASSIGNED), `Request.Resolve`, `Team.History`. Code implements assign (`rescueService.assignTeam`) and team history (`getTeam` includes 20 assignments) but they are untraced. | `TRACEABILITY.md:22` FR-07 lists only Availability/Match/Block/Status.Update; `:23` FR-08 only Team.Report. | Add rows for the three IDs with endpoint+test evidence. | S |
| R-03 | Medium | `backend/src/services/requestService.ts:196-201`, `utils/enums.ts:21-22`, SRS p.8 | `Request.Cancel` deviates: SRS §3.1.3 "only while Submitted"; code allows SUBMITTED **or VERIFIED** (Appendix B). TRACEABILITY §4 discloses the choice, but normative clause still contradicts. | Read `cancelRequest` → `transitionRequest(id,'CANCELLED')` which permits both per `REQUEST_TRANSITIONS`. | Either amend SRS (preferred, matches activity diagram) or restrict code; keep disclosure. | S |
| R-04 | Medium | SRS p.7, `backend/src/docs/openapi.ts:126-180`, `docs/API.md:51-61`, `AGENTS.md:121-122` | `Request.Resolve` admin path missing: SRS allows "authorized Rescue Team **or Administrator**"; only path is `submitReport → RESOLVED` (no `POST /requests/:id/resolve`). AGENTS.md documents "ONLY through rescue-report" as intentional but TRACEABILITY §4 doesn't list it as accepted deviation. | No resolve route in openapi/API; `rescueService.ts:227-244` is the sole writer of RESOLVED. | Add TRACEABILITY §4 entry (accepted) or add admin resolve endpoint with audit. | S |
| R-05 | Medium | SRS App.A p.14, report TABLE 14, `backend/prisma/schema.prisma:31-64`, `Class Diagram Updated.png: Volunteer` | `Volunteer.verificationStatus` required ("volunteer = … + verification status", "USER … status/verification") but schema has only `isActive` (default true); class diagram shows only skills/availability/location. Violates AS-2 onboarding. | `schema.prisma:48` `isActive @default(true)`; no `verificationStatus` anywhere (`grep`). | Add `verificationStatus PENDING→APPROVED/REJECTED` + admin queue (already README Future #1). | M |
| R-06 | Medium | SRS p.6 AS-2, `README.md:85-88`, `schema.prisma:48` | AS-2 violated: Rescue Teams/Shelter Managers/NGOs/Admins must be "verified/onboarded before operational access"; today VOLUNTEER/SHELTER_MANAGER/NGO self-register and are immediately active. README admits it. TRACEABILITY has no AS-1..AS-3/DE-1..DE-2 rows. | Register as NGO → immediate `isActive true`, can create inventory (probed login+create works). | Same fix as R-05; add assumption rows to TRACEABILITY. | M |
| R-07 | Low | `Class Diagram Updated.png`, `schema.prisma:83-95,132-136,225-262,277-290`, report TABLE 5 | Class diagram omits `AuditLog` (implemented everywhere via `writeAuditLog`) and link attributes present in code: `EmergencyRequest.duplicateOfId/disasterId/latitude/longitude/injuryPresent`, `RescueAssignment.assignedById/assignedAt/completedAt`, `ResourceRequest.quantityFulfilled`, `Allocation.inventoryId/allocatedById`. | Visual read of diagram vs `schema.prisma` fields. | Update diagram (add AuditLog, attributes) or note as implementation detail. | S |
| R-08 | Low | `docs/ARCHITECTURE.md:15,73-157`, `frontend/src/App.tsx:88-129` | ARCHITECTURE claims "Pages (25, role-guarded)" and ER "from schema.prisma" but defines 29 distinct paths in 23 `*.tsx` files and details only 6 of 14 models (omits Disaster/RescueTeam/VolunteerTask/ReliefItem/Inventory/Notification/AuditLog blocks). | Counted `App.tsx` routes (29) + `pages/**/*.tsx` (23); ER lists 6 entity blocks. | Correct counts; add missing entity blocks. | S |
| R-09 | Low | `docs/TRACEABILITY.md:21,32`, `e2e/tests/roles.spec.ts:17-25`, `e2e/tests/screenshots.spec.ts:54-71` | Two E2E evidence claims overstated: FR-06 "admin UI create covered in roles smoke" — roles.spec only logs in 6 roles and checks headings, no team creation; FR-17 cites "roles (heading), screenshots" — screenshots take PNGs with no data assertions. | Read spec files; no `POST /teams` UI flow in e2e. | Point FR-06 at `authLockdown.test.ts:66-77` (real coverage) and FR-17 at dashboard API + charts render check. | S |
| R-10 | Medium | SRS §5.1/§4-5, `docs/TRACEABILITY.md:44,50,56,60,74,95`, `README.md:77,95-99`, `e2e/playwright.config.ts:25` | NFRs marked ✅ while evidence says otherwise: PE-1 no load test (no k6 artifact); SE-1/CI-1 dev HTTP (TLS only "at reverse proxy"); CO-2 SQLite vs SRS MySQL/PostgreSQL; UD-2 no first-login tour; UI-2 global Help only (no per-screen links); 99% single instance (backup = file copy); OE-1 Chromium only (FF/Edge untested, config has one project). | `TRACEABILITY §4` itself lists 1-8 as gaps yet status column stays ✅. | Flip those rows to ⚠️ (already partially) and keep as accepted academic scope. | S |

## 3. Backend

| ID | Severity | Location | Problem | How to reproduce / evidence | Suggested fix | Effort | Status |
|----|----------|----------|---------|-----------------------------|---------------|--------|--------|
| BE-01 | High | `backend/src/services/rescueService.ts:119-134` | `assignTeam` splits transaction: assignment + team AVAILABLE→ASSIGNED inside `$transaction`, then `transitionRequest(VERIFIED→ASSIGNED)` **outside**. If transition fails (race to CANCELLED), orphaned ASSIGNED assignment + stuck team. | Read `:120-130`; `firstAssignment` branch calls `transitionRequest` after txn commits. | Move request transition into the same txn (or compensate: cancel assignment on failure). | M | FIXED — assign + team + request in one txn |
| BE-02 | High | `backend/src/services/rescueService.ts:181-196` | `progressAssignment` commits assignment + `TEAM_MIRROR` in txn, then `transitionRequest(ASSIGNED→RESCUE_IN_PROGRESS)` outside. Partial failure leaves mission moved but request stale. | Read `:181-195`; request update after `await prisma.$transaction`. | Same-txn or saga with retry + audit. | M | FIXED — mission + team + request in one txn |
| BE-03 | High | `backend/src/services/rescueService.ts:227-244`, `utils/enums.ts:20-29` | `submitReport` commits report + COMPLETED + AVAILABLE, then `transitionRequest(→RESOLVED)` outside. If request is still ASSIGNED (prior progress failed), ASSIGNED→RESOLVED is invalid → 422 **after** report committed: COMPLETED report exists but request never RESOLVED. | Read `:234-243`; `REQUEST_TRANSITIONS` has no ASSIGNED→RESOLVED edge. | Validate request state before txn; include request update in txn. | M | FIXED — pre-validated + single txn, orphan test |
| BE-04 | High | `backend/src/services/rescueService.ts:155-159,162-166` vs `requestService.ts:40-59` | `listAssignments`/`getAssignment` `include:{team,request:true,report}` return full request row **with exact lat/lng + phone** and no SE-5 masking (`decorateRequest` is request-path only). Any ADMIN/own-team viewer gets coordinates regardless of assignment link. | Read includes; `decorateRequest` never called on assignment payloads. Live probe `GET /assignments` returns nested `request` with coords (truncated output showed team+request objects). | Reuse `decorateRequest` (or select-mask) on nested requests. | S | FIXED — nested requests reuse decorateRequest, unit + HTTP tests |
| BE-05 | Medium | `backend/src/services/requestService.ts:218-230` | `setPriority` bypasses the state machine: direct `update({priority})` with no status check, so priority can change on terminal RESOLVED/REJECTED/DUPLICATE/CANCELLED. | Live probe: `PATCH /requests/<RESOLVED>/priority {LOW}` → **200** (captured). | Route through `transitionRequest` (from→from with priority) or reject on terminal states. | S | FIXED — 422 on RESOLVED/REJECTED/DUPLICATE/CANCELLED |
| BE-06 | Medium | `backend/src/services/rescueService.ts:70-75`, `schemas/rescue.schema.ts:15-24`, `utils/enums.ts:20-27` | `updateTeam` allows arbitrary `availabilityStatus` patch with no transition/ref-count check, defeating `Team.Assign.Block` (`assignTeam:112-113` 409). Admin can set AVAILABLE while active assignments exist. | Read `updateTeam` (no guard) vs `TEAM_MIRROR` comment. | Validate against active assignments or restrict to location/capability fields. | S | FIXED — PATCH strips availability + audited AVAILABLE-only action w/ guard |
| BE-07 | Medium | `backend/src/services/rescueService.ts:33-42`, `middleware/errorHandler.ts:14-17` | Duplicate `RescueTeam.name` (@unique) leaks raw Prisma 500 (no P2002→409 mapping, unlike `reliefService:30-37`). Response contains `Invalid prisma.rescueTeam.create() invocation…`. | Live probe duplicate name → **500** with Prisma invocation text (captured). | Catch P2002 → 409; stop returning `err.message` verbatim. | S | FIXED — global P2002→409/P2025→404/FK→409, generic 5xx |
| BE-08 | Medium | `schemas/request.schema.ts:12`, `services/requestService.ts:123`, `utils/enums.ts:210-212` | `injurySeverity` inconsistent: Zod allows only NONE/MINOR/MODERATE/SEVERE, but service injects `'UNKNOWN'` when `injuryPresent` and severity omitted, and `meta` exposes UNKNOWN. Client cannot send explicit UNKNOWN (400) yet DB stores it. | Probe `POST /requests {injurySeverity:'UNKNOWN'}` → **400** `Invalid enum value… 'UNKNOWN'` (captured). | Add UNKNOWN to Zod (or stop injecting it; default to MINOR/UNSPECIFIED). | S | FIXED — UNKNOWN in Zod + form default, submit test |
| BE-09 | Medium | `schemas/rescue.schema.ts:38`, `schemas/shelter.schema.ts:25`, `schemas/relief.schema.ts:37`, `schemas/notify.schema.ts:8`, `services/rescueService.ts:115` | `z.coerce.boolean()` treats string `"false"` as **true** (`Boolean("false")===true`), forcing override/emergencyOverride/lowStock paths and wrong filters. | Read schemas; `override && !overrideReason` check becomes true on `"false"`. | Use strict `z.boolean()` or custom `"true"/"false"` transform. | S | FIXED — strictBoolean helper in all 5 schemas |
| BE-10 | Medium | `backend/src/docs/openapi.ts:315-322`, `routes/relief.routes.ts:37`, `AGENTS.md §7` | Spec/route mismatch: OpenAPI documents `PATCH /allocations/{id}`, real route is `PATCH /allocations/:id/status`. `PATCH /allocations/:id` → 404. AGENTS.md writes `GET\|PATCH /allocations/:id[/status]` (ambiguous). | Probe `PATCH /allocations/dummy` → **404** (captured); `API.md:109` is correct, OpenAPI+AGENTS are not. | Align all three on `/status`; add regression test. | S | FIXED — OpenAPI + AGENTS.md use /status + contract test |
| BE-11 | Medium | `backend/src/services/dashboardService.ts:6-13,64-72` | `summary()` loads 5 unbounded `findMany` + JS `countBy`/reduce; `timeseries()` loads all rows since `days`. No `groupBy/count`. Fine for demo, OOM/slow at scale (PE-1). | Read function; no `groupBy`. | Use Prisma `groupBy`/`count` + date truncation. | M |
| BE-12 | Medium | `services/rescueService.ts:81`, `services/volunteerService.ts:59`, `services/shelterService.ts:114` | `matchingTeams`/`suggestVolunteers`/`nearbyShelters` load full tables then rank/Haversine-sort in JS. Correct but wasteful; `useMatchingTeams` also never repolls so triage uses stale ranks. | Read `findMany` without `take` + JS `.sort`. | Push coarse filters to DB (status/type/bbox), keep JS rank on top-K. | M |
| BE-13 | Low | `backend/prisma/schema.prisma:109-124,31-64,66-77,225-245` | Missing indexes on hot filters: `RescueTeam.availabilityStatus`, `User.role/isActive`, `Disaster.status`, `ResourceRequest.shelterId`, `EmergencyRequest.emergencyType`, `VolunteerTask.taskType`. Existing indexes cover request status/priority/requester/disaster, assignment request/team/status, etc. | Compared `@@index` list vs `where` clauses in services. | Add the six indexes (Postgres-ready, harmless on SQLite). | S |
| BE-14 | Low | `middleware/errorHandler.ts:7,14-17`, `middleware/auth.ts:17-22`, `app.ts:10-17` | Two hygiene items: (a) `errorHandler` returns `err.message` verbatim → Prisma internals leak (see BE-07); (b) `getToken` reads `cookies.token` but no `cookie-parser` is registered → cookie path is dead code (header-only auth in practice). | Read files; no `cookie-parser` in `package.json`/`app.ts`. | Map known Prisma codes to 409/404; either add cookie-parser or remove cookie branch. | S | FIXED — global Prisma mapping + cookie branch removed |
| BE-15 | Low | `services/requestService.ts:67-86,103-111`, `services/reliefService.ts:194-251,292-308`, `services/volunteerService.ts:125-135` | Read-then-write races without optimistic locking: `transitionRequest`, `progressResourceRequest`, `progressTask` (no txn); `createAllocation`/`updateAllocationStatus` use `$transaction` but no `SELECT FOR UPDATE`, so concurrent allocators can over-allocate on Postgres (SQLite serializes, masking the bug). No test for concurrent paths. | Read patterns; backend tests cover single-threaded atomicity only. | Add version/conditional writes or serializable txn + concurrency test. | M | FIXED — conditional writes + 409 on lost race, race tests |

Audit-log coverage (FR-18) is otherwise good: AUTH_*, ADMIN_USER_CREATE,
DISASTER_*, REQUEST_SUBMIT/VERIFY/CANCEL/PRIORITY, TEAM_REGISTER/UPDATE/ASSIGN(+OVERRIDE),
ASSIGNMENT_ACK/STATUS/CANCEL, SUPPORT_REQUESTED, RESCUE_REPORT, VOLUNTEER_*,
SHELTER_*, RELIEF_ITEM_*/INVENTORY_*/RESOURCE_REQUEST_*/RESOURCE_ALLOCATE/ALLOCATION_STATUS,
ALERT_BROADCAST all call `writeAuditLog`. Gaps are minor: failed logins not
audited, `activate` vs `close` both emit `DISASTER_UPDATE`, allocation-status
log omits `from/quantity`.

## 4. Security and privacy

| ID | Severity | Location | Problem | How to reproduce / evidence | Suggested fix | Effort | Status |
|----|----------|----------|---------|-----------------------------|---------------|--------|--------|
| S-01 | High | `backend/src/services/shelterService.ts:56-69`, `routes/shelter.routes.ts:9-11` | Public `GET /shelters[/:id]` (correct per SE-2) includes `manager:{id,name,email}` — PII exposed without auth. | Probe unauth `GET /shelters` → first row `manager:{name:'Meera Iyer',email:'shelter.manager@drrcp.local'}` (captured). | Select only `id,name` publicly; email behind auth/owner. | S | FIXED — email only for ADMIN/owner, covered by backend test |
| S-02 | High | `backend/src/services/requestService.ts:141`, `routes/request.routes.ts` (list auth CITIZEN/ADMIN/RESCUE_TEAM) | Any `RESCUE_TEAM` can enumerate **all** requests (`scoped={}` for non-CITIZEN); code comment says "any rescue-team member may view" but enforcement is role-wide, not assignment-scoped. Coords are masked, but metadata (type/location text/people) is visible. | Probe `GET /requests` as team.alpha → **200** with other citizens' requests (captured). | Scope team list to assigned + VERIFIED pool, or document as intentional. | M | FIXED — scoped to own assignments (403 otherwise), e2e covered |
| S-03 | Medium | `backend/src/services/reliefService.ts:206-212`, `routes/relief.routes.ts:29-30` | Any NGO can approve/reject **any** shelter's request (no ownership check; logged but broad). By-design? — still violates least-privilege expectation. | Read `approveResourceRequest` (no requester check) + route `authorize('ADMIN','NGO')`. | Restrict NGO approve to linked org or require ADMIN; else document. | S | DOCUMENTED — intentional, see TRACEABILITY §5 |
| S-04 | Medium | `routes/relief.routes.ts:13-14,20,22`, `services/reliefService.ts` | `GET /relief-items[/:id]`, `GET /inventory[/:id]` require only `auth` — any CITIZEN/VOLUNTEER can read stock layouts. Low sensitivity but broad surface. | Read routes (no role check) + probe as citizen (200 expected; pattern matches code). | Restrict reads to NGO/ADMIN/SHELTER_MANAGER or document public-stock decision. | S | DOCUMENTED — intentional, see TRACEABILITY §5 |
| S-05 | Medium | `backend/prisma/seed.ts`, `README.md:37-46`, `POST /auth/login` | Well-known demo credentials (`Password@123` for **all** 13 accounts, printed by seed + README). Safe for classroom, dangerous if demo DB/creds are promoted to a public deploy. | `npm run seed:demo` prints all emails; login as each role verified working. | Force password rotation on first prod seed; separate demo/prod seeds. | S |
| S-06 | Low | `backend/src/app.ts:13,16`, `middleware/rateLimit.ts:20-30`, `config/env.ts:13-25` | Hardening notes (not holes): no `app.set('trust proxy')` (rate-limit keys on proxy IP behind LB); no input sanitization lib (relies on Prisma parameterization; stored XSS in description/location/message left to React escaping); JWT 7d no revocation (logout is client-side discard, verified in `auth.controller:69-74`); dev `JWT_SECRET` default weak but **prod guard exists** (`env.ts:23-25` throws). | Read files; rate-limit OFF in test verified via `globalSetup`. | Add `trust proxy`, consider DOMPurify on rich notes, short-lived access tokens if needed. | M |

RBAC verified correct: citizen POST /teams → 403, citizen dashboard → 403,
volunteer GET /requests → 403, unauth GET /requests → 401, citizen2 fetching
citizen1 request → 403, register ADMIN/RESCUE_TEAM → 403 (backend tests),
`authenticate` uses DB role (not JWT claim) and rejects inactive users.

## 5. Frontend

| ID | Severity | Location | Problem | How to reproduce / evidence | Suggested fix | Effort | Status |
|----|----------|----------|---------|-----------------------------|---------------|--------|--------|
| F-01 | Critical | `frontend/src/pages/admin/Relief.tsx:123,132,146` | All three admin relief modals dead: `<form onSubmit={void itemForm.handleSubmit(submitItem)}>` — `void` discards the handler so `onSubmit` is `undefined`; Save/Allocate never fires. NGO copy (`pages/ngo/Relief.tsx:68,113`) uses `handleSubmit(onSubmit)` correctly. | Read file; pattern repeats 3×. E2E `workflows` NGO alloc passes, but no e2e covers admin Relief modals. | Remove `void` (use `onSubmit={itemForm.handleSubmit(submitItem)}`). | S | FIXED — void removed from 3 modals + admin round-trip e2e |
| F-02 | High | `frontend/src/pages/citizen/NewRequest.tsx:16,36,61,112`, `backend/src/schemas/request.schema.ts:12` | Injury-severity path 400s: form default `'NONE'` but options filter out NONE, so untouched severity stays `'NONE'` (contradicts checked "injured"); empty case sends `'UNKNOWN'` (`data.injurySeverity \|\| 'UNKNOWN'`) which backend rejects (see BE-08). | Read both; probe confirms 400 on explicit UNKNOWN. E2E full-story selects a severity, masking the bug. | Mirror backend enum (include UNKNOWN or require severity when injured). | S | FIXED — default UNKNOWN matches options, never 400s |
| F-03 | High | `frontend/src/pages/admin/RequestQueue.tsx:208-216`, `components/ui.tsx:182-188` | Row-click opens wrong request after sorting: `DataTable` sorts into `sorted` internally, but click handler maps DOM row index to unsorted `rows[idx]`. | Read both; sort a column then click any row in UI. | Pass row object (not index) to `onRowClick`, or expose sorted rows. | S | FIXED — DataTable onRowClick(row) + sorted-click e2e |
| F-04 | Medium | `pages/admin/Relief.tsx:101,109,113,119`, `pages/ngo/Relief.tsx:66,111,150`, `pages/shelter/Shelters.tsx:151`, `pages/admin/Manage.tsx:198` | Pagination controls dead: `page={1} onPage={() => undefined}` while passing real `meta` (controls render when `totalPages>1` but do nothing). | Read files; load >1 page of data and click pager. | Wire `useState` page → query params (pattern exists in Notifications). | S | FIXED — page state → query params on Admin Relief (4 tables), NGO Inventory/Allocations/Field, ShelterRequests, Disasters; batch4 pager e2e |
| F-05 | Medium | `pages/Landing.tsx:20,59-66`, `pages/citizen/RequestDetail.tsx:72-82`, `pages/admin/Volunteers.tsx:95-103`, `pages/admin/Shelters.tsx:76-86`, `pages/admin/Relief.tsx:45-49,92-120`, `pages/ngo/Relief.tsx:65,110,136-151`, `pages/shelter/Shelters.tsx:143-152`, `pages/admin/Manage.tsx:198,233-234`, `pages/admin/Dashboard.tsx:118-133`, `pages/citizen/Shelters.tsx:55` | Missing loading/error states: Landing shows `0 shelters/beds` on error and swallows alerts errors (`.catch(()=>[])`); RequestDetail history renders empty `<ol>` on error and never renders `metadata` (duplicate-link/override context lost); Volunteers/Shelters/Relief/NGO/Manage lack `isLoading`/`isError` branches; Dashboard queue preview ignores `isError`; Shelters error has no retry. | Read each file; block API (offline) and observe blank/zero states. E2E passes because APIs succeed. | Add `isLoading` skeletons + `ErrorState onRetry` per query (pattern exists in Notifications/MyRequests). | M |
| F-06 | Medium | `pages/admin/Teams.tsx:18-19`, `pages/admin/Manage.tsx:62-67,88-90,143-148`, `pages/admin/RequestQueue.tsx:52-58`, `pages/Register.tsx:16`, `pages/admin/Relief.tsx:11` | Form validation gaps vs backend: Teams lat/lng `z.coerce.number()` turns blank into `0,0` (Atlantic); provision team fields optional → RESCUE_TEAM provision always 400; disaster severity free text vs enum; DUPLICATE verify sends `duplicateOfId\|\|undefined` with no required check; Register role unconstrained client-side; item category free string (UI Select constrains, schema doesn't). | Read schemas vs backend `admin.schema:20-28`, `disaster.schema:8`, `relief.schema:6`. | Mirror backend enums/required in RHF schemas; omit empty coords. | S | FIXED — blank coords preprocessed to undefined, provision superRefine requires team profile, severity + category + register-role enums, DUPLICATE inline required; batch4 field-error e2e |
| F-07 | Medium | `lib/meta.tsx:23`, `pages/admin/RequestQueue.tsx:102,120,132,162`, `pages/team/*`, `pages/admin/Dashboard.tsx:17,40,96,127`, `components/StatusBits.tsx:7-8,37`, `pages/volunteer/Tasks.tsx:48-53`, `pages/citizen/*`, `pages/volunteer/Profile.tsx:19`, `pages/citizen/NewRequest.tsx:24`, `pages/admin/Relief.tsx:125` | Hardcoded domain values despite ARCHITECTURE "never hardcodes": raw `emergencyType` renders, hardcoded filter chips (volunteer omits DECLINED/CANCELLED → unfilterable), terminal lists, NEXT map, `PRIORITY_DOT` hexes bypassing meta colors, hardcoded AVAILABILITY/TYPE_ICONS/categories/occupancy thresholds. | `grep` shows 20+ literals; `useMeta().options()/label()` exists but unused at those sites. | Replace with `options()/label()/badgeClass()`; add lint rule or meta test. | M |
| F-08 | Medium | `lib/queries.ts:9,44,55,63-68,75,92,135-175`, `pages/*` invalidations | Stale data: mutations invalidate narrowly (`useSubmitRequest` only `['requests']`, `useRequestAction` misses dashboard/audit, `useAssignTeam` misses matching-teams/dashboard/audit, shelter/profile/manage/ngo miss dashboard/users/teams/shortages); `useMatchingTeams` never repolls (stale rank in open drawer); `useReliefItems/Timeseries/AuditLogs/Disasters/Users` never poll (audit view never auto-refreshes despite "● LIVE"); Landing "live stats" mount-only; MissionDetail disables request polling while assignment polls. | Read `queries.ts` invalidate lists + `refetchInterval` per hook. | Invalidate dashboard/audit/matching on mutations; poll audit/disasters slowly or remove "LIVE" label. | M |
| F-09 | Low | `components/ui.tsx:193,248`, `components/Maps.tsx:33,54,90`, `pages/shelter/Shelters.tsx:110` | Layout nits: `DataTable min-w-[640px]` forces phone horizontal scroll (no card fallback); toast `w-80` overflows 320px; map heights fixed 420/380/300 dominate small screens; shelter cards lack `truncate`. | Read files; e2e screenshots (30 PNGs) show scroll-by-design per TESTING.md. | Responsive heights, `max-w-[calc(100vw-2rem)]` toasts, stacked mobile table. | M |
| F-10 | Low | `components/Maps.tsx:37,59-60,69-103`, `components/ui.tsx:144-164`, `pages/admin/RequestQueue.tsx:79-80` | Accessibility gaps (axe suite still green): markers `keyboard={false}` (unreachable), LocationPicker mouse-only (no lat/lng text fallback), Modal no focus trap/initial-focus/return, triage drawer backdrop `aria-hidden` with no `role=dialog`/Esc (unlike Modal), emoji-only buttons without labels in 3 pages. | Read files; `a11y.spec` covers 7 pages with settle-wait but not map keyboard paths. | Keyboard-accessible list equivalents already exist — document; add focus trap + Esc to drawer. | M |
| F-11 | Low | `pages/Landing.tsx:8-13`, `components/Layout.tsx:147,172`, `pages/Help.tsx:29`, `pages/Notifications.tsx:41,66`, `pages/citizen/MyRequests.tsx:66,71`, `pages/citizen/RequestDetail.tsx:47`, `components/StatusBits.tsx:56`, `pages/admin/RequestQueue.tsx:122`, `pages/admin/Dashboard.tsx:122`, `pages/admin/RequestQueue.tsx:217`, `pages/Notifications.tsx:53` | Wording/style drift: helpline sets differ across Landing/AppShell-footer/public-footer/Help (112/1078/102/101 subsets); "Mark all read" vs "Mark read"; "Cancel" vs "Cancel request"; empty states ("all caught up" vs "Queue is clear 🎉" vs "Queue clear…"); support wording (`＋` fullwidth vs `·` vs plain). | Read cited lines. | Centralize helplines + empty-state strings. | S |

## 6. Frontend–backend integration

| ID | Severity | Location | Problem | How to reproduce / evidence | Suggested fix | Effort |
|----|----------|----------|---------|-----------------------------|---------------|--------|
| I-01 | High | `frontend/src/lib/api-client.ts:62-73`, `lib/queries.ts:156`, `pages/volunteer/Profile.tsx:33` | `apiGet/apiSend` single-key collapse is load-bearing: `useRequest/useAssignment/useShelter/Profile` and `useUnreadCount` (backend returns `{unread}`/`{volunteer}` wrappers) only work by accident; any second key breaks typing silently. | Read unwrapper (`Object.values(d)[0]`); works today, fragile contract. | Return explicit shapes per endpoint (no generic collapse). | M | FIXED — apiGet/apiSend return data verbatim; apiGetOne/apiSendOne with explicit keys at every call site (+useTeam/useMarkTeamAvailable); 58 backend + 38 e2e green |
| I-02 | Medium | `backend/src/schemas/notify.schema.ts:12-16`, `frontend/src/pages/admin/Manage.tsx:25` | Role-targeted broadcast impossible from UI: backend accepts `roles?`, UI sends only `{message,type}`. | Read both; broadcast to single role requires curl. | Add roles multi-select to Alerts page. | S | FIXED — role chip multi-select (none = everyone), batch4 role-targeted e2e (citizen receives, volunteer does not) |
| I-03 | Medium | `frontend/src/lib/queries.ts:100-102,123-125`, `routes/*.routes.ts`, `pages/*` | Endpoints with no UI caller (verified by search): `PATCH /teams/:id`, `GET /teams/:id`, `POST /assignments/:id/cancel`, `PATCH /allocations/:id/status` (display-only badge), `PATCH /inventory/:id`, `PATCH/DELETE /relief-items/:id`, `GET /disasters/active`, `PATCH /disasters/:id`, `POST /resource-requests/:id/cancel`, `POST /shelters`, `DELETE /shelters/:id`, `GET /volunteer-tasks/:id`, `GET /shelters/:id` (`useVolunteerTask`/`useShelter` exported but never imported). | `grep` UI imports; hooks defined but unused. | Either wire UI (allocation progress, shelter create/delete, task detail) or mark as API-only in docs. | M |
| I-04 | Medium | `frontend/src/pages/shelter/Shelters.tsx:95,125` | Shelter over-capacity path dead: UI sends only `{currentOccupancy}` with no `emergencyOverride` and tells user to "contact admin" — admin override exists (`PATCH /shelters/:id` + audit) but manager can't request it in-flow. | Read form + hint text; `updateShelter` requires explicit flag. | Add override checkbox + reason (mirrors team-override modal). | S | FIXED — in-flow override checkbox + mandatory reason (manager + admin forms); backend requires/audits overrideReason (SHELTER_OVERRIDE, relief.test updated); batch4 override e2e |
| I-05 | Medium | `frontend/src/pages/shelter/Shelters.tsx:43,88-89` | Shelter list breaks past 50: `mine = items.filter(managerId===user.id)` client-side after `limit:50` fetch (no server `managerId` filter); `RaiseRequestForm` defaults `shelterId` to `shelters[0]?.id` — zero shelters → empty Select but schema requires `min(1)` (dead submit). | Read code; create 51 shelters to reproduce. | Add `?managerId=` server filter; disable submit with helper text when zero. | S | FIXED — listSheltersQuery + service filter (?managerId=, OpenAPI), manager page uses it, raise form disabled/empty-state at zero shelters |
| I-06 | Low | `frontend/src/components/ui.tsx:265-268` | `formatApiError` returns only `message`, dropping `details/fieldErrors` — backend Zod 400s never surface field-level errors in any form. | Read function; submit invalid form and observe generic toast. | Render `details` fieldErrors under fields. | S | FIXED — formatApiError appends field errors; extractFieldErrors + reportFormError wire server errors onto RHF fields in every form; batch4 field-error e2e |
| I-07 | Low | `frontend/src/pages/Landing.tsx:20`, `frontend/src/lib/api.ts:1-21` | Two dead-code items: Landing bypasses `getPaged` with `as never` (discards `meta`); entire fetch-based `lib/api.ts` client is unused (every page imports `api-client`). | `grep` imports; `lib/api` has zero importers. | Delete `lib/api.ts`; use `getPaged` in Landing. | S | FIXED — lib/api.ts deleted, Landing alerts via getPaged |

## 7. UX and product quality (vs NDMA/SDMA Sachet, FEMA, Ushahidi, Sahana Eden)

| ID | Severity | Location | Problem | How to reproduce / evidence | Suggested fix | Effort |
|----|----------|----------|---------|-----------------------------|---------------|--------|
| U-01 | Medium | citizen `NewRequest`, `app.ts`, README Future #6 | No offline/intermittent-connectivity story (AS-1): submission requires live API; no outbox/retry. Sachet works over cell broadcast/SMS; Ushahidi accepts SMS reports. | Go offline and submit → axios timeout (20s) then generic error; no queued retry. | IndexedDB outbox with retry (already deferred in README). | L |
| U-02 | Medium | `utils/notify.ts`, `pages/admin/Manage.tsx:25` (Alerts), README Future #2 | In-app only notifications; no SMS/push/email gateway, no escalation if unread. Sachet/FEMA use cell broadcast/IPAWS for public alerts. | Read `notify()` (DB row only); broadcast creates inbox rows, nothing leaves the app. | Plug gateway behind `notify()/notifyRoles()` (single send path exists). | M |
| U-03 | Medium | `frontend/src/pages/citizen/*`, `Landing`, README Future (i18n) | Citizen-facing pages English-only; no Hindi/Marathi toggle. Sachet is multilingual by mandate. | Browse citizen flows; no locale switcher. | i18n citizen pages first (already deferred). | M |
| U-04 | Medium | `components/Maps.tsx`, `lib/queries.ts:9` (POLL=10s) | No live GPS/ETA: static lat/lng + 10s polling (keeps firing when tab hidden; `FitToPoints` rebuilds `points.join('|')` every poll → map jitter). Comparators stream positions/ETAs. | Read `FitToPoints` dep + `refetchOnWindowFocus:false` with interval still on. | SSE/socket positions; pause poll when hidden; stabilize map deps. | L |
| U-05 | Low | SRS UD-2/UI-2, `pages/Help.tsx`, sidebars | No first-login tour (UD-2) and no per-screen help links (UI-2) — only global Help page linked from sidebars. Acceptable interpretation, but evaluators may check SRS literally. | Read Help + sidebars; TRACEABILITY already marks ⚠️. | Add driver.js tour + per-screen `?` links (README Future #5). | M |
| U-06 | Low | Missing vs comparators (SRS scope) | Expected disaster features absent (all deferred or unscoped): missing-person registry (only an `emergencyType`), hospital/bed integration, GIS hazard layers, duplicate **suggestions** (manual link only), queue SLA/aging view, role-targeted broadcast UI (see I-02), allocation IN_TRANSIT→DELIVERED progression UI (see I-03). | Compare IA against Sachet/FEMA/Ushahidi/Sahana; confirm no routes/pages by search. | Prioritize duplicate-suggest + SLA + allocation-progress (smallest lifts). | M/L |

Navigation quirks that confused testing (kept here, not double-counted):
CITIZEN sidebar "Nearby shelters → /shelters" drops `AppShell` (public route,
`App.tsx:91` outside `RequireAuth`); Landing CTA "Request Emergency Help"
sends non-CITIZEN authed users to `/notifications` (`Landing.tsx:47`); Leaflet
popup link uses `href` (full reload) instead of SPA `Link` (`Maps.tsx:40`).

> Batch 4 fix (Oct 2026): citizen link → `/nearby-shelters` (in-shell alias;
> public `/shelters` kept for logged-out users); Landing CTA → `homeForRole()`
> for non-citizens; map popup uses SPA `<Link>`. Pre-task: no stale
> `availabilityStatus` PATCH found in the frontend (BE-06 already strips it);
> admin Teams page gained an audited "Mark available" button showing the 409
> while missions are active (+ batch4 e2e). Batch 3 rows (BE-01/02/03/05/06/15)
> were already marked FIXED — verified, no change needed.

## 8. Documentation and deliverables

| ID | Severity | Location | Problem | How to reproduce / evidence | Suggested fix | Effort | Status |
|----|----------|----------|---------|-----------------------------|---------------|--------|--------|
| D-01 | Medium | `docs/ARCHITECTURE.md:59`, `docs/TRACEABILITY.md:21,32,44,50,56,60,64,66,74`, `docs/API.md` vs `backend/src/docs/openapi.ts` | Over-claims: "UI never hardcodes" (false — see F-07); "25 pages" (29 paths); FR-06/FR-17 E2E evidence (see R-09); status column stays ✅ on rows whose own §4 admits gaps (PE-1, SE-1/CI-1, CO-2, UD-2, UI-2, availability, OE-1). | Cross-read cited sections. | Fix numbers, point at real evidence, flip rows to ⚠️. | S |
| D-02 | Medium | `backend/src/docs/openapi.ts:315-322`, `routes/relief.routes.ts:37`, `AGENTS.md §7`, `docs/API.md:109` | Contract mismatch: OpenAPI `PATCH /allocations/{id}` vs real `PATCH /allocations/:id/status` (API.md correct, OpenAPI+AGENTS wrong). Swagger "try it out" on the documented path 404s. | Probe `PATCH /allocations/dummy` → 404 (see BE-10). | Fix OpenAPI + AGENTS.md; add contract test. | S | FIXED — OpenAPI + AGENTS.md use /status + contract test |
| D-03 | Low | `SE/*.mdj`, `SE/*.drawio`, `SE/*.pdf` | Diagram sources need proprietary tools (StarUML `.mdj`, draw.io) and text extraction from Sequence/Collaboration/UseCase/Activity PDFs returns blank/image-only (verified via PDF read) — evaluators without those tools can only rely on the 3 PNGs + report tables. | `read` on the PDFs returned empty/image-only content. | Export all diagrams to PNG/SVG into `docs/diagrams/` and link from report. | S |

`docs/screenshots/` is correct: 30 PNGs on disk (15 pages × desktop 1440 +
mobile 390), matching README + TESTING.md. `DEMO_SCRIPT.md`, `TESTING.md`,
`API.md`, RMMM mapping, and WBS/schedule artifacts were spot-checked and are
consistent with the code (modulo the rows above).

## Prioritized fix plan (each batch ≈ one OpenCode session)

**Batch 1 — Unbreak prod + core admin flow (Critical).**
B-01 start path · F-01 relief modals (`void handleSubmit`) · F-03 wrong-row
click · BE-10/D-02 allocations path + contract test. Verify: `npm run build`
+ `npm start` boots, admin item/stock/allocate round-trip in UI, Swagger path works.

**Batch 2 — Privacy + 500s (High).**
S-01 public manager email · BE-04 assignment masking · S-02 team enumeration
scope (or document) · BE-07 duplicate-team 409 + stop `err.message` leak
(BE-14a) · F-02 NewRequest severity enum. Verify: unauth shelters hide email,
assignment payload masked, dup-name 409 JSON, injured submit succeeds.

**Batch 3 — State-machine integrity (High).**
BE-01/BE-02/BE-03 same-txn transitions · BE-05 priority-on-terminal block ·
BE-06 team-availability guard · BE-15 concurrency (conditional writes + test).
Verify: race scripts (double-verify, double-alloc) leave no orphans; new tests.

**Batch 4 — Validation + integration dead-ends (Medium).**
BE-08 UNKNOWN · BE-09 coerce-boolean · F-06 form mirrors · I-02 roles
broadcast · I-04 shelter override in-flow · I-05 server `managerId` filter +
empty-shelter submit guard · I-06 fieldErrors display · F-04 pagination wiring.
Verify: invalid inputs show field errors, broadcast targets roles, pager works.

**Batch 5 — Stale-data + perf (Medium).**
F-08 invalidations/polling (dashboard/audit/matching-teams/Landing) · BE-11
dashboard `groupBy` · BE-12 top-K rank · BE-13 indexes · F-09 responsive nits.
Verify: post-mutation dashboard/audit update without manual refresh; map stable.

**Batch 6 — Docs + conformance + a11y/UX polish (Low/Medium).**
R-01 FR numbering map · R-02/R-04/R-10 TRACEABILITY rows + ✅→⚠️ ·
R-07/R-08 diagram/page counts · D-03 diagram exports · F-07 de-hardcode
(lint) · F-10 focus-trap/Esc/keyboard · F-11 strings centralization ·
U-05 tour/help links. Verify: docs diff clean, axe still green, no literals.

Deferred (explicitly out of Release 1.0, keep in README Future):
U-01 offline outbox · U-02 SMS/push gateway · U-03 i18n · U-04 live GPS/ETA ·
R-05/R-06 verification queue · k6 PE-1 · TLS deploy · standby 99%.

## Verified as working (no need to re-check)

- Clean-clone `npm install` (2s, 403 pkgs), typechecks (backend+frontend clean),
  `npm run build` green (vite 816 modules, 2.9s; chunks vendor 275KB, charts
  402KB, maps 155KB lazy).
- Backend 43/43 Vitest (lifecycle, 409/422 blocks, RBAC lockdown, SE-5 masking,
  override-reason, atomic allocation, capacity block) and e2e 30/30 Playwright
  (~2m, axe 0 violations, no 5xx/console-error failures).
- `npm run seed:demo` idempotent reseed with printed credentials; demo logins
  for all 6 roles verified; Mumbai Floods 2026 ACTIVE with mixed-status requests.
- RBAC matrix probed live: citizen POST /teams 403, dashboard 403, volunteer
  GET /requests 403, unauth 401, citizen2→citizen1 request 403, register
  ADMIN 403 (tests), per-route `authenticate+authorize`, DB-role (not JWT claim).
- Request FSM (SUBMITTED→…→RESOLVED, DUPLICATE link, cancel rules), assignment
  mission flow (ack→on-the-way→in-progress→support→report, exactly-once 409),
  volunteer skill/low-risk 422, shelter nearby Haversine + capacity block,
  allocation atomicity + shortage math, broadcast → inbox, dashboard/timeseries,
  audit on all FR-18 mutations, `/api/meta` public shape, `/api/docs` Swagger.
- No TODO/FIXME in `backend/src`/`frontend/src` (grep: only `console.log` listen
  line); rate limits env-tunable and OFF in test; prod JWT guard throws.
- `docs/screenshots/` 30 PNGs present; DEMO_SCRIPT + `api-tests.http` walkthrough
  consistent with seeded DB.

## Could not verify, and why

- Firefox/WebKit + real mobile browsers (OE-1): e2e runs Chromium only
  (`playwright.config.ts:25`); no FF/WebKit devices available in this session.
- 500-user load (PE-1), HTTPS/TLS termination (SE-1/CI-1), 99% availability:
  need staging infra + k6 + reverse proxy; repo has no harness (correctly
  disclosed as gaps).
- Sequence/Communication/Activity/DFD/WBS/Schedule diagram semantics beyond
  report Tables 7-10: source `.mdj`/`.drawio` need StarUML/draw.io and the PDFs
  are image-only (text extraction blank), so only class/use-case PNGs + tables
  were verified pixel-by-pixel.
- Real SMS/push delivery (DE-1/SI-2) and live GPS streams: correctly in-app-only
  in Release 1.0; no gateway credentials to test.
- Production `npm start` serving traffic: blocked by B-01 path bug (verified
  statically + via direct `node dist/src/index.js` listen); frontend `vite
  preview` of `dist/` not exercised beyond asset listing (1.1MB total).
