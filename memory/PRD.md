# RegCheck-India — Frontend Veeva Rewire

## Original problem statement
> "can u access the frontend section from the regcheck-india project? i want to rewire the frontend ui ux and other things… make the frontend more to look like veeva vaults regulatory software and similar workflow as well. consider yourself a regulatory affairs specialist and design the frontend in the similar manner. it should be more of a enterprise grade not like a demo or mvp. the colors should be as well good enough. the workflow should be streamlined as well."

User choices: **1b + 2c + 3a**
- 1b — Frontend-only rewire using realistic mock data (backend deferred)
- 2c — Hybrid Veeva object model: Submission/Document-centric primary workflow, AI agents accessible from a right-side inspector + per-document action menu
- 3a — Also Veeva-ize the landing page (sober enterprise marketing)

## Architecture
- Next.js 14.2 (App Router) + React 18 + TypeScript + Tailwind 3
- Workspace state: React Context (`/app/frontend/src/lib/workspaceStore.tsx`) with URL-hash deep-linking (`#/<view>[/sub/<id>]`)
- Design system: CSS variables in `/app/frontend/src/styles/platform.css` (Veeva navy primary `#0B2A5B`, CTA blue `#1A56DB`, dense 13px type, sharp 4-6px radii)
- Mock data: `/app/frontend/src/lib/mockData.ts` (6 submissions, 11 documents, 6 applications, 3 registrations, 4 HA correspondence items, 8 audit events)

## User personas
- Regulatory Lead (primary) — Anika Sharma
- CMC Lead, Clinical Lead, Pharmacovigilance, QA, RA Specialist (supporting)
- Vault audience: pharmaceutical sponsors, CROs, RA consultancies in India

## Core requirements (static)
- Veeva Vault aesthetic — enterprise, dense, document-centric, navy chrome on white
- Veeva object model — Submissions, Applications, Registrations, Documents, HA Correspondence, Audit Trail
- Document lifecycle states — Draft / In Review / Approved / Effective / Rejected (Deficiency) / Superseded
- AI compliance agents repositioned as "Compliance Actions" attachable to a document/submission, opened from a right-side inspector

## What's been implemented (2026-05-22)
- **Workspace shell** — navy TopBar (vault picker, global search, notifications, user) + LeftNav (Workspace / Compliance Agents / System sections) + RightInspector + main content
- **Home view** — Greeting header, 4 KPI tiles (Active Submissions / Open Critical Gaps / AI Actions Run / HA Items Past Due), "My Queue · Needs Action" table, Vault-wide Compliance bars, Recent Activity stream, Pinned Submissions
- **Submissions view** — Faceted filters (State / Type / Phase) + search + dense table with status pills, compliance scorebars, owners. Single-click opens right inspector; double-click opens detail
- **Submission detail** — Lifecycle stepper, Overview / Documents / HA Correspondence / Compliance Gaps / Activity tabs, run AI actions from header
- **Applications view** — Table of clinical trial / new drug / subsequent new drug applications with status pills
- **Registrations view** — Table of approved registrations with Effective/Expiring/Expired/Withdrawn states
- **Documents view** — State-filter pills + document table with version, lifecycle, owner
- **HA Correspondence view** — Inbox / Sent / All tabs + split list/detail layout for CDSCO communications
- **Audit Trail view** — 21 CFR Part 11-style immutable log table
- **Reports view** — Compliance bars + submission throughput + top submissions by gap count
- **9 AI Compliance Agents (M1–M9)** — unified `AgentActionView` with consistent input → Run Analysis → mocked findings (CRITICAL/MAJOR/MINOR) + citations + recommendations. Lazy timeout simulates inference
- **Right Inspector** — Slides in with Details / Compliance Actions / Activity tabs for the selected submission or document
- **Settings view** — General / Team & Roles / Security & Compliance / Integrations tabs
- **Landing page** — Veeva-style enterprise marketing: navy announcement bar, hero with workspace preview card, 6 platform cards, 4-step workflow, security/frameworks split, dark navy Solutions section, contact CTA, dark footer
- **URL hash routing** — Every view is deep-linkable (e.g. `/app#/submissions`, `/app#/audit`, `/app#/m7-scheduley`)

## What's mocked
- All AI agent responses (no real Anthropic Claude calls yet) — `AgentActionView.runMock()` returns canned findings after 1.1 s
- All data in `mockData.ts` — no calls to the existing FastAPI backend

## Prioritized backlog
- **P0 — Wire real backend**
  - Connect `AgentActionView` to the existing `/api/v1/agents/*` endpoints (api.ts already has the helpers — `runScheduleYCompliance`, `runICHGCPChecker`, `crossDocumentCheck`, etc.)
  - Connect Settings → API Keys to `storeKey()` / `storeSarvamKey()` in `services/api.ts`
  - Replace `SUBMISSIONS` / `DOCUMENTS` mocks with persistent storage (MongoDB or existing Render Postgres)
- **P1 — Per-document Compliance Actions menu** (the "+ Run AI Action" button on a document row should open the inspector with the document pre-selected and the Actions tab open — partially wired, polish UX)
- **P1 — File upload flow** in `DocumentsView` and on `SubmissionDetailView` → `Upload` button (currently no-op)
- **P1 — Sticky / pinned compliance action results** (PinnedResultPanel component exists but not wired)
- **P2 — Bulk operations** (multi-select rows + bulk e-sign, bulk run analysis)
- **P2 — Saved filter views** (already a button in SubmissionsView header — no-op)
- **P2 — CDSCO SUGAM connector** mock → real integration

## Test coverage
- Frontend: 100% per `/app/test_reports/iteration_1.json`
  - Landing renders all sections
  - Workspace shell + Home view
  - All 8 primary nav targets navigate correctly
  - All 9 compliance agents reachable and Run Analysis returns mocked findings
  - Right inspector opens on row click, 3 tabs work, close works
  - Submission detail view, lifecycle bar, tabs all work
  - URL hash deep-linking (`#/audit`, `#/correspondence`, `#/m1-anonymiser`) verified
  - Zero JS console errors

## Next task list
1. Decide backend connectivity strategy (re-deploy Render backend in this env, or wire to the live Render URL)
2. Wire `AgentActionView` Run Analysis to real `/api/v1/agents/*` endpoints
3. Connect Settings → API & Vaults to actual API key storage
4. Replace mock SUBMISSIONS / DOCUMENTS with backend-fetched data
5. Implement actual file upload (drag-and-drop into `DocumentsView` + `SubmissionDetail`)
