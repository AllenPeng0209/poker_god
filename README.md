# poker_god Monorepo

This repository is organized as a monorepo to support:

- Mobile app
- Web app
- Backend API
- Shared domain and contract packages

## Folder Layout

- `apps/mobile`: Expo React Native app (migrated from previous `mobile/`)
- `apps/web`: Web app (scaffold)
- `services/api`: Backend API service (scaffold)
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

## Migration Status

Completed:

- Monorepo folder structure in place
- Existing mobile app moved to `apps/mobile`
- Shared package scaffolding created
- `contracts` package extracted from mobile types and connected
- `domain-poker` package extracted from mobile `engine` and `data`
- `solver-core` package extracted from mobile solver logic and data
- Mobile compatibility layer added (`apps/mobile/src/*` now re-exports shared packages)

Next:

- Remove duplicated transitional files from `apps/mobile/src` after verification
- Add real backend framework and endpoints in `services/api`
- Build `apps/web` with framework and connect `@poker-god/sdk`
