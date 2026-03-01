# COMMERCIALIZATION_MASTER_TABLE

| Idea | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Track Coverage |
|---|---|---|---|---|---|---|
| T-021 Admin Mistake Clusters Radar (Web + API) | shipped (2026-03-01) | campaign decision time -35%; attach +2.0~3.2% | M | Supabase `pg_mvp_analyzed_hands`, ReportsWorkbench | No duplicate with funnel/retention/priority/campaign reco; cluster-level actionability | Backend ✅ Admin ✅ Mobile follow-up |
| T-022 Mobile Mistake Clusters Radar | shipped (2026-03-01) | mobile cluster diagnosis latency -30%; attach +1.2~2.0% | M | T-021 API, mobile feature flag env | No duplicate with prior mobile cards; this specifically closes cluster-level ops loop | Backend ✅ Admin ✅ Mobile ✅ |
| T-023 Admin+Mobile campaign launch attribution loop | backlog | launch-to-attach attribution coverage +20% | M | `pg_mvp_events`, web/mobile event emitters | Different from radar cards: attribution and ROI observability | Backend planned, Admin planned, Mobile planned |
