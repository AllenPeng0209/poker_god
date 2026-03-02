-- T-033: Analytics event deduplication guardrail
-- Architecture target: Python backend (`services/api`) + Supabase source-of-truth.

alter table if exists public.pg_mvp_events
  add column if not exists event_id text,
  add column if not exists event_fingerprint text;

create unique index if not exists pg_mvp_events_event_fingerprint_uidx
  on public.pg_mvp_events (event_fingerprint)
  where event_fingerprint is not null;

create index if not exists pg_mvp_events_event_id_idx
  on public.pg_mvp_events (event_id)
  where event_id is not null;
