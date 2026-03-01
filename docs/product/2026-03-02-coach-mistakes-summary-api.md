# 2026-03-02 — Coach Mistakes Summary API (US-001)

## Why now (highest-impact optimization)
当前 Admin/Web/Mobile 都已有漏点雷达与聚类视图，但 **AI coach 侧缺少可直接消费的“漏点汇总 API”**，导致作业生成与漏点诊断之间缺少稳定契约。

本次优先补齐 backend API，给后续 Admin 投放入口与 Mobile 作业推荐提供统一 source-of-truth。

- 影响面：backend（本次实现）→ admin/mobile（下轮接入）
- 商业化价值：缩短“发现漏点 → 触发作业”的链路

## User flow
1. Coach/运营端请求 `GET /api/coach/mistakes/summary?windowDays=30&limit=5`
2. 服务端从 Supabase `pg_mvp_analyzed_hands` 聚合 `tags`（漏点 cluster）
3. 返回每个 cluster 的：样本量、平均/总 EV loss、Top streets、Top positions、推荐动作
4. 上层（Admin/Mobile/Agent）按返回结果生成作业与干预动作

## API contract
- Endpoint: `GET /api/coach/mistakes/summary`
- Query:
  - `windowDays`: 7/30/90（其他值回落为30）
  - `limit`: 1-20（内部保护）
- Response:
  - `totalHands`
  - `items[]`:
    - `cluster`
    - `sampleSize`
    - `averageEvLossBb100`
    - `totalEvLossBb100`
    - `topStreets[]`
    - `topPositions[]`
    - `recommendation`

## KPI hypothesis
- `coach_homework_attach_rate` +2.0% ~ +3.5%
- `mistake_to_homework_launch_latency` -25% ~ -35%
- `ops_time_to_prioritize_leak_cluster` -30%

## Acceptance criteria mapping (US-001)
- ✅ 提供 mistakes summary API
- 其他 US-001 条目（作业追溯、错误码、UI 验收）留在后续小时任务继续完成

## Rollout / feature flag plan
- 本次仅 backend，默认可用
- 下一轮在 `apps/web` 与 `apps/mobile` 各自受 feature flag 控制接入显示

## Migration notes
- 无新增表结构，复用 Supabase `pg_mvp_analyzed_hands`
- 若后续出现查询压力，新增 `played_at` + `tags` 复合索引作为迁移项

## Validation
- `PYTHONPATH=services/api python3 -m unittest -q services/api/tests/test_mistakes_summary.py`
- `python3 -m py_compile services/api/app/main.py services/api/app/services.py services/api/app/schemas.py`
