# ZENGTO Web Delivery Docs Index

## 1. 使用顺序（建议）

1. 产品范围：`tasks/prd-zengto-web-realtime-solver.md`
2. 信息架构与路由：`docs/web/ia-routing.md`
3. UI 规范：`docs/web/ui-spec.md`
4. API 合同：`docs/api/web-analysis-openapi.yaml`
5. 数据模型：`docs/data/web-schema.md`
6. 埋点方案：`docs/analytics/web-events.md`
7. 验收方案：`docs/testing/web-acceptance.md`
8. 环境部署：`docs/dev/web-env.md`
9. 迭代任务：`tasks/web-m0-m1-backlog.md`

## 2. 开发启动最小集合

若你今天就要开工，先看这 4 份：

- `tasks/prd-zengto-web-realtime-solver.md`
- `docs/web/ia-routing.md`
- `docs/api/web-analysis-openapi.yaml`
- `tasks/web-m0-m1-backlog.md`

## 3. 评审会建议议程

- Step 1：确认 M0/M1 边界（PRD + Backlog）
- Step 2：确认路由与页面状态机（IA）
- Step 3：确认接口字段（OpenAPI + Data Schema）
- Step 4：确认可上线标准（Testing + Analytics + Dev Env）

## 4. 维护规则

- PRD 变更后，必须同步更新：Backlog、OpenAPI、Acceptance
- 新增接口后，必须同步更新：OpenAPI、Data Schema、Analytics
- 发版前，必须核对：Acceptance 与埋点看板
- ZEN Chat 相关改动需同步：`/app/chat` 路由、`/api/zen/chat` 合同与埋点事件
