# COMMERCIALIZATION_MASTER_TABLE

| ID | Idea | Track | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Next Step |
|---|---|---|---|---|---|---|---|---|
| T-031 | US-002 homework lifecycle persistence API + status transition guardrails | Backend reliability + coach retention loop | Done (2026-03-02 07:25 Asia/Shanghai) | coach_homework_attach_rate +2.5~4.0%; homework_completion_d7 +2~3%; homework_state_recovery_after_restart to deterministic | M | FastAPI routes + Supabase migration + unit tests | Checked against previous T-001 intent; no duplicate with prior lifecycle work; this run closes quality-gate gap | Next: admin lifecycle operations panel (apps/web) + mobile homework status card (apps/mobile) consuming `/api/coach/homeworks/*` under feature flags |
