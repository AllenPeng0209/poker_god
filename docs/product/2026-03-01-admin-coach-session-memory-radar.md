# 2026-03-01 Admin Coach Session Memory Radar

## Problem / Highest-impact optimization this run
AI coach链路已有漏斗、归因和campaign投放，但缺少“会话记忆衰减”视角：运营无法快速识别哪些 coach 会话已经 stale 且 attach 率低，导致本应可回收的用户流失。

## User flow
1. Admin进入 Reports 页面，打开 `Admin Coach Session Memory Radar`（feature flag）。
2. 系统读取 `/api/admin/coach/session-memory?windowDays=30&limit=5`。
3. 卡片展示高风险会话（low attach + 高 stale hours）与推荐动作。
4. 运营根据推荐动作触发 recovery campaign / quick drill nudge。

## KPI hypothesis
- `coach_session_reactivation_rate`: +2.0% ~ +3.5%
- `coach_to_homework_attach_rate`: +1.2% ~ +2.0%
- `ops_time_to_identify_stale_coach_sessions`: -40%

## Acceptance criteria
- Backend提供 session-memory risk API，返回 summary + top session 风险队列。
- Web Reports页面有 feature-flag 卡片可视化风险与动作建议。
- 明确 mobile follow-up tracking（本轮占位，下一轮补齐）。
- build/typecheck/py_compile 通过。

## API contract
`GET /api/admin/coach/session-memory?windowDays=7|30|90&limit=1..100`

Response:
- `summary`: sessions/highRiskSessions/mediumRiskSessions/averageAttachRatePct/staleRiskRatePct
- `sessions[]`: sessionId/messageCount/actionCount/attachRatePct/staleHours/riskLevel/recommendedAction

## Rollout plan
- Phase 1: default off (`NEXT_PUBLIC_ADMIN_COACH_SESSION_MEMORY_V1=0`) + internal ops QA.
- Phase 2: open to admin cohort, observe risk distribution and false positive rate.
- Phase 3: link to campaign launcher for one-click reactivation.

## Migration notes
- No schema migration required in this run.
- Continues FE/BE split: UI in `apps/web`, logic in Python `services/api`, data source Supabase.
- Next migration step: move API service naming fully to `services/poker_god_api` and mirror same card in `apps/mobile`.
