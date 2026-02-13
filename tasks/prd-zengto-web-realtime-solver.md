# PRD: ZENGTO Web 端（Real-time Solver Engine）

## Document Info

- Product: ZENGTO Web
- Version: v0.1 (Draft)
- Status: Draft for review
- Owner: Product / Web
- Related workspace:
  - `apps/web`
  - `services/api`
  - `packages/sdk`
  - `packages/contracts`
  - `packages/domain-poker`
  - `packages/solver-core`

## 1. 背景与目标

ZENGTO Web 端目标是把“职业牌手级别的手牌决策分析”做成可对话、可解释、可回溯的在线工作台。用户可直接输入真实牌局问题（示例：FT 6-max、有效筹码、翻牌面、对手类型），系统输出可执行决策建议与可视化分析。

当前视觉方向为“专业交易终端式”暗色界面，强调沉浸感、权威感、低干扰和高信息密度。

## 2. 产品愿景

在 1 个 Web 工作台内完成：

- 牌局问题输入（自然语言 + 结构化参数）
- 实时分析编排（范围推断 -> 解算 -> 对手建模 -> 决策输出）
- 结果可视化（策略频率、EV 对比、线路解释）
- 知识沉淀（保存、复盘、检索、分享）

## 3. 目标用户

- 用户类型 A：认真提升实战 ROI 的中高阶牌手
- 用户类型 B：内容创作者/教练，需要可视化讲解素材
- 用户类型 C：重度策略玩家，关注 GTO 与 Exploit 切换

## 4. 版本范围

### 4.1 M0（当前过渡版，Coming Soon）

- 提供完整品牌化界面框架（左导航 + 中央交互区）
- 输入框支持示例问题展示与占位引导
- 展示分析流程文案（非真实计算）
- “成为首批内测玩家”按钮支持预约收集
- 基础埋点可追踪访问和预约转化

### 4.2 M1（可用 MVP）

- New Solution 可发起真实分析任务
- GTO Agent / Hand Analysis 输出可读结果卡片
- 显示分析过程状态（排队、计算、完成、失败）
- 支持历史记录与单次结果复看

### 4.3 M2（增强版）

- Range Explorer（范围网格与频率热力图）
- Reports & Stats（用户阶段性决策质量报告）
- Knowledge Library（案例沉淀与标签检索）
- Strategy Market（模板策略包与社区分享）

## 5. 非目标（当前阶段不做）

- 不做真人 PvP 对战
- 不做真钱交易相关能力
- 不在 M0 提供完整 Solver 可视化深度参数面板
- 不在 M0 实现复杂协作权限（团队共享、审批流）

## 6. 关键场景

### 场景 S1：快速提问并拿到建议

1. 用户进入首页，点击 `+ New Solution`
2. 在输入框中输入牌局问题（自然语言）
3. 系统解析关键字段：位置、筹码、街道、牌面、动作序列
4. 系统显示分析流程状态
5. 输出建议动作、理由、关键变量

### 场景 S2：等待内测资格

1. 用户进入页面，看到 `COMING SOON`
2. 点击 `成为首批内测玩家`
3. 提交邮箱/联系方式
4. 页面反馈提交成功

### 场景 S3：复盘历史分析

1. 用户进入 Hand Analysis 历史
2. 打开某条历史任务
3. 查看当时输入、建议、假设条件、结果图表

## 7. 信息架构（IA）

### 7.1 一级导航（左侧）

- `+ New Solution`
- `ZEN Chat`
- `Knowledge Library`
- `Strategy Market`
- `Real-time Solver Engine`（当前主模块）

### 7.2 Solver 子导航

- `Hand Analysis`
- `Range Explorer`
- `Reports & Stats`
- `AI Settings`

### 7.3 页面状态

- `idle`：默认展示引导与示例
- `processing`：展示分析步骤状态
- `success`：展示结果卡片与可视化
- `empty_coming_soon`：展示 Coming Soon + 内测 CTA
- `error`：失败原因 + 重试入口

## 8. 用户故事与验收标准

### US-WEB-001：内测预约

Description: As a visitor, I want to join beta waitlist so that I can get early access.

Acceptance Criteria:

- [ ] 用户点击 `成为首批内测玩家` 可弹出或跳转预约表单
- [ ] 表单最少字段：邮箱（必填）
- [ ] 提交成功后给出明确反馈
- [ ] 重复提交时有友好提示
- [ ] 埋点记录 `waitlist_submit`

### US-WEB-002：发起新分析

Description: As a player, I want to submit a poker hand question so that I can receive actionable decision advice.

Acceptance Criteria:

- [ ] 点击 `+ New Solution` 进入输入态
- [ ] 输入支持中英文与常见扑克缩写（如 BB/BTN/3bet）
- [ ] 提交后展示分析步骤状态
- [ ] 分析完成后展示建议动作与理由
- [ ] 失败时可重试

### US-WEB-003：查看分析结果

Description: As a player, I want to view solver output and rationale so that I can study and apply strategy.

Acceptance Criteria:

- [ ] 输出包含推荐动作（Fold/Call/Raise）
- [ ] 输出包含理由摘要（范围关系、赔率、对手模型）
- [ ] 输出包含最少一个可视化模块（频率或 EV 对比）
- [ ] 支持复制结果文本

### US-WEB-004：历史复盘

Description: As a returning user, I want to reopen previous analyses so that I can compare decisions over time.

Acceptance Criteria:

- [ ] 保存最近 N 条分析记录
- [ ] 点击历史记录可恢复完整内容
- [ ] 历史项包含时间、核心问题、状态

## 9. 功能需求（Functional Requirements）

- FR-001：系统必须提供统一输入框用于提交手牌问题
- FR-002：系统必须解析输入中的关键牌局实体（位置、筹码、动作、牌面）
- FR-003：系统必须展示分析任务状态流转
- FR-004：系统必须在完成后返回结构化建议
- FR-005：系统必须支持失败重试与错误提示
- FR-006：系统必须支持预约内测提交
- FR-007：系统必须记录关键行为埋点
- FR-008：系统必须支持基础历史记录浏览（M1）
- FR-009：系统必须支持子模块导航高亮和切换
- FR-010：系统必须支持 `AI Settings` 的最小配置（语言、输出深度）

## 10. 非功能需求（NFR）

- NFR-001 性能：页面首屏可交互时间 <= 3s（标准桌面网络）
- NFR-002 体验：输入后 300ms 内给出“已接收”反馈
- NFR-003 可用性：任务失败可恢复，不出现无反馈状态
- NFR-004 可观测：核心链路有日志与埋点，支持问题定位
- NFR-005 安全：预约信息脱敏存储；基础限流防滥用
- NFR-006 兼容：桌面端优先，同时保证移动端可读可用
- NFR-007 可访问性：关键按钮和输入可键盘操作

## 11. 数据与接口需求

### 11.1 核心对象

- AnalysisRequest
  - `id`
  - `user_id`（匿名可空）
  - `prompt`
  - `parsed_context`（位置/筹码/街道/牌面等）
  - `status`
  - `created_at`

- AnalysisResult
  - `request_id`
  - `recommended_action`
  - `alternatives`
  - `reasoning_summary`
  - `visual_payload`
  - `latency_ms`

- WaitlistLead
  - `id`
  - `email`
  - `source`
  - `created_at`

### 11.2 API 建议（草案）

- `POST /web/waitlist`
- `POST /analysis/jobs`
- `GET /analysis/jobs/:id`
- `GET /analysis/history`

## 12. 交互与视觉要求

- 风格定位：专业、冷静、策略终端感
- 布局结构：左固定导航 + 中央工作区
- 状态反馈：每一步分析流程可见，不做黑盒等待
- 关键动作：`+ New Solution` 与 `成为首批内测玩家` 需保持高显著性
- 文案语气：专业直接，避免过度营销化措辞

## 13. 埋点与成功指标

### 13.1 核心埋点事件

- `page_view_home`
- `click_new_solution`
- `submit_analysis`
- `analysis_success`
- `analysis_failed`
- `waitlist_click`
- `waitlist_submit`

### 13.2 指标目标（M0-M1）

- Waitlist 转化率 >= 8%
- 分析提交到完成成功率 >= 90%（M1）
- 分析任务 P95 完成时长 <= 15s（M1）
- 次日回访率 >= 20%（已提交分析用户）

## 14. 里程碑计划

- Milestone A（1-2 周）：M0 上线
  - 完成页面框架、CTA、预约提交、基础埋点

- Milestone B（2-4 周）：M1 上线
  - 接入分析任务 API、状态流、结果卡片、历史记录

- Milestone C（4-8 周）：M2 增强
  - Range Explorer、Reports、Knowledge Library 初版

## 15. 风险与应对

- 风险 R1：Solver 计算耗时长，影响首批体验
  - 应对：异步任务 + 明确进度反馈 + 超时回退建议

- 风险 R2：自然语言输入不规范导致解析失败
  - 应对：提供示例模板 + 结构化补全提示

- 风险 R3：Coming Soon 阶段价值感不足
  - 应对：展示分析流程能力与样例结果预览，提升预约意愿

- 风险 R4：模块过多导致首版分散
  - 应对：强制 P0 只保留 `New Solution + Hand Analysis + Waitlist`

## 16. 开放问题（需产品评审确认）

- OQ-001：M1 是否必须登录后使用，还是继续匿名试用 + 限频？
- OQ-002：首发语言优先级：简中优先还是中英双语？
- OQ-003：`ZEN Chat` 在 M1 是独立对话页还是与分析结果联动侧栏？
- OQ-004：Strategy Market 是否在 M2 即开放 UGC，或先做官方模板库？
- OQ-005：是否需要导出 PDF/图片报告作为分享能力的 P1 功能？

