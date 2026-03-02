# T-033 产品包：Analytics Event Dedupe Guard（商业化埋点防重）

## 背景（本轮最高影响优化）
当前 AI coach / GTO 训练转化指标高度依赖 `/api/events`。移动端弱网重试与前端重复上报会放大 attach/completion 指标，造成运营决策偏差（高估投放效果、误判漏斗阻塞）。

本轮选择 **“事件去重 + 可观测返回”** 作为最高影响优化：先确保数据可信，再扩展 Admin/Mobile 运营看板。

## 用户流
1. Web/Mobile 继续调用 `POST /api/events`。
2. 客户端可传 `eventId`（推荐），后端优先按 `eventId` 去重；无 `eventId` 时按事件内容哈希去重。
3. API 返回 `accepted`（入库）与 `deduplicated`（被拦截重复）供客户端/运营观测。

## KPI 假设
- `campaign_attach_rate` 指标噪声下降 20%+（因重复事件被隔离）
- `ops_time_to_trust_funnel_data` -30%
- `false_positive_campaign_win_rate` -15%

## 验收标准
- [x] `/api/events` 支持幂等去重（eventId + 内容哈希双路径）
- [x] 返回 `deduplicated` 字段，便于前端/移动端追踪重试影响
- [x] Supabase migration 提供唯一索引（`event_fingerprint`）
- [x] 单测覆盖重复事件拦截

## 架构对齐
- FE：保持 `apps/web` + `apps/mobile` 通过 API 边界调用，不下沉业务逻辑
- BE：Python service（`services/api`，兼容向 `services/poker_god_api` 迁移）
- DB：Supabase（`pg_mvp_events`）

## 发布与回滚
- 发布：先执行 `services/api/sql/0003_pg_mvp_events_dedupe_guard.sql`，再部署 API。
- 回滚：若兼容性异常，保留 migration 字段但临时关闭客户端 `eventId`；后端已内置 fallback（无新列时退化为普通写入）。

## Feature flag / rollout
- 阶段1：仅后端开启，客户端无感；观察 `deduplicated` 比率。
- 阶段2：Web/Mobile 补传稳定 `eventId`（下一轮 Admin/Mobile 跟进项）。
