# COMMERCIALIZATION_MASTER_TABLE

| ID | Track | Surface | Idea | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Notes |
|---|---|---|---|---|---|---|---|---|---|
| T-028 | Reliability/Production Readiness | Admin(Web)+Mobile+Backend | US-001 one-command quality gate (`npm run quality:us001`) covering web/mobile typecheck + backend validation contract test | Done (2026-03-02 03:24 Asia/Shanghai) | Regression escape rate -25%, integration triage time -30% | S | Existing monorepo scripts + Python gate runner | Not duplicate of prior API-only hardening; this is cross-surface preflight | Explicit admin/mobile/backend tracking in one command |
