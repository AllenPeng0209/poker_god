# COMMERCIALIZATION_MASTER_TABLE

| ID | Idea | Track | Surface Coverage | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Notes |
|---|---|---|---|---|---|---|---|---|---|
| PG-COMM-001 | AI coach conversation memory + personalized homework loop | AI coach agent + retention | Backend ✅ / Web ✅ / Mobile ⏳ / Admin ✅ | In progress (v1.5) | High (retention, drill starts) | M | Coach chat pipeline, reports UI | Unique (adds measurable funnel layer) | Next: persistent store + lifecycle nudges |
| PG-COMM-002 | Range-matrix error heatmap + EV delta overlay | GTO training UX | Backend ⏳ / Web ⏳ / Mobile ⏳ / Admin N/A | Backlog | High (study depth, paid conversion) | M-L | Matrix API, hand bucket metadata | Not duplicate | Prioritize when coach funnel baseline stabilizes |
| PG-COMM-003 | Mobile coach homework inbox + streak loop | AI coach agent + retention | Backend ⚙️ / Web N/A / Mobile ⏳ / Admin N/A | Planned | High (mobile DAU, session frequency) | M | Mobile API client, push/reminder hooks | Not duplicate | Follow-up to current admin funnel run |
| PG-COMM-004 | Coach admin quality dashboard + funnel telemetry | Reliability/observability | Backend ✅ / Web-admin ✅ / Mobile N/A / Admin ✅ | Shipped (v1) | Medium-High (operator velocity) | M | Memory store aggregate endpoint | Not duplicate | Introduced `/api/admin/coach/memory-funnel` |

## Surface Coverage Tracker (rolling)
- 2026-02-28 08:54: Backend ✅ / Web ✅ / Mobile ⏳ / Admin ⏳
- 2026-02-28 09:37: Backend ✅ / Web ✅ / Mobile ⏳ / Admin ✅
