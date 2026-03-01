# HOURLY BUILD LOG

## 2026-03-01 13:40 (Asia/Shanghai) — T-017 Admin Coach Conversion Blockers Radar

- Branch: `pg/hourly-20260301-1340-admin-conversion-blockers`
- Changed files:
  - `services/api/app/{main.py,services.py,schemas.py}`
  - `apps/web/src/lib/apiClient.ts`
  - `apps/web/src/components/reports/ReportsWorkbench.tsx`
  - `docs/product/2026-03-01-admin-coach-conversion-blockers-radar.md`
  - `docs/product/COMMERCIALIZATION_MASTER_TABLE.md`
  - `docs/product/HOURLY_BUILD_LOG.md`
  - `tasks/prd-poker-god-hourly-commercialization.md`
- Validation:
  - `npm --workspace @poker-god/web run typecheck`
  - `npm run build:web`
  - `npm run build:api`
  - `python3 -m py_compile services/api/app/main.py services/api/app/services.py services/api/app/schemas.py`
- Rollout:
  - Feature flag `NEXT_PUBLIC_ADMIN_COACH_CONVERSION_BLOCKERS_V1` (default off)
  - internal dogfood -> full admin rollout
- Data/API notes:
  - New endpoint `GET /api/admin/coach/conversion-blockers`
  - Uses Supabase `pg_mvp_events` stage funnel (`coach_message_sent -> coach_action_executed -> drill_started -> drill_completed`)
- Blockers:
  - none
- Next action:
  - Mobile read-only radar for conversion blockers (`apps/mobile`) to close admin/mobile/backend loop.
