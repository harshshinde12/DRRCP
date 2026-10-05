# API Reference — DRRCP Release 1.0

Base URL (dev): `http://localhost:4000/api`. Interactive explorer:
`http://localhost:4000/api/docs` (Swagger UI, works against the seeded DB).
This page is the human-readable companion; the OpenAPI JSON is the contract
(`backend/src/docs/openapi.ts` → `/api/docs.json`).

## Conventions

- **Envelope.** Success: `{ "success": true, "data": …, "meta"?: { page, limit, total, totalPages } }`.
  Error: `{ "success": false, "error": { "message", "details"? } }`.
- **Auth.** `Authorization: Bearer <JWT>` (from `POST /auth/login`). 401 =
  missing/invalid/inactive; 403 = wrong role.
- **Validation.** Zod on every body/query → `400 { fieldErrors }`. State-machine
  violations → `422`. Busy-team assignment without override → `409`.
- **Pagination.** `?page=&limit=` (max 100) on all list endpoints; filters/sort
  per endpoint below.
- **Rate limits.** 300/15min global, 50/15min on `/auth/*` (env-tunable, off when
  `NODE_ENV=test`).

## System

| Method & path | Auth | Notes |
|---------------|------|-------|
| `GET /health` | public | `{ status, service, time }` |
| `GET /meta` | public | All enum sets `{value,label,color}` + `publicRoles` + lifecycles. The UI consumes this and never hardcodes domain values. |
| `GET /docs`, `GET /docs.json` | public | Swagger UI / raw spec |

## Auth & users

| Method & path | Roles | Notes |
|---------------|-------|-------|
| `POST /auth/register` | public | CITIZEN/VOLUNTEER/SHELTER_MANAGER/NGO only (ADMIN/RESCUE_TEAM → 403); 409 email taken; password min 8 |
| `POST /auth/login` | public (rate-limited) | `{ user, token }`; 401 bad credentials |
| `POST /auth/logout` | any | audited; client discards token |
| `GET /auth/me` | any | current user (no hash, ever) |
| `POST /admin/users` | ADMIN | any role; RESCUE_TEAM requires `team{…}` → creates user + team atomically |
| `GET /admin/users?role=&search=` | ADMIN | paginated |

## Disasters

| Method & path | Roles | Notes |
|---------------|-------|-------|
| `POST /disasters` | ADMIN | `{name,type,affectedArea,severity,startDate,status?}` |
| `GET /disasters?status=` | auth | paginated |
| `GET /disasters/active` | auth | 404 when none active |
| `GET /disasters/:id` · `PATCH /disasters/:id` | auth / ADMIN | — |
| `POST /disasters/:id/activate` | ADMIN | demotes other ACTIVE → MONITORING |
| `POST /disasters/:id/close` | ADMIN | → RESOLVED |

## Emergency requests

| Method & path | Roles | Notes |
|---------------|-------|-------|
| `POST /requests` | CITIZEN | `{emergencyType,description,location,latitude?,longitude?,peopleAffected,injuryPresent?,injurySeverity?}`; auto-links ACTIVE disaster; → SUBMITTED + receipt notification |
| `GET /requests?status=&priority=&emergencyType=&disasterId=&search=&sort=&order=` | CITIZEN (own) / ADMIN / RESCUE_TEAM | includes `missionStatus` + `displayStatus`; SE-5 masking applied |
| `GET /requests/:id` | owner / ADMIN / RESCUE_TEAM | full detail + assignments + report; SE-5 masking |
| `GET /requests/:id/history` | same | audit timeline incl. assignment/report events |
| `POST /requests/:id/cancel` | CITIZEN owner | SUBMITTED/VERIFIED → CANCELLED |
| `POST /requests/:id/verify` | ADMIN | `{decision: VERIFIED\|DUPLICATE\|REJECTED, priority?, duplicateOfId?}` (required for DUPLICATE) |
| `PATCH /requests/:id/priority` | ADMIN | `{priority}`; audited + notified |

## Rescue

| Method & path | Roles | Notes |
|---------------|-------|-------|
| `POST /teams` · `GET /teams?availabilityStatus=&teamType=&capability=&search=` | ADMIN / ADMIN+RESCUE_TEAM | register / list |
| `GET /teams/:id` · `PATCH /teams/:id` | ADMIN+RESCUE_TEAM / ADMIN | history included; availability/location updates |
| `GET /requests/:id/matching-teams` | ADMIN | AVAILABLE only, ranked capability → distance |
| `POST /requests/:id/assign` | ADMIN | `{teamId, override?, overrideReason?}`; busy team → 409 unless `override:true` **+ reason** (logged); repeat dispatch = “Additional support” |
| `GET /assignments?...` · `GET /assignments/:id` | ADMIN / own team | — |
| `POST /assignments/:id/acknowledge` | RESCUE_TEAM (own) | ASSIGNED → ACKNOWLEDGED |
| `PATCH /assignments/:id/status` | RESCUE_TEAM (own) | forward-only mission steps; RESCUE_IN_PROGRESS flips request ASSIGNED → RESCUE_IN_PROGRESS |
| `POST /assignments/:id/request-support` | RESCUE_TEAM (own) | `{notes}` → alerts all admins, mission stays open |
| `POST /assignments/:id/report` | RESCUE_TEAM (own) | `{peopleRescued,injuredPeople,notes?}`; exactly once (409 repeat); → COMPLETED + team AVAILABLE + request RESOLVED |
| `POST /assignments/:id/cancel` | ADMIN | frees the team |

## Volunteers

| Method & path | Roles | Notes |
|---------------|-------|-------|
| `GET /volunteers?...` · `GET /volunteers/suggest?taskType&location` | ADMIN | skill + area ranked suggestions |
| `GET /volunteers/:id` · `PATCH /volunteers/:id` | ADMIN or self | skills/availability/area/phone only |
| `POST /volunteer-tasks` | ADMIN | skill-match + low-risk allowlist enforced (422) |
| `GET /volunteer-tasks` · `GET /volunteer-tasks/:id` | ADMIN / own | — |
| `POST /volunteer-tasks/:id/accept` · `/decline` | VOLUNTEER (own) | — |
| `PATCH /volunteer-tasks/:id/status` | VOLUNTEER (own, forward) / ADMIN | — |

## Shelters (listings public per SE-2)

| Method & path | Roles | Notes |
|---------------|-------|-------|
| `GET /shelters?...&openOnly` · `GET /shelters/nearby?lat&lng&radiusKm` · `GET /shelters/:id` | public | `availableCapacity` computed; nearby = OPEN + beds, Haversine-sorted |
| `POST /shelters` | SHELTER_MANAGER (own) / ADMIN | — |
| `PATCH /shelters/:id` | owner-manager / ADMIN | occupancy ≤ capacity unless `emergencyOverride` (422 + audited) |
| `DELETE /shelters/:id` | ADMIN | — |

## Relief

| Method & path | Roles | Notes |
|---------------|-------|-------|
| `POST /relief-items` · `GET /relief-items` · `GET/PATCH/DELETE /relief-items/:id` | NGO+ADMIN (delete: ADMIN) | unique(name, category); delete blocked with stock |
| `POST /inventory` · `GET /inventory` · `GET /inventory/:id` · `PATCH /inventory/:id` | NGO+ADMIN (adjust: owner-NGO/ADMIN) | `lowStock` filter |
| `GET /inventory/shortages` | ADMIN, NGO | demand-vs-stock per item |
| `POST /resource-requests` · `GET /resource-requests` · `GET /resource-requests/:id` | SHELTER_MANAGER (own) + ADMIN (+NGO read) | — |
| `POST /resource-requests/:id/approve\|reject` | ADMIN, NGO | PENDING → APPROVED/REJECTED |
| `POST /resource-requests/:id/cancel` | requester / ADMIN | — |
| `POST /allocations` | ADMIN, NGO | **atomic**: 422 over stock/need; APPROVED → PARTIALLY_FULFILLED → FULFILLED |
| `GET /allocations` · `GET /allocations/:id` · `PATCH /allocations/:id/status` | ADMIN, NGO | cancel restores stock + reopens request |

## Notifications, dashboard, audit

| Method & path | Roles | Notes |
|---------------|-------|-------|
| `GET /notifications?isRead=&type=` · `GET /notifications/unread-count` | own inbox | `meta.unread` included |
| `PATCH /notifications/:id/read` · `PATCH /notifications/read-all` | own | — |
| `POST /alerts/broadcast` | ADMIN | `{message,type?,roles?}` → fan-out + audit |
| `GET /dashboard/summary` | ADMIN | requests/teams/shelters/stock/performance |
| `GET /dashboard/timeseries?days=` | ADMIN | per-day submitted vs resolved |
| `GET /audit-logs?action=&actorId=&target=` | ADMIN | every FR-18 event queryable |
