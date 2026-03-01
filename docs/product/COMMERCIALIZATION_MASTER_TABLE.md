# COMMERCIALIZATION_MASTER_TABLE

| ID | Idea | Status | Track | KPI Impact | Complexity | Dependencies | Duplicate Check | Notes |
|---|---|---|---|---|---|---|---|---|
| PG-T027 | Coach mistakes summary API (`/api/coach/mistakes/summary`) | shipped (2026-03-02 00:23 Asia/Shanghai) | backend (this run), admin/mobile follow-up tracked | attach rate +2.0%~3.5%, mistake→homework latency -25%~-35% | M | Supabase `pg_mvp_analyzed_hands` | checked: no dedicated coach mistakes summary API existed | Next run: wire Admin+Mobile cards to this API under flags |
| PG-T028 | Coach homework traceability from mistake cluster (`POST /api/coach/actions/create-drill`) | shipped (2026-03-02 01:24 Asia/Shanghai) | backend (this run), admin/mobile rendering follow-up tracked | targeted attach +2.0%~3.0%, origin explain latency -60% | M | Supabase `pg_mvp_drills` + migration `0004_pg_mvp_drills_traceability.sql` | checked: no persisted mistake-cluster lineage on drills/homeworks | Next run: show traceability badges in web/mobile under feature flags |
