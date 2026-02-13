# ZENGTO Web M0/M1 Backlog

## 1. 目标

将 PRD 拆解为可执行任务，覆盖 M0（Coming Soon）与 M1（Analysis MVP），用于排期与协作。

## 2. 优先级定义

- P0：不上线不行
- P1：强烈建议上线
- P2：可延期

## 3. 里程碑节奏

- Sprint A（1-2 周）：M0
- Sprint B（2-4 周）：M1 基础链路
- Sprint C（4-6 周）：M1 稳定性与体验增强

## 4. M0 Backlog（Coming Soon + Waitlist）

| ID | 任务 | 优先级 | Owner | 预估 | 依赖 | 验收标准 |
|---|---|---|---|---|---|---|
| M0-001 | 初始化 Web 框架（Next.js + TS + ESLint） | P0 | FE | 1d | 无 | 本地可启动，CI 可 build |
| M0-002 | 搭建页面骨架（左导航 + 中央区） | P0 | FE | 1.5d | M0-001 | 与 UI Spec 结构一致 |
| M0-003 | 实现 Coming Soon 主屏 | P0 | FE | 1d | M0-002 | 大标题与流程文案可见 |
| M0-004 | 实现 Waitlist 表单 UI（弹窗/独立页） | P0 | FE | 1d | M0-002 | 可输入邮箱并提交 |
| M0-005 | 实现 `POST /web/waitlist` API | P0 | BE | 1.5d | 数据表 | 返回 201/409/422 |
| M0-006 | 建立 waitlist 数据表与索引 | P0 | BE | 0.5d | 无 | 迁移脚本可执行 |
| M0-007 | 接入 waitlist 提交链路 | P0 | FE/BE | 1d | M0-004/M0-005 | 提交成功与失败提示完整 |
| M0-008 | 埋点 SDK 封装与核心事件接入 | P0 | FE/Data | 1d | M0-002 | 事件可在看板查询 |
| M0-009 | 404/500 页面与路由守卫 | P1 | FE | 0.5d | M0-001 | 异常页可回首页 |
| M0-010 | M0 验收与问题修复 | P0 | QA/FE/BE | 1d | 前序完成 | P0 用例全通过 |

## 5. M1 Backlog（Analysis MVP）

| ID | 任务 | 优先级 | Owner | 预估 | 依赖 | 验收标准 |
|---|---|---|---|---|---|---|
| M1-001 | 新建分析页 `/app/analysis/new` | P0 | FE | 1d | M0-001 | 可输入并触发提交 |
| M1-002 | 定义并实现 `POST /analysis/jobs` | P0 | BE | 1.5d | OpenAPI | 返回 job_id + queued |
| M1-003 | 定义并实现 `GET /analysis/jobs/:id` | P0 | BE | 1d | M1-002 | 可查询状态与结果 |
| M1-004 | 定义并实现 `GET /analysis/jobs` 历史 | P0 | BE | 1d | 数据表 | 分页可用 |
| M1-005 | 分析任务状态机与进度条 UI | P0 | FE | 1d | M1-002/M1-003 | queued/processing/success/fail 可视化 |
| M1-006 | 结果卡片（动作/理由/图表） | P0 | FE | 1.5d | M1-003 | 推荐动作与理由展示完整 |
| M1-007 | 失败重试 `POST /analysis/jobs/:id/retry` | P1 | FE/BE | 1d | M1-003 | retryable 错误可重试 |
| M1-008 | 历史列表页 `/app/history` | P1 | FE | 1d | M1-004 | 可查看最近 N 条 |
| M1-009 | AI 设置页 `/app/settings/ai` | P1 | FE/BE | 1d | settings API | 修改后生效 |
| M1-010 | 任务事件日志与可观测性 | P0 | BE/SRE | 1d | M1-002 | 可定位失败原因 |
| M1-011 | 埋点补齐（submit/success/fail/retry） | P0 | FE/Data | 0.5d | M1-001~006 | 漏斗可计算 |
| M1-012 | 性能优化与加载体验 | P1 | FE | 1d | 主链路稳定 | 首屏 <=3s |
| M1-013 | M1 综合验收 | P0 | QA | 1d | 全部任务 | P0 100% 通过 |
| M1-014 | ZEN Chat 页面 `/app/chat`（会话 + 建议问题 + 连续对话） | P0 | FE | 1.5d | M0-002 | 可连续发送并展示回复 |
| M1-015 | ZEN Chat 接口 `POST /api/zen/chat`（含 fallback） | P0 | BE | 1d | OpenAPI | 返回 reply + suggestions + provider |
| M1-016 | ZEN Chat 埋点（submit/response/error） | P1 | FE/Data | 0.5d | M1-014/M1-015 | 会话链路可观测 |

## 6. 依赖清单

- API 合同：`docs/api/web-analysis-openapi.yaml`
- 数据模型：`docs/data/web-schema.md`
- IA/路由：`docs/web/ia-routing.md`
- UI 规范：`docs/web/ui-spec.md`
- 验收标准：`docs/testing/web-acceptance.md`

## 7. 风险与缓解

- Solver 耗时不可控 -> 加进度条 + 超时提示 + 重试
- Prompt 解析失败率高 -> 增加输入模板与字段补全
- 前后端并行错位 -> 先 Mock contract test，再联调
- 埋点晚接入 -> 要求 P0 功能开发时同步埋点

## 8. Definition of Done

每个 backlog 项目完成标准：

- 代码合并到主分支
- 单测/集成测试通过
- 验收用例通过
- 埋点与日志可观测
- 文档同步更新

## 9. 建议执行顺序（最小可用）

1. 先完成 M0-001 到 M0-008，确保可对外展示与收集线索。
2. 再完成 M1-014 和 M1-015，先打通 ZEN Chat 独立价值链路。
3. 然后完成 M1-001 到 M1-006，打通分析主链路。
4. 最后补 M1-007 到 M1-013 与 M1-016，提升稳定性和可运营性。
