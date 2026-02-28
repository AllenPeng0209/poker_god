# poker_god_api (migration scaffold)

This directory is the architecture-aligned backend target (`services/<project>/`).

Current production API code still lives in `services/api`. During hourly hardening work,
we are migrating modules incrementally to this path to enforce FE/BE split policy:

- Frontend: `apps/web` + `apps/mobile`
- Backend: `services/poker_god_api`
- Database: Supabase

Next migration step:
1. Move `services/api/app` to `services/poker_god_api/app`
2. Keep a temporary compatibility import bridge in `services/api`
3. Update deployment entrypoint to `services/poker_god_api/app/main.py`
