# 2026-03-01 Mobile EV Leak Hotspots Radar

## Background
Admin Web 已有 EV 漏点热点雷达，但移动端运营排查仍需回到桌面，导致漏点->作业投放决策延迟。

## User Flow
1. 运营/教练在移动端进入 Profile。
2. 打开 feature flag `EXPO_PUBLIC_MOBILE_EV_HOTSPOTS_V1=1`。
3. 查看 30 天 EV 漏点摘要：总手数、总 EV 损失、Top3 街道热点。
4. 点击「刷新 EV 热点」进行即时拉取。
5. 根据最高热点街道触发下一步作业设计（线性 drill / leak campaign）。

## KPI Hypothesis
- `mobile_ops_time_to_identify_biggest_ev_leak`: -30%
- `ev_hotspot_to_homework_launch_latency_mobile`: -25%
- `homework_attach_rate_mobile`: +1.5% ~ +2.3%

## Acceptance Criteria
- Mobile 提供 EV hotspots 卡片（feature flag 控制）
- 消费 `/api/admin/coach/ev-hotspots?windowDays=30`
- 覆盖 loading / error / success 展示
- 支持手动刷新
- TypeScript 编译通过

## Implementation Notes
- FE: `apps/mobile/src/screens/ProfileScreen.tsx`
- FE API boundary: `apps/mobile/src/features/play/services/evHotspotsApi.ts`
- Integration: `apps/mobile/src/features/play/views/RootTabView.tsx`

## Rollout / Feature Flag
- Flag: `EXPO_PUBLIC_MOBILE_EV_HOTSPOTS_V1`
- Phase 1: internal dogfood（10% 运营）
- Phase 2: 全量运营启用
- Rollback: 关闭 flag，回退到现有 profile 视图

## Migration / Architecture Alignment
- 本次仅移动端接入，核心计算仍在后端 Python API。
- 数据系统记录边界不变，继续以 Supabase 为 system of record。
- 后续继续推进 `services/api` -> `services/poker_god_api` 命名迁移。
