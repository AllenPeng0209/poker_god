# COMMERCIALIZATION_MASTER_TABLE

| ID | Idea | Track | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Next Step |
|---|---|---|---|---|---|---|---|---|
| T-030 | US-003 Admin campaign launch API + flagged web entry + Supabase audit persistence | Admin growth ops + backend reliability | Done (2026-03-02 05:32 Asia/Shanghai) | diagnosis_to_campaign_launch_lead_time -35%; ops_campaign_execution_rate +15%; coach_homework_attach_rate +2~4% | M | FastAPI endpoint + Supabase migration + Next.js flag + contracts update | Checked against T-019/T-023 (recommendation+attribution already exist); this run adds missing executable launch path | Add mobile campaign launch/read-only card under `apps/mobile` with same audit fields |
