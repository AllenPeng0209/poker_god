# Feature Package: AI Coach Session Memory + Personalized Homework

## Problem / Highest-Impact Optimization (This Run)
Current AI coach responses are stateless and generic. Users cannot feel continuity across a study session, which weakens trust, lowers drill conversion, and hurts retention.

**Optimization chosen:** add lightweight session memory + leak tagging + KPI-bound homework generation in the chat response path.

Why this is highest impact now:
- **Product:** immediately increases perceived coach quality and stickiness.
- **Engineering:** small-scope backend change (in-memory map) with no migration risk.
- **Commercialization:** enables measurable loop: coach answer -> homework -> drill follow-through.

## User Flow
1. User asks strategy question in AI Coach drawer.
2. Backend detects leak signals from text (e.g., over-fold/missed-value/size mismatch).
3. Backend updates session memory (module hint, stack hint, leak score trend).
4. Backend returns:
   - normal strategy reply,
   - memory summary,
   - personalized homework tasks with KPI targets.
5. Frontend shows memory summary + homework as system cards in chat feed.

## KPI Targets
- Coach-to-drill conversion +8% (7-day rolling).
- D1 coach re-engagement +5%.
- Avg coach session length +10%.
- Homework acceptance click-through (future action button metric) >= 25%.

## Acceptance Criteria
- [x] Chat response includes `memorySummary` when available.
- [x] Chat response includes `homework[]` (1-3 tasks) with KPI field.
- [x] Leak detection influences homework theme.
- [x] Frontend renders summary/homework in drawer without crashing existing flow.
- [x] No DB migration required for this version.

## API / Data Notes
- Contract update: `ZenChatResponse` now supports
  - `memorySummary?: string`
  - `leakSignals?: ZenCoachLeakSignal[]`
  - `homework?: ZenCoachHomeworkTask[]`
- Data storage: process memory map keyed by `sessionId`.
- Migration: none (ephemeral memory by design for v1).

## Validation Notes
- Typecheck/build should pass for API + web workspaces.
- Manual validation:
  - Send multiple coach messages in same session.
  - Confirm memory summary evolves.
  - Confirm homework changes with different leak keywords.

## Rollout / Feature Flag
- Soft rollout via existing endpoint (`/api/zen/chat`) with additive fields only.
- No breaking change for older clients.
- Optional future env flag: `ZEN_HOMEWORK_ENABLED` (not required in this patch).

## Risks
- Heuristic leak tagging may overfit noisy text.
- In-memory storage resets on deploy/restart.

## Next Step
Add explicit homework action execution events (accept/skip/complete) and persistence in DB for long-term personalization.
