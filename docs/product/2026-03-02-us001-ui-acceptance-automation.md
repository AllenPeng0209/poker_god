# US-001 UI Acceptance Automation (T-034)

## Why this is the highest-impact optimization this run
Commercialization is currently bottlenecked by manual/one-off UI evidence. A release-ready GTO/AI-coach product needs deterministic acceptance artifacts for each PRD-gated UI change. This run productizes the evidence path for US-001 and reduces operator variance.

## User flow
1. Operator runs `bash scripts/capture_us001_ui_evidence.sh`.
2. Script boots Next.js web app on a fixed local port with required feature flag.
3. Script captures `/app/reports` SSR HTML into `docs/product/evidence/2026-03-02-us001-ui-acceptance.html`.
4. Script verifies required UI markers:
   - `Admin Campaign Readiness`
   - `data-testid="admin-campaign-readiness-card"`
5. Artifact is attached as release evidence and referenced in PRD/log.

## KPI hypothesis
- UI acceptance lead time: **-30%** (scripted, one-command evidence)
- Missed UI-proof checklist items in PRD-gated tasks: **to 0** for admin/web flow
- Cross-run reproducibility for audit: **+50%**

## Acceptance criteria
- [x] One-command evidence capture script exists in repo.
- [x] Script outputs artifact under `docs/product/evidence/`.
- [x] Script hard-fails if required markers are missing.
- [x] Product docs + commercialization table + build log updated.
- [x] PRD backlog/acceptance status updated with evidence pointer.

## Architecture alignment
- Frontend: Next.js web in `apps/web` (evidence target route).
- Backend: Python service API consumed across UI path (unchanged this run, boundary preserved).
- DB: Supabase remains source of truth (no schema change required).
- Migration note: none required (documentation+automation only).

## Rollout / feature flag plan
- Reuses existing flag: `NEXT_PUBLIC_ADMIN_CAMPAIGN_READINESS_V1=1`.
- No production code path mutation; safe rollout as CI/pre-release gate.

## Validation notes
- `bash scripts/capture_us001_ui_evidence.sh`
- `npm --workspace @poker-god/web run typecheck`
- `npm run build:web`
