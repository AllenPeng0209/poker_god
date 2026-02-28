# COMMERCIALIZATION_MASTER_TABLE

_Last updated: 2026-02-28 12:28 Asia/Shanghai_

| Idea ID | Track | Area Coverage (Web/Admin/Mobile/Backend) | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Notes |
|---|---|---|---|---|---|---|---|---|
| PG-001 | AI coach session memory + personalized homework loop | Web + Backend (Admin/Mobile pending) | In Progress | +8-15% D7 retention, +10% drill starts/session | M | Coach endpoints, analytics events | Unique: persistent coach memory not shipped in mainline | Needs durable memory store + admin controls |
| PG-002 | Analyze hands pagination + contract hardening | Web + Mobile + Backend | In Progress | -35% TTFR, -60% payload size | M | Analyze list query contract | Unique: adds bounded pagination metadata in contract | Implemented this run |
| PG-003 | Analyze mistake summary + coach homework suggestions | Web + Mobile + Backend | In Progress | +10-12% homework attach/start rate | M | Summary endpoint + coach drill action | Unique: no existing structured mistake summary in mainline | Implemented this run |
| PG-004 | Admin leak-ops overview (trend + campaign recommendation) | Admin + Backend | In Progress | -30% time-to-intervention for leak campaigns | M | Admin dashboard API integration | Unique: first admin decision endpoint for leak commercialization | API shipped; admin UI pending |
| PG-005 | Content/lesson pipeline QA and release gates | Admin + Backend | Backlog | -25% lesson defect leakage | H | Content schema + moderation workflows | Not duplicate; no release-gate system yet | Schedule after admin shell lands |
| PG-006 | Production observability for coach/analyze endpoints | Admin + Backend | Backlog | -40% MTTR, +99.9% API reliability target | M/H | Metrics stack + alerting + SLO policy | Not duplicate; current MVP has no durable telemetry | Tie to rollout of PG-002/003 |
