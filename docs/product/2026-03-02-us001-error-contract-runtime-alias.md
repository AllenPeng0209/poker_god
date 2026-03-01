# Feature Spec — US-001 Failure Error Contract + Backend Runtime Alias

## Why this is the highest-impact optimization now
Current commercialization blocker is API integration instability: frontend/mobile/admin cannot reliably classify malformed request failures. This creates noisy support tickets, slower incident triage, and weak attribution of coach funnel drop-offs.

This package hardens a stable error contract and aligns backend runtime path to `services/<project>/` without risky rewrite.

## Scope
- **Backend (implemented):**
  - Add FastAPI `RequestValidationError` handler in `services/api/app/main.py`
  - Enforce stable envelope: `code=invalid_request_payload`, `message`, `requestId`
  - Add architecture-aligned runtime alias at `services/poker_god_api/main.py`
- **Admin/Web follow-up (tracked):** wire all admin error toasts to `invalid_request_payload`
- **Mobile follow-up (tracked):** map API errors to user-safe hints + retry guidance

## User flow
1. Client sends malformed payload to coach endpoint
2. Backend returns deterministic 422 contract
3. Admin/mobile detect `invalid_request_payload`
4. UI shows actionable correction instead of generic unknown error

## KPI hypothesis
- `unknown_error_bucket_rate` **-40%**
- `api_integration_triage_time` **-30%**
- `coach_action_dropoff_due_to_payload_errors` **-15%**

## Acceptance Criteria
- [x] Validation failures return `invalid_request_payload`
- [x] Error response includes `requestId` for support tracing
- [x] Runtime alias exists under `services/poker_god_api`
- [x] Unit tests pass for contract and runtime alias
- [ ] Admin UI maps contract into explicit remediation copy (next)
- [ ] Mobile UI maps contract into explicit remediation copy (next)

## API contract
- **Status:** `422`
- **Body:**
  - `code: "invalid_request_payload"`
  - `message: string`
  - `requestId: string`

## Migration / rollout notes
- No DB migration required in this run.
- Safe rollout: backend-only behavior hardening, backwards-compatible for clients already handling 422.
- Next step: feature-flagged admin/mobile copy updates to consume this contract.

## Validation
- `PYTHONPATH=services/api services/api/.venv/bin/python -m unittest -q services/api/tests/test_validation_error_codes.py`
- `PYTHONPATH=services services/api/.venv/bin/python -m unittest -q services/poker_god_api/tests/test_runtime_alias.py`
- `services/api/.venv/bin/python -m py_compile services/api/app/main.py services/poker_god_api/main.py`
