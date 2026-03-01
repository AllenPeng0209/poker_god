# COMMERCIALIZATION_MASTER_TABLE

| ID | Idea | Track | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Next Step |
|---|---|---|---|---|---|---|---|---|
| T-031 | US-002 homework lifecycle persistence API + status transition guardrails | Backend reliability + coach retention loop | In progress (2026-03-02 06:30 Asia/Shanghai) | coach_homework_attach_rate +2.5~4.0%; homework_completion_d7 +2~3%; homework_state_recovery_after_restart to deterministic | M | FastAPI routes + Supabase migration + unit tests | Checked against previous T-001 intent; implemented on current mainline, but validation blocked by missing Python deps on host | Install Python deps, rerun tests, then add web admin lifecycle ops panel + mobile status card consuming `/api/coach/homeworks/*` |
