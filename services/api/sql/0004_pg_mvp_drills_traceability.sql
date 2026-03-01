-- Track coach homework generation lineage back to mistake clusters.
-- Supports US-001 acceptance: 作业生成可追溯到漏点cluster.

alter table if exists pg_mvp_drills
  add column if not exists mistake_cluster text,
  add column if not exists source_window_days int,
  add column if not exists source_sample_size int,
  add column if not exists source_total_ev_loss_bb100 numeric(10,2);

alter table if exists pg_mvp_drills
  drop constraint if exists pg_mvp_drills_source_window_days_check;

alter table if exists pg_mvp_drills
  add constraint pg_mvp_drills_source_window_days_check
  check (source_window_days is null or source_window_days in (7, 30, 90));

create index if not exists idx_pg_mvp_drills_mistake_cluster_created_at
  on pg_mvp_drills (mistake_cluster, created_at desc);
