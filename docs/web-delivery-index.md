# ZENGTO Web Delivery Docs Index

## 1. 文档版本

- `V1`：早期 M0/M1（waitlist + analysis MVP）
- `V2`：GTOWizard 对标版（全模块 + AI 教练）

## 2. V2 阅读顺序（推荐）

1. 产品 PRD：`docs/web/gtowizard-clone-prd.md`
2. 课程 PRD：`docs/web/academy-texas-holdem-complete-course-prd.md`
3. IA 路由：`docs/web/ia-routing.md`
4. UI 规范：`docs/web/ui-spec.md`
5. 技术架构：`docs/web/gtowizard-clone-architecture.md`
6. 数据模型：`docs/web/gtowizard-clone-data-model.md`
7. API 合同：`docs/api/web-gtowizard-clone-openapi.yaml`
8. AI 教练：`docs/web/gtowizard-clone-ai-coach-spec.md`
9. 埋点实验：`docs/web/gtowizard-clone-analytics-experiments.md`
10. 测试计划：`docs/web/gtowizard-clone-test-plan.md`
11. 发布运维：`docs/web/gtowizard-clone-release-runbook.md`
12. 实施 Backlog：`docs/web/gtowizard-clone-backlog.md`

## 3. V2 最小开工集合

- `docs/web/gtowizard-clone-prd.md`
- `docs/web/ia-routing.md`
- `docs/web/ui-spec.md`
- `docs/api/web-gtowizard-clone-openapi.yaml`
- `docs/web/gtowizard-clone-backlog.md`

## 4. V1 历史文档（保留）

- `tasks/prd-zengto-web-realtime-solver.md`
- `tasks/web-m0-m1-backlog.md`
- `docs/api/web-analysis-openapi.yaml`
- `docs/data/web-schema.md`
- `docs/analytics/web-events.md`
- `docs/testing/web-acceptance.md`
- `docs/dev/web-env.md`

## 5. 维护规则

- V2 为当前主线，新增需求默认更新 V2 文档。
- 若发布仍依赖 V1 模块，需在 PR 中明确说明双版本影响。
- API 或 schema 变更必须同步更新对应测试和埋点文档。
