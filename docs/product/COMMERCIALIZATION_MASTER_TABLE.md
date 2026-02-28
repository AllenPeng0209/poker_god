# COMMERCIALIZATION MASTER TABLE

| ID | Idea | Track | Surface Coverage | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PG-022 | Mobile homework inbox with push reminders | retention loop | Mobile | Backlog | +10% weekly active learners | M | mobile app notifications, coach homework API | Not duplicate: no current mobile homework execution inbox | Depends on PG-024 funnel events and durable homework state. |
| PG-023 | Admin commercialization dashboard for homework conversion funnel | reliability/ops | Backend ✅ / Web-admin-lite ✅ / Admin app ⏳ | In Progress | -30% time-to-insight for experiments | M | analytics warehouse, admin UI | Not duplicate: existing reports lacked homework conversion metrics | This run ships reports-based admin-lite panel + API endpoint. |
| PG-024 | Coach homework execution loop + funnel observability events | AI coach agent + retention loop + reliability | Backend ✅ / Web ✅ / Admin-lite ✅ / Mobile ⏳ | In Progress (branch) | +10% homework starts, +8% completion, +6% drill conversion | M | coach drawer UX, analytics schema, reports card | Distinct from generic coach chat: adds measurable execution funnel and KPI loop | Includes generate/start/complete lifecycle events and funnel endpoint. |

## Coverage Tracker (hourly cadence)
- 2026-02-28 14:51 run: **Backend + Web + Admin-lite reports** touched.
- Next required rotation: **Mobile**.
