# Feature Package: AI Coach Conversation Memory + Homework Loop (v1)

## Why this is the highest-impact optimization this hour
Current AI coach responses are stateless per turn. That limits perceived personalization, repeat-session retention, and conversion to paid study behavior.

This package adds a lightweight memory layer that turns repeated leak themes into personalized homework prompts in the coach drawer.

## User flow
1. User chats with AI coach about hands/leaks.
2. Backend updates per-conversation memory themes (e.g., river decisions, sizing, c-bet structure).
3. Coach response references top homework recommendation.
4. Web coach drawer fetches conversation memory and shows “Homework” quick actions.
5. User taps homework chip to continue focused coaching.

## KPI hypothesis
- +12% coach D1 return rate (users who open coach again within 24h)
- +18% homework-start rate (chat sessions that trigger follow-up study action)
- -20% time-to-first-action from coach panel open (via one-tap homework chips)

## Acceptance criteria
- `GET /api/coach/conversations/{conversationId}/memory` returns deterministic memory payload.
- `POST /api/coach/chat` updates conversation memory counts every valid user message.
- Coach action section references personalized homework title/reason.
- Web coach drawer renders top homework chips and can send them as prompts.
- No DB migration required for v1 (in-memory store only); API schema is backward-compatible.

## Data / model / API notes
- Added response model: `CoachConversationMemoryResponse`
- Added nested models: `CoachMemoryTheme`, `CoachHomeworkTask`
- New endpoint: `GET /api/coach/conversations/{conversationId}/memory`
- `coach_chat` now enriches response from memory-derived homework.

## Migration notes
- **DB migration:** none in v1 (ephemeral memory).
- v2 recommendation: persist memory snapshots to Supabase for cross-instance continuity.

## Validation notes
- Build check: `npm run build:api`
- Syntax check: `python3 -m py_compile services/api/app/main.py services/api/app/services.py services/api/app/schemas.py`
- Manual API smoke:
  1. POST `/api/coach/chat` with repeated “river/sizing/range” terms
  2. GET `/api/coach/conversations/{id}/memory`
  3. Verify theme counts + homework ranking

## Rollout / feature flag
- Suggested env flag for next run: `COACH_MEMORY_HOMEWORK_V1=true`
- Current rollout: soft launch (always on in non-persistent memory mode)
- Rollback: remove drawer memory fetch + route exposure, keep chat baseline behavior.
