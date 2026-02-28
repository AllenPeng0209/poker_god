# 2026-03-01 Mobile Latency Debug Panel (Ops Radar)

## Why now (highest-impact optimization)
Current reliability visibility is strong on backend + admin web, but mobile support/debug still has a blind spot. When users report "coach/practice slow", operators cannot quickly inspect route latency from the mobile surface.

This package closes that loop with a feature-flagged mobile latency panel using the existing backend API (`GET /api/admin/ops/latency`).

## User flow
1. Operator/internal QA opens mobile app → Profile tab.
2. If `EXPO_PUBLIC_MOBILE_OPS_LATENCY_V1=1`, a "Mobile Latency Radar (Debug)" card is shown.
3. Card displays sample size + generated timestamp + top p95 routes.
4. Operator taps refresh to pull latest latency telemetry.
5. On error, inline failure message is shown for fast triage.

## KPI hypothesis
- `mobile_ops_route_identification_time`: -25%
- `mobile_latency_incident_triage_time`: -20%
- `p95_spike_blind_window_mobile`: -30%

## Acceptance criteria
- Feature is gated by `EXPO_PUBLIC_MOBILE_OPS_LATENCY_V1`.
- Mobile consumes existing backend API boundary (`/api/admin/ops/latency`) without duplicating business logic client-side.
- Top p95 routes + count/avg/p50/max are visible on mobile profile debug card.
- Refresh action works and error state is explicit.
- Type/build validation passes for mobile + backend.

## Rollout / feature flag
- Default OFF in `.env.example` (`EXPO_PUBLIC_MOBILE_OPS_LATENCY_V1=0`).
- Enable for internal QA and operator cohort first.
- Keep admin web latency radar as primary production ops view; mobile is support/debug companion.

## Migration / architecture notes
- FE/BE split maintained:
  - FE: `apps/mobile`
  - BE: `services/api` (Python)
  - DB: Supabase remains system of record
- No schema migration required for this increment (reuses existing telemetry endpoint).

## Validation plan
- `npm --workspace @poker-god/mobile run build -- --platform android --non-interactive` is heavy for hourly loop, so validate with TypeScript compile:
  - `npx tsc -p apps/mobile/tsconfig.json --noEmit`
- Backend compile check:
  - `python3 -m py_compile services/api/app/main.py services/api/app/schemas.py`
