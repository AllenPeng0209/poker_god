# poker_god Monorepo

This repository is organized as a monorepo to support:

- Mobile app
- Web app
- Backend API
- Shared domain and contract packages

## Folder Layout

- `apps/mobile`: Expo React Native app (migrated from previous `mobile/`)
- `apps/web`: Web app (Next.js, MVP flow connected)
- `services/api`: Backend API service (Python FastAPI + Supabase)
- `packages/domain-poker`: Pure poker domain logic shared by clients/services
- `packages/solver-core`: Solver adapters and strategy loaders
- `packages/contracts`: Shared DTOs and TypeScript types
- `packages/sdk`: Shared API client
- `packages/ui-web`: Shared web UI package (optional)
- `packages/config`: Shared configuration presets
- `infra`: Docker and infra scripts
- `docs`: Architecture and design docs

## Workspace Commands

- `npm run dev:mobile`
- `npm run dev:web`
- `npm run dev:api`

## Ralph Automation

Ralph has been added under `scripts/ralph/` from `snarktank/ralph`.

Quick start:

1. Copy example PRD:
   - `cp scripts/ralph/prd.json.example scripts/ralph/prd.json`
2. Edit `scripts/ralph/prd.json` with your real stories
3. Run Ralph:
   - Claude Code: `npm run ralph:claude`
   - Amp: `npm run ralph:amp`
   - Codex: `npm run ralph:codex`
   - Default tool (amp): `npm run ralph`

Notes:

- Ralph reads/writes `scripts/ralph/prd.json` and `scripts/ralph/progress.txt`
- You need `jq` installed and the selected CLI tool authenticated
- For Codex, ensure `codex login` has been completed
- Default max iterations is `1000` (or pass a custom number as the last arg)
- For Codex runs, one iteration times out after `1800s` by default (`CODEX_TIMEOUT_SECONDS` can override)

## Migration Status

Completed:

- Monorepo folder structure in place
- Existing mobile app moved to `apps/mobile`
- Shared package scaffolding created
- `contracts` package extracted from mobile types and connected
- `domain-poker` package extracted from mobile `engine` and `data`
- `solver-core` package extracted from mobile solver logic and data
- Mobile compatibility layer added (`apps/mobile/src/*` now re-exports shared packages)
- Web MVP loop connected (Study/Practice/Analyze/Reports/Coach)
- Backend migrated to Python FastAPI and Supabase persistence for MVP modules

Next:

- Remove duplicated transitional files from `apps/mobile/src` after verification
- Add auth and user scoping for MVP tables and routes
- Add automated API tests for critical practice/analyze/report flows
