# COMMERCIALIZATION_MASTER_TABLE

| ID | Idea | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Track Coverage |
|---|---|---|---|---|---|---|---|
| T-024 | Admin coach session memory radar + backend session memory risk API | shipped (2026-03-01 21:21) | Reactivation + attach uplift, stale detection latency down | M | Supabase `pg_mvp_events`, Reports page feature flag | Checked against T-019/T-023 (non-duplicate: focuses on stale memory risk not attribution/blockers) | admin ✅ backend ✅ mobile follow-up |
| T-025 (next) | Mobile coach session memory radar | backlog | Mobile reactivation response time down | M | Existing `/api/admin/coach/session-memory` | New | mobile target |
