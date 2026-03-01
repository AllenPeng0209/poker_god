# HOURLY_BUILD_LOG

## 2026-03-02 04:24 (Asia/Shanghai)
- Branch: `pg/hourly-20260302-0424-service-path-migration`
- Focus: T-029 — US-001 failure error contract hardening + architecture migration step to `services/poker_god_api`
- Changed files:
  - `services/api/app/main.py`
  - `services/api/tests/test_validation_error_codes.py`
  - `services/poker_god_api/__init__.py`
  - `services/poker_god_api/main.py`
  - `services/poker_god_api/tests/test_runtime_alias.py`
  - `docs/product/2026-03-02-us001-error-contract-runtime-alias.md`
  - `docs/product/COMMERCIALIZATION_MASTER_TABLE.md`
  - `docs/product/HOURLY_BUILD_LOG.md`
  - `tasks/prd-poker-god-hourly-commercialization.md`
- Validation:
  - `PYTHONPATH=services/api services/api/.venv/bin/python -m unittest -q services/api/tests/test_validation_error_codes.py` ✅
  - `PYTHONPATH=services services/api/.venv/bin/python -m unittest -q services/poker_god_api/tests/test_runtime_alias.py` ✅
  - `services/api/.venv/bin/python -m py_compile services/api/app/main.py services/poker_god_api/main.py` ✅
- Push result: pending
- Blockers: none
- Next action: web/mobile consume `invalid_request_payload` contract with feature-flagged user guidance copy.
