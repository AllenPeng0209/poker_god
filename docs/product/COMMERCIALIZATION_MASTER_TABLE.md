# COMMERCIALIZATION MASTER TABLE

| ID | Idea | Track | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Admin/Mobile/Backend Tracking |
|---|---|---|---|---|---|---|---|---|
| T-033 | Analytics Event Dedupe Guard (`/api/events` idempotency + deduplicated counter) | Reliability/Observability | done (2026-03-02) | Funnel data trust ↑, false positive wins ↓ | M | Supabase migration `0003_pg_mvp_events_dedupe_guard.sql` | New (no equivalent dedupe guard in current backend) | Admin: next add dedupe trend card; Mobile: next add eventId in emitter; Backend: shipped |
| T-034 | Admin dedupe health radar (show accepted vs deduplicated by day) | Admin UX | backlog | Ops triage time ↓ | M | T-033 API field | Not duplicate | Admin focus |
| T-035 | Mobile analytics emitter eventId rollout | Mobile reliability | backlog | Retry-induced noise ↓ | S | T-033 | Not duplicate | Mobile focus |
