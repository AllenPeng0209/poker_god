# Admin Homework Campaign Launch (PG-007)

- Date: 2026-02-28 13:16 (Asia/Shanghai)
- Owner: Hourly commercialization cron
- Track: AI coach agent + retention loops + admin ops

## Why this is highest-impact now

Current leak analytics can identify issues, but admin cannot operationalize them in one click.
This creates a monetization and retention gap: insight exists, but no campaign object to run outreach/homework loops.

## User flow

1. Admin opens Reports module with feature flag `NEXT_PUBLIC_ADMIN_HOMEWORK_CAMPAIGN_V1=true`.
2. UI fetches `/api/admin/analyze/mistakes/overview`.
3. Admin sees EV trend, top leak tag, critical cluster count, recommended action.
4. If action is `launch_homework_campaign`, admin clicks **Launch Homework Campaign**.
5. UI calls `POST /api/admin/analyze/mistakes/campaigns`.
6. Backend builds summary-backed draft campaign (`status=draft`) and returns campaign metadata + suggested homework payload.
7. Admin sees draft confirmation (campaign id, total homework items, top leak tag).

## KPI hypothesis

Primary:
- +12% homework campaign creation rate (admin side)
- +8% weekly drill starts from campaign-linked homework

Guardrail:
- <2% failed campaign creation requests
- No regression to reports page load (>300ms p95 added budget in MVP)

## Acceptance criteria

- [x] New contract types for mistake summary, admin overview, and campaign create response.
- [x] Backend exposes:
  - `GET /api/analyze/mistakes/summary`
  - `GET /api/admin/analyze/mistakes/overview`
  - `POST /api/admin/analyze/mistakes/campaigns`
- [x] Web client methods added for the above APIs.
- [x] Reports UI shows admin launcher card under feature flag and can create a draft campaign.
- [x] Campaign create validates `topN` range (1..8).

## Data / model / API updates

- Data model (MVP in-memory): new `adminHomeworkCampaigns` store keyed by campaign id.
- New API contracts:
  - `AnalyzeMistakeSummaryResponse`
  - `AnalyzeMistakeOverviewResponse`
  - `AdminHomeworkCampaignCreateRequest`
  - `AdminHomeworkCampaignCreateResponse`

## Migration notes

- No DB migration required in this run (MVP memory store).
- Production migration follow-up:
  - Persist campaigns in Postgres table `admin_homework_campaigns`.
  - Add async job to fan out suggested homework to coach/homework delivery pipeline.

## Rollout / feature flags

- `NEXT_PUBLIC_ADMIN_HOMEWORK_CAMPAIGN_V1=false` by default.
- Enable in internal admin environment first.
- Phase plan:
  1. Internal QA (1 day)
  2. 10% admin cohort (1 week)
  3. 100% rollout after KPI/guardrail check

## Validation notes

- `npm --workspace @poker-god/web run typecheck` passed.
- `npm run build:web` passed.
- `npm run build:api` passed (python API package compile check in current workspace configuration).
