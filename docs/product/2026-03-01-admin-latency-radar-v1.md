# Admin Latency Radar V1 (T-006)

## Problem
运营侧缺少按路由的延迟可视化，出现 p95 波动时只能靠日志全文检索，定位慢接口耗时高。

## User Flow
1. Admin 打开 Reports 页面。
2. 若 `NEXT_PUBLIC_ADMIN_OPS_LATENCY_V1=1`，显示 `Admin Latency Radar` 卡片。
3. 前端请求 `GET /api/admin/ops/latency`。
4. 卡片展示 top p95 routes 及 count/avg/p50/p95/max。
5. Admin 根据慢路由回跳后端日志或发布节流策略。

## Scope (this run)
- Backend: `/api/*` 响应头注入 `X-Response-Time-Ms` + `Server-Timing`；新增 `GET /api/admin/ops/latency`。
- Frontend (web): Reports 页面新增 feature-flagged latency radar。
- Mobile: 本轮仅做 backlog 跟踪，不改动代码。

## KPI Hypothesis
- `admin_latency_regression_detection_time`: -40%
- `ops_time_to_identify_slow_route`: -35%
- `p95_spike_blind_window`: -30%

## Acceptance Criteria
- [x] `/api/*` 响应含 latency headers。
- [x] 后端可输出按路由 latency 聚合统计。
- [x] Web 端 feature flag 生效并可展示 top p95 routes。
- [x] 构建验证通过（web typecheck/build + api build/py_compile）。
- [x] 在产品主表登记 admin/mobile/backend 跨端跟踪状态。

## Rollout / Feature Flag
- Flag: `NEXT_PUBLIC_ADMIN_OPS_LATENCY_V1`
- Rollout:
  1. staging 开启并观察 24h；
  2. 仅 admin 账号灰度；
  3. 全量开启并纳入每周运维复盘。
- Rollback: 关闭 flag（前端立刻隐藏），后端接口保留供脚本化巡检。

## Architecture / Migration Notes
- FE/BE split 遵循：web in `apps/web`，backend in Python `services/api`。
- 下一步迁移：将 `services/api` 归档到 `services/poker_god_api` 完成命名对齐。
- DB 仍由 Supabase 承担 system-of-record，本次 telemetry 为内存采样，不新增持久化表。
