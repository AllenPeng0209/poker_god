# ZENGTO Web Environment & Deployment Guide

## 1. 文档目的

定义 Web 端本地开发、环境变量、部署流水线与发布策略，保证团队可快速一致地启动。

## 2. 技术基线（默认）

如未另行决策，采用以下默认方案：

- Framework：Next.js（App Router）
- Runtime：Node.js 20 LTS
- UI：React + TypeScript
- 请求层：`@poker-god/sdk`（统一封装）
- 质量工具：ESLint + Prettier + TypeScript strict

备注：若改用 Vite + React，接口契约与目录规范不变。

## 3. 环境分层

- `local`：开发机本地
- `staging`：预发测试
- `production`：正式环境

域名建议：

- local: `http://localhost:3000`
- staging: `https://staging.zengto.com`
- prod: `https://zengto.com`

API 域名：

- staging: `https://staging-api.zengto.com`
- prod: `https://api.zengto.com`

## 4. 环境变量规范

新建 `apps/web/.env.local`：

```bash
NEXT_PUBLIC_APP_ENV=local
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_DEFAULT_LOCALE=zh-CN
NEXT_PUBLIC_ANALYTICS_ENABLED=true
NEXT_PUBLIC_ANALYTICS_PROVIDER=posthog
NEXT_PUBLIC_ANALYTICS_KEY=<REDACTED>
NEXT_PUBLIC_FEATURE_MODE=coming_soon
NEXT_PUBLIC_WAITLIST_ENABLED=true
NEXT_PUBLIC_ANALYSIS_ENABLED=false
ANALYSIS_SERVICE_API_KEY=<SERVER_ONLY>
ZEN_API_BASE_URL=http://localhost:3001
```

规则：

- `NEXT_PUBLIC_*` 才能注入前端
- 密钥类字段不得以 `NEXT_PUBLIC_*` 暴露
- 默认值必须有安全兜底

## 5. Feature Flag 建议

- `FEATURE_MODE`: `coming_soon | live`
- `WAITLIST_ENABLED`: true/false
- `ANALYSIS_ENABLED`: true/false
- `RANGE_EXPLORER_ENABLED`: true/false
- `REPORTS_ENABLED`: true/false
- `ZEN_CHAT_ENABLED`: true/false

## 6. 本地开发流程

前置：

- Node.js 20+
- npm 10+

命令（仓库根目录）：

```bash
npm install
npm run dev:web
```

建议补充脚本（`apps/web/package.json`）：

- `dev`: 启动本地
- `build`: 生产构建
- `start`: 运行构建产物
- `lint`: 代码规范检查
- `typecheck`: TS 类型检查
- `test`: 单元测试

## 7. CI/CD 流程

## 7.1 PR 检查（必过）

- lint
- typecheck
- unit test
- build

## 7.2 合并到 main

- 自动部署 staging
- 自动执行 smoke test
- 人工确认后 promote 到 production

## 7.3 发布策略

- 先灰度 5%-20% 流量（若平台支持）
- 观测 30-60 分钟再全量

## 8. 监控与告警

前端监控：

- JS Error Rate
- Route Error
- API 4xx/5xx 比率

业务监控：

- Waitlist 提交成功率
- Analysis 提交成功率
- Analysis 任务完成时延 P95

告警阈值（建议）：

- Waitlist 成功率 < 90%
- Analysis 成功率 < 85%
- 5xx > 2% 持续 10 分钟

## 9. 安全基线

- CSP：限制脚本来源
- HSTS：生产强制 HTTPS
- 速率限制：Waitlist 与 Analysis 提交接口
- XSS 防护：渲染结果文案前统一 escape

## 10. 回滚策略

触发条件：

- 核心流程中断（提交不可用）
- 前端白屏率异常
- 5xx 突升不可恢复

回滚动作：

1. 平台回滚到上个稳定版本
2. 关闭风险 Feature Flag
3. 发布事故记录与修复计划

## 11. 上线前检查清单

- 环境变量已配置并校验
- Feature Flag 与目标版本匹配
- OpenAPI 与服务实现一致
- 埋点事件完整
- Smoke 测试通过
