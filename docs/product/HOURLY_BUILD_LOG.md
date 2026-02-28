# HOURLY BUILD LOG

## 2026-02-28 16:43 (Asia/Shanghai) — pg/hourly-20260228-1643-homework-supabase

### PRD backlog selection
- Selected exactly one PRD item: **T-003 补齐验证脚本与失败场景测试**.

### Highest-impact optimization
- Replaced fragile in-memory homework lifecycle with **Supabase-backed durable coach homework persistence**.
- This removes restart data loss in the core AI coach retention loop.

### Changed files
- `services/api/app/schemas.py`
- `services/api/app/services.py`
- `services/api/app/main.py`
- `services/api/sql/0003_pg_mvp_coach_homework.sql`
- `services/api/tests/test_coach_homework.py`
- `docs/product/2026-02-28-pg-027-homework-supabase-persistence.md`
- `docs/product/COMMERCIALIZATION_MASTER_TABLE.md`
- `docs/product/HOURLY_BUILD_LOG.md`
- `prd/prd-poker-god.md`

### Validation evidence
- `npm run build:api` ✅
- `cd services/api && .venv/bin/python -m unittest discover -s tests -q` ✅ (3 tests)

### Data / Model / API updates
- Added Supabase migration: `0003_pg_mvp_coach_homework.sql`.
- Added models/APIs:
  - `POST /api/coach/homework`
  - `GET /api/coach/homework/inbox?conversationId=...`
  - `POST /api/coach/homework/items/{item_id}/status`
- Added failure guardrails:
  - 409 when item missing
  - 409 when attempting `completed -> in_progress`

### Rollout / feature flag
- `coach_homework_supabase_v1` (QA -> 20% -> 100%).

### Blockers
- None for local delivery.

### Next action
- Implement PG-028 admin homework operations queue to satisfy admin-surface rotation.

### Push result
- Pending this run (see git push output in summary).
