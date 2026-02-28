# 2026-03-01 Mobile Coach Funnel Radar (Profile)

## Why this is highest impact now
当前商业化最核心漏斗是 `coach_message_sent -> coach_action_executed -> drill_started -> drill_completed`。
Admin 端已有漏斗雷达，但移动端（教练和训练主要触点）缺少同视角，导致运营和产品在移动场景定位流失慢一拍。

## User Flow
1. 运营/测试在移动端打开 Profile。
2. 打开 feature flag `EXPO_PUBLIC_MOBILE_COACH_FUNNEL_V1=1` 后可见 `Coach Funnel Radar (Mobile)` 卡片。
3. 卡片读取 `/api/admin/coach/funnel?windowDays=30`。
4. 显示 attach rate、completion rate、阶段会话量、阶段转化、最大流失节点。
5. 可手动点击 Refresh funnel 拉最新数据。

## KPI Targets
- `mobile_dropoff_detection_time` 下降 30%
- `coach_to_homework_attach_rate` +2%（更快发现 attach 流失）
- `homework_completion_from_attach` +1.5%

## Acceptance Criteria
- [x] Mobile 端新增 feature-flag 卡片，默认关闭。
- [x] 通过 API boundary 消费后端漏斗接口，不在前端实现业务计算。
- [x] 支持 loading/error/empty/success 四态。
- [x] 提供手动刷新能力。
- [x] TypeScript 校验通过（`npx tsc -p apps/mobile/tsconfig.json --noEmit`）。

## Rollout / Feature Flag Plan
- Phase 1: 内部灰度（仅测试账号 + flag 打开）
- Phase 2: 运营账号全开，观察 3 天
- Phase 3: 默认开启（若错误率 <1%，且 KPI 出现正向变化）

## Architecture Alignment
- FE: `apps/mobile`（React Native）
- BE: Python service `services/api` 暴露 `/api/admin/coach/funnel`
- DB: Supabase（漏斗事件系统记录）
