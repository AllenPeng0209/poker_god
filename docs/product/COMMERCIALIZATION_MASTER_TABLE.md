# COMMERCIALIZATION_MASTER_TABLE

| Idea / Track | Status | KPI Impact | Complexity | Dependencies | Duplicate Check | Notes |
|---|---|---|---|---|---|---|
| T-011 Mobile homework retention radar (`apps/mobile` + `/api/admin/coach/homework-retention`) | Done (2026-03-01 07:27 Asia/Shanghai) | dropoff detection time -30%, completion +2.0%, stale risk -15% | M | Existing backend retention API, mobile env vars (`EXPO_PUBLIC_POKER_GOD_API_BASE_URL`, optional `EXPO_PUBLIC_POKER_GOD_API_KEY`) | Checked: not duplicate of T-010 (admin-only) | Completes Admin/Mobile/Backend retention observability loop |
| Next candidate: homework campaign one-click launch from admin analysis (US-003) | Backlog | attach rate +4~5% | M-H | campaign create API + audit + FE flag | Checked: not duplicate with retention radar tracks | Recommended next highest ROI for conversion lift |
