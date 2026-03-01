# HOURLY_BUILD_LOG

## 2026-03-01 20:12 (Asia/Shanghai) — pg/hourly-20260301-2012-campaign-attribution-loop

### Changed files
- `services/api/app/{main.py,schemas.py,services.py}`
- `services/api/sql/0003_pg_mvp_events_campaign_attribution_index.sql`
- `apps/web/src/{lib/apiClient.ts,components/reports/ReportsWorkbench.tsx}`
- `apps/mobile/src/screens/ProfileScreen.tsx`
- `services/poker_god_api/{README.md,__init__.py}`
- `docs/product/{2026-03-01-campaign-launch-attribution-loop.md,COMMERCIALIZATION_MASTER_TABLE.md,HOURLY_BUILD_LOG.md}`
- `tasks/prd-poker-god-hourly-commercialization.md`

### Validation
- `npm run build:web` ✅
- `npm run build:api` ✅
- `npx tsc -p apps/mobile/tsconfig.json --noEmit` ✅
- `python3 -m py_compile services/api/app/main.py services/api/app/services.py services/api/app/schemas.py` ✅

### Push result
- Branch push attempted after commit.
- If remote credentials are valid: should publish `pg/hourly-20260301-2012-campaign-attribution-loop`.

### Blockers
- None on local build.
- Attribution quality depends on clients sending `payload.campaignId` consistently.

### Next action
- Add launch action instrumentation in admin trigger path to guarantee campaign-id population rate > 99%.
