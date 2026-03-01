-- Campaign attribution loop optimization
-- Supports fast lookup for campaign launch -> attach/completion correlation.

create index if not exists idx_pg_mvp_events_campaign_id
  on pg_mvp_events ((payload ->> 'campaignId'))
  where event_name in ('coach_campaign_launched', 'coach_action_executed', 'drill_completed');

create index if not exists idx_pg_mvp_events_event_time_name
  on pg_mvp_events (event_time desc, event_name);
