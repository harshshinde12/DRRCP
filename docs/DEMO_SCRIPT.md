# 5-Minute Viva Demo Script — DRRCP

> Reset first: `npm run seed:demo` (clean DB, same state every time).
> Start: `npm run dev` → app at `http://localhost:5173`, API at `:4000`.
> Password for **every** account: `Password@123`. Use the one-click demo
> buttons on the login page. Keep `http://localhost:4000/api/docs` open in a
> second tab to show the contract if asked.

## Cast (log in as each when cued)

| When | Who | Email |
|------|-----|-------|
| 0:30 | Citizen | `citizen1@drrcp.local` |
| 1:30 | Admin | `admin@drrcp.local` |
| 2:30 | Rescue team | `team.charlie@drrcp.local` |
| 3:30 | Citizen again | `citizen1@drrcp.local` |
| 4:10 | NGO + Volunteer (quick hits) | `ngo1@drrcp.local`, `volunteer3@drrcp.local` |

## 0:00 — Landing (30s)

Open `/`. Say: “Central coordination layer — citizens raise requests, admins
verify and dispatch with human confirmation, shelters and relief stay visible.”
Point at: live shelter stats, helplines (112/1078/102), Request Emergency Help.

## 0:30 — Citizen submits (60s)

1. Log in as **citizen1** → **Request help**.
2. Step 1: type **Rescue**, **5** people, tick *Anyone injured*, severity **Severe**.
3. Step 2: address `Bldg 7, Andheri West, near station` (map optional).
4. Step 3: description `Five trapped on roof, one injured, water rising` →
   **Confirm & submit**. Say: “Auto-linked to the active Mumbai Floods 2026
   disaster; status SUBMITTED.”
5. Open the request → timeline shows **“Awaiting verification”**.

## 1:30 — Admin triage + dispatch (60s)

1. Log in as **admin** → **Request queue** → search `Bldg 7` → click the row
   (triage drawer opens).
2. Verify: decision **VERIFIED**, priority **Critical** → Apply. Say: “Every
   transition is validated against one state machine and audited.”
3. Assign: matching list ranks AVAILABLE teams by capability + distance →
   **Assign** Charlie Fire Squad. Say: “Busy teams return 409 unless an admin
   overrides with a written, audited reason — human-confirmed dispatch, SF-1.”

## 2:30 — Team mission (60s)

1. Log in as **team.charlie** → **My missions** → Open mission.
2. Click **Acknowledge** → **On the way** → **Start rescue**.
3. Mention: “If this failed, Request support would alert all admins and keep
   the mission open.”
4. Fill report: rescued **5**, injured **1**, note → **File report & resolve**.
   Say: “The report is the *only* path to RESOLVED; the team is freed.”

## 3:30 — Citizen sees resolution (30s)

1. Back as **citizen1** → request shows **Resolved — mission complete**,
   History lists every event, bell has the updates.
2. Visit **Nearby shelters** → map + beds. Say: “Contact and exact coordinates
   were visible only to us, the admin, and Charlie — verified by tests.”

## 4:00 — Relief in 40 seconds (optional if time)

1. As **ngo1**: Field requests → approve a PENDING water request →
   Allocations → allocate stock (over-allocation is blocked atomically).
2. As **volunteer3**: Tasks → Accept → Start → Complete.

## 4:40 — Close (20s)

Admin **Command center**: live map, charts, audit log. Say: “43 backend tests,
30 E2E checks incl. axe a11y, docs in `/docs`. Known limits: single-instance
deploy, no load test yet — both flagged in TRACEABILITY.”

### If something misbehaves live

- Empty queue: you skipped seed — run `npm run seed:demo`, log back in.
- Map tiles grey: offline tiles — lists carry the same data, continue there.
- Any 422/409 toast: read it aloud — those *are* the guardrails working.
