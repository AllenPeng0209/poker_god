# COMMERCIALIZATION_MASTER_TABLE

| ID | Idea | Track | Surface Coverage | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Notes |
|---|---|---|---|---|---|---|---|---|---|
| PG-COMM-001 | AI coach conversation memory + personalized homework loop | AI coach agent + retention | Backend ✅ / Web ✅ / Mobile ⏳ / Admin ⏳ | In progress (v1 shipped) | High: retention + homework starts | M | FastAPI coach endpoints, web coach drawer | Unique vs prior observability/mobile-homework runs (adds memory-driven personalization) | v1 in-memory; v2 persist to DB |
| PG-COMM-002 | Range-matrix error heatmap + EV delta overlay | GTO training UX | Backend ⏳ / Web ⏳ / Mobile ⏳ / Admin ⏳ | Backlog | High: study completion depth | M-L | matrix API expansion, UI heatmap component | Not duplicate | Candidate next focus |
| PG-COMM-003 | Admin coach quality dashboard (memory adoption + action funnel) | Reliability/observability | Backend ⏳ / Web-admin ⏳ / Mobile N/A / Admin ⏳ | Backlog | Medium-High: coaching quality control | M | events pipeline + admin UI route | Not duplicate | Pairs with PG-COMM-001 |

## Surface Coverage Tracker (rolling)
- Backend: 2026-02-28 ✅ (coach memory API)
- Web: 2026-02-28 ✅ (coach drawer homework chips)
- Mobile: pending in next commercialization cycle
- Admin: pending in next commercialization cycle
