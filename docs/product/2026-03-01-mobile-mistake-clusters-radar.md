# 2026-03-01 Mobile Mistake Clusters Radar (T-022)

## Why now
当前 Admin 已有 mistake cluster 雷达，但移动端运营同学在通勤/临场无法快速看到“哪类漏点最值得推作业”。
本轮补齐 mobile 只读雷达，缩短从诊断到动作的闭环时间。

## User flow
1. 运营在移动端进入 Profile 页。
2. 若开启 `EXPO_PUBLIC_MOBILE_MISTAKE_CLUSTERS_V1=1`，显示 `Mistake Clusters Radar (Mobile)` 卡片。
3. 卡片调用 `GET /api/admin/coach/mistake-clusters?windowDays=30&limit=5`。
4. 展示 top clusters（占比、EV 损失、风险等级、建议 campaign）。
5. 运营可点击 Refresh 手动拉取最新结果。

## KPI hypothesis
- `mobile_ops_time_to_identify_top_mistake_cluster` -30%
- `mobile_campaign_launch_lead_time` -20%
- `homework_attach_rate_from_mobile_ops` +1.2%~2.0%

## Acceptance criteria (this run)
- [x] Mobile profile 新增 feature-flag mistake clusters 卡片
- [x] Mobile API boundary 独立封装（base URL + API key）
- [x] 卡片支持 loading / error / empty / success + 手动刷新
- [x] 保持 FE/BE 边界：前端仅展示，聚合逻辑在 backend API
- [x] TypeScript 校验通过

## Rollout / feature flag
- Flag: `EXPO_PUBLIC_MOBILE_MISTAKE_CLUSTERS_V1`
- Stage 1: internal ops dogfood (1 day)
- Stage 2: expand to full ops team if crash-free and payload sanity OK
- Rollback: set flag to `0` to hide card immediately

## Migration / data model notes
- No schema migration in this run (reuse existing `/api/admin/coach/mistake-clusters` and Supabase-backed aggregation).
- Continues architecture target: FE in `apps/mobile`, BE in Python service, data in Supabase.

## Validation
- `cd poker_god && npx tsc -p apps/mobile/tsconfig.json --noEmit`
