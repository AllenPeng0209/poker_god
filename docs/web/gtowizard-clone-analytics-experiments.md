# ZENGTO Web Analytics & Experimentation（对标版）

## 1. 文档目的

定义对标版关键指标、埋点事件、漏斗口径和实验框架，确保产品迭代可量化。

## 2. 指标体系

## 2.1 北极星指标

- `闭环完成率（7 天）`：7 天内完成 `Study -> Practice -> Analyze -> Practice` 至少一次的用户占比。

## 2.2 一级指标

- 学习激活率：注册后 24 小时内完成首个 Study 节点浏览。
- 训练转化率：Study 用户中创建 Drill 的比例。
- 复盘覆盖率：活跃用户中上传 HH 并完成分析的比例。
- 漏洞修复率：高影响指标在 30 天内回归目标区间的比例。
- AI 教练采纳率：教练建议动作被执行的比例。

## 2.3 守护指标

- 分析成功率。
- AI 回答幻觉率。
- 用户投诉率。
- P95 响应时延。

## 3. 事件命名规范

- 命名结构：`<domain>_<object>_<action>`。
- 统一小写下划线：如 `study_node_opened`。
- 单次请求链路必须携带：`request_id`。

## 4. 通用字段

必填字段：

- `event_name`
- `event_time`（UTC ISO8601）
- `session_id`
- `user_id`（匿名可空）
- `route`
- `module`
- `app_env`
- `app_version`

建议字段：

- `plan_tier`
- `device_type`
- `locale`
- `ab_bucket`

## 5. 事件字典（核心）

## 5.1 Study

- `study_node_opened`
  - params: `node_id`, `spot_id`, `street`, `stack_bb`
- `study_filter_changed`
  - params: `filter_key`, `filter_value`
- `study_drill_created`
  - params: `node_id`, `drill_id`, `source=study`

## 5.2 Solver

- `solver_job_submitted`
  - params: `job_id`, `complexity_score`, `estimated_credit_cost`
- `solver_job_status_changed`
  - params: `job_id`, `from_status`, `to_status`, `duration_ms`
- `solver_job_completed`
  - params: `job_id`, `latency_ms`, `result_version`

## 5.3 Practice

- `practice_session_started`
  - params: `session_id`, `drill_id`, `mode`, `difficulty`
- `practice_question_answered`
  - params: `session_id`, `item_id`, `ev_loss`, `decision_time_ms`
- `practice_session_completed`
  - params: `session_id`, `total_ev_loss`, `accuracy_score`

## 5.4 Analyze

- `analyze_upload_started`
  - params: `upload_id`, `source_site`, `file_count`
- `analyze_upload_completed`
  - params: `upload_id`, `hands_count`, `parse_latency_ms`
- `analyze_hand_viewed`
  - params: `hand_id`, `ev_loss`, `error_labels`

## 5.5 Reports

- `report_run_started`
  - params: `run_id`, `window_days`
- `report_run_completed`
  - params: `run_id`, `metrics_count`, `latency_ms`
- `report_metric_clicked`
  - params: `run_id`, `metric_key`, `impact_score`

## 5.6 AI Coach

- `coach_panel_opened`
  - params: `module`, `context_type`
- `coach_message_sent`
  - params: `conversation_id`, `mode`, `message_length`
- `coach_response_received`
  - params: `conversation_id`, `latency_ms`, `has_action`, `confidence`
- `coach_action_executed`
  - params: `action_type`, `action_id`, `result_status`

## 6. 漏斗定义

## 6.1 核心闭环漏斗

1. `study_node_opened`
2. `study_drill_created`
3. `practice_session_completed`
4. `analyze_upload_completed`
5. `report_run_completed`

## 6.2 AI 价值漏斗

1. `coach_panel_opened`
2. `coach_message_sent`
3. `coach_response_received`
4. `coach_action_executed`

## 7. 口径规则

- 用户去重优先 `user_id`，匿名会话回退 `session_id`。
- 成功率以最终状态为准，重试任务按 `origin_job_id` 归并。
- 报告类指标需附样本量门槛（默认 >= 100）

## 8. A/B 实验框架

## 8.1 实验对象

- AI 教练默认模式（Explain vs Fix）。
- Drill 生成入口（自动弹窗 vs 手动按钮）。
- 报告优先级排序策略（impact-first vs recency-first）。

## 8.2 实验要求

- 必须有主要指标和守护指标。
- 样本量满足统计功效后再决策。
- 实验期间禁止同时改动同漏斗关键路径。

## 8.3 评估周期

- 短周期实验：7-14 天。
- 中周期实验：21-28 天（涉及学习效果）。

## 9. 仪表盘建议

- Dashboard A：增长与激活（新用户、激活、闭环完成率）。
- Dashboard B：训练与复盘（训练时长、EV 改善、报告打开率）。
- Dashboard C：AI 教练（时延、采纳率、帮助度、故障率）。
- Dashboard D：服务健康（错误率、队列堆积、API SLA）。

## 10. 数据质量保障

- 必填字段缺失率 < 0.5%。
- 事件重复率 < 1%。
- 关键漏斗事件顺序一致性 > 99%。
- 每日自动校验并输出异常报告。

## 11. 隐私与合规

- 不上报完整手牌原文到第三方分析工具。
- 邮箱、IP 等敏感字段只保留哈希摘要。
- 用户可选择退出个性化分析。

