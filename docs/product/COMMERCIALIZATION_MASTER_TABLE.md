# COMMERCIALIZATION_MASTER_TABLE

| ID | Track | Surface | Idea | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Notes |
|---|---|---|---|---|---|---|---|---|---|
| T-027 | Reliability/Production Readiness | Backend (admin/mobile clients consume) | Standardize validation failures to stable API error code envelope (`invalid_request_payload`) | Done (2026-03-02 02:24 Asia/Shanghai) | Triage time -30%, unknown-error bucket -40% | S | FastAPI exception layer | Checked against prior T-001~T-026; no explicit validation-error-code hardening item found | Admin/Mobile follow-up: consume `code` for deterministic UX copy |
