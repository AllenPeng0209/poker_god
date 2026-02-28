# PG-021 — Personalized AI Coach Homework Pack (v1)

## Why now (highest-impact optimization)
Current AI Coach stops at advice text. Users still need to manually convert advice into action, creating execution drop-off. The highest impact optimization is to convert every coaching interaction into a **one-click actionable homework pack** tied to measurable KPIs.

## User flow
1. User opens AI Coach drawer from Study/Practice/Analyze/Reports.
2. User clicks **Generate Homework**.
3. Backend computes a 3-item personalized pack from recent practice sessions + analyze EV-loss trends + coach action telemetry.
4. Coach posts a structured system message with tasks, time budget, and KPI target deltas.
5. User executes tasks and returns to coach for next loop.

## KPI targets
- D7 study retention among coach users: **+8%**
- Drill completion rate after coach interaction: **+12%**
- Avg EV-loss (recent 20 hands) reduction over 2 weeks: **-1.8 bb/100**

## Acceptance criteria
- [x] API endpoint exists: `POST /api/coach/homework`
- [x] Returns 3 homework items with title, objective, estimated time, baseline→target KPI
- [x] Web AI coach drawer supports one-click generation and renders homework summary
- [x] Analytics event sent when homework generation is executed
- [x] No DB migration required for v1 (in-memory heuristic)

## Data / model / API updates
- Contracts:
  - Added `CoachHomeworkRequest`, `CoachHomeworkItem`, `CoachHomeworkResponse`.
- Backend service:
  - Added `buildCoachHomework()` generator (heuristic personalization).
  - Added route `POST /api/coach/homework`.
- Frontend:
  - Added `apiClient.coachHomework()`.
  - Added coach drawer CTA + result rendering.

## Migration notes
- v1 is stateless/in-memory with existing MVP store data.
- No SQL schema migration required.
- For production hardening (next iteration): persist homework packs and completion state to durable storage.

## Rollout / feature-flag plan
- Flag name: `coach_homework_pack_v1`
- Stage 1 (internal): enable on dev/staging; verify event volume + latency.
- Stage 2 (10% users): compare coach->drill conversion vs control.
- Stage 3 (100%): if KPI uplift reaches >=50% of target after 7 days.

## Validation notes
- Contract + TS compile check in monorepo.
- Manual smoke:
  - Open coach drawer
  - Click Generate Homework
  - Verify message with 3 tasks and KPI lines
  - Confirm `coach_action_executed` emitted with action `generate_homework`
