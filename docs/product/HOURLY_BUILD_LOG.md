# HOURLY_BUILD_LOG

## 2026-03-01 15:56 Asia/Shanghai
- Branch: `pg/hourly-20260301-1556-coach-campaign-reco`
- PRD item: `T-019 Admin coach campaign recommendations radar`
- Highest-impact optimization selected: move from passive blocker visibility to executable campaign recommendations (admin decision acceleration).

### Changed files
- `services/api/app/schemas.py`
- `services/api/app/services.py`
- `services/api/app/main.py`
- `apps/web/src/lib/apiClient.ts`
- `apps/web/src/components/reports/ReportsWorkbench.tsx`
- `docs/product/2026-03-01-admin-coach-campaign-recommendations.md`
- `docs/product/COMMERCIALIZATION_MASTER_TABLE.md`
- `tasks/prd-poker-god-hourly-commercialization.md`

### Validation
- `npm --workspace @poker-god/web run typecheck`
- `npm run build:web`
- `npm run build:api`
- `python3 -m py_compile services/api/app/main.py services/api/app/services.py services/api/app/schemas.py`

### Rollout / feature flag
- Web flag: `NEXT_PUBLIC_ADMIN_COACH_CAMPAIGN_RECO_V1`
- Rollout: internal 10% -> 50% ops -> 100% after 72h stability
- Kill switch: disable web flag

### Push result
- pending (run `git push -u origin pg/hourly-20260301-1556-coach-campaign-reco`)

### Blockers
- none in local code path

### Next action
- Implement mobile parity reader (`EXPO_PUBLIC_MOBILE_COACH_CAMPAIGN_RECO_V1`) to keep Admin/Mobile/Backend explicit tracking continuous.
