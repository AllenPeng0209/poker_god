# HOURLY_BUILD_LOG

## 2026-03-01 21:21 Asia/Shanghai — pg/hourly-20260301-2121-session-memory-radar

### Changed files
- `services/api/app/schemas.py`
- `services/api/app/services.py`
- `services/api/app/main.py`
- `packages/contracts/src/api.ts`
- `apps/web/src/lib/apiClient.ts`
- `apps/web/src/components/reports/ReportsWorkbench.tsx`
- `docs/product/2026-03-01-admin-coach-session-memory-radar.md`
- `docs/product/COMMERCIALIZATION_MASTER_TABLE.md`
- `tasks/prd-poker-god-hourly-commercialization.md`

### What shipped
- Added backend session-memory risk API: `GET /api/admin/coach/session-memory`.
- Added admin web feature-flag card: `NEXT_PUBLIC_ADMIN_COACH_SESSION_MEMORY_V1`.
- Added product spec + commercialization/master tracking updates.

### Validation
- `npm --workspace @poker-god/web run typecheck`
- `npm run build:web`
- `npm run build:api`
- `python3 -m py_compile services/api/app/main.py services/api/app/services.py services/api/app/schemas.py`

### Rollout / feature flag
- Web flag: `NEXT_PUBLIC_ADMIN_COACH_SESSION_MEMORY_V1` (default off).
- Mobile follow-up tracked as T-025 (`EXPO_PUBLIC_MOBILE_COACH_SESSION_MEMORY_V1`).

### Blockers
- None in local build.

### Next action
- Implement mobile read-only card for session memory risk and close admin/mobile/backend loop.
