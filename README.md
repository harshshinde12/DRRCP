# DRRCP — Disaster Relief & Rescue Coordination Platform

> A full-stack web platform built for disaster management to coordinate emergency requests, rescue operations, relief shelters, volunteer tasks, and supply logistics during crisis situations.

---

## 📌 About the Project

During severe natural disasters (such as urban flooding, cyclones, or earthquakes), emergency services and relief agencies face huge coordination challenges:
- Phone helplines get overwhelmed with duplicate calls.
- Rescue teams don't have clear information on trapped citizens, priority levels, or exact GPS locations.
- Relief shelters get overcrowded while nearby ones sit underutilized.
- NGOs struggle to match relief supplies with actual field shortages.

**DRRCP (Disaster Relief & Rescue Coordination Platform)** solves this by providing a unified, role-based operations system connecting **Citizens**, **Emergency Responders**, **Shelter Managers**, **NGOs**, and **City Administrators** in real time.

---

## 🚀 Key Features by Role

### 🧑‍🤝‍🧑 1. Citizens (Affected Public)
- **Submit SOS / Help Requests**: 3-step intuitive wizard to specify emergency type (evacuation, medical, flood rescue), headcount, injuries, description, and pinpoint exact location using an interactive Leaflet map.
- **Track Status in Real-Time**: Visual timeline tracking request progress (Submitted → Verified → Rescue In Progress → Resolved).
- **Find Nearby Shelters**: Search open relief shelters around current location with live available bed capacity, contact numbers, and amenities (food, water, medical aid).

### 🛡️ 2. Admin Command Center
- **Emergency Triage Queue**: Review incoming citizen requests, verify authenticity, weed out duplicates, and assign critical/high priority tags.
- **Rescue Dispatch**: Match verified incidents with the best-suited rescue squad based on team capabilities and proximity.
- **Platform Oversight**: Visual dashboard with real-time operational metrics, interactive incident map, shelter occupancy levels, inventory shortages, and an immutable audit log.
- **Emergency Broadcasts**: Send instant system-wide alerts to all active users or targeted groups.

### 🚤 3. Rescue Teams
- **Mission Dashboard**: View dispatched assignments with citizen contact info, location markers, and severity notes.
- **Operational Status Updates**: Transition mission stages (*Acknowledged* → *En Route* → *Rescue in Progress*).
- **Incident Reporting**: File post-rescue field reports logging rescued count, medical triage details, and completion notes.
- **Support Requests**: Flag need for additional backup or medical support directly to admins.

### 🏕️ 4. Shelter Managers
- **Live Occupancy Tracking**: Monitor bed counts with visual capacity gauges and quick check-in / check-out controls.
- **Facility Status**: Update shelter availability (Open, Full, Temporarily Closed) and available services.
- **Resource Requests**: Request emergency supplies (food kits, clean water, blankets, medicines) directly from relief inventory.

### 📦 5. NGOs & Relief Inventory
- **Warehouse Inventory**: Track stock levels across essential relief items, set minimum thresholds, and detect critical shortages.
- **Supply Allocation**: Review shelter requests and allocate warehouse supplies without the risk of over-allocating or duplicate dispatches.
- **Delivery Tracking**: Monitor relief shipments from dispatch to on-site shelter delivery.

### 🤝 6. Volunteers
- **Community Tasks**: Accept and update low-risk local support tasks (food distribution, queue management, shelter aid).
- **Profile & Availability**: Configure volunteer skill sets, active service radius, and on-duty availability.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite 5, TypeScript, Tailwind CSS
  - **State & Data Fetching**: TanStack React Query, Axios
  - **Routing & Forms**: React Router v6, React Hook Form, Zod
  - **UI & Visualization**: Recharts, Leaflet / OpenStreetMap, Lucide Icons
- **Backend**: Node.js, Express 4, TypeScript
  - **Database & ORM**: SQLite (via Prisma ORM 5) — Postgres-ready schema
  - **Authentication**: JWT (JSON Web Tokens), bcryptjs password hashing
  - **Security & Reliability**: Helmet, CORS, Morgan logging, express-rate-limit
- **Testing**:
  - **Backend API**: Vitest + Supertest (43 automated tests)
  - **End-to-End**: Playwright test suite with Axe-core accessibility checks

---

## ⚡ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) (bundled with Node.js)
- [Git](https://git-scm.com/)

### One-Command Setup (Windows)
If you're on Windows, simply double-click or run:
```bat
start-dev.bat
```
This automatically installs packages, runs database migrations, seeds realistic demo data, and boots both the backend and frontend simultaneously.

---

### Manual Setup (Linux / macOS / Windows)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/harshshinde12/DRRCP.git
   cd DRRCP
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   # Copy backend environment config
   cp backend/.env.example backend/.env

   # Copy frontend environment config
   cp frontend/.env.example frontend/.env
   ```

4. **Initialize the database & seed demo data**:
   ```bash
   npm run prisma:migrate --workspace=backend
   npm run seed:demo
   ```

5. **Start the development servers**:
   ```bash
   npm run dev
   ```

Both servers will start concurrently:
- 🌐 **Frontend Web App**: [http://localhost:5173](http://localhost:5173)
- ⚙️ **Backend REST API**: [http://localhost:4000/api](http://localhost:4000/api)
- 📖 **Swagger API Documentation**: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- 🩺 **Health Check**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 🔑 Demo Accounts

The project includes an active disaster simulation (**Mumbai Floods 2026**) with pre-populated incidents, teams, shelters, and supplies.

> **Default password for all demo accounts:** `Password@123`  
> *(Tip: The login screen also features 1-click quick-login buttons for fast testing!)*

| Role | Demo Email | Primary Dashboard |
|:-----|:-----------|:------------------|
| **Administrator** | `admin@drrcp.local` | Central Command Center, Queue & Audit |
| **Citizen (Requester)** | `citizen1@drrcp.local` | Emergency SOS Form & Request Tracker |
| **Rescue Squad (Lead)** | `team.charlie@drrcp.local` | Dispatched Missions & Rescue Reports |
| **Shelter Manager** | `shelter.manager@drrcp.local` | Live Shelter Capacity & Resource Requests |
| **NGO Coordinator** | `ngo1@drrcp.local` | Relief Inventory & Supply Allocations |
| **Volunteer** | `volunteer1@drrcp.local` | Community Relief & Support Tasks |

---

## 📁 Repository Structure

```text
DRRCP/
├── backend/                  # Express + TypeScript REST API
│   ├── prisma/               # Database schema & migrations (SQLite)
│   │   ├── schema.prisma     # Relational models & status sets
│   │   └── seed.ts           # Demo disaster scenario seeder
│   └── src/
│       ├── controllers/      # API request handlers
│       ├── middleware/       # Auth (JWT), validation (Zod), rate limiting
│       ├── routes/           # REST endpoints
│       └── services/         # Business logic & state-machine transactions
├── frontend/                 # React 18 + Vite SPA
│   └── src/
│       ├── components/       # UI elements, interactive Leaflet maps, timelines
│       ├── lib/              # API clients, auth context, query hooks
│       └── pages/            # Role-specific portals (Citizen, Admin, Team, Shelter, NGO)
├── docs/                     # Course & technical documentation
│   ├── API.md                # REST API specifications
│   ├── ARCHITECTURE.md       # System design & component architecture
│   ├── DEMO_SCRIPT.md        # Step-by-step 5-minute presentation script
│   ├── TESTING.md            # Test strategy & test cases
│   └── diagrams/             # Class diagrams, use case diagrams, WBS
├── e2e/                      # Playwright end-to-end integration tests
├── start-dev.bat             # One-click Windows development boot script
└── README.md
```

---

## 🧪 Available Scripts

| Script | Purpose |
|:-------|:--------|
| `npm run dev` | Runs both backend (:4000) and frontend (:5173) in watch mode |
| `npm run build` | Typechecks and compiles production builds for both apps |
| `npm run seed:demo` | Resets the database to a clean, realistic demo disaster scenario |
| `npm run test --workspace=backend` | Executes the 43 Vitest backend integration tests |
| `npm run test:e2e` | Runs automated Playwright user-flow & accessibility tests |

---

## 🔮 Roadmap & Future Scope

Features planned for upcoming releases:
1. **SMS & WhatsApp Gateway Integration**: Allow citizens in areas with low mobile data to submit SOS requests via SMS or WhatsApp chatbot.
2. **Real-Time GPS Tracking**: WebSockets / SSE integration to show live GPS movement of rescue vehicles heading toward incident sites.
3. **Offline Outbox Support (PWA)**: Allow local caching of emergency reports when cellular connection drops, automatically syncing once connection restores.
4. **Multi-Language Support**: Regional localization (Marathi, Hindi, Gujarati) for citizen-facing emergency workflows.
5. **Admin Approval Queue for Responders**: Verification workflow for newly registered NGOs and volunteers before field deployment.

---

## 📄 License & Academic Note

This project was developed as an academic Software Engineering course project to demonstrate end-to-end software architecture, secure role-based access control, relational data modeling, and human-in-the-loop disaster coordination.
