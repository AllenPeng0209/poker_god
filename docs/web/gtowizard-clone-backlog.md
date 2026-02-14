# ZENGTO Web Implementation Backlog（对标版）

## 1. 文档目的

将对标版 PRD 拆解为可执行 Epic、Story 与里程碑，支持研发、测试、数据和运营并行推进。

## 2. 里程碑定义

- M1（0-12 周）：最小学习闭环 `Study + Practice + Analyze + AI Coach`。
- M2（13-20 周）：`Solver + Reports` 深化与动作化教练。
- M3（21-28 周）：`Arena + Table Companion` 实战闭环。
- M4（29+ 周）：`Credits + Integrity Cloud` 商业化增强。

## 3. 优先级规则

- P0：不完成无法达成该里程碑目标。
- P1：强相关价值项。
- P2：可延后优化项。

## 4. Epic 清单

## Epic A：Study Hub

- A-01（P0）预解库列表、过滤器、节点浏览。
- A-02（P0）Strategy/Ranges/Breakdown 三视图。
- A-03（P1）Reports 视图与节点对比。
- A-04（P0）一键生成 Drill。

验收：Study 页面可完成“节点浏览 -> Drill 生成”。

## Epic B：Trainer

- B-01（P0）Drill 模型与 CRUD。
- B-02（P0）训练会话与评分引擎。
- B-03（P1）错题本自动沉淀。
- B-04（P1）难度分层与多模式训练。

验收：训练结果可量化并可复训。

## Epic C：Hand Analyzer

- C-01（P0）HH 上传与解析管线。
- C-02（P0）手牌匹配与 EV loss 计算。
- C-03（P0）错误标签与排序筛选。
- C-04（P1）回放与跳转 Study/Practice。

验收：批量上传后可定位 Top 错误并生成训练建议。

## Epic D：AI Coach

- D-01（P0）右侧面板基础交互。
- D-02（P0）上下文注入与输出协议。
- D-03（P0）动作能力（create_drill/create_plan）。
- D-04（P1）记忆策略与隐私模式。

验收：至少 3 个动作型闭环可稳定使用。

## Epic E：Solver Lab

- E-01（P0）任务提交与队列调度。
- E-02（P0）结果版本化与可视化摘要。
- E-03（P1）Nodelock 与方案对比。
- E-04（P1）成本估算与 credits 扣费。

验收：复杂求解任务可追踪并可复用。

## Epic F：Leak Reports

- F-01（P0）统计聚合管道。
- F-02（P0）报告页面与样本量提示。
- F-03（P1）指标回跳手牌。
- F-04（P1）AI 优先级建议。

验收：可识别高影响漏洞并转成训练计划。

## Epic G：Arena + Table

- G-01（P1）Arena 对战基础模式。
- G-02（P1）赛后自动复盘。
- G-03（P1）Table Companion 自动上传。
- G-04（P2）桌面覆盖层与热键模板。

验收：实战数据可回流学习闭环。

## Epic H：平台工程

- H-01（P0）认证授权与 RBAC。
- H-02（P0）可观测体系（日志/追踪/告警）。
- H-03（P0）埋点 SDK 与数据看板。
- H-04（P0）CI/CD 与发布回滚流程。

验收：支持稳定发布与故障定位。

## 5. 分阶段交付物

## M1 交付

- Study/Trainer/Analyze/Coach 完整流程。
- 基础指标看板。
- 对外 Beta 可用。

## M2 交付

- Solver 自定义求解可用。
- Reports 全量可用。
- AI Coach 动作化增强。

## M3 交付

- Arena Beta。
- Table Companion Beta。
- 实战复盘闭环可观测。

## 6. 人力配置建议

- Product：1
- Frontend：2
- Backend：3
- Data：1
- QA：1
- SRE：1（兼职）
- AI Engineer：1

## 7. 关键依赖

- 求解引擎能力成熟度。
- HH 格式解析覆盖度。
- AI 推理成本与响应时延。
- 数据基础设施（OLTP + OLAP）

## 8. 风险与缓解

- 需求膨胀：按里程碑冻结范围。
- 求解时延：分层队列 + credits 调节。
- AI 幻觉：强制证据输出与离线评测。
- 数据质量：埋点与报表双重校验。

## 9. DoD（Story 级）

每个 Story 必须满足：

- 代码合并并通过 CI。
- 合同测试与单测通过。
- 关键埋点已接入。
- 文档已同步更新。

