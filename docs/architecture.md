# Architecture Notes

## Principles

- Frontend/backend separation by deployment unit.
- Domain logic is platform-agnostic and lives in shared packages.
- API contracts are centralized and versioned.
- Apps depend on shared packages, never on each other.

## Dependency Rules

- `apps/*` can depend on `packages/*` and backend APIs.
- `services/*` can depend on `packages/*`.
- `packages/domain-poker` must not import UI or Node-specific APIs.
- `packages/contracts` is the source of truth for API and domain types.

## Extraction Roadmap

1. Done: moved `src/types/poker.ts` from mobile to `packages/contracts`.
2. Done: moved pure domain modules from mobile engine/data to `packages/domain-poker`.
3. Done: moved solver logic/data to `packages/solver-core`.
4. In progress: keep platform-specific storage/audio/UI code inside app folders.
5. Next: use `packages/sdk` for all API calls from web/mobile.
