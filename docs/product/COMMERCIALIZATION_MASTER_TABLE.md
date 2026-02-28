# COMMERCIALIZATION_MASTER_TABLE

| Idea ID | Track | Area (Admin/Mobile/Backend) | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Notes |
|---|---|---|---|---|---|---|---|---|
| PG-HOURLY-20260228-1025 | Study matrix/list TTL cache + cache-health endpoint | Backend + Admin | In Progress (implemented, pending prod deploy) | High: latency -30% target; drill conversion +3% target | M | API service deploy env var | Unique vs prior coach/homework/moderation work | Adds `/api/admin/study/cache-health` + in-memory TTL cache |
| PG-NEXT-COACH-HW-MOBILE | Homework completion streak + coach reminder card | Mobile + Backend | Backlog | Medium-High: D7 retention +4% | M | Push/notification infra | Not implemented yet | Next run candidate for retention loop |
| PG-NEXT-LINE-DRILL-ADMIN | Admin line-drill quality audit queue | Admin + Backend | Backlog | Medium: content quality incident rate -20% | M | Admin panel wiring + audit store | Not implemented yet | Build reviewer workflow for wrong baseline detection |
| PG-NEXT-COACH-MEMORY | AI coach long-horizon session memory + personalized homework generator | Backend (agent logic) + Mobile | Backlog | High: weekly active coaching sessions +8% | L | Memory schema + summarizer worker | Not implemented yet | Directly supports coach monetization |

## Coverage tracking (last touched)
- Backend: 2026-02-28 10:25 (this run)
- Admin: 2026-02-28 10:25 (this run, API observability endpoint)
- Mobile: pending next commercialization run (queued in backlog)
