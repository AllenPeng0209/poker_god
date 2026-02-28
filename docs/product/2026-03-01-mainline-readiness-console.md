# Mainline Readiness Console (Admin/Web)

## Problem
Mainline usability acceptance is blocked by missing single-screen readiness visibility (API/Supabase/feature-flag gating). Release checks are currently fragmented.

## User Flow
1. Admin opens `Reports` module in `apps/web`.
2. Page loads leak report + `Mainline readiness` card in parallel.
3. Admin reviews overall status (`PASS/WARN/FAIL`) and per-check details:
   - Supabase connectivity + core table query
   - Write API key guard status
   - Coach homework persistence flag
   - Admin campaign launch flag
4. If all checks pass, admin proceeds with campaign launch and coach homework workflows.

## KPI Hypothesis
- Reduce pre-release triage time by **30%**.
- Improve `coach homework attach rate` stability by surfacing disabled flags before rollout.
- Reduce failed acceptance runs caused by env drift by **20%**.

## Acceptance Criteria
- Backend exposes `GET /api/admin/mainline-readiness` with machine-readable check list.
- Reports page renders overall readiness status + check details.
- Readiness endpoint is low-latency and includes observed DB check duration.
- Validation:
  - `python3 -m py_compile services/api/app/main.py services/api/app/schemas.py`
  - `npm --workspace @poker-god/web run typecheck`

## Rollout / Feature Flag
- No new runtime flag needed for endpoint.
- Existing flags inspected by readiness:
  - `COACH_HOMEWORK_SUPABASE_V1`
  - `ADMIN_CAMPAIGN_LAUNCH_V1`
- If endpoint fails in production, rollback by reverting this branch; Reports page remains functional without readiness card.

## Architecture Alignment
- Frontend change kept in `apps/web` (Next.js).
- Backend change kept in Python service `services/api`.
- Supabase remains source-of-record and is explicitly tested in readiness checks.
