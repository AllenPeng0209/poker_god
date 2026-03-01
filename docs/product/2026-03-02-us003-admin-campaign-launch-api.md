# 2026-03-02 — US-003 Admin投放入口（Campaign Launch API + Flagged Web Entry）

## Why this is highest impact now
- 当前后台已有漏点诊断与推荐，但缺少**可执行投放动作入口**，运营无法从洞察直接转化为投放执行。
- 本次补齐 `Admin -> Campaign Create -> Audit` 主路径，缩短从诊断到触达的 lead time。

## Scope (this run)
- **Backend (Python):** `POST /api/admin/coach/campaigns`
- **Database (Supabase):** `pg_mvp_coach_campaigns` 持久化表 + 索引（migration）
- **Frontend (Next.js):** `ReportsWorkbench` 增加 feature-flag 控制的投放入口
- **Mobile:** 本轮不改，明确追踪后续补 `apps/mobile` 只读/创建入口

## User flow
1. Admin 在 Reports 页面打开 `Admin Coach Campaign Launch (Flagged)` 卡片（flag on）。
2. 填写 campaign name + target cluster，点击 `Launch now`。
3. Web 调用 `POST /api/admin/coach/campaigns`。
4. Backend 写入 Supabase `pg_mvp_coach_campaigns`，返回 `campaignId/status/audit fields`。
5. 前端显示成功状态并写入 `coach_action_executed` 事件。

## API contract
- Request: `campaignName`, `targetCluster`, `channel`, `sourceWindowDays`, `expectedAttachLiftPct`, `createdBy`, `notes?`, `launchNow?`
- Response: `campaign`（含 `status`, `createdBy`, `createdAt`, `launchedAt`）

## Acceptance criteria mapping
- [x] 提供 campaign 创建 API
- [x] 前端入口受 feature flag 控制（`NEXT_PUBLIC_ADMIN_COACH_CAMPAIGN_LAUNCH_V1`）
- [x] 记录审计字段（`created_by`, `created_at`, `status`, `launched_at`, `notes`）
- [x] Typecheck/lint/tests pass（见验证）
- [ ] UI 实操截图/录屏（当前 cron run 未接入浏览器录制，后续补）

## KPI hypothesis
- `diagnosis_to_campaign_launch_lead_time` -35%
- `ops_campaign_execution_rate` +15%
- `coach_homework_attach_rate` +2%~4%（通过更快投放闭环）

## Rollout / feature flag
- Web flag: `NEXT_PUBLIC_ADMIN_COACH_CAMPAIGN_LAUNCH_V1=1`
- 默认关闭，灰度给运营管理员。
- 回滚：关闭 flag + 停止调用 API，后端 endpoint 可保留不暴露。

## Migration notes
- 新增 `services/api/sql/0003_pg_mvp_coach_campaigns.sql`
- 生产部署先执行 migration，再开启前端 flag。

## Validation notes
- `PYTHONPATH=services/api services/api/.venv/bin/python -m unittest -q services/api/tests/test_admin_campaign_create.py`
- `services/api/.venv/bin/python -m py_compile services/api/app/main.py services/api/app/services.py services/api/app/schemas.py`
- `npm --workspace @poker-god/web run typecheck`
