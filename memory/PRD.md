# RegCheck-India — Frontend Veeva Rewire (Path A: Backend Wired)

## Original problem statement
> "can u access the frontend section from the regcheck-india project? i want to rewire the frontend ui ux and other things… make the frontend more to look like veeva vaults regulatory software… enterprise grade… streamlined workflow."

User choices: **1b + 2c + 3a** (originally) → then escalated to **Path A** (wire frontend to existing Render backend).

## Architecture
- Next.js 14.2 + React 18 + TypeScript + Tailwind 3
- Workspace state: React Context (`workspaceStore.tsx`) with URL-hash deep-linking
- Design system: CSS variables in `platform.css` (Veeva navy primary `#0B2A5B`)
- Mock data: `/app/frontend/src/lib/mockData.ts` (Submissions / Documents / Applications / Registrations / HA Correspondence / Audit)
- **Backend connectivity**: Same-origin Next.js rewrite proxy at `/api/regcheck/*` → `https://regcheck-india.onrender.com/api/v1/agents/*` (browser never makes cross-origin call → no CORS, no key in URL, no need for user to manage ALLOWED_ORIGINS)

## What's implemented

### Veeva-style workspace (from original rewire)
TopBar · LeftNav · RightInspector · Home / Submissions / Submission Detail / Applications / Registrations / Documents / HA Correspondence / Audit Trail / Reports / Settings views.

### Path A wiring (new)
- **Next.js rewrite proxy** in `next.config.js` — server-side proxy to Render backend, configurable via `REGCHECK_API_BASE` env var
- **`services/api.ts`** — switched all 9 agent helpers to use `/api/regcheck/*` proxy path (was direct cross-origin calls)
- **`AgentActionView.tsx`** — completely rewritten:
  - Real API calls to backend (9 agents) — no more mocks
  - Loading state with elapsed-time counter + 90s cold-start hint
  - Error banner for failures
  - **Rich result renderer** that auto-detects backend response shapes:
    - Compliance score → big number + colour-coded progress bar
    - Readiness / risk → status pills
    - Critical / Major / Minor findings → grouped lists with severity pills
    - Schedule Y / ICH GCP checklist → requirement table with status pills + corrective actions
    - QA agent → prose answer + Key Requirements + Regulatory Basis
    - Classifier → structured cards (Classification / Seriousness / Causality / Reporting Timeline)
    - Recommendations → bullet list
    - Fallback → pretty-printed JSON
  - Model + token-usage footer on every result
  - JSON export button
  - File upload (drag-drop) for cross-document agent (M9)
- **`SettingsView.tsx`** — API & Vaults tab now actually stores/clears keys:
  - Anthropic API key (with obfuscated localStorage + show/hide toggle)
  - Sarvam AI key (Hindi STT)
  - Mask format `sk-ant-•••••••XXXX`
  - Replace / Clear buttons
- **`getStoredKey()`** default → `admin-regcheck` magic word — keeps the demo working out-of-the-box using the vault owner's Anthropic credits. User-supplied keys take precedence.

## Verified working end-to-end (via the running proxy)
| Agent | Endpoint | Status | Time |
|---|---|---|---|
| Completeness | `/completeness` | ✅ 200 | ~13 s |
| Schedule Y | `/schedule-y` | ✅ 200 | ~20 s |
| ICH GCP | `/ich-gcp` | ✅ 200 | ~19 s |
| Case Classifier | `/classify` | ✅ 200 | ~6 s |
| Regulatory Q&A | `/qa` | ✅ 200 | ~10 s |

## Known issues (PRE-EXISTING BACKEND BUGS — not from this session)
**Two backend endpoints return 500** because of a typo at line 928 (and similar) of `agents_router.py` on the Render backend:
- `/anonymise` — uses `request.document` instead of `body.document`
- `/summarise` — same bug pattern
Fix: change `request.document` to `body.document` in those handler bodies, redeploy Render. The frontend is correctly wired; these will start working as soon as the backend bug is patched.

## What's still mocked (intentionally)
- Submissions / Documents / Applications / Registrations / HA Correspondence / Audit Trail data — these objects don't exist on the backend yet. Path B (later) will add MongoDB/Postgres persistence + CRUD endpoints.
- File upload to a real storage layer — local-only.
- The AI banner text on agent pages says "running against the vault's shared key" — accurate, since we default to `admin-regcheck`.

## Prioritized backlog
- **P0 (you)** — fix the two backend handler typos and redeploy Render
- **P0** — add the production Vercel URL to backend `ALLOWED_ORIGINS` (only matters if you ever want to call backend directly from the browser, *not* needed for the proxy)
- **P1** — Path B: real Submissions/Documents endpoints + storage
- **P1** — Real file upload for cross-doc agent (presigned URL or direct upload through proxy)
- **P2** — Persist agent run history server-side
- **P2** — Multi-user roles + e-signature middleware

## Next task list
1. You: fix the two backend typos (`agents_router.py` lines around 928 and the summarise handler) and redeploy Render
2. You: push frontend changes via "Save to GitHub" → Vercel will redeploy with the proxy + wired agents
3. After Vercel deploy: visit `https://<your-vercel>.vercel.app/app#/m7-scheduley`, paste a real protocol, click Run Analysis — should get a live Schedule Y compliance report in ~20 s
4. Optional: wire the per-document "Run AI Action" button in Submission Detail to pre-populate the agent input with the document's content
