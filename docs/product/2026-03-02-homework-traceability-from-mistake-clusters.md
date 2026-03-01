# 2026-03-02 Feature Spec — Coach Homework Traceability from Mistake Clusters

## Why now (highest-impact optimization)
当前商业化闭环里，`mistakes summary -> coach homework` 缺少可追溯链路，运营无法判断作业是否真正命中高EV损失cluster，导致投放复盘和迭代效率受限。

本次优化聚焦 **US-001 / 作业生成可追溯到漏点cluster**：在后端把作业（drill）与漏点来源建立明确 lineage，支持后续 admin/mobile 展示与转化归因。

## User flow
1. Admin/Coach 从 `/api/coach/mistakes/summary` 选中高优先级 cluster（例如 `over_bluff`）。
2. 调用 `POST /api/coach/actions/create-drill` 创建作业时，携带来源字段：
   - `mistakeCluster`
   - `sourceWindowDays`
   - `sourceSampleSize`
   - `sourceTotalEvLossBb100`
3. 后端落库到 `pg_mvp_drills` 并回传 `drill.traceability`。
4. 后续 Admin/Mobile 可据此做「作业来源解释 + ROI 回看 + campaign 对比」。

## KPI hypothesis
- `homework_attach_rate_from_targeted_cluster` +2.0% ~ +3.0%
- `time_to_explain_homework_origin` -60%
- `ops_campaign_postmortem_latency` -35%

## Acceptance criteria (this run)
- [x] 作业创建支持 mistake cluster trace 字段写入与返回
- [x] 返回结构包含 `drill.traceability`，可被 FE 直接消费
- [x] Supabase migration 提供字段与索引
- [x] 单元测试覆盖 traceability 持久化与响应映射

## API/Model changes
- `CoachCreateDrillRequest` 新增可选字段：
  - `mistakeCluster`
  - `sourceWindowDays`
  - `sourceSampleSize`
  - `sourceTotalEvLossBb100`
- `Drill` 新增 `traceability`：
  - `mistakeCluster`
  - `sourceWindowDays`
  - `sourceSampleSize`
  - `sourceTotalEvLossBb100`

## Rollout & feature flag
- 本次为 backend contract 增量，向后兼容（字段均为可选）。
- Admin/Mobile UI 展示将在后续通过 feature flag 分步开启：
  - Web: `NEXT_PUBLIC_ADMIN_HOMEWORK_TRACEABILITY_V1`
  - Mobile: `EXPO_PUBLIC_MOBILE_HOMEWORK_TRACEABILITY_V1`

## Migration / rollback
- Migration: `services/api/sql/0004_pg_mvp_drills_traceability.sql`
- 回滚：若出现异常，可仅停用前端 traceability 显示，旧写入路径仍可运行；必要时删除新增列（需评估历史数据保留）。

## Validation notes
- `PYTHONPATH=services/api python3 -m unittest -q services/api/tests/test_coach_homework_traceability.py`
- `PYTHONPATH=services/api python3 -m unittest -q services/api/tests/test_mistakes_summary.py`
- `python3 -m py_compile services/api/app/main.py services/api/app/services.py services/api/app/schemas.py`
