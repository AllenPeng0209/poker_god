# PRD: ZENGTO Web GTOWizard Clone（M1 学习闭环）

## 1. Introduction/Overview

本 PRD 定义 ZENGTO Web 对标 GTOWizard 的 M1 范围：先完成最小可验证学习闭环 `Study -> Practice -> Analyze -> Reports`，并在每个核心页面挂载统一 AI Coach 侧栏。

目标不是一次性覆盖全部模块，而是优先交付可持续迭代的闭环，确保用户可以从策略学习进入训练，再回到复盘与报告。

## 2. Goals

- 在单次会话内支持完成至少一次完整闭环：学习节点 -> 生成训练 -> 完成训练 -> 上传并查看复盘结果。
- 上线可执行的 AI Coach 动作能力（创建 Drill、创建周计划），且输出遵循统一协议。
- 将核心流程事件接入埋点，支持后续增长与留存分析。
- 所有 M1 用户故事可被 Ralph 单轮独立完成，避免超大 Story。

## 3. User Stories

### US-001: 建立 M1 页面与路由骨架
**Description:** As a learner, I want a clear M1 navigation skeleton so that I can move between Study/Practice/Analyze/Reports quickly.

**Acceptance Criteria:**
- [ ] 新增或确认以下路由可访问：`/app/study`、`/app/practice`、`/app/analyze`、`/app/reports`、`/app/ai-coach/history`。
- [ ] 顶部导航高亮与当前路由一致。
- [ ] 未实现功能显示明确占位态与后续入口说明。
- [ ] Typecheck/lint passes。
- [ ] Verify in browser using dev-browser skill。

### US-002: Study Spot 列表与过滤器
**Description:** As a learner, I want to filter spots by format/position/stack so that I can quickly find relevant study scenarios.

**Acceptance Criteria:**
- [ ] 提供 Spot 列表数据结构（包含 `format`、`position`、`stack_bb`、`street`）。
- [ ] Study 页面支持 `Format`、`Position`、`Stack` 三类过滤器。
- [ ] 过滤条件变化后，列表结果与计数实时更新。
- [ ] Typecheck/lint passes。
- [ ] Verify in browser using dev-browser skill。

### US-003: Study 节点详情与视图切换
**Description:** As a learner, I want Strategy/Ranges/Breakdown views so that I can understand both frequencies and EV context.

**Acceptance Criteria:**
- [ ] 节点详情支持 `Strategy`、`Ranges`、`Breakdown` 三个 tab。
- [ ] 每个 tab 至少展示一个结构化指标（如频率分布、EV 值、行动拆解）。
- [ ] 节点切换时保持 UI 状态稳定，不出现空白闪烁。
- [ ] Typecheck/lint passes。
- [ ] Verify in browser using dev-browser skill。

### US-004: Study 一键创建 Drill
**Description:** As a learner, I want to create a drill from the current node so that I can immediately convert theory into practice.

**Acceptance Criteria:**
- [ ] 节点详情提供“创建 Drill”按钮。
- [ ] 点击后调用 `trainer.create_drill`（或等价后端接口）并返回 drill id。
- [ ] 成功后提供可点击跳转到 Practice 的反馈状态。
- [ ] 失败时展示错误信息与可重试入口。
- [ ] Typecheck/lint passes。
- [ ] Verify in browser using dev-browser skill。

### US-005: Drill 数据模型与 CRUD
**Description:** As a developer, I want a drill domain model and CRUD APIs so that study/analyze/coach can reuse the same training object.

**Acceptance Criteria:**
- [ ] 定义 `drills` 与 `drill_items` 核心字段并完成接口契约。
- [ ] 提供 Drill 的创建、读取、删除（或归档）能力。
- [ ] `source_type` 支持 `study|analyze|coach|manual`。
- [ ] Typecheck/lint passes。
- [ ] Tests pass。

### US-006: Practice 会话生命周期与评分接口
**Description:** As a learner, I want session start/submit/finish APIs so that my training quality can be measured consistently.

**Acceptance Criteria:**
- [ ] 提供 `start session`、`submit answer`、`finish session` 接口。
- [ ] 会话结果至少包含 `ev_loss`、`frequency_gap`、`decision_time_ms` 聚合结果。
- [ ] 同一 session 的提交顺序可追踪，重复提交有防重策略。
- [ ] Typecheck/lint passes。
- [ ] Tests pass。

### US-007: Practice 训练题面与即时反馈
**Description:** As a learner, I want immediate per-hand feedback so that I can correct mistakes while training.

**Acceptance Criteria:**
- [ ] 题面支持展示动作选项与当前上下文信息。
- [ ] 提交后展示本题反馈（正确性、EV loss 或偏差方向）。
- [ ] 会话结束显示汇总卡片（至少 3 个指标）。
- [ ] Typecheck/lint passes。
- [ ] Verify in browser using dev-browser skill。

### US-008: HH 上传与解析任务状态
**Description:** As a learner, I want to upload hand histories and see parsing status so that I know when analysis is ready.

**Acceptance Criteria:**
- [ ] 提供上传入口与 `uploaded/parsing/parsed/failed` 状态。
- [ ] 上传任务可查询进度，失败有错误原因。
- [ ] 支持单文件最小可用流程（M1 可先不做多站点全兼容）。
- [ ] Typecheck/lint passes。
- [ ] Tests pass。

### US-009: Analyze 列表与 EV Loss 排序
**Description:** As a learner, I want hands sorted by EV loss so that I can fix the most expensive mistakes first.

**Acceptance Criteria:**
- [ ] Analyze 页面展示手牌结果列表与关键字段（位置、街道、EV loss、标签）。
- [ ] 默认按 EV loss 从高到低排序。
- [ ] 支持至少一个筛选维度（如位置或错误标签）。
- [ ] Typecheck/lint passes。
- [ ] Verify in browser using dev-browser skill。

### US-010: AI Coach 统一侧栏与输出协议
**Description:** As a learner, I want a consistent AI coach panel so that I always get actionable and evidence-based guidance.

**Acceptance Criteria:**
- [ ] 右侧 AI Coach 在 Study/Practice/Analyze/Reports 可打开。
- [ ] 每次回答包含 5 段：`结论`、`依据数据`、`行动建议`、`风险提示`、`置信度`。
- [ ] 缺少上下文证据时返回“证据不足”而非编造结论。
- [ ] Typecheck/lint passes。
- [ ] Verify in browser using dev-browser skill。

### US-011: AI Coach 动作能力（Create Drill / Create Plan）
**Description:** As a learner, I want AI coach actions to produce concrete artifacts so that advice turns into execution.

**Acceptance Criteria:**
- [ ] 支持 `create_drill` 与 `create_plan` 两类动作调用。
- [ ] 高成本或覆盖性动作需要二次确认。
- [ ] 动作结果写入审计记录，并可回溯触发消息。
- [ ] Typecheck/lint passes。
- [ ] Tests pass。

### US-012: Reports 漏洞摘要与闭环埋点
**Description:** As a product team, I want leakage summaries and funnel events so that we can measure learning-loop effectiveness.

**Acceptance Criteria:**
- [ ] Reports 页面展示按影响度排序的前 N 个漏洞项。
- [ ] 每项显示样本量与小样本提示状态。
- [ ] 接入漏斗事件：`study_node_opened`、`drill_started`、`drill_completed`、`hand_uploaded`、`report_opened`。
- [ ] 埋点字段包含 `user_id`、`session_id`、`module`、`timestamp`、`request_id`。
- [ ] Typecheck/lint passes。
- [ ] Verify in browser using dev-browser skill。

## 4. Functional Requirements

- FR-1: 系统必须提供 Study/Practice/Analyze/Reports/AI Coach History 的稳定路由入口。
- FR-2: 系统必须支持 Spot 列表按格式、位置、筹码深度过滤。
- FR-3: 系统必须支持 Study 节点多视图切换并展示策略指标。
- FR-4: 系统必须支持从 Study 节点直接创建 Drill。
- FR-5: 系统必须提供 Drill 统一数据模型供多模块复用。
- FR-6: 系统必须支持训练会话开始、答题提交、会话结束三个阶段。
- FR-7: 系统必须记录并返回训练评分核心指标。
- FR-8: 系统必须支持 HH 上传并暴露解析任务状态。
- FR-9: 系统必须按 EV loss 对分析结果排序并支持筛选。
- FR-10: 系统必须在 AI Coach 中强制五段式输出协议。
- FR-11: 系统必须支持 AI Coach 触发创建 Drill 与创建 Plan 的动作。
- FR-12: 系统必须对高风险动作执行二次确认。
- FR-13: 系统必须记录关键 AI 动作与上下文审计日志。
- FR-14: 系统必须展示漏洞摘要并提示样本量可靠性。
- FR-15: 系统必须打通学习闭环关键埋点事件。

## 5. Non-Goals (Out of Scope)

- 不在 M1 实现完整 Solver Lab 高级功能（如 Nodelock 深度对比、多人树求解）。
- 不在 M1 实现 Arena 赛季体系与 Table Companion 桌面覆盖层。
- 不在 M1 实现 B2B Integrity Cloud 商业化 API。
- 不在 M1 做全扑克变体覆盖（先聚焦 NLHE 主流场景）。

## 6. Design Considerations

- 维持模块间统一信息架构，避免每页不同的交互心智。
- AI Coach 采用右侧抽屉，支持 `collapsed/half/full` 三态。
- Study/Practice/Analyze 页面优先“任务导向”的主 CTA（如创建 Drill、开始复训）。
- Reports 中所有结论均需可回跳到明细数据。

## 7. Technical Considerations

- 长任务（求解、批量解析）采用异步任务模型，前端按状态渲染。
- 统一请求返回结构：`request_id`、`status`、`data`、`warnings[]`、`error_code`。
- AI Coach 工具调用必须走服务端编排层，不允许前端直连敏感服务。
- 核心实体建议沿用现有模型：`drills`、`training_sessions`、`hands`、`hand_analysis_results`、`coach_actions`。
- 每个故事必须可独立验证并通过 Typecheck/Lint（涉及逻辑时补 Tests）。

## 8. Success Metrics

- 7 日内完成至少一次学习闭环的用户占比达到 `>=25%`（M1 目标）。
- Study -> Drill 转化率达到 `>=30%`。
- Drill 完成后触发 Analyze 上传比例达到 `>=20%`。
- AI Coach 回答中五段式协议完整率达到 `100%`。
- Analyze 上传任务成功率达到 `>=98%`。

## 9. Open Questions

- M1 的 HH 解析站点优先级如何排序（先支持哪 1-2 个）？
- 报告影响度排序是否只基于 EV loss，是否引入频次权重？
- AI Coach 的默认模式应为 Explain 还是 Fix？
- 周计划（Plan）是否允许自动覆盖旧计划，还是仅增量合并？
- 在 M1 是否需要提供最小权限模型（user/admin）以支持后续团队版扩展？
