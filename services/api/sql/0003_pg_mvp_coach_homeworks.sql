-- US-002 homework lifecycle persistence
-- Apply after 0001_pg_mvp_schema.sql

create table if not exists pg_mvp_coach_homeworks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  drill_id uuid references pg_mvp_drills(id) on delete set null,
  source_type text not null check (source_type in ('mistake_cluster', 'coach', 'admin_campaign', 'manual')),
  source_ref_id text,
  status text not null check (status in ('queued', 'in_progress', 'completed', 'canceled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_pg_mvp_coach_homeworks_user_status
  on pg_mvp_coach_homeworks (user_id, status, created_at desc);

create index if not exists idx_pg_mvp_coach_homeworks_source
  on pg_mvp_coach_homeworks (source_type, source_ref_id);
