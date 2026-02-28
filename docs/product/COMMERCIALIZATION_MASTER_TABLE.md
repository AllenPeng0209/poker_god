# COMMERCIALIZATION MASTER TABLE

| ID | Idea | Track | Surface Coverage | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PG-027 | Coach homework Supabase persistence + lifecycle guardrails | AI coach agent + reliability | Backend ✅ / Mobile ⏭ / Admin ⏭ | Shipped (this run) | +8-12% homework attach reliability lift | M | SQL migration 0003, coach homework API consumers | Not duplicate: prior iterations created homework UX, this closes durability gap | Adds durable create/list/update APIs + invalid transition protection. |
| PG-028 | Admin homework operations queue with SLA risk sorting | retention loop + ops | Admin ⏭ / Backend ✅ / Mobile - | Backlog (next) | -30% unresolved homework backlog time | M | admin panel route + queue endpoint | Not duplicate: no dedicated admin action queue yet | Next run target to satisfy admin rotation. |

## Coverage Tracker (explicit rotation)
- 2026-02-28 16:43 run: **Backend reliability** shipped (Supabase durability + API guardrails).
- Next required rotation: **Admin panel** implementation (PG-028).
- Following rotation: **Mobile status UX polish** for completion nudges.
