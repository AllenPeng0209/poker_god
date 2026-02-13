# ZENGTO Web Data Schema (M0-M1)

## 1. 文档目的

定义 Web 端核心业务数据模型，覆盖 waitlist、分析任务、结果、事件与设置，作为数据库设计和后端实现基线。

## 2. 数据库选型与原则

- DB：PostgreSQL（建议 `uuid + jsonb + timestamptz`）
- 原则：
  - 输入原文与解析结果分离存储
  - 任务状态可追踪（事件日志）
  - 结果可扩展（`jsonb` 承载图表负载）
  - 用户隐私最小化采集

## 3. 实体关系

- `web_waitlist_leads`：内测预约线索
- `analysis_jobs`：分析任务主表
- `analysis_results`：任务结果（1:1 或 1:N 版本化）
- `analysis_job_events`：任务事件流（状态切换、重试）
- `analysis_settings`：用户/匿名会话设置
- `zen_chat_sessions`：ZEN Chat 会话元数据
- `zen_chat_messages`：ZEN Chat 消息历史

关系：

- `analysis_jobs.id` 1 - N `analysis_job_events.job_id`
- `analysis_jobs.id` 1 - N `analysis_results.job_id`
- `analysis_jobs.user_id/client_session_id` 1 - 1 `analysis_settings`
- `zen_chat_sessions.id` 1 - N `zen_chat_messages.session_id`

## 4. 表结构（建议）

## 4.1 `web_waitlist_leads`

用途：收集 M0 预约信息。

字段：

- `id uuid primary key`
- `email citext not null`
- `source varchar(64) null`
- `locale varchar(16) null`
- `ip_hash varchar(128) null`
- `ua varchar(512) null`
- `created_at timestamptz not null default now()`

约束/索引：

- `unique(email)`
- `index(created_at desc)`

## 4.2 `analysis_jobs`

用途：分析任务生命周期主表。

字段：

- `id uuid primary key`
- `user_id uuid null`
- `client_session_id uuid not null`
- `prompt text not null`
- `locale varchar(16) not null default 'zh-CN'`
- `parsed_context jsonb null`
- `status varchar(32) not null`
- `status_reason text null`
- `retry_count int not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

状态枚举：

- `queued`
- `processing`
- `success`
- `failed_retryable`
- `failed_fatal`

约束/索引：

- `check (char_length(prompt) between 1 and 2000)`
- `index(client_session_id, created_at desc)`
- `index(user_id, created_at desc)`
- `index(status, created_at desc)`

## 4.3 `analysis_results`

用途：存放任务输出与可视化载荷。

字段：

- `id uuid primary key`
- `job_id uuid not null references analysis_jobs(id)`
- `version int not null default 1`
- `recommended_action jsonb not null`
- `alternatives jsonb null`
- `confidence numeric(5,4) null`
- `ev_delta numeric(10,4) null`
- `reasoning_summary jsonb not null`
- `visual_payload jsonb null`
- `latency_ms int null`
- `created_at timestamptz not null default now()`

约束/索引：

- `unique(job_id, version)`
- `index(job_id)`
- `check (confidence is null or (confidence >= 0 and confidence <= 1))`

## 4.4 `analysis_job_events`

用途：记录任务每一步状态变化，用于调试与时间线展示。

字段：

- `id bigserial primary key`
- `job_id uuid not null references analysis_jobs(id)`
- `event_type varchar(64) not null`
- `step_name varchar(64) null`
- `payload jsonb null`
- `created_at timestamptz not null default now()`

`event_type` 示例：

- `job_created`
- `status_changed`
- `step_started`
- `step_completed`
- `step_failed`
- `job_retried`

索引：

- `index(job_id, created_at asc)`
- `index(event_type, created_at desc)`

## 4.5 `analysis_settings`

用途：存储用户或匿名会话的输出偏好。

字段：

- `id uuid primary key`
- `user_id uuid null`
- `client_session_id uuid null`
- `output_language varchar(16) not null default 'zh-CN'`
- `reasoning_depth varchar(16) not null default 'standard'`
- `include_alternatives boolean not null default true`
- `include_visuals boolean not null default true`
- `updated_at timestamptz not null default now()`

约束：

- `check (user_id is not null or client_session_id is not null)`
- `unique(user_id)` where `user_id is not null`
- `unique(client_session_id)` where `client_session_id is not null`

## 4.6 `zen_chat_sessions`

用途：承载 ZEN Chat 会话级元信息。

字段：

- `id uuid primary key`
- `user_id uuid null`
- `client_session_id uuid not null`
- `locale varchar(16) not null default 'zh-CN'`
- `last_provider varchar(32) null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

约束/索引：

- `index(client_session_id, updated_at desc)`
- `index(user_id, updated_at desc)`

## 4.7 `zen_chat_messages`

用途：存储聊天消息（用户/助手）。

字段：

- `id uuid primary key`
- `session_id uuid not null references zen_chat_sessions(id)`
- `role varchar(16) not null` (`user|assistant`)
- `content text not null`
- `provider varchar(32) null`
- `created_at timestamptz not null default now()`

约束/索引：

- `check (char_length(content) between 1 and 2000)`
- `index(session_id, created_at asc)`

## 5. 推荐 DDL（草案）

```sql
create extension if not exists citext;

create table if not exists web_waitlist_leads (
  id uuid primary key,
  email citext not null unique,
  source varchar(64),
  locale varchar(16),
  ip_hash varchar(128),
  ua varchar(512),
  created_at timestamptz not null default now()
);

create table if not exists analysis_jobs (
  id uuid primary key,
  user_id uuid,
  client_session_id uuid not null,
  prompt text not null,
  locale varchar(16) not null default 'zh-CN',
  parsed_context jsonb,
  status varchar(32) not null,
  status_reason text,
  retry_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analysis_jobs_prompt_len_ck check (char_length(prompt) between 1 and 2000),
  constraint analysis_jobs_status_ck check (
    status in ('queued', 'processing', 'success', 'failed_retryable', 'failed_fatal')
  )
);

create table if not exists analysis_results (
  id uuid primary key,
  job_id uuid not null references analysis_jobs(id) on delete cascade,
  version int not null default 1,
  recommended_action jsonb not null,
  alternatives jsonb,
  confidence numeric(5,4),
  ev_delta numeric(10,4),
  reasoning_summary jsonb not null,
  visual_payload jsonb,
  latency_ms int,
  created_at timestamptz not null default now(),
  constraint analysis_results_unique_version unique (job_id, version),
  constraint analysis_results_confidence_ck check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  )
);

create table if not exists analysis_job_events (
  id bigserial primary key,
  job_id uuid not null references analysis_jobs(id) on delete cascade,
  event_type varchar(64) not null,
  step_name varchar(64),
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists analysis_settings (
  id uuid primary key,
  user_id uuid,
  client_session_id uuid,
  output_language varchar(16) not null default 'zh-CN',
  reasoning_depth varchar(16) not null default 'standard',
  include_alternatives boolean not null default true,
  include_visuals boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint analysis_settings_identity_ck check (
    user_id is not null or client_session_id is not null
  )
);

create table if not exists zen_chat_sessions (
  id uuid primary key,
  user_id uuid,
  client_session_id uuid not null,
  locale varchar(16) not null default 'zh-CN',
  last_provider varchar(32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists zen_chat_messages (
  id uuid primary key,
  session_id uuid not null references zen_chat_sessions(id) on delete cascade,
  role varchar(16) not null,
  content text not null,
  provider varchar(32),
  created_at timestamptz not null default now(),
  constraint zen_chat_messages_role_ck check (role in ('user', 'assistant')),
  constraint zen_chat_messages_content_len_ck check (char_length(content) between 1 and 2000)
);

create unique index if not exists idx_waitlist_email on web_waitlist_leads(email);
create index if not exists idx_waitlist_created_at on web_waitlist_leads(created_at desc);
create index if not exists idx_jobs_session_created_at on analysis_jobs(client_session_id, created_at desc);
create index if not exists idx_jobs_user_created_at on analysis_jobs(user_id, created_at desc);
create index if not exists idx_jobs_status_created_at on analysis_jobs(status, created_at desc);
create index if not exists idx_results_job_id on analysis_results(job_id);
create index if not exists idx_job_events_job_id_created_at on analysis_job_events(job_id, created_at asc);
create unique index if not exists idx_settings_user_id_unique on analysis_settings(user_id) where user_id is not null;
create unique index if not exists idx_settings_session_id_unique on analysis_settings(client_session_id) where client_session_id is not null;
create index if not exists idx_zen_chat_sessions_client_updated on zen_chat_sessions(client_session_id, updated_at desc);
create index if not exists idx_zen_chat_sessions_user_updated on zen_chat_sessions(user_id, updated_at desc);
create index if not exists idx_zen_chat_messages_session_created on zen_chat_messages(session_id, created_at asc);
```

## 6. 字段与 API 对齐

- `analysis_jobs.prompt` <-> `AnalysisJobCreateRequest.prompt`
- `analysis_jobs.parsed_context` <-> `HandContext`
- `analysis_results.recommended_action` <-> `RecommendedAction`
- `analysis_results.reasoning_summary` <-> `AnalysisResult.reasoning_summary`
- `analysis_settings.*` <-> `/analysis/settings`
- `zen_chat_sessions` / `zen_chat_messages` <-> `/api/zen/chat`

## 7. 生命周期与保留策略

- Waitlist：默认长期保留，支持按法规删除
- 分析任务：默认保留 180 天（匿名会话）
- 分析结果：随任务保留策略同步
- 事件日志：默认 30-90 天（调试用途）

## 8. 安全与合规

- 邮箱字段仅必要业务使用，不用于公开展示
- 存储 `ip_hash` 而非明文 IP
- 任务文本中如出现个人信息，支持脱敏管道
- 删除请求（DSR）需联动 `analysis_jobs` 与 `web_waitlist_leads`

## 9. 数据质量检查

- 定时任务检查无结果的 `success` 任务（异常）
- 检查 `failed_retryable` 连续重试次数阈值
- 检查 `reasoning_summary` 空数组情况

## 10. 后续扩展（M2）

- 新增 `library_documents`（知识库）
- 新增 `report_snapshots`（周期报告快照）
- 新增 `strategy_assets`（市场模板包元数据）
