# Feature Package: AI Coach Session Memory + Personalized Homework (MVP)

## 1) Problem / Opportunity
Current AI coach interactions are stateless and easily forgotten. Users get advice but no persistent, personalized follow-through task list, reducing repeat engagement and measurable learning outcomes.

## 2) User Flow
1. User asks AI Coach in any module (Study/Practice/Analyze/Reports).
2. Backend stores conversation snippets (module/mode/message).
3. Coach drawer fetches `GET /api/coach/conversations/:conversationId/homework`.
4. User sees:
   - memory summary (message count + dominant focus)
   - 1-3 personalized homework chips
5. User taps a homework chip to auto-send a structured prompt to coach and generate a drill/evaluation plan.

## 3) KPI Targets
- Primary: Coach-to-Drill conversion rate +10% (2-week target after rollout)
- Primary: D7 retention for users who used coach >=2 times +8%
- Secondary: Avg coach messages/session +15%
- Guardrail: Coach response latency impact < +100ms p95

## 4) Acceptance Criteria
- [x] Coach messages are persisted in server memory by `conversationId`.
- [x] Homework API returns memory summary + deterministic homework list.
- [x] Web coach drawer renders homework chips and supports click-to-continue workflow.
- [x] Existing coach chat flow remains functional if homework API fails (non-blocking).
- [x] Build passes for web app.

## 5) Engineering Scope
### Backend/API
- Added conversation tracking in `services/api/src/mvpStore.ts`.
- Added homework generation and memory summarization.
- Added endpoint:
  - `GET /api/coach/conversations/:conversationId/homework`

### Contracts/Data Model
- New contracts:
  - `CoachHomeworkItem`
  - `CoachConversationMemory`
  - `CoachHomeworkResponse`
- Extended `CoachActionType` with `create_homework_drill` for forward compatibility.

### Frontend (Web)
- `AICoachDrawer` now fetches and displays personalized homework.
- Homework chip click sends a pre-filled coaching request for drill generation.
- UI failure tolerance: homework widget silently degrades if endpoint errors.

## 6) Migration / Data Notes
- No DB migration required in this MVP (in-memory store).
- Production migration plan:
  1. Persist `coach_conversations` to Postgres.
  2. Add TTL and GDPR deletion workflow.
  3. Move heuristic homework generation to model-driven service.

## 7) Rollout / Feature Flag Plan
- Flag name: `coach_homework_v1`
- Phase 1: Internal/staging only (10% traffic)
- Phase 2: All web users
- Phase 3: Mobile surface parity
- Kill switch: disable homework fetch/render path; coach chat remains available.

## 8) Validation Notes
- Build validation: `npm --workspace @poker-god/web run build` ✅
- API Python build unaffected: `npm --workspace @poker-god/api run build` ✅
- Note: workspace originally lacked installed node modules; installed via `npm install` before validation.

## 9) Risks / Follow-ups
- In-memory storage loses history on restart (known).
- Homework quality currently heuristic; needs outcome feedback loop.
- Next hourly candidates:
  - Backend persistence + pagination for analyze data
  - Mobile homework quick actions
  - Admin lesson-to-homework linkage
