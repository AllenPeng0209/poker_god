# 2026-03-02 Feature Spec — US-003 Campaign Readiness Radar

## Problem
Admin can launch campaign, but lacks a fast "what to launch now" view tied to EV leak impact, causing slower commercialization loops.

## User Flow
1. Admin opens `app/reports`.
2. If `NEXT_PUBLIC_ADMIN_CAMPAIGN_READINESS_V1=1`, UI shows **Admin Campaign Readiness** card.
3. Web calls `GET /api/admin/coach/campaign-readiness?windowDays=7|30|90`.
4. Backend converts leak clusters into launch-ready rows (channel/action/expected attach lift).
5. Admin uses suggestions to prioritize campaign launch.

## KPI Hypothesis
- `ops_time_to_campaign_selection`: **-30%**
- `homework_attach_rate_from_admin_campaign`: **+1.0% ~ +2.2%**
- `stale_homework_backlog_growth_rate`: **-8% ~ -15%**

## Acceptance Criteria
- [x] Backend readiness API returns deterministic suggestion fields.
- [x] Web card is feature-flagged and typed.
- [x] UI practical acceptance evidence captured (`docs/product/evidence/2026-03-02-us003-ui-acceptance.html`).
- [x] Typecheck/tests/py_compile pass.

## API/Data Notes
- New API: `GET /api/admin/coach/campaign-readiness`
- New schema models: `CampaignReadinessItem`, `CampaignReadinessResponse`
- **Migration**: not required this round (derived from existing Supabase leak source data).

## Rollout / Feature Flag
- Flag: `NEXT_PUBLIC_ADMIN_CAMPAIGN_READINESS_V1`
- Rollout: internal admin only (off by default), enable in staging first.
- Rollback: disable flag, endpoint can remain deployed safely.
