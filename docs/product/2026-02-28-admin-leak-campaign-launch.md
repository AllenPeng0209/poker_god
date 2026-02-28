# Admin Leak Campaign Launch (T-002)

## Why now
Highest-impact optimization this round: convert leak report insights into one-click admin campaign drafts so coach homework can be attached immediately, reducing leak-to-action latency.

## User flow
1. Admin opens Reports module and loads leak ranking (7/30/90 day windows).
2. Admin clicks **Launch homework campaign** on a high-impact leak.
3. Web app calls backend `POST /api/admin/campaigns/leak` with leak id + owner + feature flag.
4. Backend creates Supabase draft campaign in `pg_mvp_leak_campaigns` with KPI target.
5. UI confirms campaign creation and logs `admin_campaign_launched` analytics event.

## KPI hypothesis
- Primary: `coach_homework_attach_rate` +4% to +8% for users touched by launched campaigns.
- Secondary: leak-to-campaign lead time from hours to <5 minutes.
- Guardrail: campaign create API p95 < 400ms.

## Acceptance criteria
- Reports UI exposes launch CTA per leak row.
- Backend validates `leakId`/`owner` and persists draft campaign in Supabase.
- Response includes campaign id, feature flag, KPI metric, target lift.
- Analytics receives `admin_campaign_launched` event with leak + campaign ids.
- Feature-flag plan documented: `admin_campaign_launch_v1`.

## Rollout / flag
- Start with internal admin only under `admin_campaign_launch_v1`.
- If 7-day attach rate improves and error rate <1%, enable for full admin cohort.

## Migration notes
- Apply SQL migration: `services/api/sql/0003_pg_mvp_leak_campaigns.sql` in Supabase before enabling feature flag.
