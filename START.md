# ELOP — Local Dev & Login Guide

## Login Credentials

| Role            | Email                          | Password        |
|-----------------|-------------------------------|-----------------|
| Super Admin     | admin@euradicle.com           | Admin@1234      |
| Org Admin       | orgadmin@adityabirla.com      | Admin@1234      |
| Participant     | participant@adityabirla.com   | Admin@1234      |

> **Bypass password** (works for any account): `ElopTest@2026`

---

## Running Locally

### One-time setup (first time only)

Open a terminal in the `elop/` folder:

```bash
# Install root + server + client deps
npm install
cd server && npm install
cd ../client && npm install
cd ..
```

### Start both servers (one command)

```bash
npm run dev
```

This runs both concurrently:
- **API server** → http://localhost:4000
- **React app**  → http://localhost:5173

Or in two separate terminals:

```bash
# Terminal 1 — API
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev
```

### Open the app

- http://localhost:5173 — main app (login page)
- http://localhost:4000/health — API health check

---

## What each portal shows

### Super Admin (`/admin`)
- Dashboard with KPIs, org/cohort/user management
- Cohort detail → Journey Builder (add/edit/reorder interventions)

### Org Admin (`/org-admin`)
- Dashboard → active cohort cards with enrollment counts
- Cohorts page → search + filter
- Cohort detail → Overview, Participants list, Learning Journey (read-only)

### Participant (`/participant`)
- Dashboard → active programs with gradient cards
- Cohort page → full learning journey with tabs (Pre-Work, Virtual Sessions, etc.)
- Locked interventions show unlock date; virtual sessions have Join button

---

## Demo data already seeded

| Item               | Value                                        |
|--------------------|----------------------------------------------|
| Organization       | Aditya Birla Group                           |
| Cohort             | Leadership Excellence Program – Batch 1      |
| Cohort code        | ADIT-LEA-202606-DEMO                         |
| Cohort status      | Active                                       |
| Enrolled user      | participant@adityabirla.com (Rahul Mehta)    |
| Journey            | 9 interventions (pre-work → virtual sessions → case studies → assessments) |

---

## Project structure

```
elop/
├── api/index.js          ← Vercel serverless (prod) — all routes here
├── server/               ← Express server (local dev)
│   ├── src/routes/
│   │   ├── auth.js
│   │   ├── cohorts.js
│   │   ├── journeys.js   ← journey + org-admin + participant routes
│   │   └── ...
│   └── .env              ← DB keys (already configured)
├── client/               ← React 18 + Vite
│   └── src/
│       ├── pages/admin/        Super Admin pages
│       ├── pages/org-admin/    Org Admin portal
│       ├── pages/participant/  Participant portal
│       └── lib/api.js          Axios (auto token refresh, /api proxy)
└── START.md              ← This file
```

## Supabase

- **Dashboard:** https://supabase.com/dashboard/project/lkfqoqwvjuuharlkxlwf

## Security note

RLS is currently disabled (service role key is backend-only). Enable RLS policies before production go-live.
