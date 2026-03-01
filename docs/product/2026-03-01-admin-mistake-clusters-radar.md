# 2026-03-01 Admin Mistake Clusters Radar (Web + API)

## Problem
Admin 端缺少「哪类错误最该先投放作业」的可执行视图，运营只能看泛化 leak report，无法直接对齐 AI coach 作业投放优先级。

## User Flow
1. Admin 打开 Reports 页（`apps/web`）并切换 `windowDays`（7/30/90）。
2. 当 `NEXT_PUBLIC_ADMIN_MISTAKE_CLUSTERS_V1=1` 时，看到 `Admin Mistake Clusters Radar` 卡片。
3. 前端调用 `GET /api/admin/coach/mistake-clusters?windowDays=<n>&limit=5`。
4. 后端基于 Supabase `pg_mvp_analyzed_hands` 聚合：
   - cluster share（标签占比）
   - avg EV loss
   - repeat session rate
   - risk level 与建议 campaign
5. Admin 按 high-risk cluster 优先投放 `homework_recovery / quick_drill / coach_nudge`。

## KPI Hypothesis
- `ops_time_to_homework_campaign_decision`: -35%
- `homework_attach_rate_from_admin_campaign`: +2.0% ~ +3.2%
- `high_risk_cluster_repeat_rate_7d`: -10%

## Acceptance Criteria
- [x] 新增 backend API: `/api/admin/coach/mistake-clusters`
- [x] Web feature-flag 卡片可视化高风险 cluster
- [x] 输出可执行 campaign 建议（quick_drill/homework_recovery/coach_nudge）
- [x] Typecheck/build 通过
- [ ] Mobile 端同视图（下一轮 T-022）

## Rollout / Feature Flag
- Web flag: `NEXT_PUBLIC_ADMIN_MISTAKE_CLUSTERS_V1=1`
- Rollout: internal admin only -> 50% ops -> 100%
- Rollback: 关闭 feature flag 即可前端回滚；后端 API 保留只读无副作用

## Architecture Alignment
- Frontend: `apps/web`（Next.js）
- Backend: Python API (`services/api`，后续迁移到 `services/poker_god_api`)
- Database: Supabase (`pg_mvp_analyzed_hands`) as source of truth
- FE/BE API boundary maintained; no business scoring in frontend.

## Migration Notes
- 本次无需 schema migration（复用现有 `pg_mvp_analyzed_hands`）
- 迁移步骤保持：后续将 API 入口从 `services/api` 收敛到 `services/poker_god_api`
