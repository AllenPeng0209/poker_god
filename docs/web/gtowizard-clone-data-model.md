# ZENGTO Web Data Model（GTOWizard 对标版）

## 1. 文档目的

定义对标版核心数据模型，覆盖策略学习、求解、训练、复盘、报告、AI 教练、计费和审计，作为数据库与接口契约统一来源。

## 2. 建模原则

- 业务主数据与计算产物分离。
- 所有“可再计算结果”保留版本号。
- 长任务采用“任务主表 + 事件流”模式。
- AI 建议必须可追溯到上下文和证据。
- 高频查询字段必须有组合索引与分页策略。

## 3. 业务域与核心实体

- Identity：`users` `user_profiles` `organizations`
- Study：`study_spots` `strategy_nodes` `strategy_snapshots`
- Solver：`solver_jobs` `solver_job_events` `solver_results` `nodelock_configs`
- Practice：`drills` `drill_items` `training_sessions` `training_answers`
- Analyze：`hand_uploads` `hands` `hand_analysis_results` `hand_tags`
- Reports：`report_runs` `report_metrics` `report_materializations`
- Coach：`coach_conversations` `coach_messages` `coach_actions`
- Billing：`subscriptions` `credit_wallets` `credit_ledgers`
- Governance：`audit_logs` `data_access_logs`

## 4. 关系总览（文本 ER）

- `users.id` 1:N `solver_jobs.user_id`
- `users.id` 1:N `training_sessions.user_id`
- `users.id` 1:N `hand_uploads.user_id`
- `study_spots.id` 1:N `strategy_nodes.spot_id`
- `solver_jobs.id` 1:N `solver_job_events.job_id`
- `solver_jobs.id` 1:N `solver_results.job_id`
- `drills.id` 1:N `drill_items.drill_id`
- `training_sessions.id` 1:N `training_answers.session_id`
- `hand_uploads.id` 1:N `hands.upload_id`
- `hands.id` 1:1 `hand_analysis_results.hand_id`
- `report_runs.id` 1:N `report_metrics.run_id`
- `coach_conversations.id` 1:N `coach_messages.conversation_id`
- `coach_messages.id` 1:N `coach_actions.trigger_message_id`

## 5. 表结构建议（关键字段）

## 5.1 用户与权限

### `users`

- `id uuid pk`
- `email citext unique not null`
- `status varchar(24) not null` (`active|suspended|deleted`)
- `created_at timestamptz not null default now()`

索引：`(status, created_at desc)`

### `organizations`

- `id uuid pk`
- `name varchar(128) not null`
- `plan_tier varchar(24) not null`
- `created_at timestamptz not null`

### `organization_members`

- `org_id uuid fk`
- `user_id uuid fk`
- `role varchar(24) not null` (`owner|admin|member|analyst`)
- `joined_at timestamptz not null`

约束：`unique(org_id, user_id)`

## 5.2 Study 域

### `study_spots`

- `id uuid pk`
- `format varchar(32) not null` (cash/mtt/sng)
- `table_type varchar(16) not null` (6max/9max/hu)
- `stack_bb numeric(6,2) not null`
- `street varchar(16) not null` (preflop/flop/turn/river)
- `meta jsonb not null`

索引：`(format, table_type, stack_bb, street)`

### `strategy_nodes`

- `id uuid pk`
- `spot_id uuid fk not null`
- `parent_node_id uuid null`
- `action_key varchar(64) not null`
- `board_key varchar(32) null`
- `pot_size numeric(12,4) not null`
- `actor_position varchar(16) not null`
- `frequency_payload jsonb not null`
- `ev_payload jsonb not null`
- `version int not null`

索引：`(spot_id, version)` `(parent_node_id)` `(board_key)`

### `strategy_snapshots`

- `id uuid pk`
- `spot_id uuid fk not null`
- `version int not null`
- `source varchar(24) not null` (`precomputed|custom_solver`)
- `checksum varchar(128) not null`
- `created_at timestamptz not null`

约束：`unique(spot_id, version)`

## 5.3 Solver 域

### `solver_jobs`

- `id uuid pk`
- `user_id uuid fk not null`
- `org_id uuid fk null`
- `status varchar(24) not null` (`queued|running|succeeded|failed|canceled`)
- `priority smallint not null default 5`
- `complexity_score numeric(8,2) not null`
- `input_tree jsonb not null`
- `nodelock_enabled boolean not null default false`
- `credit_cost int not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

索引：`(status, priority, created_at)` `(user_id, created_at desc)`

### `solver_job_events`

- `id bigserial pk`
- `job_id uuid fk not null`
- `event_type varchar(48) not null`
- `payload jsonb null`
- `created_at timestamptz not null`

索引：`(job_id, created_at asc)`

### `solver_results`

- `id uuid pk`
- `job_id uuid fk not null`
- `result_version int not null`
- `summary jsonb not null`
- `strategy_payload_uri text not null`
- `exploit_delta_payload jsonb null`
- `latency_ms int not null`
- `created_at timestamptz not null`

约束：`unique(job_id, result_version)`

## 5.4 Practice 域

### `drills`

- `id uuid pk`
- `user_id uuid fk not null`
- `source_type varchar(32) not null` (`study|analyze|coach|manual`)
- `source_ref_id uuid null`
- `title varchar(160) not null`
- `difficulty varchar(24) not null`
- `tags text[] not null default '{}'`
- `created_at timestamptz not null`

索引：`(user_id, created_at desc)` `(source_type, source_ref_id)`

### `drill_items`

- `id uuid pk`
- `drill_id uuid fk not null`
- `node_id uuid fk not null`
- `weight numeric(6,4) not null`
- `target_action_distribution jsonb not null`
- `order_no int not null`

索引：`(drill_id, order_no)`

### `training_sessions`

- `id uuid pk`
- `user_id uuid fk not null`
- `drill_id uuid fk not null`
- `mode varchar(24) not null` (`spot|street|fullhand`)
- `started_at timestamptz not null`
- `ended_at timestamptz null`
- `score_ev_loss numeric(10,4) null`
- `score_frequency_gap numeric(10,4) null`

索引：`(user_id, started_at desc)`

### `training_answers`

- `id bigserial pk`
- `session_id uuid fk not null`
- `item_id uuid fk not null`
- `selected_action varchar(32) not null`
- `decision_time_ms int not null`
- `ev_loss numeric(10,4) not null`
- `created_at timestamptz not null`

索引：`(session_id, created_at)`

## 5.5 Analyze 域

### `hand_uploads`

- `id uuid pk`
- `user_id uuid fk not null`
- `source_site varchar(32) not null`
- `file_uri text not null`
- `status varchar(24) not null` (`uploaded|parsing|parsed|failed`)
- `hands_count int null`
- `created_at timestamptz not null`

索引：`(user_id, created_at desc)`

### `hands`

- `id uuid pk`
- `upload_id uuid fk not null`
- `external_hand_id varchar(128) not null`
- `played_at timestamptz not null`
- `hero_position varchar(16) not null`
- `effective_stack_bb numeric(8,2) not null`
- `action_line text not null`
- `raw_payload jsonb not null`

约束：`unique(upload_id, external_hand_id)`

### `hand_analysis_results`

- `id uuid pk`
- `hand_id uuid fk not null unique`
- `match_confidence numeric(5,4) not null`
- `matched_node_id uuid null`
- `ev_loss numeric(10,4) not null`
- `error_labels text[] not null`
- `recommendation jsonb not null`
- `created_at timestamptz not null`

索引：`(ev_loss desc)` `(matched_node_id)`

## 5.6 Reports 域

### `report_runs`

- `id uuid pk`
- `user_id uuid fk not null`
- `window_days int not null`
- `status varchar(24) not null`
- `created_at timestamptz not null`
- `finished_at timestamptz null`

### `report_metrics`

- `id bigserial pk`
- `run_id uuid fk not null`
- `metric_key varchar(64) not null`
- `dimension jsonb not null`
- `sample_size int not null`
- `player_value numeric(12,4) not null`
- `gto_baseline numeric(12,4) not null`
- `impact_score numeric(12,4) not null`

索引：`(run_id, impact_score desc)`

## 5.7 Coach 域

### `coach_conversations`

- `id uuid pk`
- `user_id uuid fk not null`
- `context_type varchar(32) not null` (`study|solver|practice|analyze|reports|arena|global`)
- `context_ref_id uuid null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `coach_messages`

- `id uuid pk`
- `conversation_id uuid fk not null`
- `role varchar(16) not null` (`user|assistant|tool`)
- `content text not null`
- `citations jsonb null`
- `confidence numeric(5,4) null`
- `created_at timestamptz not null`

索引：`(conversation_id, created_at)`

### `coach_actions`

- `id uuid pk`
- `trigger_message_id uuid fk not null`
- `action_type varchar(32) not null` (`create_drill|create_plan|open_node|flag_risk`)
- `payload jsonb not null`
- `status varchar(24) not null`
- `created_at timestamptz not null`

## 5.8 计费域

### `credit_wallets`

- `id uuid pk`
- `owner_type varchar(16) not null` (`user|org`)
- `owner_id uuid not null`
- `balance int not null default 0`
- `updated_at timestamptz not null`

约束：`unique(owner_type, owner_id)`

### `credit_ledgers`

- `id bigserial pk`
- `wallet_id uuid fk not null`
- `entry_type varchar(16) not null` (`grant|consume|refund|expire`)
- `amount int not null`
- `ref_type varchar(32) not null`
- `ref_id uuid null`
- `created_at timestamptz not null`

索引：`(wallet_id, created_at desc)`

## 5.9 审计域

### `audit_logs`

- `id bigserial pk`
- `actor_user_id uuid null`
- `action varchar(64) not null`
- `resource_type varchar(64) not null`
- `resource_id uuid null`
- `metadata jsonb null`
- `created_at timestamptz not null`

索引：`(resource_type, resource_id)` `(created_at desc)`

## 6. 分区与生命周期

- `hands`、`training_answers`、`audit_logs` 按月分区。
- `coach_messages` 默认保留 180 天（可配置）。
- `hand_uploads` 原始文件 180 天后归档冷存。
- `report_materializations` 保留最近 12 个窗口快照。

## 7. 一致性策略

- 使用事务保障同域写入一致性。
- 跨服务操作使用 outbox + 幂等消费。
- 对外 API 要求 `Idempotency-Key`（创建类接口）。

## 8. 数据质量规则

- 所有 EV 字段统一单位和小数精度。
- 所有频率字段范围必须在 `[0,1]`。
- 报告指标若 `sample_size < threshold`，标记 `low_confidence`。
- AI 行动写库必须附 `trigger_message_id`。

## 9. 隐私与合规

- PII 字段最小化，仅保留必要账号信息。
- 敏感列（邮箱、IP 摘要）加密存储。
- 支持用户导出与删除请求（DSAR）。

## 10. 演进计划

- M1：实现 Study/Practice/Analyze/Coach 核心表。
- M2：新增 Solver 版本化与 Reports 物化层。
- M3：新增 Arena 与 B2B Integrity 表。

