# ZENGTO Web PRD: GTOWizard 对标版（全模块 + AI 教练）

## 1. 文档信息

- 文档版本：`v1.0`
- 创建日期：`2026-02-13`
- 适用阶段：`MVP -> Beta -> GA`
- 目标端：`Web（主） + Desktop Companion（Table Tool）`

## 2. 项目背景

目标是构建一个与 GTOWizard 同级别的策略平台，覆盖「看解、求解、训练、复盘、报告、对战、实战工具、内容学习、完整性检测」全链路能力，并在每个模块内提供 Cursor 风格的右侧 AI 教练侧栏，实现“可解释 + 可执行 + 可追问”的学习闭环。

## 3. 产品目标与边界

### 3.1 产品目标

- 目标 1：形成端到端闭环 `Study -> Practice -> Analyze -> Study`。
- 目标 2：每个模块统一挂载 AI 教练侧栏，减少策略理解与迁移成本。
- 目标 3：支持从学习场景扩展到实战场景（Arena + Table Tool）。
- 目标 4：构建可商业化能力（订阅 + Credits + B2B Integrity）。

### 3.2 非目标（当前阶段）

- 不做扑克平台现金局/锦标赛真实资金托管。
- 不做与任何第三方产品完全一致的 UI 文案复刻。
- 不在 MVP 阶段覆盖所有扑克变体（先聚焦 NLHE 6-max/9-max 主流场景）。

## 4. 用户画像与核心场景

### 4.1 用户画像

- 职业玩家：需要高效率复盘、可落地 exploit 研究、跨桌型稳定收益。
- 进阶玩家：需要结构化学习路径与错题驱动训练。
- 教练/内容创作者：需要批量分析、分层教学、导出教材。
- 平台运营方（B2B）：需要公平性检测与可审计报告。

### 4.2 关键任务（JTBD）

- 当我打完 session 后，我要在 30 分钟内定位最贵错误，并转成训练计划。
- 当我学习一个 spot 时，我要理解“为什么”，并立刻进入 drill 强化。
- 当我偏离 GTO 时，我要知道偏离代价和可接受阈值。
- 当我制定一周训练计划时，我要有可量化目标和复训提醒。

## 5. GTOWizard 对标模块拆解（基线）

以下为对标范围（用于定义能力边界，不代表逐字/逐 UI 复制）。

| 对标模块 | 核心价值 | 关键能力 | 我方对标模块名 |
|---|---|---|---|
| Study | 看解和策略研究 | Strategy / Ranges / Breakdown / Reports、EV/EQ/EQR、过滤器 | `Study Hub` |
| Custom Solver + AI | 自定义求解与 exploit 研究 | Tree 配置、dynamic sizing、nodelock、多人求解 | `Solver Lab` |
| Practice | 从理解到执行 | Spot/Street/Full Hand 训练、Drills、评分、RNG | `Trainer` |
| Analyze | 手牌复盘 | 批量上传 HH、自动匹配、EV loss 排序、回跳学习 | `Hand Analyzer` |
| GTO Reports | 统计级漏洞发现 | 玩家频率 vs 基线、位置拆解、样本量提示 | `Leak Reports` |
| PokerArena | 对战 + 学习反馈 | 竞技模式、赛季积分、赛后分析 | `Arena` |
| Table Wizard | 实战桌面效率 | 热键、布局、注码工具、HUD 覆盖、自动上传 | `Table Companion` |
| Content/Coaching | 认知教育 | 文章/视频/课程/每日题 | `Academy` |
| Integrity | B2B 反作弊 | 超人类行为检测、公平性报告 | `Integrity Cloud` |

## 6. 产品总体验证闭环

### 6.1 主闭环

`Study Hub` 学习某 Spot -> 一键生成 `Trainer` Drill -> 训练后错题进入 `Hand Analyzer` 对照 -> 聚合到 `Leak Reports` -> AI 教练生成下周计划 -> 回到 `Study Hub` 针对性学习。

### 6.2 实战闭环

`Table Companion` 自动上传实战 HH -> `Hand Analyzer` 自动复盘 -> `Leak Reports` 看趋势 -> `Trainer` 复训 -> `Arena` 校验执行质量。

## 7. 模块级 PRD（全量）

## 7.1 Study Hub（看解中心）

### 7.1.1 目标

让用户快速理解某个节点的最优策略结构，并可无缝过渡到训练与复盘。

### 7.1.2 功能需求

- 预解库浏览：按 `Format / Position / Stack / Spot` 过滤。
- 视图切换：`Strategy`、`Ranges`、`Breakdown`、`Reports`。
- 指标展示：`EV`、`EQ`、`EQR`、策略频率、行动分布。
- 牌面与动作过滤：支持 board texture、action line、bet size 过滤。
- 节点跳转：从任意动作节点向前/向后跳转。
- 一键转训练：当前节点生成训练包（含权重与难度）。

### 7.1.3 AI 教练（右侧）

- 能力：解释当前节点策略逻辑，给出 3 条可执行启发式。
- 数据绑定：回答必须引用当前节点数据（频率/EV 差/阻断）。
- 行动建议：支持“一键生成 Drill”和“加入本周计划”。
- 风险提示：样本不足或参数不一致时明确告警。

### 7.1.4 关键指标

- Study 页平均停留时长。
- Study -> Trainer 转化率。
- AI 对话后 5 分钟内二次操作率。

## 7.2 Solver Lab（自定义求解）

### 7.2.1 目标

支持高级用户自定义游戏树并进行 GTO / exploit 分析。

### 7.2.2 功能需求

- 参数配置：positions、stacks、pot、rake、ante、bet sizing tree。
- 模式：`Fixed` / `Dynamic` sizing。
- Nodelock：可锁定对手频率并对比前后策略。
- 多人求解：支持 preflop multiway，后续迭代 postflop multiway。
- 任务队列：异步提交、排队、取消、失败重试。
- 结果管理：版本化保存与“方案对比视图”。

### 7.2.3 AI 教练（右侧）

- 自然语言转参数模板（如“面对 loose caller 的 exploit 树”）。
- 求解后自动输出：结论、敏感参数、可操作训练建议。
- 自动识别错误配置（树过深、无效 size、冲突输入）。

### 7.2.4 关键指标

- 求解任务成功率。
- 平均等待时长（P50/P95）。
- 求解结果被复用率（生成训练/进入报告）。

## 7.3 Trainer（训练中心）

### 7.3.1 目标

把“知道策略”转化为“稳定执行”。

### 7.3.2 功能需求

- 模式：`Full Hand`、`By Street`、`By Spot`。
- 难度分层：`Beginner / Intermediate / Advanced / Elite`。
- Drill 系统：收藏错题、批量复训、标签管理。
- 评分系统：EV loss、频率偏差、决策耗时、稳定性分。
- RNG 训练：混合策略随机化辅助。
- 多桌训练：并行题面，提升决策吞吐。

### 7.3.3 AI 教练（右侧）

- 实时纠错（可设为仅重大错误提示）。
- 训练结束生成：Top3 漏洞 + 下次训练建议。
- 自动把错题沉淀到“错题本”并安排复训日程。

### 7.3.4 关键指标

- 7 日训练留存。
- 周均训练手数。
- 错题二次正确率提升。

## 7.4 Hand Analyzer（复盘中心）

### 7.4.1 目标

快速定位真实对局中最昂贵错误，并给出可执行改进路径。

### 7.4.2 功能需求

- 单手/批量 HH 上传（主流站点格式适配）。
- 自动解析与最近策略匹配（含置信度分级）。
- 按 EV loss 排序、按位置/街道/动作类型筛选。
- 手牌重放与关键分岔节点标记。
- 一键回跳：Study 节点与 Trainer Drill。

### 7.4.3 AI 教练（右侧）

- 单手诊断标签：`频率错 / 尺寸错 / 计划错 / 阈值错`。
- 聚合诊断：跨手牌识别重复模式。
- 自动生成“本周修复计划”（按收益优先级排序）。

### 7.4.4 关键指标

- 上传到结果可用时间（TTR）。
- 分析后转训练比例。
- 30 天 EV loss 趋势下降幅度。

## 7.5 Leak Reports（统计报告）

### 7.5.1 目标

把离散错误变成统计级漏洞，指导训练优先级。

### 7.5.2 功能需求

- 玩家统计 vs 基线（位置、对位、街道、动作）。
- 样本量可信度提示（小样本警示）。
- 指标排序：按潜在收益影响排序。
- 报告内联回查：点击统计项回到具体手牌列表。
- 时间窗口：7/30/90 天趋势对比。

### 7.5.3 AI 教练（右侧）

- 先判定样本有效性，再给建议，避免误导。
- 输出“先改哪 3 项最值钱”并配训练入口。
- 自动生成可执行周计划和复盘检查点。

### 7.5.4 关键指标

- 报告打开率与停留时长。
- 报告 -> 手牌回查率。
- 报告 -> 训练计划转化率。

## 7.6 Arena（对战场）

### 7.6.1 目标

用实战化对局检验训练结果，提升留存与竞技动机。

### 7.6.2 功能需求

- 模式：`Casual`、`Ranked`、`Private Room`。
- 赛季体系：积分、段位、排行榜、赛季奖励。
- 对局回放与关键手牌标注。
- 赛后自动分析并跳转 Hand Analyzer。

### 7.6.3 AI 教练（右侧）

- 赛后 3 分钟摘要：最关键 3 手 + 最先修复 2 个问题。
- 结合对手画像给下场策略建议。

### 7.6.4 关键指标

- 周活跃对局数。
- 赛后复盘率。
- Arena -> 订阅转化率。

## 7.7 Table Companion（桌面实战工具）

### 7.7.1 目标

降低多桌实战操作负担并把实战数据回流到学习系统。

### 7.7.2 功能需求

- 桌面布局管理、热键、下注快捷模板。
- HUD 覆盖层：`SPR`、`Pot Odds`、`Effective Stack`、牌谱提示。
- 自动 HH 上传与断线补传。
- 合规策略配置：站点白名单/黑名单与功能开关。

### 7.7.3 AI 教练（右侧/会后）

- 会后自动生成“实战 -> 训练桥接报告”。
- 输出今日最该练的 2 个 Spot 与推荐 Drill。

### 7.7.4 关键指标

- 自动上传成功率。
- 实战数据回流率。
- 会后复盘触发率。

## 7.8 Academy（内容学习）

### 7.8.1 目标

为不同水平用户提供结构化学习路径，提升长期留存。

### 7.8.2 功能需求

- 内容类型：文章、视频、课程、每日题、学习计划。
- 标签系统：按盲注级别、位置、主题、难度分类。
- 学习路径：新手/进阶/职业三档。
- 课程完成度与阶段考试。

### 7.8.3 AI 教练（右侧）

- 基于用户漏洞自动推荐学习内容。
- 把课程节点转成训练任务并追踪完成率。

### 7.8.4 关键指标

- 内容完课率。
- 内容 -> 训练转化率。
- 学习路径 30 天留存。

## 7.9 Integrity Cloud（B2B 公平性）

### 7.9.1 目标

提供可解释、可审计、可接入的公平性检测服务。

### 7.9.2 功能需求

- 行为风险评分（玩家/会话/平台级）。
- 超人类行为与异常一致性检测。
- 可审计报告：证据链、时间线、指标对比。
- B2B API：批量任务、Webhook、权限分级。

### 7.9.3 AI 教练（右侧）

- 为运营人员生成可读性报告摘要。
- 输出“建议动作”与风险等级说明。

### 7.9.4 关键指标

- 误报率与检出率。
- 报告阅读完成率。
- B2B 客户续费率。

## 8. AI 教练统一规格（Cursor 风格右侧面板）

## 8.1 交互与布局

- 默认入口：页面右侧抽屉，快捷键 `Cmd/Ctrl + ]`。
- 三态：`折叠`、`半宽`、`全宽`。
- 支持上下文标签：`@当前手牌`、`@当前节点`、`@我的报告`、`@本次训练`。

## 8.2 会话模式

- `Explain`：解释当前策略与依据。
- `Fix`：针对错误给修复动作。
- `Drill`：直接生成训练包。
- `Plan`：输出 7 天学习计划。

## 8.3 输出协议（强约束）

每次回答必须包含：

- `结论`
- `依据数据`
- `行动建议`
- `风险提示`
- `置信度`

## 8.4 工具调用层

- `solver.query_node`
- `trainer.create_drill`
- `analyzer.fetch_hand_cluster`
- `reports.fetch_metric`
- `planner.upsert_weekly_plan`

## 8.5 安全与合规

- 小样本自动警示，不输出确定性误导结论。
- 参数冲突时先澄清，不直接给硬建议。
- 支持“隐私模式”：不跨模块记忆历史。

## 9. 信息架构与路由（Web）

- 顶部导航：`Study | Solver | Practice | Analyze | Reports | Arena | Learn`
- 辅助入口：`Table`（下载桌面端）`Integrity`（企业入口）
- 全局对象：`Spot`、`Node`、`Hand`、`Drill`、`Report`、`Plan`。

建议路由：

- `/app/study`
- `/app/solver`
- `/app/practice`
- `/app/analyze`
- `/app/reports`
- `/app/arena`
- `/app/learn`
- `/app/ai-coach/history`

## 10. 数据模型（核心实体）

### 10.1 业务实体

- `users`
- `player_profiles`
- `hands`
- `analysis_jobs`
- `solver_jobs`
- `strategy_nodes`
- `drills`
- `training_sessions`
- `leak_reports`
- `coach_conversations`
- `weekly_plans`

### 10.2 关键关系

- `hands` -> `analysis_jobs`：1:N
- `analysis_jobs` -> `drills`：1:N
- `training_sessions` -> `leak_reports`：N:1（按时间窗口聚合）
- `coach_conversations` 可挂载任一业务对象 `object_type + object_id`

## 11. API 清单（MVP）

- `POST /api/analyze/upload`
- `GET /api/analyze/jobs/:id`
- `POST /api/solver/jobs`
- `GET /api/solver/jobs/:id`
- `POST /api/trainer/drills`
- `POST /api/trainer/sessions`
- `GET /api/reports/leaks`
- `POST /api/coach/chat`
- `POST /api/coach/actions/create-drill`
- `POST /api/coach/actions/create-plan`

统一返回字段建议：

- `request_id`
- `status`
- `data`
- `warnings[]`
- `error_code`（失败时）

## 12. 埋点与增长指标

### 12.1 事件

- `page_view`
- `study_node_opened`
- `coach_message_sent`
- `coach_action_clicked`
- `drill_started`
- `drill_completed`
- `hand_uploaded`
- `analysis_viewed`
- `report_opened`
- `arena_match_completed`

### 12.2 北极星指标

- 7 日内完成至少 1 次学习闭环的用户比例。

### 12.3 关键漏斗

- Study -> Coach 提问 -> Drill 生成 -> Drill 完成 -> Analyze 上传 -> Report 打开。

## 13. 商业化模型

### 13.1 套餐分层

- Free：基础 Study + 限量训练 + 限量分析。
- Pro：全量 Study/Practice/Analyze + 基础 AI 教练。
- Elite：自定义求解 + Nodelock + 高级报告。
- Team/B2B：Integrity API + 团队看板 + 审计能力。

### 13.2 Credits

- 高计算任务计费（复杂求解、多人树、大规模聚合报告）。
- 月度订阅附赠 Credits，超额按量购买。

## 14. 里程碑与交付计划

### 14.1 M0（0-6 周）

- Web 框架、账号体系、Study 基础视图、AI 教练侧栏 v1。

### 14.2 M1（7-12 周）

- Trainer、Hand Analyzer、基础 Leak Reports，打通最小闭环。

### 14.3 M2（13-20 周）

- Solver Lab（异步队列 + 参数模板 + 基础对比）。
- AI 教练动作化（创建 Drill / 创建 Plan）。

### 14.4 M3（21-28 周）

- Arena Beta、Table Companion Beta、实战回流闭环。

### 14.5 M4（29+ 周）

- 多人求解增强、Credits、Integrity Cloud（B2B）。

## 15. 验收标准（Definition of Done）

- 用户可在单次会话完成：学习 -> 提问 -> 训练 -> 复盘 -> 再训练。
- AI 教练回答中，`>=80%` 包含明确行动建议且引用上下文数据。
- Analyze 任务成功率达到目标阈值（建议 `>=98%`）。
- 关键页面 P95 交互延迟满足阈值（建议 `<500ms`）。
- 7 日闭环完成率达到阶段目标（M1 建议 `>=25%`，M2 `>=35%`）。

## 16. 风险与缓解

- 风险：求解成本高、排队时延长。  
  缓解：队列分级 + Credits + 结果缓存复用。
- 风险：小样本报告误导用户。  
  缓解：样本置信度门槛 + AI 强制风险提示。
- 风险：合规边界不清（桌面工具）。  
  缓解：站点策略白名单 + 风险开关 + 合规审查流程。
- 风险：功能多导致学习门槛高。  
  缓解：角色化 onboarding + AI 引导任务流。

## 17. 附录：实施优先级（建议）

1. 先做最小可验证闭环：`Study + Trainer + Analyze + Coach`。
2. 再做高粘性增长模块：`Leak Reports + Arena`。
3. 最后做高复杂度护城河：`Solver 多人树 + Table Companion + Integrity`。
