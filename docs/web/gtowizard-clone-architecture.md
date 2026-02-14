# ZENGTO Web Technical Architecture（GTOWizard 对标版）

## 1. 文档目的

定义对标版 Web 平台的系统架构、服务边界、数据流、可用性与扩展策略，作为后端、前端、数据和运维统一实现基线。

## 2. 目标与范围

- 目标：支撑 `Study / Solver / Practice / Analyze / Reports / Arena / Table Companion / AI Coach` 全链路。
- 范围：Web 主应用与云端服务架构，不含移动端 UI 细节。
- 范围外：扑克房间底层撮合/资金系统（Arena 仅做训练对战与模拟环境）。

## 3. 架构原则

- 模块化：按业务域拆分服务，避免单体耦合。
- 异步优先：高计算任务全部走任务队列，前端以状态流消费。
- 可恢复：所有长任务可重试、可取消、可追踪。
- 可解释：AI 输出必须绑定结构化依据，不允许“黑盒结论”。
- 可观测：任何关键用户动作都能映射到日志、指标、追踪链路。

## 4. 总体架构

## 4.1 逻辑分层

- Interface Layer：`apps/web`（Next.js）+ `apps/table-companion`（桌面）
- API Layer：`api-gateway`（鉴权、限流、路由、审计）
- Domain Services：
  - `study-service`
  - `solver-orchestrator`
  - `trainer-service`
  - `analyzer-service`
  - `reports-service`
  - `arena-service`
  - `coach-service`
- Compute Layer：`solver-workers`（CPU/GPU 混合集群）
- Data Layer：PostgreSQL + Redis + Object Storage + Warehouse
- Event Layer：Kafka / NATS（事件总线）

## 4.2 部署拓扑

- Web：CDN + Edge Cache + Next.js Runtime
- API：Kubernetes（多副本）
- Worker：独立节点池（按计算任务类型扩缩容）
- DB：PostgreSQL 主从 + PITR
- Cache：Redis Cluster（热点节点、任务状态、限流桶）
- Analytics：事件流 -> ETL -> OLAP（如 ClickHouse/BigQuery）

## 5. 服务边界与职责

## 5.1 `study-service`

- 提供预解库查询、策略节点详情、过滤器与聚合视图。
- 维护策略快照版本和可追溯元数据。

## 5.2 `solver-orchestrator`

- 接收自定义求解请求，进行参数校验、预算评估、排队调度。
- 拆分任务到 `solver-workers`，汇总结果并版本化。
- 支持 Nodelock 前后对比。

## 5.3 `trainer-service`

- 管理 Drill、训练会话、评分、错题本。
- 支持多模式训练与随机化策略（RNG）。

## 5.4 `analyzer-service`

- HH 文件接入与标准化解析。
- 手牌与策略匹配、EV 损失估算、错误分类。

## 5.5 `reports-service`

- 统计聚合（用户/位置/街道/动作维度）。
- 生成 Leak 报告与趋势图。

## 5.6 `coach-service`

- 统一 AI 教练入口。
- 负责上下文拼装、工具调用编排、输出校验与安全策略。
- 只返回“带证据”的建议，并记录可审计轨迹。

## 5.7 `arena-service`

- 对战房间管理、赛季积分、赛后回放与复盘触发。

## 6. 核心业务流

## 6.1 Study -> Trainer

1. 前端请求 `study node`。
2. 用户触发“生成 Drill”。
3. `coach-service` 调用 `trainer-service` 创建训练包。
4. 前端跳转训练并记录漏斗事件。

## 6.2 Solver Job 生命周期

1. 提交 `solver job`。
2. `solver-orchestrator` 进行参数校验与成本评估。
3. 入队 -> worker 执行 -> 中间状态上报。
4. 结果入库（版本化）并推送状态完成事件。
5. 可选触发：自动生成训练建议。

## 6.3 Analyze 批量复盘

1. 上传 HH（支持批量）。
2. 解析与标准化。
3. 自动匹配策略节点并计算 EV loss。
4. 输出手牌级与聚合级结果。
5. 一键回跳 Study / Trainer。

## 6.4 AI Coach Action

1. 用户在右侧面板提问。
2. `coach-service` 获取上下文（节点、手牌、报告、历史）。
3. LLM 推理 + 工具调用。
4. 输出 `结论/依据/行动/风险/置信度`。
5. 若用户确认动作，写入 `drill` 或 `weekly plan`。

## 7. 数据与存储策略

- OLTP：PostgreSQL（业务主存）。
- 热读缓存：Redis（节点热数据、会话态、任务状态）。
- 大文件：Object Storage（HH 原文、回放快照、导出报告）。
- 分析仓库：OLAP（事件和统计聚合）。
- 归档策略：原始 HH 默认 180 天热存，归档后仅保留摘要和索引。

## 8. 可用性与性能目标（SLO）

- Web 首屏 TTI：P95 < 3s。
- Study 节点切换：P95 < 300ms（命中缓存时）。
- Coach 首 token：P95 < 2s。
- Analyze 上传到首批可用结果：P95 < 90s（批量任务除外）。
- 平台可用性：月度 `99.9%`。

## 9. 扩展策略

- 求解任务按“复杂度分层队列”调度，避免大任务饿死小任务。
- 热点策略节点走只读副本 + CDN/Redis 双层缓存。
- 报表计算采用增量聚合 + 物化视图。
- Arena 房间服务独立扩缩容，避免影响核心学习链路。

## 10. 安全架构

- 鉴权：JWT + 短期会话 token（桌面端设备绑定）。
- 授权：RBAC（user/coach/admin/b2b_analyst）。
- 数据隔离：按租户和用户双维度鉴权。
- 加密：传输 TLS 1.2+，存储 AES-256（敏感列）。
- 审计：关键动作（求解、导出、AI 动作）全量审计日志。

## 11. 可观测性

- Metrics：请求量、错误率、时延、队列长度、求解吞吐。
- Tracing：`x-request-id` 全链路追踪。
- Logging：结构化日志（JSON），脱敏处理。
- Alerting：
  - API 5xx > 2% 持续 10 分钟。
  - Solver 队列等待 > 15 分钟。
  - Coach 工具调用失败率 > 5%。

## 12. 容灾与恢复

- PostgreSQL：每日全量 + 15 分钟增量备份（PITR）。
- RPO：<= 15 分钟。
- RTO：<= 60 分钟。
- 跨可用区部署 API 与 Worker，单区故障自动切流。

## 13. 技术栈建议

- Web：Next.js + TypeScript + React Query。
- API：Node.js/NestJS 或 Go（团队择一，保持契约一致）。
- Queue：Redis Streams / Kafka。
- DB：PostgreSQL 16。
- Observability：OpenTelemetry + Prometheus + Grafana + Sentry。

## 14. 架构决策记录（ADR）

上线前至少固化以下 ADR：

- ADR-001：求解调度方案（单队列 vs 分层队列）。
- ADR-002：Coach LLM 提供商与 fallback 策略。
- ADR-003：Arena 服务是否独立集群。
- ADR-004：OLAP 引擎选型。

## 15. 退出条件（架构冻结）

- 所有核心服务边界明确并通过评审。
- SLO、告警和容量模型可执行。
- 故障演练通过（任务堆积、DB 只读、单可用区故障）。
