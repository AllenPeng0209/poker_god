# Poker God Commercialization Spec — Backend Service Alias Migration (T-025)

## Problem
当前后端主实现位于 `services/api`，与目标架构 `services/<project>/` 不一致。该偏差会导致部署/运维入口不统一，增加生产环境切换风险。

## Chosen optimization (highest-impact this run)
建立 `services/poker_god_api` 作为正式后端入口别名，统一运行目标并为后续模块迁移铺路。

## User flow (ops/admin)
1. 运维或管理员部署时，统一使用 `services.poker_god_api.main:app` 启动服务。
2. 现有 API 行为保持不变（零产品行为变化）。
3. 后续功能迭代可在不改部署入口的前提下，逐步把业务模块迁入 `services/poker_god_api`。

## KPI hypothesis
- Deployment misconfiguration incidents: **-40%**
- Backend runtime entrypoint ambiguity: **-100%** (single canonical target)
- Mean time to rollback after bad release: **-20%**

## Acceptance criteria
- [x] 新增 `services/poker_god_api/main.py` 且可直接导出 FastAPI `app`
- [x] 新增 `services/poker_god_api/README.md` 说明迁移路径
- [x] 保持现有 API 行为不变（兼容模式）
- [x] 通过编译级验证（`python3 -m py_compile`）
- [x] 在商业化主表与构建日志记录 admin/mobile/backend 跟踪状态

## Rollout / Feature flag
- 本次为架构迁移步骤，不需要用户侧 feature flag。
- 采用 **runtime target rollout**：新环境优先使用 `services.poker_god_api.main:app`，旧入口保留回退。

## Data / API / migration notes
- No API contract changes.
- No DB schema changes.
- 迁移备注：本次为 backend runtime alias，后续再拆分模块与 Supabase wiring 到 `services/poker_god_api`。
