# API Service

Fastify-based backend service.

## Commands

- `npm --workspace @poker-god/api run dev`
- `npm --workspace @poker-god/api run build`
- `npm --workspace @poker-god/api run start`

## Endpoints

- `GET /health`
- `GET /api/training/zones`
- `POST /api/zen/chat`

## Current Notes

- Uses `@poker-god/contracts` for response typing.
- Uses `@poker-god/domain-poker` for training zone domain data.
- Runtime uses `tsx` directly (no JS emit step yet).
- ZEN Chat supports optional provider envs:
  - `ZEN_CHAT_PROVIDER=heuristic|openai|qwen|auto`
  - `ZEN_OPENAI_API_KEY` / `ZEN_OPENAI_MODEL`
  - `ZEN_QWEN_API_KEY` / `ZEN_QWEN_MODEL`
