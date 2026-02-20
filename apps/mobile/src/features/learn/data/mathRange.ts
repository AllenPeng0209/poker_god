import type { CourseModule } from '../types';
import { c } from '../types';

export const mathRangeModules: CourseModule[] = [
  {
    id: 'M4',
    week: 'Week 4',
    track: 'mathRange',
    level: 'L2',
    title: c('组合与阻断牌', 'Combos and Blockers'),
    summary: c('把河牌决策从“猜测”升级为“组合计数 + 阻断筛选”。', 'Upgrade river decisions from guessing to combo counting and blocker filtering.'),
    coachCore: c('课程目标：先数价值组合，再决定诈唬预算与下注尺寸。', 'Goal: count value combos first, then allocate bluffs and sizing.'),
    conceptLessons: [
      {
        title: c('概念 1：价值/诈唬配比', 'Concept 1: Value and Bluff Ratio'),
        bullets: [
          c('下注代表的是一段组合，不是单张牌故事。', 'A bet represents combo segments, not a single hand story.'),
          c('价值组合越薄，诈唬频率越要克制。', 'The thinner the value region, the tighter bluff frequency must be.'),
          c('下注尺寸越大，配比容错越小。', 'Larger sizing gives less tolerance for ratio errors.'),
        ],
      },
      {
        title: c('概念 2：阻断牌优先级', 'Concept 2: Blocker Priority'),
        bullets: [
          c('优先选择阻断对手跟注上限的诈唬候选。', 'Prioritize bluff candidates that block the top of villain call range.'),
          c('避免使用会阻断对手弃牌区间的反向阻断。', 'Avoid reverse blockers that remove villain folding combos.'),
          c('同牌力候选的 EV 差主要来自阻断结构。', 'EV differences among similar-strength candidates come mainly from blocker structure.'),
        ],
      },
    ],
    videoLessons: [
      {
        title: c('视频 1：组合计数到下注配比', 'Video 1: Combo Counting to Betting Ratios'),
        duration: '24m',
        objective: c('会在 30 秒内给出大注前配比草案。', 'Provide a pre-big-bet ratio draft within 30 seconds.'),
        deliverable: c('完成 40 道 value/bluff 配比题。', 'Complete 40 value-bluff ratio drills.'),
      },
      {
        title: c('视频 2：河牌阻断筛选实战', 'Video 2: River Blocker Candidate Selection'),
        duration: '21m',
        objective: c('形成可复用的诈唬候选排序流程。', 'Build a reusable ranking workflow for bluff candidates.'),
        deliverable: c('提交 12 手河牌阻断排序报告。', 'Submit 12 river blocker ranking reports.'),
      },
    ],
    handCases: [
      {
        title: c('案例 A：价值不足时的 overbet 降级', 'Case A: Overbet Downgrade When Value Is Too Thin'),
        setup: c('河牌想 overbet，但价值组合密度不足，诈唬占比过高。', 'A river overbet is considered while value density is too thin and bluff share too high.'),
        objective: c('识别比例失衡并改用更稳健尺寸。', 'Detect ratio imbalance and switch to a more stable size.'),
        streetPlan: [
          c('River：先统计可清晰价值下注的组合数。', 'River: first count clearly value-betting combos.'),
          c('若诈唬预算超标，降为 75% 或压缩诈唬。', 'If bluff budget is excessive, move to 75% or compress bluff frequency.'),
          c('复盘：记录尺寸调整前后 EV 变化。', 'Review: record EV difference before and after sizing adjustment.'),
        ],
        coachTakeaways: [
          c('大注是比例管理题，不是胆量测试。', 'Big betting is ratio management, not a courage test.'),
          c('尺寸错配会放大结构性漏损。', 'Sizing mismatch amplifies structural leaks.'),
        ],
        passChecks: [
          c('能给出 overbet 前后的组合配比对照。', 'Can show combo ratio comparison before and after overbet downgrade.'),
          c('能解释为什么该点应降尺寸。', 'Can explain why sizing should be reduced in this spot.'),
        ],
      },
      {
        title: c('案例 B：三个诈唬候选如何筛选', 'Case B: How to Select Among Three Bluff Candidates'),
        setup: c('河牌有 3 手近似候选，牌力接近但阻断不同。', 'River has three similar bluff candidates with different blocker effects.'),
        objective: c('用阻断关系做可解释排序而非凭直觉。', 'Use blocker logic for explainable ranking instead of intuition.'),
        streetPlan: [
          c('先保留阻断对手强跟注组合的候选。', 'First retain candidates that block strong calls.'),
          c('剔除阻断对手弃牌组合的候选。', 'Remove candidates that block opponent folds.'),
          c('按 EV 预估保留最高质量诈唬组合。', 'Keep the highest-quality bluff set by EV estimate.'),
        ],
        coachTakeaways: [
          c('诈唬选择是排序问题，不是情绪问题。', 'Bluff selection is a ranking problem, not an emotional one.'),
          c('阻断质量决定长期胜率上限。', 'Blocker quality defines long-run edge ceiling.'),
        ],
        passChecks: [
          c('能写出 3 候选的排序与依据。', 'Can provide ranked order of 3 candidates with rationale.'),
          c('能说明最差候选为何必须弃用。', 'Can explain why the worst candidate must be removed.'),
        ],
      },
    ],
    acceptanceChecks: [
      c('组合题正确率 >= 88%。', 'Combo drill accuracy >= 88%.'),
      c('河牌大注前均有比例验证。', 'Every major river bet has ratio validation.'),
      c('阻断误用频率连续下降。', 'Blocker misuse frequency declines consistently.'),
    ],
    homework: [
      c('提交 20 手诈唬候选排序笔记。', 'Submit ranking notes for 20 bluff-selection spots.'),
      c('制作 1 份“尺寸-配比”速查卡。', 'Create one quick-reference card for size-to-ratio mapping.'),
    ],
    targetSample: c('样本要求：100 个组合节点 + 180 手复盘', 'Sample: 100 combo nodes + 180 reviewed hands'),
    passRule: c('过关：配比与阻断决策稳定，无明显失衡下注', 'Pass: stable ratio and blocker decisions without major imbalance bets'),
  },
  {
    id: 'M5',
    week: 'Week 5',
    track: 'mathRange',
    level: 'L2',
    title: c('范围语言与可视化', 'Range Language and Visualization'),
    summary: c('训练“范围对范围”表达，避免把复杂节点简化为单手牌猜拳。', 'Train range-versus-range communication and avoid single-hand guessing in complex spots.'),
    coachCore: c('课程目标：从“我这手牌”升级为“我这段范围在做什么”。', 'Goal: move from “my hand” to “what this range segment is doing.”'),
    conceptLessons: [
      {
        title: c('概念 1：范围优势与坚果优势', 'Concept 1: Range Edge and Nut Edge'),
        bullets: [
          c('范围优势决定总体可施压空间。', 'Range edge defines overall pressure capacity.'),
          c('坚果优势决定大尺寸下注的可信度。', 'Nut edge defines credibility for large sizings.'),
          c('先判断优势归属，再决定频率和尺寸。', 'Determine edge ownership before frequency and size decisions.'),
        ],
      },
      {
        title: c('概念 2：频率语言与混频纪律', 'Concept 2: Frequency Language and Mixing Discipline'),
        bullets: [
          c('高频/中频/低频比“永远/从不”更接近实战。', 'High-mid-low frequencies are more practical than always-never rules.'),
          c('中频动作被纯化会暴露 exploitable 漏洞。', 'Purifying mixed actions creates exploitable leaks.'),
          c('复盘记录频率偏差，而非只写对错。', 'Log frequency deviations in review instead of binary right-wrong notes.'),
        ],
      },
    ],
    videoLessons: [
      {
        title: c('视频 1：13x13 范围矩阵标注', 'Video 1: 13x13 Range Matrix Mapping'),
        duration: '25m',
        objective: c('能独立构建开局/防守范围网格。', 'Independently build open and defense range grids.'),
        deliverable: c('提交 8 个位置范围图。', 'Submit 8 positional range maps.'),
      },
      {
        title: c('视频 2：同牌面不同位置策略差异', 'Video 2: Same Board, Different Positional Strategies'),
        duration: '22m',
        objective: c('理解同牌面为何能出现不同最优线。', 'Understand why the same board can yield different optimal lines.'),
        deliverable: c('完成 16 个牌面的范围叙述。', 'Complete range narrations on 16 board textures.'),
      },
    ],
    handCases: [
      {
        title: c('案例 A：K72r 的位置差异策略', 'Case A: Positional Strategy Divergence on K72r'),
        setup: c('同为 K72r，BTN vs BB 与 BB vs BTN 的优势归属不同。', 'On K72r, edge ownership differs between BTN vs BB and BB vs BTN perspectives.'),
        objective: c('把位置与范围结构映射到具体频率。', 'Map position and range structure into concrete frequencies.'),
        streetPlan: [
          c('Flop：先标记双方顶部与中段密度。', 'Flop: mark top-end and middle-density of both ranges first.'),
          c('Turn：若优势延续，扩大价值与施压频率。', 'Turn: if edge persists, expand value and pressure frequencies.'),
          c('River：按到达分布决定价值收口或放弃。', 'River: close with value or give up by arrival distribution.'),
        ],
        coachTakeaways: [
          c('同牌面不等于同策略。', 'Same board does not imply same strategy.'),
          c('位置与范围共同定义可执行答案。', 'Position plus range shape defines executable answers.'),
        ],
        passChecks: [
          c('能口述双方优势归属。', 'Can articulate edge ownership for both sides.'),
          c('能给出匹配优势的频率建议。', 'Can provide frequency recommendations aligned with edges.'),
        ],
      },
      {
        title: c('案例 B：中频动作被打成纯动作', 'Case B: A Mixed Action Turned into a Pure Action'),
        setup: c('某中频 check 候选长期被高频下注，导致防守结构塌陷。', 'A mixed-check candidate is over-bet too often, collapsing defensive structure.'),
        objective: c('恢复中频纪律，修复可防守范围结构。', 'Restore mixed-frequency discipline and repair defendable range shape.'),
        streetPlan: [
          c('Flop：识别该手在范围中的功能角色。', 'Flop: identify this hand role in the full range.'),
          c('Turn：保留必要 check 频率，避免过度纯化。', 'Turn: preserve required check frequency and avoid over-purification.'),
          c('River：减少被对手针对的可预测线路。', 'River: reduce predictable lines that opponents can target.'),
        ],
        coachTakeaways: [
          c('混频是结构稳定器，不是犹豫。', 'Mixing is a structural stabilizer, not hesitation.'),
          c('长期纯化会产生可见 exploit 缺口。', 'Long-term purification creates visible exploit windows.'),
        ],
        passChecks: [
          c('能判断动作应属于高/中/低频。', 'Can classify whether an action should be high, mid, or low frequency.'),
          c('能给出修正后的频率区间。', 'Can provide corrected frequency bands.'),
        ],
      },
    ],
    acceptanceChecks: [
      c('范围口述完整率 >= 88%。', 'Range narration completeness >= 88%.'),
      c('中频动作纯化错误显著下降。', 'Mixed-action purification errors are significantly reduced.'),
      c('复盘中能稳定描述优势归属。', 'Edge ownership is consistently described in reviews.'),
    ],
    homework: [
      c('每周提交 24 手 range vs range 口述。', 'Submit 24 weekly range-vs-range narrations.'),
      c('输出 1 套“优势归属判定卡”。', 'Produce one edge-ownership decision card set.'),
    ],
    targetSample: c('样本要求：90 个牌面口述 + 140 手范围复盘', 'Sample: 90 board narrations + 140 range reviews'),
    passRule: c('过关：可稳定用范围语言做决策与复盘', 'Pass: stable range-language decision and review capability'),
  },
];
