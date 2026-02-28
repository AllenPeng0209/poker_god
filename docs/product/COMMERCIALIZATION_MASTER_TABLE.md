# COMMERCIALIZATION MASTER TABLE

| ID | Idea | Track | Surface Coverage | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PG-021 | Personalized AI Coach Homework Pack (auto-generated, KPI-bound tasks) | AI coach agent + retention loop | Backend ✅ / Web ✅ / Mobile ⏳ / Admin ⏳ | In Progress (branch) | +8% D7 study return, +12% drill completion after coach session | M | services/api, contracts, web coach drawer, analytics events | Checked against PG-013/016 coach drill-plan items; non-duplicate because this is KPI-bound homework generation API + UI trigger | This run ships v1 heuristic generator and coach UI entrypoint. |
| PG-022 | Mobile homework inbox with push reminders | retention loop | Mobile | Backlog | +10% weekly active learners | M | mobile app notifications, coach homework API | Not duplicate: no current mobile homework surface | Depends on PG-021 API stability. |
| PG-023 | Admin commercialization dashboard for homework conversion funnel | reliability/ops | Admin + Backend | Backlog | Faster experiment cycle, target -30% time-to-insight | M | analytics warehouse / admin UI | Not duplicate: current admin pages don’t track homework funnel | Should follow once PG-021/022 produce event volume. |

## Coverage Tracker (hourly cadence)

- 2026-02-28 14:03 run: **Backend + Web** touched.
- Pending mandatory rotation: **Mobile**, **Admin** in upcoming runs.
