# Hourly Build Log

## 2026-03-01 08:20 (Asia/Shanghai)
- Branch: `pg/hourly-20260301-0820-admin-homework-priority-queue`
- PRD item: T-012 (new backlog item added and completed in `tasks/prd-poker-god-hourly-commercialization.md`)
- Feature package: Admin Homework Priority Queue
  - Backend: `GET /api/admin/coach/homework-priority-queue` in `services/api/app/main.py`
  - Backend logic: risk-tier queue builder in `services/api/app/services.py`
  - API schema: queue response contracts in `services/api/app/schemas.py` + `packages/contracts/src/api.ts`
  - Web: feature-flagged card in `apps/web/src/components/reports/ReportsWorkbench.tsx`
  - Web API client: `apps/web/src/lib/apiClient.ts`
  - Spec: `docs/product/2026-03-01-admin-homework-priority-queue.md`
- Validation:
  - `npm --workspace @poker-god/web run typecheck`
  - `npm run build:web`
  - `npm run build:api`
  - `python3 -m py_compile services/api/app/main.py services/api/app/services.py services/api/app/schemas.py`
- Rollout: web flag canary -> internal ops only -> evaluate 3-day KPI before wider rollout
- Blockers: none in local build; push status recorded below after git push
- Next action: mobile read-only homework priority radar (`EXPO_PUBLIC_MOBILE_HOMEWORK_PRIORITY_QUEUE_V1`)
