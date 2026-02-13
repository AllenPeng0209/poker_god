# ZENGTO Web IA & Routing Spec

## 1. 文档目的

定义 ZENGTO Web 的信息架构、导航结构、路由规划和页面状态机，作为前端页面搭建、权限设计与埋点设计的统一依据。

## 2. 版本范围

- M0：Coming Soon + Waitlist（可访问、可转化）
- M1：可提交分析任务 + 查看结果 + 基础历史
- M2：Range Explorer / Reports / Library / Market 增强

## 3. 导航架构

### 3.1 一级导航（左栏）

- `+ New Solution`
- `ZEN Chat`
- `Knowledge Library`
- `Strategy Market`
- `Real-time Solver Engine`（分组标题）

### 3.2 Solver 子导航

- `Hand Analysis`
- `Range Explorer`
- `Reports & Stats`
- `AI Settings`

### 3.3 模块开放策略

- M0 开放：`+ New Solution`（落到 Coming Soon 输入态）、Waitlist CTA
- M1 开放：`+ New Solution`、`ZEN Chat`、`Hand Analysis`、`AI Settings`（最小配置）
- M2 开放：`Range Explorer`、`Reports & Stats`、`Knowledge Library`、`Strategy Market`

## 4. 路由定义

## 4.1 路由清单（建议）

| 路径 | 页面 | 里程碑 | 访问控制 | 说明 |
|---|---|---|---|---|
| `/` | Landing / Home | M0 | Public | 默认进入页，承载 Coming Soon 与主输入框 |
| `/waitlist` | Waitlist 页面（可选） | M0 | Public | 当 CTA 走独立页面时使用；默认可用弹窗替代 |
| `/app/chat` | ZEN Chat 对话页 | M1 | Public(session) / Auth | 连续策略问答与上下文追问 |
| `/app/analysis/new` | 新分析输入页 | M1 | Public(限频) / Auth | 发起新任务 |
| `/app/analysis/:jobId` | 分析结果页 | M1 | Public(仅本人匿名会话) / Auth | 查看状态与结果 |
| `/app/history` | 历史列表 | M1 | Public(匿名会话) / Auth | 最近 N 条任务 |
| `/app/settings/ai` | AI 设置 | M1 | Public(session) / Auth | 输出语言、解释深度 |
| `/app/range-explorer` | 范围探索 | M2 | Auth 优先 | 网格/热力图 |
| `/app/reports` | 报告统计 | M2 | Auth | 指标趋势 |
| `/app/library` | 知识库 | M2 | Auth | 案例沉淀 |
| `/app/market` | 策略市场 | M2 | Auth | 策略模板 |
| `/status` | 系统状态页（可选） | M1 | Public | 服务状态与公告 |

### 4.2 回退路由

- 未匹配路由 -> `404`
- 权限不足 -> `403`（或重定向到 `/` 并提示）
- 服务异常 -> `500`（提供返回首页入口）

## 5. 页面状态机

所有分析相关页面共用以下状态机语义，便于前后端统一实现。

- `idle`：未提交，展示示例和输入引导
- `validating`：本地校验中（prompt 长度、非法字符）
- `queued`：任务已创建，等待执行
- `processing`：任务执行中，展示步骤进度
- `partial`：部分结果可用（可选）
- `success`：返回最终建议与图表
- `failed_retryable`：可重试错误（超时、网关错误）
- `failed_fatal`：不可重试错误（参数不合法等）

状态迁移约束：

- `idle -> validating -> queued -> processing -> success`
- `processing -> failed_retryable -> queued`（重试）
- `processing -> failed_fatal`（需重新提交）

## 6. URL 查询参数规范

为可分享和可复盘，支持以下 query 参数。

- `lang`：`zh-CN | en-US`
- `source`：流量来源（如 `x`, `youtube`, `direct`）
- `prompt`：预填问题（URL 编码）
- `mode`：`coming_soon | live`
- `tab`：子模块（如 `hand-analysis`, `reports`）

约束：

- 不在 URL 暴露敏感字段（邮箱、用户标识）
- `prompt` 超长时使用本地缓存 key 替代

## 7. 会话与权限

### 7.1 匿名模式（M0/M1 默认）

- 通过 `client_session_id` 标识会话
- 可提交分析，但有速率限制
- 历史只保存在本会话范围（可本地 + 服务端短期）

### 7.2 登录模式（M1 可选 / M2 建议）

- 支持长期历史、跨端同步、报告能力
- 需要绑定账号后访问 `reports/library/market`

## 8. 导航交互规则

- 一级导航点击后，主工作区切页，左栏状态高亮
- 子导航仅在 `Real-time Solver Engine` 组展开时显示
- `+ New Solution` 永远可见，且始终可一键回到输入态
- Coming Soon 状态下，禁止进入未开放模块，显示“预计开放时间 + 预约入口”

## 9. 多语言与文案策略

- 默认语言：`zh-CN`
- 若浏览器语言为英文且无手动设置，则自动 `en-US`
- 顶部不显示语言切换时，至少在设置页可切换
- 核心术语统一词表：
  - Hand Analysis
  - Range Explorer
  - Reports & Stats
  - Effective Stack
  - Recommended Action

## 10. 埋点映射（路由层）

- 路由首屏：`page_view`
- 导航点击：`nav_click`
- 路由切换完成：`route_change_success`
- 路由失败：`route_change_error`

事件字段最小集合：

- `route`
- `prev_route`
- `session_id`
- `user_id`（可空）
- `lang`
- `timestamp`

## 11. 交付物与验收

前端完成 IA 与路由开发的验收标准：

- 可从 `/` 正常导航到已开放页面
- 未开放模块有统一占位态与返回路径
- 分析页状态机可正确切换
- 关键路由埋点能被上报
- 404/500 页面可访问且具备返回入口
