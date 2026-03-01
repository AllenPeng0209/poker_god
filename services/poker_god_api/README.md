# services/poker_god_api

Architecture migration scaffold toward the mandatory backend target `services/<project>/`.

Current runtime backend remains in `services/api`.

Migration plan:
1. Move FastAPI app package from `services/api/app` to `services/poker_god_api/app`.
2. Keep `/api/*` routes unchanged (no client impact).
3. Re-point workspace script `@poker-god/api` to this folder once parity tests pass.
