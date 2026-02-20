import type { CourseModule } from '../types';
import { c } from '../types';

export const procampModules: CourseModule[] = [
  {
    id: 'M12',
    week: 'Week 22-24',
    track: 'procamp',
    level: 'L4',
    title: c('职业化训练系统', 'Professional Training Loop'),
    summary: c('把学习、实战、复盘、修正做成可持续闭环，稳定降低核心漏损。', 'Turn study, play, review, and correction into a sustainable loop that steadily reduces core leaks.'),
    coachCore: c('课程目标：建立“目标-执行-验收-迭代”的职业化训练节奏。', 'Goal: build a professional cadence of goal, execution, validation, and iteration.'),
    conceptLessons: [
      {
        title: c('概念 1：高价值复盘优先级', 'Concept 1: High-Value Review Prioritization'),
        bullets: [
          c('优先复盘 EV 损失最大的 30 手，而非随机翻看。', 'Review the top 30 EV-loss hands first instead of random browsing.'),
          c('每周只修 2-3 个高影响漏洞，避免任务过载。', 'Fix only 2-3 high-impact leaks weekly to avoid overload.'),
          c('复盘输出必须可执行，禁止“以后注意”式结论。', 'Review outputs must be executable, not vague reminders.'),
        ],
      },
      {
        title: c('概念 2：闭环训练节奏', 'Concept 2: Closed-Loop Training Cadence'),
        bullets: [
          c('周初设 KPI，周中执行，周末验收。', 'Set KPIs at week start, execute midweek, validate at week end.'),
          c('错题按 1-3-7 天间隔复训，防止回弹。', 'Retrain mistakes on a 1-3-7 day schedule to prevent relapse.'),
          c('保留稳定基线，每周只调整少量关键变量。', 'Preserve a stable baseline and adjust only a few key variables weekly.'),
        ],
      },
    ],
    videoLessons: [
      {
        title: c('视频 1：30 手深复盘标准模板', 'Video 1: Standard 30-Hand Deep Review Template'),
        duration: '32m',
        objective: c('掌握可重复执行的深复盘工作流。', 'Master a repeatable deep-review workflow.'),
        deliverable: c('提交 30 手复盘报告（含漏洞排序）。', 'Submit a 30-hand review report with ranked leaks.'),
      },
      {
        title: c('视频 2：solver 对照到动作修正', 'Video 2: Solver Comparison to Action Fixes'),
        duration: '28m',
        objective: c('将 solver 偏差转成可执行训练动作。', 'Convert solver deviations into executable training actions.'),
        deliverable: c('提交 8 条“偏差 -> 修正动作”映射。', 'Submit 8 deviation-to-fix mappings.'),
      },
    ],
    handCases: [
      {
        title: c('案例 A：同类错误连续出现', 'Case A: Repeated Error Pattern'),
        setup: c('连续多周在相同 turn 节点过度二枪，漏损持续。', 'Over-barreling repeats on similar turn nodes across weeks.'),
        objective: c('把重复错误转成可追踪修正方案。', 'Convert repeated errors into a trackable correction plan.'),
        streetPlan: [
          c('聚类：按节点类型合并错误样本。', 'Cluster: group mistakes by node type.'),
          c('修正：定义“触发条件 -> 替代动作”规则。', 'Fix: define trigger-to-replacement action rules.'),
          c('验证：下一周追踪错误频率与 EV 变化。', 'Validate: track error frequency and EV changes next week.'),
        ],
        coachTakeaways: [
          c('复盘的价值在于改行为，不在于复述结果。', 'The value of review is behavior change, not result retelling.'),
          c('重复错误说明默认策略存在结构漏洞。', 'Repeated errors indicate structural flaws in baseline strategy.'),
        ],
        passChecks: [
          c('能列出该类错误的触发条件。', 'Can list trigger conditions for this error class.'),
          c('能执行替代动作并连续跟踪一周。', 'Can execute replacement actions and track for one week.'),
        ],
      },
      {
        title: c('案例 B：solver 建议与池子偏差冲突', 'Case B: Solver Advice Conflicts with Pool Tendencies'),
        setup: c('solver 建议中频，但当前池子表现出显著偏离。', 'Solver recommends mixed frequency while the current pool shows clear deviations.'),
        objective: c('平衡基线正确性与 exploit 收益。', 'Balance baseline correctness with exploit profitability.'),
        streetPlan: [
          c('先确认样本是否足以支持偏离。', 'First confirm whether sample quality supports deviation.'),
          c('偏离时设置强度上限与回退触发。', 'When deviating, set intensity caps and rollback triggers.'),
          c('按周比较基线与偏离净 EV，再决定延续。', 'Compare baseline vs exploit net EV weekly before continuing.'),
        ],
        coachTakeaways: [
          c('solver 是基线参考，不是僵化答案。', 'Solver is a baseline reference, not a rigid answer.'),
          c('偏离必须可证伪、可回退、可复验。', 'Exploits must be falsifiable, reversible, and reproducible.'),
        ],
        passChecks: [
          c('能写出偏离前提、强度与回退条件。', 'Can document exploit assumptions, intensity, and rollback conditions.'),
          c('能输出按周净 EV 对照结果。', 'Can output weekly net-EV comparisons.'),
        ],
      },
    ],
    acceptanceChecks: [
      c('连续 4 周执行完整训练闭环。', 'Execute a full training loop for 4 consecutive weeks.'),
      c('每周 30 手深复盘按时完成。', 'Complete weekly 30-hand deep reviews on schedule.'),
      c('核心漏损指标连续下降。', 'Core leak metrics trend downward continuously.'),
    ],
    homework: [
      c('产出 4 周训练看板：目标、执行率、结果。', 'Produce a 4-week dashboard with goals, execution rates, and outcomes.'),
      c('维护错题库并记录 1-3-7 复训轨迹。', 'Maintain a mistake bank with 1-3-7 retraining logs.'),
    ],
    targetSample: c('样本要求：4 周闭环记录 + 每周 30 手深复盘', 'Sample: 4-week loop logs + 30 deep reviews per week'),
    passRule: c('毕业：4 周执行率 >= 88%，核心漏损持续下降', 'Graduation: 4-week execution >= 88% with sustained core leak reduction'),
  },
];
