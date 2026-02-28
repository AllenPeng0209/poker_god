# COMMERCIALIZATION_MASTER_TABLE

| Idea ID | Track | Item | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Cross-Surface Tracking |
|---|---|---|---|---|---|---|---|---|
| PG-T006 | Reliability/Observability | Admin latency radar + backend route telemetry | shipped (2026-03-01 01:10) | MTTD -40%, slow-route定位时长 -35% | M | FastAPI middleware, Reports UI, feature flag | Checked against existing reports/leak cards; no overlap in latency visibility | Backend ✅ / Admin Web ✅ / Mobile ⏳ next |
| PG-NEXT-001 | Reliability/Observability | Mobile debug latency panel consuming `/api/admin/ops/latency` (read-only) | backlog | App-side issue triage time -25% | M | Expo screen + API client auth policy | Not duplicate (mobile currently lacks any ops observability surface) | Backend ✅ / Admin Web ✅ / Mobile planned |
