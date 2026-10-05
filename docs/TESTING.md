# Testing Strategy — DRRCP Release 1.0

Three layers, three commands. Everything below is green on a clean checkout.

| Layer | Command | Scope | Result |
|-------|---------|-------|--------|
| Backend unit + API | `npm run test --workspace=backend` (Vitest + Supertest, isolated `test.db`) | 58 tests, 7 files | ✅ 58/58 |
| E2E UI | `npm run test:e2e` (Playwright + Chromium, boots both dev servers, reseeds) | 40 checks, 11 files | ✅ 40/40 |
| Accessibility | part of E2E (`a11y.spec.ts`, axe wcag2a+wcag2aa) | 7 pages | ✅ 0 violations |
| Meta literals | `npm run lint:meta --workspace=frontend` (no test runner needed) | 6 display-literal rules + meta-group presence | ✅ clean |

## 1. Backend suite (`backend/tests/`, 58 tests)

Isolated SQLite (`prisma/test.db` via `globalSetup.ts` + `db push`), rate limits
off (`NODE_ENV=test`), fixtures in `helpers.ts` (`cleanDb/seedBase/tokenFor`).

| File | Tests | What it proves (sample cases) |
|------|-------|-------------------------------|
| `requestTransitions` (9) | Full SRS lifecycle SUBMITTED→…→RESOLVED; SUBMITTED exits; skips/backward moves rejected; terminal states exitless; 422 `RequestTransitionError`; single-source key coverage; assignment/volunteer/resource/allocation maps | State machines can't drift |
| `authLockdown` (13) | Public register allows CITIZEN/VOLUNTEER/SHELTER_MANAGER/NGO; ADMIN/RESCUE_TEAM → 403; `/admin/ping` gone (404); admin provisioning incl. RESCUE_TEAM bundle + 422 without team; 401/403 matrix; 60 rapid logins never 429 | FR-01/FR-02, Step-0 hardening |
| `lifecycle` (3) | Submit→verify→assign→ack→on-the-way→in-progress→report→resolved with notification+audit at every step; 409 busy-team; override+reason; cancel rules; duplicate linking; RBAC matrix | FR-03…FR-08, FR-16, FR-18 |
| `metaDisplay` (4) | `/api/meta` public shape (all 18 groups incl. itemCategories/verifyDecisions); `missionStatus`/`displayStatus` through list+detail; SE-5 phone/coord masking (4 viewer classes); mandatory override reason + audit | Step-0 display + privacy |
| `relief` (14) | Atomic partial→full allocation; over-stock/over-need/PENDING 422 blocks; cancel restores stock; shortage math; capacity block ± override; low-capacity admin alert; nearby ordering; skill-mismatch + high-risk 422; task flow; suggest ranking; cross-module RBAC; public shelters; broadcast + pagination | FR-09…FR-16 |
| `batch2` + `batch3` | Privacy masking on assignments, team scoping, 409/422 guards, same-txn transitions, concurrency races | Batch 2–3 hardening |

## 2. E2E suite (`e2e/tests/`, 40 checks, serial `workers: 1`)

`playwright.config.ts` boots backend `:4000` + frontend `:5173`, seeds once
globally; flow-heavy specs reseed in `beforeAll` for determinism. Every test
tracks console/page errors (handled 4xx ignored; any 5xx or JS error fails).

| File | Checks | Flows covered |
|------|--------|---------------|
| `roles` (8) | All 6 roles log in → land on role home with heading; citizen blocked from `/admin`; anon deep-link → `/login` | FR-01/FR-02 per role |
| `full-story` (1) | Flood story: register → 3-step submit (5 people, 1 injured) → verify Critical → assign Charlie → ack → on-the-way → **citizen timeline updates live via polling, no reload** → in-progress → report (5/1) → Resolved → history + notification | FR-03…FR-08, FR-16 E2E |
| `exception-paths` (5) | Busy-team 409 → override modal demands reason → force-assign + “Additional support”; Bravo support-request → admin inbox; duplicate link + original still dispatchable; capacity 422 → admin audited override; over-allocation 422 → valid 50-unit alloc | Team.Assign.Block, support path, duplicates, Shelter.Capacity.Block, Allocation.Block |
| `workflows` (4) | Volunteer accept→start→complete; manager raises rice request; NGO approves water req + allocates 200; broadcast → citizen inbox | FR-10/13/14/15/16 roles E2E |
| `privacy` (2) | Stranger citizen sees nothing + API scopes own; volunteer route-kicked, zero phone leakage; assigned team sees contact, unassigned team sees masked | SE-5 in the UI |
| `batch1` | Prod boot path, relief modals submit, sorted table row-click, allocations contract | Batch 1 fixes |
| `batch2` | Manager-email masking, assignment masking, team scoping, duplicate-team 409, severity submit | Batch 2 fixes |
| `batch4` (5) | Field-level errors, pager paging, role-targeted broadcast isolation, shelter override + reason, team availability 409 | Batch 4 fixes |
| `batch5` (2) | Dashboard + audit update after triage with no reload; blocked-API error states with retry recovery | Batch 5 fixes |
| `screenshots` (8) | 15 pages × desktop 1440 + mobile 390 → `docs/screenshots/` (30 PNGs) | Visual regression baseline |
| `a11y` (2) | axe on landing/login/register/shelters + citizen authed pages; style-settle wait kills FOUC flakes | CO-3, UI-4 |

Known E2E sensitivities (documented, handled): full-suite auth rate limits —
solved by raising limits **only** for the Playwright-booted servers via
`webServer.env` (production `.env` untouched); OSM tile/CDN blips ignored;
`docs/screenshots` regenerate on every screenshots run (deterministic seed).

## 3. Accessibility audit (axe, wcag2a + wcag2aa)

Initial run found real issues — all fixed in app code, not in tests:

| Finding | Fix |
|---------|-----|
| Unassociated `<label>`s (report form etc.) | `Field` now auto-associates single inputs via `useId` (40+ labels fixed at once) |
| `link-in-text-block` (helplines) | `.link` always underlined |
| Dark-mode contrast (`slate-500` text, `brand-500`/`green-600` buttons) | Global dark lift for bare `slate-500`; buttons moved to 600/700 shades |
| Leaflet `role=button` markers unnamed | `keyboard={false}` (equivalent list content everywhere) |
| FOUC flakes in CI | `settled()` waits for computed body bg + fonts before axe runs |

Lighthouse was evaluated and deliberately **not** adopted: it needs a separate
Chrome + manual runs; axe-core in Playwright gives the same wcag2a/aa signal on
every `test:e2e` run. Performance budgets are covered by code-split build output
(see `docs/ARCHITECTURE.md` §4) and PE-2/PE-4 observations in TRACEABILITY.

## 4. Manual / exploratory

- Swagger UI (`/api/docs`) against seeded DB for every endpoint family.
- `api-tests.http` (Thunder Client) full-flow walkthrough.
- Screenshot review pass: 30 PNGs inspected; no layout breaks (mobile tables
  scroll horizontally by design; gauges/cards stack).
- `docs/diagrams/` ledger (D-03): 13 diagram exports + per-file source/method
  table and manual-export list in `docs/diagrams/README.md`.

## 5. Dependency audit (B-02, recorded Oct 2026)

`npm audit`: **7 vulnerabilities (1 moderate, 6 high)** — `esbuild<=0.24.2`
(GHSA-67mh-4wv8-2f99, via `vite`) and `braces` stack-exhaustion
(GHSA-vfj7-8cjw-p6xm, via `tailwindcss`/`chokidar`). Non-breaking
`npm audit fix` changes nothing; breaking majors (`tailwindcss@4`, `vite@8`)
stay deferred to a separate branch. Accepted risk: dev-time-only exposure
(local dev server, build-time glob), no production runtime surface. Re-run
`npm audit` before any deploy; see TRACEABILITY §4 #9.
