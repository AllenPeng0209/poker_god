# COMMERCIALIZATION_MASTER_TABLE

| ID | Idea | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Track Coverage |
|---|---|---|---|---|---|---|---|
| PG-COM-004 | Admin one-click leak→homework campaign launch | In Progress (T-002) | coach_homework_attach_rate +4~8% | M | apps/web, services/api, Supabase migration 0003 | Not duplicate: directly closes insight-to-action gap; prior work focused on validation hardening | Backend ✅ / Admin ✅ / Mobile 🔄 next |
| PG-COM-005 | Mobile diagnosis card with campaign enrollment nudge | Backlog | homework completion +3~5% | M | apps/mobile, services/api campaign read API | Distinct from admin launch: targets learner-side conversion | Backend 🔄 / Admin ✅ / Mobile 🎯 |

## Coverage Tracker (hourly rotation)
- Backend: 2026-02-28 19:40 — added Supabase campaign persistence/API for admin launch.
- Admin/Web: 2026-02-28 19:40 — reports CTA to launch campaign from leak row.
- Mobile: next target = diagnosis card + campaign acknowledgment in `apps/mobile`.
