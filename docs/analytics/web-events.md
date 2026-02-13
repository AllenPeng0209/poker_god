# ZENGTO Web Analytics Tracking Spec

## 1. 文档目的

定义 Web 端事件埋点模型、事件字典、参数规范与质量校验，用于衡量 M0-M1 的转化与可用性。

## 2. 目标指标

M0 关注：

- `Waitlist CVR` = `waitlist_submit` / `page_view_home`
- `CTA CTR` = `waitlist_click` / `page_view_home`

M1 关注：

- `Submit Rate` = `submit_analysis` / `page_view_home`
- `Success Rate` = `analysis_success` / `submit_analysis`
- `P95 Latency` = `analysis_complete_ms` P95
- `D1 Return`（提交过分析的用户次日回访）

## 3. 埋点通用字段

所有事件必须包含：

- `event_name`
- `event_time`（ISO8601 UTC）
- `session_id`
- `user_id`（匿名可空）
- `route`
- `referrer`
- `locale`
- `env`（dev/staging/prod）
- `app_version`

建议字段：

- `source`（流量来源）
- `utm_*`
- `device_type`（desktop/tablet/mobile）
- `network_type`（可选）

## 4. 事件字典

## 4.1 页面与导航

### `page_view_home`

触发：进入首页 `/` 首次渲染完成。

参数：

- `is_logged_in` (boolean)
- `mode` (`coming_soon|live`)

### `nav_click`

触发：点击左导航任意项。

参数：

- `nav_item` (`new_solution|zen_chat|knowledge_library|strategy_market|hand_analysis|range_explorer|reports_stats|ai_settings`)
- `target_route`
- `is_locked` (boolean)

### `route_change_success`

触发：路由切换完成。

参数：

- `from_route`
- `to_route`
- `duration_ms`

## 4.2 Waitlist

### `waitlist_click`

触发：点击 `成为首批内测玩家`。

参数：

- `entry` (`hero_cta|nav|modal`)

### `waitlist_submit`

触发：表单提交成功。

参数：

- `entry`
- `domain`（邮箱域名，例 `gmail.com`，不记录完整邮箱）
- `submit_latency_ms`

### `waitlist_submit_failed`

触发：提交失败。

参数：

- `entry`
- `error_code`
- `http_status`

## 4.3 Analysis Flow

### `click_new_solution`

触发：点击 `+ New Solution`。

参数：

- `entry` (`side_nav|hero_button|keyboard_shortcut`)

### `submit_analysis`

触发：分析请求提交成功（拿到 job_id）。

参数：

- `job_id`
- `prompt_length`
- `has_context_structured` (boolean)
- `reasoning_depth` (`brief|standard|deep`)
- `output_language`

### `analysis_status_changed`

触发：任务状态变化。

参数：

- `job_id`
- `from_status`
- `to_status`
- `duration_ms`（从上一个状态到本状态）

### `analysis_success`

触发：任务成功完成。

参数：

- `job_id`
- `analysis_complete_ms`
- `recommended_action` (`fold|call|raise`)
- `confidence`

### `analysis_failed`

触发：任务失败。

参数：

- `job_id`
- `status` (`failed_retryable|failed_fatal`)
- `error_code`
- `analysis_elapsed_ms`

### `analysis_retry_click`

触发：用户点击重试。

参数：

- `job_id`
- `retry_index`

### `copy_result`

触发：用户复制分析结果。

参数：

- `job_id`
- `copy_target` (`summary|full_result`)

## 4.4 ZEN Chat

### `zen_chat_submit`

触发：用户发送一条聊天消息。

参数：

- `session_id`
- `message_length`
- `history_length`

### `zen_chat_response`

触发：收到 ZEN Chat 回复。

参数：

- `session_id`
- `provider` (`heuristic|openai|qwen|fallback`)
- `latency_ms`
- `suggestions_count`

### `zen_chat_error`

触发：聊天请求失败。

参数：

- `session_id`
- `error_code`
- `http_status`

## 4.5 Settings

### `ai_settings_updated`

触发：更新设置成功。

参数：

- `output_language`
- `reasoning_depth`
- `include_alternatives`
- `include_visuals`

## 5. 漏斗定义

## 5.1 M0 Waitlist 漏斗

1. `page_view_home`
2. `waitlist_click`
3. `waitlist_submit`

## 5.2 M1 分析漏斗

1. `page_view_home`
2. `click_new_solution`
3. `submit_analysis`
4. `analysis_success`
5. `copy_result`（价值行为）

## 6. 指标口径

- 成功率以 `job_id` 去重
- 用户口径优先 `user_id`，匿名回退 `session_id`
- 时延以服务端返回 `latency_ms` 为准，前端仅做补充观测

## 7. 数据质量保障

- 必填字段缺失率 < 0.5%
- 同一 `job_id` 事件顺序必须满足状态机
- 事件上报失败重试最多 2 次，防止重复风暴
- 重复事件去重键：`event_name + session_id + timestamp_bucket(1s)`

## 8. 仪表盘建议

- Dashboard A（M0）：流量来源、CTA CTR、Waitlist CVR
- Dashboard B（M1）：提交量、成功率、时延分布、失败原因 Top N
- Dashboard C（留存）：提交用户 D1/D7 回访

## 9. 隐私与合规

- 不上报明文邮箱
- 不上报完整手牌原文到第三方分析平台（只上报长度/摘要标签）
- 仅内部受控日志可保留原始 prompt（用于质量改进）

## 10. 实施清单

- 前端：事件 SDK 封装 + 埋点触发
- 后端：关键任务状态上报
- 数据：漏斗模型与看板
- QA：埋点回归脚本（核心事件逐条校验）
