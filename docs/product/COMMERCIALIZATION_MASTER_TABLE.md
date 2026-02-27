# Commercialization Master Table

| ID | Track | Idea | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Surface Coverage (Admin/Mobile/Backend) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| PG-20260228-01 | AI coach agent | Session memory + leak-aware personalized homework in coach chat | In Progress (implemented v1) | High (coach->drill +8%, D1 +5%) | M | contracts, api, web coach UI | Checked against docs/web backlog; no direct duplicate | Admin: Planned / Mobile: Planned / Backend: **Done(v1)** | This run shipped additive API + UI rendering |
| PG-20260228-02 | GTO training UX | Range matrix diff mode (baseline vs selected exploit line) | Backlog | High | L | solver matrix API, ui-web heatmap | Not duplicate of existing matrix panel | Admin: N/A / Mobile: Planned / Backend: Planned | Priority next for study monetization |
| PG-20260228-03 | Reliability/observability | Coach response latency + error dashboard | Backlog | Med-High | M | event schema, admin page | No existing dashboard found | Admin: Planned / Mobile: N/A / Backend: Planned | Needed before paid scale |
| PG-20260228-04 | Content/retention loop | Weekly homework completion loop with reminders | Backlog | High | M | push infra, scheduler | Distinct from current plan endpoint | Admin: Planned / Mobile: Planned / Backend: Planned | Ties directly to subscription retention |

## Coverage Tracking Rule
- At least one run every 24h should include **backend** changes.
- At least one run every 72h should include **mobile** visible change.
- At least one run every 72h should include **admin/ops** change.
