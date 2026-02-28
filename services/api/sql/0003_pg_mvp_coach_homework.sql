-- Homework inbox persistence for AI coach commercialization loop.
-- Adds durable storage for mobile/admin homework lifecycle.

create table if not exists pg_mvp_coach_homework_items (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  title text not null,
  objective text not null,
  status text not null check (status in ('pending', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pg_mvp_coach_homework_conversation_created
  on pg_mvp_coach_homework_items (conversation_id, created_at desc);

create index if not exists idx_pg_mvp_coach_homework_status
  on pg_mvp_coach_homework_items (status, updated_at desc);
