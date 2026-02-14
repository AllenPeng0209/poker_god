-- Core schema for @poker-god/api MVP runtime tables.
-- Apply in Supabase SQL editor or migration pipeline before starting API in production.

create extension if not exists pgcrypto;

create table if not exists pg_mvp_drills (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null check (source_type in ('study', 'analyze', 'coach', 'manual')),
  source_ref_id text,
  tags jsonb not null default '[]'::jsonb,
  item_count int not null check (item_count >= 1 and item_count <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pg_mvp_drill_items (
  id uuid primary key default gen_random_uuid(),
  drill_id uuid not null references pg_mvp_drills(id) on delete cascade,
  sort_index int not null,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  recommended_action text not null,
  ev_loss_bb100 numeric(10,2) not null default 0,
  frequency_gap_pct numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (drill_id, sort_index)
);

create table if not exists pg_mvp_practice_sessions (
  id uuid primary key default gen_random_uuid(),
  drill_id uuid not null references pg_mvp_drills(id) on delete restrict,
  mode text not null check (mode in ('by_spot', 'by_street', 'full_hand')),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced', 'elite')),
  status text not null check (status in ('active', 'completed')),
  total_items int not null,
  answered_items int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists pg_mvp_practice_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references pg_mvp_practice_sessions(id) on delete cascade,
  item_id uuid not null references pg_mvp_drill_items(id) on delete restrict,
  chosen_action text not null,
  decision_time_ms int not null check (decision_time_ms >= 1),
  correct boolean not null,
  recommended_action text not null,
  ev_loss_bb100 numeric(10,2) not null default 0,
  frequency_gap_pct numeric(10,2) not null default 0,
  explanation text not null,
  created_at timestamptz not null default now()
);

create table if not exists pg_mvp_analyze_uploads (
  id uuid primary key default gen_random_uuid(),
  source_site text not null,
  file_name text not null,
  status text not null check (status in ('uploaded', 'parsing', 'parsed', 'failed')),
  hands_count int not null default 0,
  error_message text,
  raw_content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pg_mvp_analyzed_hands (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references pg_mvp_analyze_uploads(id) on delete cascade,
  played_at timestamptz not null,
  position text not null,
  street text not null check (street in ('preflop', 'flop', 'turn', 'river')),
  ev_loss_bb100 numeric(10,2) not null default 0,
  tags jsonb not null default '[]'::jsonb,
  summary text not null default ''
);

create table if not exists pg_mvp_weekly_plans (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  focus text not null,
  week_start date not null,
  tasks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_start, focus)
);

create table if not exists pg_mvp_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_time timestamptz not null,
  session_id text not null,
  user_id text,
  route text not null,
  module text not null,
  request_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists pg_mvp_study_spots (
  id text primary key,
  title text not null,
  format text not null check (format in ('Cash 6-max', 'Cash Heads-Up', 'MTT 9-max')),
  position text not null check (position in ('BTN vs BB', 'CO vs BTN', 'SB vs BB', 'UTG vs BB')),
  stack_bb int not null check (stack_bb in (20, 40, 60, 100)),
  street text not null check (street in ('Flop', 'Turn', 'River')),
  node jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pg_mvp_drills_created_at on pg_mvp_drills (created_at desc);
create index if not exists idx_pg_mvp_drill_items_drill_id on pg_mvp_drill_items (drill_id);
create index if not exists idx_pg_mvp_practice_sessions_drill_id on pg_mvp_practice_sessions (drill_id);
create index if not exists idx_pg_mvp_practice_answers_session_id on pg_mvp_practice_answers (session_id);
create index if not exists idx_pg_mvp_analyze_uploads_created_at on pg_mvp_analyze_uploads (created_at desc);
create index if not exists idx_pg_mvp_analyzed_hands_upload_id on pg_mvp_analyzed_hands (upload_id);
create index if not exists idx_pg_mvp_analyzed_hands_played_at on pg_mvp_analyzed_hands (played_at desc);
create index if not exists idx_pg_mvp_analyzed_hands_ev_loss on pg_mvp_analyzed_hands (ev_loss_bb100 desc);
create index if not exists idx_pg_mvp_events_event_time on pg_mvp_events (event_time desc);
create index if not exists idx_pg_mvp_study_spots_filter on pg_mvp_study_spots (format, position, stack_bb, street);
