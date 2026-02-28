-- Admin leak-to-campaign launch pipeline (commercialization track)

create table if not exists pg_mvp_leak_campaigns (
  id uuid primary key default gen_random_uuid(),
  leak_id text not null,
  leak_tag text not null,
  leak_title text not null,
  title text not null,
  owner text not null,
  channel text not null check (channel in ('in_app', 'push', 'email')),
  feature_flag text not null default 'admin_campaign_launch_v1',
  status text not null check (status in ('draft', 'active', 'paused')) default 'draft',
  kpi_metric text not null default 'coach_homework_attach_rate',
  target_lift_pct numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pg_mvp_leak_campaigns_created_at
  on pg_mvp_leak_campaigns (created_at desc);

create index if not exists idx_pg_mvp_leak_campaigns_leak_tag
  on pg_mvp_leak_campaigns (leak_tag);
