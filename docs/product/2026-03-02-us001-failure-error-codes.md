# 2026-03-02 — US-001 Failure Error Codes (Backend Hardening)

## Context
US-001 still had an unchecked acceptance criterion: failure scenarios must return explicit machine-readable error codes. Current FastAPI validation failures returned framework-default payloads that were not stable for admin/mobile clients.

## User Flow
1. Admin/mobile/agent calls API with malformed payload.
2. Backend returns HTTP 422 with stable envelope `{ code, message, requestId }`.
3. Client can branch on `code=invalid_request_payload` and show deterministic UX copy/retry guidance.

## KPI Hypothesis
- API integration failure triage time: **-30%**
- Client-side unknown-error bucket: **-40%**
- Release rollback caused by payload mismatch: **-20%**

## Acceptance Criteria
- [x] Validation failures return explicit error code `invalid_request_payload`
- [x] Error payload includes `requestId` for observability correlation
- [x] Automated test covers malformed payload path on `/api/coach/chat`
- [x] Architecture alignment preserved (backend logic in Python service)

## Rollout / Feature Flag
- No feature flag required (non-breaking additive stabilization of error envelope)
- Rollout: immediate in backend deployment window
- Rollback: revert `RequestValidationError` handler in `services/api/app/main.py`

## Validation Notes
- Command: `PYTHONPATH=services/api python3 -m unittest -q services/api/tests/test_validation_error_codes.py`
- Expected: 1 test pass, response has code/message/requestId

## Migration Notes
- DB migration: none
- API contract migration: client teams should switch malformed payload handling to `code === "invalid_request_payload"`

## Architecture Rule Check
- FE: unchanged (`apps/web`, `apps/mobile`)
- BE: changed (`services/api` Python service; alias path to `services/poker_god_api` remains future migration track)
- DB: unchanged (Supabase source-of-truth)
