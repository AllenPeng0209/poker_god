# COMMERCIALIZATION_MASTER_TABLE

_Last updated: 2026-02-28 11:50 Asia/Shanghai_

| Idea ID | Track | Area Coverage (Web/Admin/Mobile/Backend) | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Notes |
|---|---|---|---|---|---|---|---|---|
| PG-001 | AI coach session memory + personalized homework loop | Web + Backend (Admin/Mobile pending) | In Progress | +8-15% D7 retention, +10% drill starts/session | M | Coach endpoints, analytics events | Unique: no prior persistent homework loop | Shipped earlier branch; pending durable storage + mobile entry |
| PG-002 | Analyze hands pagination + server-side filtering/perf hardening | Web + Backend | Done (MVP API contract) | -35% time-to-first-render, -60% payload size at scale | M | Analyze list contract, client pagination adoption | Not duplicate: prior analyze table lacked bounded query contract | Implemented in this run (`limit/offset/hasMore`) |
| PG-003 | Analyze mistake diagnosis -> AI homework bridge | Backend first; Web/Mobile/Admin integrations queued | In Progress | +12% homework attach rate, +8% weekly EV recovery completion | M | Summary endpoint + coach action binding | Unique: no existing cluster severity + homework suggestion API | Implemented summary API in this run |
| PG-004 | Mobile coach companion (homework push + quick drill launcher) | Mobile + Backend | Backlog | +5-10% mobile WAU study sessions | M/H | Mobile coach surface, push/notification integration | Not implemented in repo yet | Next mobile-focused run |
| PG-005 | Admin content pipeline QA gates (lesson readiness score) | Admin + Backend | Backlog | -25% content defect leakage | H | Admin console, lesson schema checks | Not duplicate (admin module currently missing) | Planned when admin surface lands |
