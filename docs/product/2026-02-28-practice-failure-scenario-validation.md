# Practice Failure Scenario Validation Hardening (T-003)

## User Flow
1. 玩家在 practice session 提交答案与完成训练。
2. 后端对缺失 session/脏数据做安全降级，而不是抛异常。
3. API 继续返回明确错误映射（`session_not_found`）或稳定汇总结果。
4. Admin 与 Mobile 可依赖稳定响应继续做作业转化与留存提示。

## Highest-Impact Optimization (this run)
**Track:** Backend reliability hardening (with Admin/Mobile dependency protection)

- Add executable failure-scenario harness for practice lifecycle.
- Add automated tests for missing session + malformed numeric payload degradation.
- Preserve deterministic behavior for API-layer error mapping.

Why highest impact now:
- 直接降低线上教练闭环因异常数据导致的 5xx 风险。
- 为后续 Admin 投放与 Mobile 作业消费提供稳定后端契约。

## KPI Hypothesis
- `practice_api_failure_rate` 下降 20%
- `coach_homework_attach_rate` 间接提升 1~2%（减少训练中断）
- `support_ticket_rate_practice` 下降 15%

## Acceptance Criteria
- [x] 提供可执行失败场景脚本
- [x] 覆盖 missing session 与 malformed payload 两类失败路径
- [x] 测试可在项目 venv 通过
- [x] 记录 rollout 与回滚策略

## Data / API / Migration Notes
- No DB schema change (Supabase schema unchanged).
- API contract unchanged; only reliability validation and guard behavior verification.
- Architecture migration step added: `services/poker_god_api/` scaffold to align backend path toward `services/<project>/`.

## Rollout / Feature Flag
- No runtime flag required (test + script hardening only).
- Rollout: merge to main, run script in CI pre-merge.
- Rollback: remove `services/api/scripts/run_failure_scenarios.py` and related tests if false positives appear.
