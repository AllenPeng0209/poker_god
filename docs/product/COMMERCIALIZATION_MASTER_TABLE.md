# COMMERCIALIZATION_MASTER_TABLE

_Last updated: 2026-02-28 11:30 Asia/Shanghai_

| Idea ID | Track | Area Coverage (Web/Admin/Mobile/Backend) | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Notes |
|---|---|---|---|---|---|---|---|---|
| PG-001 | AI coach session memory + personalized homework loop | Web + Backend (Admin/Mobile pending follow-ups) | In Progress (implemented MVP API + UI chips) | +8-15% D7 retention of active learners, +10% drill starts/session | M | Coach endpoints, drawer UI, analytics event hooks | Unique vs existing generic coach chat; no existing homework generator in repo | Highest-impact this run: convert one-off chat into repeatable coaching loop |
| PG-002 | Analyze hands pagination + server-side filtering perf hardening | Backend + Web | Backlog | -30% p95 hand-list latency on large uploads | M | analyze API contract extension | Not duplicate of current filters (adds pagination + bounded payload) | Candidate for next backend-focused run |
| PG-003 | Mobile coach companion (homework push + quick drill launcher) | Mobile + Backend | Backlog | +5-10% mobile weekly active study sessions | M/H | mobile app coach surface, notification channel | Not implemented on mobile currently | Keeps area coverage rotation honest |
| PG-004 | Admin content pipeline QA gates (lesson readiness score) | Admin + Backend | Backlog | -25% content defect leakage, +faster publishing cadence | H | admin console, lesson schema checks | No admin module exists yet in codebase; greenfield | Needed before paid cohort scaling |
