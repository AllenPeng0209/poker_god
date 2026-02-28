# 2026-02-28 Coach Admin Funnel (Commercialization Package)

## Problem
AI coach memory/homework logic exists, but operators cannot measure whether conversations are becoming homework-ready and theme coverage is concentrated on high-value leaks. Without admin telemetry, retention experiments are blind and hard to scale.

## Target user flow
1. User chats with AI coach in Study/Analyze/Practice context.
2. Backend stores conversation memory themes and message counts.
3. Admin opens Reports and sees **Coach Memory Funnel** card:
   - total conversations
   - active conversations in last 24h
   - homework-ready conversations (>= threshold messages + detected themes)
   - top leak themes by mentions and conversation spread
4. PM/ops uses funnel to tune prompts, homework templates, and lifecycle nudges.

## KPI hypothesis
- Primary KPI: `coach_homework_coverage_pct` (target +15pp after prompt + UX tuning)
- Secondary KPI: `coach_active_conversations_24h` (+20% WoW)
- Guardrail KPI: report API p95 latency < 250ms

## Acceptance criteria
- [x] `/api/admin/coach/memory-funnel` returns aggregate funnel metrics and top themes.
- [x] Reports page displays funnel metrics and top theme list.
- [x] Existing coach chat still updates memory and action recommendations.
- [x] Type contracts include admin funnel schema for web/backend alignment.

## Data / model / API changes
- Added API response model: `CoachAdminMemoryFunnelResponse`
- Added aggregate theme model: `CoachMemoryThemeAggregate`
- Added endpoint: `GET /api/admin/coach/memory-funnel?minMessages=2`
- Added web API client method: `getAdminCoachMemoryFunnel(minMessages)`

## Migration notes
- No DB migration required in v1 (in-memory coach memory store).
- v2 should persist per-conversation memory snapshots/events for restart-safe analytics and cohort segmentation.

## Rollout plan (feature-flagged)
- Flag: `COACH_ADMIN_FUNNEL_V1`
  - Stage 0: backend endpoint enabled in staging only
  - Stage 1: internal admin/report users only
  - Stage 2: default on for all operator roles
- Fallback: if funnel API fails, reports page still shows leak report section.

## Validation notes
- `python3 -m py_compile services/api/app/main.py services/api/app/services.py services/api/app/schemas.py`
- `npm run build:api`
- `npm run build:web`

## Explicit surface coverage tracking
- Backend: ✅ this run
- Admin/Web reports: ✅ this run
- Mobile: ⏳ pending (next run should add mobile coach homework/funnel summary widget)
