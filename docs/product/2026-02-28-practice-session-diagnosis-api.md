# Feature Spec — Practice Session Diagnosis API (EV Line Drill Focus)

## Why now (highest-impact optimization)
当前最高影响优化点：把练习结果中的“错因”结构化，直接驱动 AI Coach 布置作业。
这在商业化上直接影响作业领取率和复训率，且工程改造成本低（后端新增只读 API，不破坏现有训练流程）。

## User Flow
1. 用户完成或进行中练习 session。
2. 前端/教练请求 `GET /api/practice/sessions/{session_id}/diagnosis`。
3. API 返回：
   - top mistake clusters（chosen -> recommended）
   - EV 损失统计
   - 推荐 homework focus（line drill）
4. AI Coach 用返回结果生成个性化作业建议。

## KPI Hypothesis
- homework_attach_rate: +3.0%
- drill_repeat_rate_7d: +4.0%
- practice_to_homework_conversion: +5.0%

## Acceptance Criteria
- 新增诊断 API，404 时返回 `session_not_found`。
- 输出 top mistake 聚类和 EV summary 字段。
- 输出 `recommendedHomeworkFocus`，可直接用于作业生成。
- 单元测试覆盖：聚类逻辑 + 空样本场景。

## Data / API notes
- 无新增表结构；复用 `pg_mvp_practice_sessions` 与 `pg_mvp_practice_answers`。
- 响应模型新增：`PracticeSessionDiagnosisResponse`。

## Rollout & Feature Flags
- Phase 1（backend dark launch）: API 上线但前端不默认展示。
- Phase 2（admin）: 管理端启用诊断卡片（建议 flag: `NEXT_PUBLIC_ADMIN_DIAGNOSIS_V1`）。
- Phase 3（mobile）: 练习完成页显示 top 1-2 错误焦点（建议 flag: `EXPO_PUBLIC_PRACTICE_DIAGNOSIS_V1`）。

## Validation
- `python3 -m pytest -q services/api/tests/test_practice_diagnosis.py`

## Architecture Alignment
- FE/BE 严格通过 API 边界交互。
- 本次为 backend-only 变更；后续补齐 web/mobile 消费层。
- 迁移备注：当前后端目录为 `services/api`，后续应迁移命名到 `services/<project>/`。