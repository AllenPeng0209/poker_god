# COMMERCIALIZATION_MASTER_TABLE

| Idea | Status | KPI Impact | Complexity | Dependencies | Track | Duplicate Check |
|---|---|---:|---|---|---|---|
| T-031 Homework lifecycle persistence API | Done | Attach + completion reliability baseline | M | Supabase homework table/index | Backend | Unique (lifecycle state machine) |
| T-032 Campaign readiness radar (this run) | Done | Campaign selection latency -30%, attach +1.0~2.2% | M | Existing leak report + web reports module | Admin/Web + Backend (mobile follow-up) | Unique (launch prioritization, not duplicate of leak list) |
| Mobile campaign readiness mirror card | Backlog | Mobile ops response time -20% | S | T-032 API stable for 1 cycle | Mobile | Not duplicate (new surface) |
