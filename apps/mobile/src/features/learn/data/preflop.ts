import type { CourseModule } from '../types';
import { c } from '../types';

export const preflopModules: CourseModule[] = [
  {
    id: 'M6',
    week: 'Week 6-7',
    track: 'preflop',
    level: 'L2',
    title: c('翻前完整体系', 'Complete Preflop System'),
    summary: c('构建 6-max 翻前默认范围、对抗 3bet/4bet 与盲注防守的全链路体系。', 'Build a full-chain 6-max preflop system: baseline ranges, vs 3bet/4bet, and blind defense.'),
    coachCore: c('课程目标：把翻前错误率压到最低，减少翻后高难度亏损节点。', 'Goal: minimize preflop errors to remove costly postflop trouble spots.'),
    conceptLessons: [
      {
        title: c('概念 1：位置基线与范围纪律', 'Concept 1: Positional Baseline and Range Discipline'),
        bullets: [
          c('UTG 到 BTN 的开局宽度必须有稳定边界。', 'Opening widths from UTG to BTN require stable boundaries.'),
          c('OOP 压缩边缘组合，IP 才能适度扩张。', 'Trim marginal combos OOP; expand selectively only in position.'),
          c('基线范围是默认策略底盘，调整是有条件增量。', 'Baseline ranges are the strategic chassis; adjustments are conditional increments.'),
        ],
      },
      {
        title: c('概念 2：对抗 3bet 的分流系统', 'Concept 2: Routing System Versus 3bet'),
        bullets: [
          c('先看位置和有效筹码，再分 4bet/call/fold。', 'Check position and effective stacks before splitting into 4bet/call/fold.'),
          c('call 3bet 必须有翻后板面计划，不可裸跟。', 'Calling a 3bet requires explicit postflop board plans.'),
          c('盲注防守按阈值执行，避免情绪防守。', 'Execute blind defense by thresholds and avoid emotional calls.'),
        ],
      },
    ],
    videoLessons: [
      {
        title: c('视频 1：6-max 开局基线到实战', 'Video 1: From 6-max Baselines to Real Execution'),
        duration: '28m',
        objective: c('将静态图谱转化为动态对手下的执行策略。', 'Convert static charts into executable plans against dynamic opponents.'),
        deliverable: c('提交 6 位置开局基线与 2 类对手微调表。', 'Submit baseline opens for 6 positions plus adjustments for 2 opponent profiles.'),
      },
      {
        title: c('视频 2：高频亏损的 3bet 防守节点', 'Video 2: High-Leak Nodes in 3bet Defense'),
        duration: '24m',
        objective: c('修复最常见的 vs 3bet 慢性漏损。', 'Fix the most common chronic leaks versus 3bet pressure.'),
        deliverable: c('完成 100 道 vs 3bet 决策题。', 'Complete 100 versus-3bet decision spots.'),
      },
    ],
    handCases: [
      {
        title: c('案例 A：BTN 开局遭 SB 3bet', 'Case A: BTN Open Facing SB 3bet'),
        setup: c('BTN 开 2.2bb，SB 3bet 到 8.5bb，需做 4bet/call/fold 分流。', 'BTN opens 2.2bb and SB 3bets to 8.5bb, requiring 4bet/call/fold routing.'),
        objective: c('建立“先基线、后微调”的高一致性决策流程。', 'Build a consistent process: baseline first, exploit adjustment second.'),
        streetPlan: [
          c('Preflop：按手牌段位先分流，再依据对手倾向微调。', 'Preflop: route by hand class first, then adjust by opponent tendency.'),
          c('Flop：若选择 call，预设可继续与放弃的牌面类别。', 'Flop: if calling, predefine continue and give-up board classes.'),
          c('Turn：无计划路线及时止损，防止沉没成本扩大。', 'Turn: stop loss early on unplanned lines to avoid sunk-cost expansion.'),
        ],
        coachTakeaways: [
          c('翻前分流正确，翻后压力会显著降低。', 'Correct preflop routing dramatically reduces postflop pressure.'),
          c('call 不是被动，而是带计划的投资。', 'Calling is not passive; it is planned investment.'),
        ],
        passChecks: [
          c('能解释该点为何不是纯 4bet 或纯 call。', 'Can explain why this node is not pure 4bet or pure call.'),
          c('能给出 call 后至少两类翻后预案。', 'Can provide at least two postflop plans after calling.'),
        ],
      },
      {
        title: c('案例 B：BB 对抗 CO 开局的防守阈值', 'Case B: BB Defense Threshold Versus CO Open'),
        setup: c('CO 开 2.5bb，BB 需决定哪些组合可盈利防守。', 'CO opens 2.5bb and BB must decide which combos can defend profitably.'),
        objective: c('压缩低兑现防守，保留可执行高 EV 组合。', 'Compress low-realization defense and keep executable high-EV combos.'),
        streetPlan: [
          c('Preflop：优先保留有后续可操作性的组合。', 'Preflop: prioritize combos with actionable postflop paths.'),
          c('Flop：不利牌面提高 check-fold，减少无效硬扛。', 'Flop: increase check-fold on poor textures and reduce forced resistance.'),
          c('Turn：拒绝“已经投钱就继续”的沉没成本思维。', 'Turn: reject sunk-cost continuation logic.'),
        ],
        coachTakeaways: [
          c('盲注过防是长期慢性漏损来源。', 'Over-defending blinds is a chronic long-term leak.'),
          c('守得住比守得多更盈利。', 'Defendable beats defending more.'),
        ],
        passChecks: [
          c('能列出 BB defend 的核心筛选条件。', 'Can list core filters for BB defense.'),
          c('能识别“看似可守但长期亏损”的候选。', 'Can identify seemingly playable but long-run losing defenders.'),
        ],
      },
    ],
    acceptanceChecks: [
      c('翻前决策准确率 >= 88%。', 'Preflop decision accuracy >= 88%.'),
      c('vs 3bet 误判率显著下降。', 'Vs-3bet misreads are significantly reduced.'),
      c('盲注过防频率连续两周下降。', 'Blind over-defense declines for two consecutive weeks.'),
    ],
    homework: [
      c('提交 140 手翻前分流记录（含理由）。', 'Submit 140 preflop routing logs with reasoning.'),
      c('每个位置产出 1 张“基线 + 微调”执行卡。', 'Produce one “baseline + adjustment” execution card for each position.'),
    ],
    targetSample: c('样本要求：300 手翻前节点 + 120 道 vs3bet 题', 'Sample: 300 preflop nodes + 120 vs-3bet drills'),
    passRule: c('过关：翻前结构稳定，关键节点不再连续误判', 'Pass: stable preflop structure with no recurring key-node misreads'),
  },
];
