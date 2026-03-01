# Admin Homework Priority Queue (T-012)

## Problem
Coach 已经能发作业，但运营端缺少“哪些作业马上要流失”的可执行队列，导致人工排查慢、提醒触达不准。

## User Flow
1. Admin 打开 Reports 页面（feature flag: `NEXT_PUBLIC_ADMIN_HOMEWORK_PRIORITY_QUEUE_V1=1`）。
2. 前端调用 `GET /api/admin/coach/homework-priority-queue?windowDays=30&limit=20`。
3. 后端基于 Supabase `pg_mvp_events` 聚合 `coach_action_executed -> drill_started -> drill_completed`。
4. 返回按风险排序的队列（P0/P1/P2、staleHours、riskScore、recommendedAction）。
5. Admin 优先处理 P0（高风险未启动/超时）用户，触发高优先提醒与人工跟进。

## KPI Hypothesis
- `homework_completion_from_attach` +2.5%（P0/P1优先处理）
- `stale_homework_risk_rate` -18%
- `ops_time_to_identify_at_risk_homework` -40%

## Acceptance Criteria
- [x] 后端提供优先队列 API（含 summary + item 级风险诊断）
- [x] 前端 Reports 增加受 feature flag 控制的 Admin queue 卡片
- [x] 风险分层具备明确运营动作建议（P0/P1/P2）
- [x] Typecheck / build / py_compile 通过
- [x] Mobile 跟踪占位在商业化主表记录（下一轮）

## Rollout Plan
- Phase 1: 内部运营灰度，开启 web feature flag。
- Phase 2: 观察 3 天 P0/P1 队列处理率与 completion uplift。
- Phase 3: 若提升>2%，扩展到 mobile 只读雷达卡并接入提醒自动化。

## Feature Flag
- Web: `NEXT_PUBLIC_ADMIN_HOMEWORK_PRIORITY_QUEUE_V1`
- Mobile (next): `EXPO_PUBLIC_MOBILE_HOMEWORK_PRIORITY_QUEUE_V1` (placeholder)

## Data / API / Migration Notes
- 数据来源：Supabase `pg_mvp_events`，无新增表结构。
- 本轮无 schema migration；若后续需要 SLA 审计可追加 `homework_priority_actions` 事件表。

## Rollback
- 关闭 web feature flag 即可回滚 UI。
- 后端 API 保持只读，不影响主业务链路。
