# COMMERCIALIZATION_MASTER_TABLE

| ID | Idea | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Track Coverage |
|---|---|---|---|---|---|---|---|
| PG-COM-001 | Practice lifecycle failure-scenario validation hardening | Shipped (T-003) | failure_rate -20%, support_tickets -15% | S | services/api, Supabase | Not duplicate: focuses on failure-path reliability, not feature expansion | Backend ✅ / Admin 🔄 next / Mobile 🔄 next |
| PG-COM-002 | Admin campaign launch from leak analysis | Backlog | attach_rate +3~5% | M | apps/web, services/poker_god_api, Supabase | Distinct from validation hardening | Backend 🔄 / Admin 🎯 / Mobile ⏳ |
| PG-COM-003 | Mobile homework diagnosis card | Backlog | completion +3% | M | apps/mobile, services/poker_god_api | Distinct from admin launch and backend validation | Backend 🔄 / Admin ⏳ / Mobile 🎯 |

## Coverage Tracker (hourly rotation)
- Backend: 2026-02-28 18:45 — failure-path validation + scenario harness
- Admin: next target = campaign launch entry with feature flag in `apps/web`
- Mobile: next target = diagnosis/homework card with completion loop in `apps/mobile`
