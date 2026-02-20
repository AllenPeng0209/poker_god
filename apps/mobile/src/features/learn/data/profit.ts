import type { CourseModule } from '../types';
import { c } from '../types';

export const profitModules: CourseModule[] = [
  {
    id: 'M10',
    week: 'Week 16-18',
    track: 'profit',
    level: 'L4',
    title: c('Exploit 与人群模型', 'Exploit and Population Models'),
    summary: c('将偏离策略从“体感操作”升级为“样本驱动、可回退、可验证”的系统。', 'Upgrade exploit strategy from intuition to a sample-driven, reversible, and verifiable system.'),
    coachCore: c('课程目标：每个偏离都具备前提、执行边界、退出条件。', 'Goal: every exploit has assumptions, execution bounds, and exit triggers.'),
    conceptLessons: [
      {
        title: c('概念 1：人群模型分层', 'Concept 1: Population Model Layering'),
        bullets: [
          c('按池子层级建立偏差地图：新手池/常规池/高强度池。', 'Build deviation maps by pool tiers: novice, regular, and high-intensity pools.'),
          c('每层只抓 3-5 个高影响偏差，不贪多。', 'Target only 3-5 high-impact deviations per tier.'),
          c('样本不足时回归基线，防止假信号误导。', 'Revert to baseline when sample quality is weak to avoid false signals.'),
        ],
      },
      {
        title: c('概念 2：偏离幅度管理', 'Concept 2: Exploit Intensity Control'),
        bullets: [
          c('先小偏离验证，再放大执行力度。', 'Validate with small deviations before scaling intensity.'),
          c('偏离必须有止损和回退阈值。', 'Every exploit must include stop-loss and rollback thresholds.'),
          c('稳定捕捉高频错误，优于追求极端偏离。', 'Consistently harvesting frequent leaks beats chasing extreme exploits.'),
        ],
      },
    ],
    videoLessons: [
      {
        title: c('视频 1：人群偏差建模与标注', 'Video 1: Population Leak Modeling and Tagging'),
        duration: '27m',
        objective: c('建立可落地的对手池偏差画像。', 'Build practical population leak profiles.'),
        deliverable: c('提交 4 类池子的偏差清单。', 'Submit deviation checklists for 4 pool profiles.'),
      },
      {
        title: c('视频 2：偏离方案 A/B 验证', 'Video 2: A/B Validation of Exploit Plans'),
        duration: '22m',
        objective: c('验证偏离是否真正提升净 EV。', 'Validate whether exploit plans truly improve net EV.'),
        deliverable: c('提交 2 套偏离方案对照报告。', 'Submit comparison reports for two exploit variants.'),
      },
    ],
    handCases: [
      {
        title: c('案例 A：对手 turn 过弃的可控扩压', 'Case A: Controlled Pressure Versus Turn Over-Folding'),
        setup: c('样本显示对手 turn fold 过高，存在可利用窗口。', 'Samples show unusually high turn fold frequency, creating an exploit window.'),
        objective: c('在可回退框架下提高 turn 压力收益。', 'Increase turn pressure profit within a reversible framework.'),
        streetPlan: [
          c('Flop：保留可转化为 turn 压力的候选组合。', 'Flop: retain candidates that convert into profitable turn pressure.'),
          c('Turn：满足阻断与弃牌率前提时扩大二枪频率。', 'Turn: increase second-barrel frequency when blocker and fold-equity prerequisites hold.'),
          c('River：监控对手反调，触发回退即收缩。', 'River: monitor counter-adjustments and shrink when rollback triggers fire.'),
        ],
        coachTakeaways: [
          c('可利用不等于无上限加压。', 'Exploitability does not justify unlimited aggression.'),
          c('偏离幅度必须跟随样本可信度。', 'Exploit intensity must track sample reliability.'),
        ],
        passChecks: [
          c('能写出偏离前提与退出条件。', 'Can document exploit assumptions and exit criteria.'),
          c('能解释为何该点优先 turn 扩压。', 'Can explain why turn pressure is prioritized in this spot.'),
        ],
      },
      {
        title: c('案例 B：对手 river 过度抓诈时的价值增压', 'Case B: Value Expansion Versus River Over-Catching'),
        setup: c('对手在极化下注面对下跟注过宽，低质量诈唬被频繁抓住。', 'Opponent over-calls polarized rivers, catching low-quality bluffs too often.'),
        objective: c('将策略从高诈唬切换为高价值薄打。', 'Shift strategy from bluff-heavy to value-heavy thin betting.'),
        streetPlan: [
          c('Turn：压缩边缘半诈，保留强价值与高质量阻断。', 'Turn: trim marginal semibluffs and keep strong value plus top blockers.'),
          c('River：提高薄价值密度，减少低质量诈唬。', 'River: increase thin-value density and reduce weak bluffs.'),
          c('复盘：跟踪价值线被更差牌跟注的频率。', 'Review: track worse-call frequency against value lines.'),
        ],
        coachTakeaways: [
          c('对抗跟注站，价值是主引擎。', 'Against call-heavy pools, value is the main engine.'),
          c('偏离方向错误会比不偏离更亏。', 'Wrong exploit direction can lose more than no exploit.'),
        ],
        passChecks: [
          c('能给出“诈唬减量、价值增量”的证据。', 'Can provide evidence for reducing bluffs and increasing value.'),
          c('能制定对手回调后的回归方案。', 'Can define a reversion plan after opponent adjustment.'),
        ],
      },
    ],
    acceptanceChecks: [
      c('偏离前提记录完整率 >= 92%。', 'Exploit premise logging completeness >= 92%.'),
      c('高风险误偏离次数显著下降。', 'High-risk mis-exploit frequency is significantly reduced.'),
      c('偏离方案有回退且有结果追踪。', 'Exploit plans include rollback and tracked outcomes.'),
    ],
    homework: [
      c('建立 24 名常见对手画像库。', 'Build a profile bank for 24 recurring opponents.'),
      c('提交 12 条“前提-执行-结果”偏离闭环。', 'Submit 12 exploit loops in premise-action-result format.'),
    ],
    targetSample: c('样本要求：240 手对手标注 + 50 组偏离记录', 'Sample: 240 tagged hands + 50 exploit logs'),
    passRule: c('过关：偏离可验证、可回退，且净 EV 持续改善', 'Pass: exploits are verifiable, reversible, and improve net EV consistently'),
  },
  {
    id: 'M11',
    week: 'Week 19-21',
    track: 'profit',
    level: 'L4',
    title: c('现金局 / MTT 专项', 'Cash and MTT Specialization'),
    summary: c('拆分现金局与锦标赛决策体系，避免赛制混用导致系统性误判。', 'Separate cash and tournament decision systems to prevent format-mixing misjudgments.'),
    coachCore: c('课程目标：同一手牌在不同赛制给出不同且可解释的标准答案。', 'Goal: produce different but explainable correct answers for the same hand across formats.'),
    conceptLessons: [
      {
        title: c('概念 1：芯片 EV 与奖池 EV', 'Concept 1: Chip EV Versus Payout EV'),
        bullets: [
          c('现金局以芯片 EV 为核心目标。', 'Cash games optimize chip EV as the primary objective.'),
          c('MTT 后段受 ICM 强约束，生存价值显著上升。', 'Late MTT decisions are strongly constrained by ICM and survival value.'),
          c('覆盖与被覆盖关系会重塑 all-in 门槛。', 'Covering dynamics reshape all-in thresholds.'),
        ],
      },
      {
        title: c('概念 2：赛制切换防错机制', 'Concept 2: Format-Switch Error Prevention'),
        bullets: [
          c('现金局薄 EV 跟注不可直接搬到 ICM 重压点。', 'Thin cash-game calls cannot be directly copied into heavy ICM spots.'),
          c('短码阶段优先 push/fold 纪律与执行稳定性。', 'Short-stack phases prioritize push-fold discipline and execution stability.'),
          c('每次切换赛制先重置默认参数。', 'Reset default assumptions before every format switch.'),
        ],
      },
    ],
    videoLessons: [
      {
        title: c('视频 1：ICM 压力下的范围重估', 'Video 1: Re-estimating Ranges Under ICM Pressure'),
        duration: '30m',
        objective: c('掌握 ICM 对开局、跟注、全压范围的影响。', 'Master ICM impact on opening, calling, and all-in ranges.'),
        deliverable: c('完成 60 个 FT ICM 节点。', 'Complete 60 final-table ICM nodes.'),
      },
      {
        title: c('视频 2：15bb 以下 push/fold 体系', 'Video 2: Push-Fold System Below 15bb'),
        duration: '23m',
        objective: c('建立短码阶段高一致性决策模板。', 'Build high-consistency templates for short-stack phases.'),
        deliverable: c('完成 100 道短码 push/fold 题。', 'Complete 100 short-stack push-fold drills.'),
      },
    ],
    handCases: [
      {
        title: c('案例 A：现金可跟，MTT 必弃', 'Case A: Call in Cash, Fold in MTT'),
        setup: c('中对在边缘赔率点位，现金与 MTT 出现冲突结论。', 'A medium pair on a marginal-odds node yields conflicting cash and MTT answers.'),
        objective: c('量化 ICM 如何抬高 MTT 跟注门槛。', 'Quantify how ICM raises MTT calling thresholds.'),
        streetPlan: [
          c('现金：按芯片 EV 比较权益与门槛。', 'Cash: compare equity and threshold under chip EV.'),
          c('MTT：叠加奖池跳跃损失与生存价值。', 'MTT: add payout-jump risk and survival value.'),
          c('复盘：并列输出两赛制标准答案。', 'Review: output side-by-side standard answers for both formats.'),
        ],
        coachTakeaways: [
          c('赛制参数变化会重写正确答案。', 'Format parameters can rewrite the correct answer.'),
          c('MTT 后段“活着”具有显性 EV。', 'Late MTT survival has explicit EV value.'),
        ],
        passChecks: [
          c('能给出两赛制不同决策依据。', 'Can justify different decisions across two formats.'),
          c('能解释 ICM 对门槛的改变方向。', 'Can explain the direction of ICM threshold shifts.'),
        ],
      },
      {
        title: c('案例 B：13bb BTN 的 push/fold 修正', 'Case B: Correcting BTN 13bb Push-Fold Decisions'),
        setup: c('BTN 13bb，盲注倾向未知，出现犹豫导致错失窗口。', 'BTN at 13bb with unknown blind tendencies, hesitation causes missed windows.'),
        objective: c('先执行基线 push/fold，再按样本微调。', 'Execute baseline push-fold first, then adjust by samples.'),
        streetPlan: [
          c('Preflop：优先基线区间，不做无依据慢打。', 'Preflop: prioritize baseline ranges and avoid unsupported traps.'),
          c('若盲注明显过弃：逐步扩张推牌范围。', 'If blinds over-fold clearly, gradually widen shove range.'),
          c('若盲注跟注过宽：收缩边缘推牌并回归基线。', 'If blinds call too wide, trim marginal shoves and revert baseline.'),
        ],
        coachTakeaways: [
          c('短码阶段最怕“犹豫型亏损”。', 'Short-stack play suffers most from hesitation losses.'),
          c('基线优先，偏离其次。', 'Baseline first, exploit second.'),
        ],
        passChecks: [
          c('能给出 13bb 默认 push/fold 逻辑。', 'Can provide default 13bb push-fold logic.'),
          c('能说明何时扩大与收缩推牌范围。', 'Can explain when to widen or tighten shove ranges.'),
        ],
      },
    ],
    acceptanceChecks: [
      c('ICM 题正确率 >= 82%。', 'ICM drill accuracy >= 82%.'),
      c('短码节点执行稳定性明显提升。', 'Short-stack execution stability clearly improves.'),
      c('赛制混用错误显著减少。', 'Format-mixing errors are significantly reduced.'),
    ],
    homework: [
      c('提交 16 手现金 vs MTT 并列复盘。', 'Submit 16 paired cash-versus-MTT reviews.'),
      c('制作 15bb 以下 push/fold 口袋卡。', 'Create sub-15bb push-fold pocket cards.'),
    ],
    targetSample: c('样本要求：140 个 ICM 节点 + 120 个短码节点', 'Sample: 140 ICM nodes + 120 short-stack nodes'),
    passRule: c('过关：赛制分流稳定，ICM 重大误判显著下降', 'Pass: stable format routing with significantly fewer major ICM misreads'),
  },
];
