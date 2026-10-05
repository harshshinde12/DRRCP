# Architecture — DRRCP Release 1.0

## 1. At a glance

Monorepo (`npm workspaces`): `backend/` (Node 24 + Express 4 + TypeScript +
Prisma 5 + SQLite) and `frontend/` (React 18 + Vite 5 + Tailwind v3). One command
runs both (`npm run dev` → backend `:4000`, frontend `:5173`). See `AGENTS.md`
for the shared contract and `docs/API.md` for the contract surface.

## 2. Three-layer diagram

```mermaid
flowchart TB
    subgraph Client["Frontend · React SPA (:5173)"]
        Pages["Pages (30 distinct paths / 23 files, role-guarded)<br/>Landing · Request wizard · Queue · Missions · …"]
        Comp["Components<br/>ui kit · StatusTimeline · Leaflet maps · Layout/Bell"]
        Hooks["Data layer<br/>axios client · React Query (10s poll on live data only) · Meta/Auth providers"]
    end

    subgraph Server["Backend · Express API (:4000)"]
        Routes["Routes<br/>per-route authenticate + authorize<br/>Zod validateBody/validateQuery"]
        Controllers["Controllers<br/>thin req/res adapters"]
        Services["Services<br/>transactions + state machines<br/>transitionRequest is THE request FSM"]
        Cross["Cross-cutting<br/>audit (never throws) · notify · geo · pagination · HttpError"]
    end

    subgraph Data["Data · Prisma + SQLite"]
        DB[("dev.db<br/>14 models<br/>String-stored enums")]
        Mig["migrations/ (committed)"]
    end

    Pages --> Comp --> Hooks
    Hooks -- "HTTPS/JSON {success,data,meta} / {success:false,error}" --> Routes
    Routes --> Controllers --> Services
    Services --> Cross
    Services -- "Prisma Client (no raw SQL)" --> DB
    Mig -. version .-> DB
```

Request flow through the layers (example: citizen submits):

```mermaid
sequenceDiagram
    participant C as Citizen UI<br/>(NewRequest wizard)
    participant Q as React Query<br/>+ axios client
    participant R as Routes<br/>(auth → RBAC → Zod)
    participant S as requestService<br/>submitRequest
    participant D as SQLite (Prisma)
    S->>D: findFirst ACTIVE disaster
    S->>D: create EmergencyRequest (SUBMITTED)
    S->>D: create AuditLog (REQUEST_SUBMIT)
    S->>D: create Notification (receipt)
```

Key architectural decisions:

- **Single state-machine source.** All status sets and allowed transitions live in
  `backend/src/utils/enums.ts` (`REQUEST_TRANSITIONS` etc.). Display values
  (labels, badge colors, option lists, map-dot hexes, type icons) render from
  `GET /api/meta` — never from literals in pages (enforced by
  `frontend/scripts/check-meta-usage.mjs`, `npm run lint:meta`). Control-flow
  comparisons (`status === 'X'` gates, role arrays, zod mirrors, transition
  maps) stay literal by necessity: they drive types and branching, and meta
  cannot narrow them.
- **No silent failures.** Helpers that must not break flows (`writeAuditLog`,
  `notify`) swallow and log errors. API errors use the `{success:false,error}`
  envelope; the UI surfaces them via toasts/inline alerts and React Query retries
  (except 401/403/404).
- **Derived, not stored, presentation state.** `missionStatus`/`displayStatus`
  are computed per viewer in `decorateRequest`, which also enforces SE-5 privacy
  masking (phone + exact coords only for ADMIN / owner / assigned team).
- **Stateless auth.** JWT (`sub`, `role`), bcrypt-12 hashes, per-route
  `authenticate` + `authorize(...)`. No server sessions → horizontally scalable.
- **Polling over sockets.** 10s React Query refetch on live-watched data only
  (request status, missions, notifications, dashboard; 30s for the trend
  chart); static boards refresh via mutation invalidations, never on a timer.
  Interval ticks pause while the tab is hidden
  (`refetchIntervalInBackground: false`). The notify path is already
  centralized for a future push/SMS gateway (SI-2).

## 3. Entity–relationship diagram (from `prisma/schema.prisma`)

```mermaid
erDiagram
    User ||--o{ EmergencyRequest : "submits (Requester)" 
    User ||--o{ VolunteerTask : "receives"
    User ||--o{ RescueAssignment : "creates (AssignedBy)"
    User ||--o{ ResourceRequest : "raises (Requester)"
    User ||--o{ ResourceAllocation : "authorizes (AllocatedBy)"
    User ||--o{ Notification : "receives (Recipient)"
    User ||--o{ AuditLog : "performs (Actor)"
    User ||--o{ Shelter : "manages (ShelterManager)"
    User ||--o{ Inventory : "manages (InventoryManager)"
    User ||--o| RescueTeam : "logs in as"

    Disaster ||--o{ EmergencyRequest : contains
    EmergencyRequest ||--o{ RescueAssignment : dispatched_as
    EmergencyRequest }o--o| EmergencyRequest : "duplicates (duplicateOf)"
    RescueTeam ||--o{ RescueAssignment : executes
    RescueAssignment ||--o| RescueReport : "completes with (exactly one)"
    Shelter ||--o{ ResourceRequest : needs
    ReliefItem ||--o{ Inventory : stocked_as
    ReliefItem ||--o{ ResourceRequest : requested_as
    ResourceRequest ||--o{ ResourceAllocation : fulfilled_by
    Inventory ||--o{ ResourceAllocation : sourced_from

    User {
        string id PK
        string name
        string email UK
        string phone
        string passwordHash
        string role "CITIZEN|VOLUNTEER|RESCUE_TEAM|SHELTER_MANAGER|NGO|ADMIN"
        string skills "CSV, volunteers"
        string availability
        string serviceArea
        string organizationName "NGOs"
        boolean isActive
    }
    EmergencyRequest {
        string id PK
        string requesterId FK
        string disasterId FK "nullable, auto-linked ACTIVE"
        string emergencyType
        string location
        float latitude "nullable, SE-5 masked"
        float longitude "nullable, SE-5 masked"
        int peopleAffected
        boolean injuryPresent
        string priority
        string status "8-state FSM"
        string duplicateOfId FK "nullable self-link"
    }
    RescueAssignment {
        string id PK
        string requestId FK
        string teamId FK
        string assignedById FK
        string status "6-state mission FSM"
    }
    Shelter {
        string id PK
        string managerId FK
        int totalCapacity
        int currentOccupancy
        string facilities "CSV"
        string operatingStatus
        boolean emergencyOverride
    }
    ResourceRequest {
        string id PK
        string shelterId FK "nullable"
        string itemId FK
        int quantityRequired
        int quantityFulfilled
        string status "6-state FSM"
    }
    ResourceAllocation {
        string id PK
        string resourceRequestId FK
        string inventoryId FK "nullable"
        int quantity
        string status "4-state FSM"
    }
    Disaster {
        string id PK
        string name
        string type
        string affectedArea
        string severity
        string status "ACTIVE|MONITORING|RESOLVED"
        datetime startDate
    }
    RescueTeam {
        string id PK
        string name UK
        string teamType
        int memberCount
        string capability "CSV"
        string currentLocation
        float latitude "nullable"
        float longitude "nullable"
        string availabilityStatus "4-state"
        string userId FK "nullable, login link"
    }
    VolunteerTask {
        string id PK
        string volunteerId FK
        string title
        string taskType "low-risk allowlist"
        string location
        string status "6-state task FSM"
        string assignedById FK "nullable"
    }
    ReliefItem {
        string id PK
        string itemName
        string category
        string unit
    }
    Inventory {
        string id PK
        string itemId FK
        string location
        string organization "nullable"
        int quantityAvailable
        string managedById FK "nullable"
    }
    Notification {
        string id PK
        string recipientId FK
        string message
        string type
        boolean isRead
    }
    AuditLog {
        string id PK
        string actorId FK "nullable (system)"
        string action
        string target "nullable"
        string targetId "nullable"
        string metadata "nullable JSON"
        datetime timestamp
    }
```

Enforced invariants (code, not just schema): duplicate links suppress independent
dispatch; `quantityFulfilled ≤ quantityRequired`; allocation `quantity ≤
inventory.quantityAvailable` inside one Prisma transaction (cancel restores
stock); occupancy ≤ capacity unless audited `emergencyOverride`; every priority
change, assignment, and allocation writes an `AuditLog` row.

### 3a. Implementation additions beyond the class diagram (R-07)

The checked-in class diagram predates several implemented details; the code is
authoritative and the differences are deliberate, not drift:

- **`AuditLog` model** (`actorId?/action/target/targetId/metadata?/timestamp`,
  indexed on actor/action/target+targetId/timestamp). The diagram has no audit
  entity; every mutating service calls `writeAuditLog()` (FR-18) and the admin
  Audit viewer + request history timeline read it back.
- **Link/foreign-key attributes on existing entities.** `EmergencyRequest`:
  `duplicateOfId` (self-link for DUPLICATE, suppresses independent dispatch),
  `disasterId` (auto-linked ACTIVE disaster), `latitude`/`longitude`
  (SE-5 masked), `injuryPresent`. `RescueAssignment`: `assignedById`,
  `assignedAt`, `completedAt`. `ResourceRequest`: `quantityFulfilled`
  (partial-fulfilment tracking). `ResourceAllocation`: `inventoryId`
  (sourcing stock), `allocatedById` (authorizing user).
- **Derived, never stored:** `missionStatus`/`displayStatus` are computed per
  viewer in `decorateRequest` (no new request states); `availableCapacity`
  (`total − occupancy`) is computed in `withAvailability`.

## 4. Frontend map (pages → roles)

| Area | Pages | Heavy deps (lazy) |
|------|-------|-------------------|
| Public | Landing, Login, Register, Shelters, 404 | maps chunk (Shelters) |
| Citizen | MyRequests, RequestDetail, NewRequest, Nearby shelters (in-shell alias of Shelters) | maps chunk (wizard picker) |
| Admin | Dashboard, RequestQueue, Teams, Volunteers, Shelters, Relief, Alerts, Users, Disasters, Audit | maps + charts chunks (Dashboard) |
| Rescue team | Missions, MissionDetail | — |
| Volunteer | Tasks, Profile | — |
| Shelter mgr | My shelters, Resource requests | — |
| NGO | Inventory, Allocations, Field requests | — |
| Shared | Notifications, Help | — |

Guards: `RequireAuth` (JWT → `/auth/me`) + `RequireRole` (redirect to role home).
Bell polls `unread-count` every 10s. Theme defaults to dark, persisted in
`localStorage`. Code-split chunks: `vendor` (react/router/axios/query),
`forms` (RHF/zod), `maps` (leaflet), `charts` (recharts).
