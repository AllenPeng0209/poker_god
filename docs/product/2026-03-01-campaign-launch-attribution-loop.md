# 2026-03-01 — Admin+Mobile Campaign Launch Attribution Loop (T-023)

## 1) Deep scan conclusion (highest-impact optimization this run)

**Optimization selected:** event-level attribution loop from campaign launch -> attach -> drill completion.

Why highest impact now:
- Product: current commercialization flow can launch campaigns, but cannot prove which launch source drives attach/completion.
- Engineering: attribution query path was expensive without campaign-id index and lacked a single API contract for Admin + Mobile.
- Revenue/KPI leverage: lets ops stop low-yield campaign sources quickly and scale high-yield sources.

Cross-surface tracking in this run:
- **Admin/Web:** new attribution radar card in reports page.
- **Mobile:** new attribution summary card in profile for field ops visibility.
- **Backend:** new telemetry aggregation API + indexed event query path.

## 2) User flow
1. Admin launches campaign (event: `coach_campaign_launched` with `payload.campaignId` + `payload.source`).
2. User executes coach action and starts/completes drills (events contain same campaign id).
3. Ops opens Admin radar (web) or Mobile profile card.
4. System shows launch count, attributed attaches/completions, and rates by campaign.
5. Ops increases spend on high-attach/high-completion campaign sources.

## 3) KPI hypothesis
- `campaign_attach_rate` +3.0% to +5.0% via source reallocation.
- `campaign_completion_rate` +1.5% to +3.0%.
- `time_to_detect_low_yield_campaign` -40% (from manual SQL to dashboard).

## 4) Acceptance criteria (T-023)
- [x] Admin attribution observability exposed from backend API.
- [x] Mobile attribution observability consumed from same API boundary.
- [x] Event-level launch->attach->completion conversion surfaced.
- [x] Feature flags for safe rollout.
- [x] Validation commands and rollout plan documented.

## 5) API / data / model changes

### Backend API
- `GET /api/admin/coach/campaign-attribution?windowDays=7|30|90&limit=1..50`
- Response:
  - `summary`: total launches, attributed attaches/completions, rates
  - `items[]`: campaign-level attribution metrics

### Event model update
- accepted analytics event name extended with `coach_campaign_launched`

### DB migration
- Added index migration:
  - `services/api/sql/0003_pg_mvp_events_campaign_attribution_index.sql`
  - Functional index on `payload->>'campaignId'` + event-time/event-name index

## 6) Rollout / feature flags
- Web: `NEXT_PUBLIC_ADMIN_CAMPAIGN_ATTRIBUTION_V1=1`
- Mobile: `EXPO_PUBLIC_MOBILE_CAMPAIGN_ATTRIBUTION_V1=1`

Rollout:
1. Enable in internal env only.
2. Verify at least one campaign emits `campaignId` consistently.
3. Compare API rates with raw SQL sample for 24h.
4. Enable to 100% after metric parity.

Rollback:
- Disable flags to hide UI instantly.
- Keep API live for back-office diagnostics.

## 7) Validation notes
- `npm run build:web`
- `npm run build:api`
- `npx tsc -p apps/mobile/tsconfig.json --noEmit`
- `python3 -m py_compile services/api/app/main.py services/api/app/services.py services/api/app/schemas.py`

## 8) Architecture alignment
- FE only in `apps/web` + `apps/mobile`.
- Backend logic in Python service (`services/api`).
- Supabase remains source-of-truth.
- Added migration scaffold `services/poker_god_api/` to move toward target `services/<project>/`.
