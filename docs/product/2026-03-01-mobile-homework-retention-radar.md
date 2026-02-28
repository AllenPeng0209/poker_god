# Mobile Homework Retention Radar (2026-03-01)

## Why now (highest-impact optimization)
Current highest-impact gap for commercialization is **mobile-side retention observability**: admin already sees retention funnel, but mobile operators/coaches lacked on-device visibility, increasing triage latency and stale-homework risk.

This package closes the Admin/Mobile/Backend loop by adding a mobile retention radar consuming backend telemetry API.

## User flow
1. Operator opens mobile Profile screen.
2. If `EXPO_PUBLIC_MOBILE_HOMEWORK_RETENTION_V1=1`, sees **Homework Retention Radar (Mobile)**.
3. Client fetches `/api/admin/coach/homework-retention?windowDays=30`.
4. Operator reviews:
   - attach rate
   - completion rate
   - stale risk rate
   - stage conversion rows
   - biggest drop stage
5. Operator taps **Refresh** to re-pull latest telemetry while troubleshooting.

## KPI hypothesis
- `mobile_retention_dropoff_detection_time`: **-30%**
- `homework_completion_from_attach_mobile`: **+2.0%**
- `stale_homework_risk_rate_mobile`: **-15%**

## Acceptance criteria
- [x] Mobile UI behind feature flag `EXPO_PUBLIC_MOBILE_HOMEWORK_RETENTION_V1`.
- [x] Data sourced only from backend API boundary (`/api/admin/coach/homework-retention`).
- [x] Loading / error / success states available for operator reliability.
- [x] Manual refresh action for operational re-check.
- [x] TypeScript compile validation recorded.

## Rollout / feature flag plan
- Default OFF in production.
- Enable for internal ops cohort first.
- Track KPI movement for 1 week before widening rollout.
- Rollback: set `EXPO_PUBLIC_MOBILE_HOMEWORK_RETENTION_V1=0` (no backend rollback required).

## Migration notes
- No schema migration this run.
- Uses existing backend telemetry endpoint and Supabase-backed event aggregation.
