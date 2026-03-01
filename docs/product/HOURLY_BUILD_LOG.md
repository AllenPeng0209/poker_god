# HOURLY_BUILD_LOG

## 2026-03-01 11:45 (Asia/Shanghai)
- Branch: `pg/hourly-20260301-1145-ev-leak-radar`
- Focus: Admin EV leak hotspot radar (backend + web typed client + feature-flag UI card)
- Changed files:
  - `services/api/app/{schemas.py,services.py,main.py}`
  - `apps/web/src/lib/apiClient.ts`
  - `apps/web/src/components/reports/ReportsWorkbench.tsx`
  - `docs/product/2026-03-01-admin-ev-leak-hotspots-radar.md`
  - `docs/product/COMMERCIALIZATION_MASTER_TABLE.md`
  - `tasks/prd-poker-god-hourly-commercialization.md`
- Validation:
  - `npm --workspace @poker-god/web run typecheck`
  - `npm run build:web`
  - `npm run build:api`
  - `python3 -m py_compile services/api/app/main.py services/api/app/services.py services/api/app/schemas.py`
- Rollout:
  - Feature flag `NEXT_PUBLIC_ADMIN_EV_HOTSPOTS_V1` default OFF
  - Admin internal canary first, then full admin rollout
- Blockers:
  - None in local build; remote push depends on repo auth/network.
- Next action:
  - Mobile follow-up: add `EXPO_PUBLIC_MOBILE_EV_HOTSPOTS_V1` read-only card consuming same API.
