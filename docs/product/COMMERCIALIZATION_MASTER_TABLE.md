# Commercialization Master Table

| Idea | Status | KPI Impact | Complexity | Dependencies | Duplicate Check |
| --- | --- | --- | --- | --- | --- |
| Admin Homework Retention Radar (`NEXT_PUBLIC_ADMIN_HOMEWORK_RETENTION_V1`) | shipped (2026-03-01) | `homework_attach_rate_pct +3%`, `homework_completion_rate_pct +2.5%`, `stale_homework_risk_rate_pct -20%`, `dropoff_detection_time -35%` | M | backend `/api/admin/coach/homework-retention`, `apps/web` reports card, Supabase `pg_mvp_events` | Not duplicate: existing funnel views do not expose stale-homework retention risk by stage |
| Mobile Homework Retention Radar (follow-up) | backlog (next) | `mobile_dropoff_detection_time -25%`, `stale_homework_followup_latency -20%` | M | same backend API, `apps/mobile` profile debug card | Not duplicate: mobile currently has coach funnel visibility but no homework retention/stale-specific card |
