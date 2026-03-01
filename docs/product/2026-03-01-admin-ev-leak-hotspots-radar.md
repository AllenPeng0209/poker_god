# 2026-03-01 Admin EV Leak Hotspots Radar

## Problem
当前 Reports 页只有 tag 级 leak list，运营难以快速看到“哪条街/哪个位置正在吞 EV”，导致训练内容投放与复盘节奏偏慢。

## User Flow
1. Admin 打开 Reports 页面。
2. 在 `NEXT_PUBLIC_ADMIN_EV_HOTSPOTS_V1=1` 下看到 `Admin EV Leak Hotspots` 卡片。
3. 卡片读取 `/api/admin/coach/ev-hotspots?windowDays=7|30|90`。
4. Admin 先看 summary（总样本、总 EV 损失、最大泄漏街），再看 `byStreet` 排行。
5. 据此优先安排该街道的 line drill / homework campaign。

## KPI Hypothesis
- `ops_time_to_identify_biggest_ev_leak` 下降 35%~45%
- `coach_homework_targeting_precision` 提升 8%~12%
- `homework_completion_from_attach` 提升 1.5%~2.5%

## Acceptance Criteria
- Backend: 新增 `GET /api/admin/coach/ev-hotspots`，返回 byStreet/byPosition/summary。
- Web: Reports 新增 feature-flag 卡片展示 hotspot ranking。
- API 合同: web typed client 补齐 `getAdminEvHotspots`。
- Validation: Web typecheck + Web build + API build + Python py_compile 通过。
- Rollout: feature flag 默认关闭，先给 admin 小流量灰度。

## Rollout / Feature Flag
- Flag: `NEXT_PUBLIC_ADMIN_EV_HOTSPOTS_V1`
- 阶段:
  1) internal admin only（1-2 天）
  2) full admin rollout（指标稳定后）
- 回滚: 关闭 flag 即刻回退 UI；后端接口保留不影响主流程。

## Architecture Alignment
- FE: `apps/web` (Next.js) 只做展示。
- BE: Python API in `services/api`（后续迁移到 `services/poker_god_api`）。
- DB: Supabase `pg_mvp_analyzed_hands` 作为系统记录来源。
- 无前端业务逻辑越界。