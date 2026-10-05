# Testing Strategy — DRRCP Release 1.0

Three layers, three commands. Everything below is green on a clean checkout.

| Layer | Command | Scope | Result |
|-------|---------|-------|--------|
| Backend unit + API | `npm run test --workspace=backend` (Vitest + Supertest, isolated `test.db`) | 43 tests, 5 files | ✅ 43/43 |
| E2E UI | `npm run test:e2e` (Playwright + Chromium, boots both dev servers, reseeds) | 30 checks, 7 files | ✅ 30/30 |
| Accessibility | part of E2E (`a11y.spec.ts`, axe wcag2a+wcag2aa) | 7 pages | ✅ 0 violations |

## 1. Backend suite (`backend/tests/`, 43 tests)

Isolated SQLite (`prisma/test.db` via `globalSetup.ts` + `db push`), rate limits
off (`NODE_ENV=test`), fixtures in `helpers.ts` (`cleanDb/seedBase/tokenFor`).

| File | Tests | What it proves (sample cases) |
|------|-------|-------------------------------|
| `requestTransitions` (9) | Full SRS lifecycle SUBMITTED→…→RESOLVED; SUBMITTED exits; skips/backward moves rejected; terminal states exitless; 422 `RequestTransitionError`; single-source key coverage; assignment/volunteer/resource/allocation maps | State machines can't drift |
| `authLockdown` (13) | Public register allows CITIZEN/VOLUNTEER/SHELTER_MANAGER/NGO; ADMIN/RESCUE_TEAM → 403; `/admin/ping` gone (404); admin provisioning incl. RESCUE_TEAM bundle + 422 without team; 401/403 matrix; 60 rapid logins never 429 | FR-01/FR-02, Step-0 hardening |
| `lifecycle` (3) | Submit→verify→assign→ack→on-the-way→in-progress→report→resolved with notification+audit at every step; 409 busy-team; override+reason; cancel rules; duplicate linking; RBAC matrix | FR-03…FR-08, FR-16, FR-18 |
| `metaDisplay` (4) | `/api/meta` public shape; `missionStatus`/`displayStatus` through list+detail; SE-5 phone/coord masking (4 viewer classes); mandatory override reason + audit | Step-0 display + privacy |
| `relief` (14) | Atomic partial→full allocation; over-stock/over-need/PENDING 422 blocks; cancel restores stock; shortage math; capacity block ± override; low-capacity admin alert; nearby ordering; skill-mismatch + high-risk 422; task flow; suggest ranking; cross-module RBAC; public shelters; broadcast + pagination | FR-09…FR-16 |

## 2. E2E suite (`e2e/tests/`, 30 checks, serial `workers: 1`)

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
