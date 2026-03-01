-- US-003 commercialization: admin campaign launch source-of-truth

create table if not exists pg_mvp_coach_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_name text not null,
  target_cluster text not null,
  channel text not null check (channel in ('in_app', 'push', 'email')),
  source_window_days int not null check (source_window_days in (7, 30, 90)),
  expected_attach_lift_pct numeric(5,2) not null default 0,
  status text not null check (status in ('draft', 'launched')) default 'draft',
  created_by text not null,
  notes text,
  launched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pg_mvp_coach_campaigns_created_at
  on pg_mvp_coach_campaigns (created_at desc);

create index if not exists idx_pg_mvp_coach_campaigns_cluster_status
  on pg_mvp_coach_campaigns (target_cluster, status);
