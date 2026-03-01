# services/poker_god_api

Architecture target backend service entrypoint (`services/<project>/`).

## Why this exists

Current API implementation lives in `services/api/app`. This package provides an
architecture-aligned import path for deployment/runtime and future code moves,
without breaking existing code today.

## Runtime

Use this app target for new infra/runtime wiring:

```bash
uvicorn services.poker_god_api.main:app --host 0.0.0.0 --port 3001
```

## Migration plan

1. Keep feature delivery in `services/api/app` while migration is in progress.
2. Route all new runtime scripts/config to `services.poker_god_api.main:app`.
3. Incrementally move backend modules under `services/poker_god_api/` in follow-up tasks.
