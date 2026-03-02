# Commercialization Master Table

| ID | Date | Initiative | Status | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| T-036 | 2026-03-02 | Optimize admin homework personalization radar latency with short-TTL cached snapshot | Completed | Codex | Added backend snapshot cache + metadata (`cacheHit`, `cacheAgeMs`, `cacheTtlMs`), tests, and no-op migration note. |
| T-037 | 2026-03-02 | Add stale-fallback reliability guard for admin homework personalization (backend + web visibility) | Completed | Codex | Backend serves stale snapshot on refresh failure with `staleFallbackUsed/staleDataAgeMs/refreshError`; web card shows cache/fallback health (flagged). Mobile follow-up tracked next cycle. |
