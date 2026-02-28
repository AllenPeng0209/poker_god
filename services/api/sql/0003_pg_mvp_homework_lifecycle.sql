-- 0003_pg_mvp_homework_lifecycle.sql
-- Homework lifecycle persistence for AI coach commercialization.

create table if not exists public.pg_mvp_coach_homeworks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  source_cluster_id text,
  source_session_id text,
  status text not null check (status in ('assigned', 'in_progress', 'completed', 'archived')),
  due_at timestamptz,
  notes text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pg_mvp_coach_homeworks_user_status
  on public.pg_mvp_coach_homeworks (user_id, status, updated_at desc);

create index if not exists idx_pg_mvp_coach_homeworks_source_cluster
  on public.pg_mvp_coach_homeworks (source_cluster_id)
  where source_cluster_id is not null;
