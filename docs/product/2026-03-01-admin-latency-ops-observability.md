# Product Spec — Admin API Latency Ops (Commercialization)

## Why this now
Current commercialization risk is production reliability: when APIs degrade, admin teams cannot quickly isolate which route is causing the slowdown. This delays mitigation and directly impacts homework campaign execution and coach session continuity.

## Target users
- **Admin / ops owner** monitoring service health during campaign windows
- **Engineering oncall** diagnosing p95 regressions without attaching heavy APM first

## User flow
1. Admin opens ops tooling and requests `/api/admin/ops/latency`.
2. Service returns top slow routes ranked by p95 over recent in-memory samples.
3. Admin identifies regressing endpoint and applies mitigation (throttle, rollback, feature flag).
4. Follow-up checks confirm p95 recovery.

## KPI hypothesis
- Mean time to detect API regression (MTTD) **-30%** for top-traffic routes.
- Admin interruption from opaque timeouts **-15% to -20%** (paired with existing retry hardening).
- Route-level latency visibility coverage from 0 to **100% of `/api/*` requests** handled by this service process.

## Acceptance criteria
- [x] Every `/api/*` request records bounded latency samples in backend memory.
- [x] Response includes `X-Response-Time-Ms` + `Server-Timing` for client-side diagnostics.
- [x] New endpoint `GET /api/admin/ops/latency?limit=N` returns ranked route latency stats (`avg/p50/p95/max/count`).
- [x] Bounded memory usage (per-route max sample cap).
- [x] Build/compile validation passes.

## Rollout / feature-flag plan
- Phase 1 (now): backend endpoint + headers live, admin consumers optional.
- Phase 2: wire `apps/web` admin dashboard card to call this endpoint under `NEXT_PUBLIC_ADMIN_OPS_LATENCY_V1`.
- Phase 3: mobile debug panel parity for support staff.

## Architecture alignment
- **Backend**: implemented in Python service under `services/api` (existing service boundary).
- **Frontend**: no business logic moved to FE; FE will consume API boundary in later phase.
- **Database**: no schema change required for this in-memory observability step.
- **Migration step toward target**: next cycle should mirror endpoint under `services/poker_god_api/` namespace as part of service path convergence.

## Validation notes
- `npm run build:api` ✅
- `python3 -m py_compile services/api/app/main.py services/api/app/schemas.py` ✅
