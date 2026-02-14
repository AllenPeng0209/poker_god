# API Service (Python + FastAPI + Supabase)

Backend has been migrated to Python and stores MVP data in Supabase tables prefixed with `pg_mvp_`.

## Install

- `npm --workspace @poker-god/api run install:deps`
- `cp services/api/.env.example services/api/.env` and fill Supabase keys
- Apply SQL schema: run `services/api/sql/0001_pg_mvp_schema.sql` in Supabase SQL editor

## Commands

- `npm --workspace @poker-god/api run dev`
- `npm --workspace @poker-god/api run build`
- `npm --workspace @poker-god/api run start`

## Required Env

- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY` (preferred)
  - Fallback: `SUPABASE_KEY` (建议同样使用 service role key)
- `HOST` (optional, default `0.0.0.0`)
- `PORT` (optional, default `3001`)
- `CORS_ORIGIN` (optional, default `*`, supports comma-separated domains)

## Production Security Env

- `APP_VERSION` (returned by `/ready`)
- `API_KEY_REQUIRED=true|false`
- `API_KEY` (required when `API_KEY_REQUIRED=true`; send via `x-api-key` or `Authorization: Bearer <key>`)
- `MAX_REQUEST_BODY_BYTES` (default `2097152`)
- `RATE_LIMIT_ENABLED=true|false`
- `RATE_LIMIT_WINDOW_SEC` (default `60`)
- `RATE_LIMIT_REQUESTS` (default `120`)

## Optional ZEN Chat Env

- `ZEN_CHAT_PROVIDER=heuristic|openai|qwen|auto`
- `ZEN_OPENAI_API_KEY`, `ZEN_OPENAI_ENDPOINT`, `ZEN_OPENAI_MODEL`
- `ZEN_QWEN_API_KEY`, `ZEN_QWEN_ENDPOINT`, `ZEN_QWEN_MODEL`
- Bailian / DashScope workspace:
  - `ZEN_BAILIAN_ENDPOINT`
  - `ZEN_BAILIAN_WORKSPACE_ID`
  - `ZEN_BAILIAN_USE_WORKSPACE=true|false`

Mobile env alias (optional, backend will auto-read):
- `EXPO_PUBLIC_COACH_VOICE_PROVIDER`
- `EXPO_PUBLIC_OPENAI_API_KEY`, `EXPO_PUBLIC_OPENAI_ENDPOINT`, `EXPO_PUBLIC_OPENAI_OMNI_MODEL`
- `EXPO_PUBLIC_QWEN_API_KEY`, `EXPO_PUBLIC_QWEN_ENDPOINT`, `EXPO_PUBLIC_QWEN_MODEL`
- `EXPO_PUBLIC_BAILIAN_API_KEY`, `EXPO_PUBLIC_BAILIAN_ENDPOINT`
- `EXPO_PUBLIC_BAILIAN_WORKSPACE_ID`, `EXPO_PUBLIC_BAILIAN_USE_WORKSPACE`

## Endpoints

- `GET /health`
- `GET /ready`
- `GET /api/training/zones`
- `GET /api/study/spots`
  - Query: `format`, `position`, `stackBb`, `street`, `limit`, `offset`
- `POST /api/zen/chat`
- `GET /api/practice/drills`
- `POST /api/practice/drills`
- `POST /api/practice/sessions/start`
- `POST /api/practice/sessions/:sessionId/answer`
- `POST /api/practice/sessions/:sessionId/complete`
- `POST /api/analyze/uploads`
- `GET /api/analyze/uploads/:uploadId`
- `GET /api/analyze/hands`
- `GET /api/reports/leaks`
- `POST /api/coach/chat`
- `POST /api/coach/actions/create-drill`
- `POST /api/coach/actions/create-plan`
- `POST /api/events`

## Commercialization Notes

- 推荐在生产环境启用 `API_KEY_REQUIRED=true` 并配置网关层鉴权（JWT/session）；
- `GET /ready` 会检查 Supabase 连通性，可直接接入容器编排 readinessProbe；
- API 已启用基础限流与请求体大小保护，建议再叠加 WAF/CDN 级别防护。
