# T-020 Mobile Coach Campaign Recommendations Radar

## Context
Admin 端已经上线 campaign recommendation（T-019），但移动端运营/教练在现场无法查看同一套建议，导致投放决策仍被桌面端阻塞。

## User Flow
1. 运营在移动端进入 Profile 页面。
2. 当 `EXPO_PUBLIC_MOBILE_COACH_CAMPAIGN_RECO_V1=1` 时显示 `Campaign Recommendations (Mobile)` 卡片。
3. 默认加载 30 天窗口，可切换 7/30/90 天并手动刷新。
4. 卡片展示 baseline attach、projected attach、projected lift、highest impact stage、top recommendation。
5. 出错时展示明确错误码文本，方便排查 API / 权限问题。

## KPI Hypothesis
- `mobile_ops_time_to_campaign_decision`: -30% ~ -40%
- `coach_action_attach_rate_mobile`: +1.5% ~ +2.8%
- `drill_completion_from_coach_mobile`: +1.0% ~ +2.0%

## Acceptance Criteria
- [x] Mobile 端新增 feature-flag 卡片并可手动刷新
- [x] 消费后端 `GET /api/admin/coach/campaign-recommendations`，仅做展示，不下沉业务逻辑
- [x] 支持 loading / error / success 三态
- [x] 支持 windowDays=7/30/90 切换
- [x] TypeScript 校验通过

## Rollout / Feature Flag
- Flag: `EXPO_PUBLIC_MOBILE_COACH_CAMPAIGN_RECO_V1`
- Plan:
  - 10% 内部运营账号
  - 50% 教练团队
  - 100% 全量（48h 无错误峰值）
- Kill switch: 关闭该 flag 即可回滚 UI 暴露

## Architecture Alignment
- Frontend: `apps/mobile`（React Native）
- Backend: Python API `services/api`（后续迁移到 `services/poker_god_api`）
- Data source: Supabase（通过后端 API 聚合）
- FE/BE boundary maintained: 移动端不实现 campaign 计算逻辑，仅消费 API

## Validation
- `cd poker_god && npx tsc -p apps/mobile/tsconfig.json --noEmit`
