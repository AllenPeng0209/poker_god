import type { CourseModule } from '../types';
import { c } from '../types';

export const foundationModules: CourseModule[] = [
  {
    id: 'M1',
    week: 'Week 1',
    track: 'foundation',
    level: 'L1',
    title: c('基础规则与流程', 'Rules and Hand Flow'),
    summary: c('从零掌握德州扑克九大牌型、行动顺序、下注合法性与主池边池结算，并配图解示例。', "Master hand rankings, action order, legal betting, and pot settlement with visual examples."),
    coachCore: c('课程目标：能口述并实操“牌型大小 + 行动顺序 + 合法下注 + 分池摊牌”四套规则。', 'Goal: execute and explain hand ranking, action order, legal betting, and main/side pot showdown rules.'),
    conceptLessons: [
      {
        title: c('概念 1：九大牌型与比牌（图解）', 'Concept 1: Hand Rankings and Comparison (Visual)'),
        bullets: [
          c('图解顺序：同花顺 > 四条 > 葫芦 > 同花 > 顺子 > 三条 > 两对 > 一对 > 高牌。', 'Visual order: straight flush > quads > full house > flush > straight > trips > two pair > pair > high card.'),
          c('同牌型比较：先比最大牌，再比踢脚；花色不分大小（♠♥♦♣无高低）。', 'Same hand type comparison: rank by highest cards then kickers; suits have no ranking.'),
          c('图解示例：Board A♠ K♠ 8♦ 8♣ 3♥，A8 是葫芦，AK 是两对，葫芦胜。', 'Visual example: on A♠ K♠ 8♦ 8♣ 3♥, A8 makes a full house and beats AK two pair.'),
        ],
      },
      {
        title: c('概念 2：一手牌四轮流程与行动顺序（图解）', 'Concept 2: Four-Street Flow and Action Order (Visual)'),
        bullets: [
          c('图解流程：发底牌 -> 翻牌前 -> 翻牌 -> 转牌 -> 河牌 -> 摊牌。', 'Visual flow: deal hole cards -> preflop -> flop -> turn -> river -> showdown.'),
          c('行动顺序：翻牌前从 UTG 开始；翻牌后从小盲位左侧在局玩家开始。', 'Action order: preflop starts from UTG; postflop starts from the first live player left of small blind.'),
          c('每轮动作只有 Fold / Check / Call / Raise，且必须满足当前规则前提。', 'Each round allows fold/check/call/raise, only when legal conditions are met.'),
        ],
      },
      {
        title: c('概念 3：合法下注与主池边池（图解）', 'Concept 3: Legal Betting and Main/Side Pots (Visual)'),
        bullets: [
          c('最小加注规则：新加注额至少等于“上一口加注增量”。', 'Minimum raise rule: the new raise increment must be at least the previous increment.'),
          c('不足完整最小加注的全压，通常不重开下注。', 'An all-in below a full minimum raise usually does not reopen action.'),
          c('图解分池：三人 20/50/50 全压 -> 主池 60（三人争）+ 边池 60（后两人争）。', 'Visual side-pot split: 20/50/50 all-in -> main pot 60 (3-way) + side pot 60 (2-way).'),
        ],
      },
    ],
    videoLessons: [
      {
        title: c('视频 1：牌型大小图鉴与快速比牌', 'Video 1: Hand Ranking Atlas and Fast Comparison'),
        duration: '22m',
        objective: c('5 秒内判断常见牌型胜负。', 'Judge common hand winners within 5 seconds.'),
        deliverable: c('完成 40 题“牌型图解判定”练习。', 'Complete 40 visual hand-ranking drills.'),
      },
      {
        title: c('视频 2：行动顺序、最小加注与边池图解', 'Video 2: Action Order, Min-Raise, and Side Pot Visuals'),
        duration: '20m',
        objective: c('能独立完成一手牌规则判定与结算。', 'Independently validate and settle a full hand by rule.'),
        deliverable: c('完成 30 题“合法下注+分池”判断题。', 'Complete 30 legal-betting and side-pot drills.'),
      },
    ],
    handCases: [
      {
        title: c('案例 A：比牌规则图解（葫芦 vs 两对）', 'Case A: Visual Hand Comparison (Full House vs Two Pair)'),
        setup: c('图面：Board A♠ K♠ 8♦ 8♣ 3♥；Hero: A♦8♥；Villain: A♣K♣。', 'Visual board: A♠ K♠ 8♦ 8♣ 3♥; Hero A♦8♥; Villain A♣K♣.'),
        objective: c('掌握“最佳 5 张牌”比较法，而非只看手里 2 张。', 'Master best-five-card comparison instead of comparing only hole cards.'),
        streetPlan: [
          c('Flop/Turn/River：双方到河牌后进入摊牌流程。', 'Flop/Turn/River: both players reach showdown on river.'),
          c('Showdown：Hero=8♠8♣8♥A♠A♦（葫芦）；Villain=A♠A♣K♠K♣8♦（两对）。', 'Showdown: Hero makes full house; Villain makes two pair.'),
          c('Result：葫芦 > 两对，Hero 获胜。', 'Result: full house beats two pair; Hero wins.'),
        ],
        coachTakeaways: [
          c('比牌永远比较“最佳 5 张”，不是比谁手牌更大。', 'Always compare best five cards, not raw hole-card strength.'),
          c('先规则正确，后谈策略收益。', 'Get rules right before discussing strategy EV.'),
        ],
        passChecks: [
          c('能口述本例双方各自最佳 5 张牌。', 'Can state each player’s best five cards in this example.'),
          c('能解释为什么葫芦胜过两对。', 'Can explain why full house beats two pair.'),
        ],
      },
      {
        title: c('案例 B：三人全压的主池/边池图解', 'Case B: Visual Main/Side Pot Split in a Three-Way All-In'),
        setup: c('图面：UTG 20bb all-in，CO 50bb all-in，BTN 50bb all-in。', 'Visual setup: UTG 20bb all-in, CO 50bb all-in, BTN 50bb all-in.'),
        objective: c('准确拆分主池与边池，并判定谁有资格争夺。', 'Accurately split main/side pots and identify eligibility.'),
        streetPlan: [
          c('Preflop：先分池 -> 主池 60（三人争）+ 边池 60（CO 与 BTN 争）。', 'Preflop: split pots first -> main 60 (3-way) + side 60 (CO vs BTN).'),
          c('Showdown：先判主池赢家，再判边池赢家。', 'Showdown: resolve main pot winner first, then side pot winner.'),
          c('Result：若 UTG 牌最大，只拿主池，边池仍由 CO/BTN 比较。', 'Result: if UTG has best hand, UTG wins only main pot; side pot is CO/BTN only.'),
        ],
        coachTakeaways: [
          c('分池先于比牌，顺序不能颠倒。', 'Pot splitting must happen before hand comparison.'),
          c('边池参与资格由筹码覆盖关系决定。', 'Side-pot eligibility is determined by stack coverage.'),
        ],
        passChecks: [
          c('能独立算出主池与边池金额。', 'Can independently compute main and side pot amounts.'),
          c('能说明每个池子的可争夺玩家。', 'Can state eligible players for each pot.'),
        ],
      },
    ],
    acceptanceChecks: [
      c('九大牌型与比牌规则口述正确率 100%。', '100% correct recitation of hand rankings and comparison rules.'),
      c('规则测验 >= 95 分（含最小加注与分池题）。', 'Rule quiz >= 95 including min-raise and side-pot questions.'),
      c('连续 60 手流程模拟无规则错误。', '60 consecutive simulated hands with zero rule mistakes.'),
    ],
    homework: [
      c('绘制 1 张“牌型大小 + 行动顺序”速查图。', 'Draw one quick-reference chart for hand rankings and action order.'),
      c('完成 30 题“合法下注 + 主池边池”图解题。', 'Complete 30 visual drills on legal betting and main/side pots.'),
    ],
    targetSample: c('样本要求：100 道规则图解题 + 60 手流程模拟', 'Sample: 100 visual rule drills + 60 hand-flow simulations'),
    passRule: c('过关：规则题 >= 95 且流程模拟零违规', 'Pass: rule quiz >= 95 and zero violations in flow simulation'),
  },
  {
    id: 'M2',
    week: 'Week 2',
    track: 'foundation',
    level: 'L1',
    title: c('位置与底池基础', 'Position and Pot Core'),
    summary: c('把“感觉跟注”改成“门槛胜率 + 兑现率 + SPR”的系统判断。', 'Replace feel-based calls with threshold equity, realization, and SPR logic.'),
    coachCore: c('课程目标：任何跟注前，先算门槛，再评估位置兑现率。', 'Goal: before any call, compute threshold then evaluate positional realization.'),
    conceptLessons: [
      {
        title: c('概念 1：门槛胜率与底池赔率', 'Concept 1: Break-Even Equity and Pot Odds'),
        bullets: [
          c('门槛公式：跟注额 / (当前底池 + 跟注额)。', 'Threshold formula: call amount / (pot + call amount).'),
          c('赔率合格不代表必跟，仍需看后续兑现率。', 'Good odds do not force a call; realization still matters.'),
          c('高压节点按公式先算，再做动作。', 'In pressure spots, calculate first and act second.'),
        ],
      },
      {
        title: c('概念 2：SPR 与可执行计划', 'Concept 2: SPR and Executable Planning'),
        bullets: [
          c('低 SPR 倾向简化价值推进，高 SPR 更重线路管理。', 'Low SPR favors simplified value push, high SPR needs line management.'),
          c('OOP 边缘组合兑现率下降，防守阈值应提高。', 'Out-of-position marginal hands realize less equity and need tighter defense thresholds.'),
          c('同一手牌在不同 SPR 的最优线可以完全不同。', 'Optimal lines can differ completely for the same hand across SPR levels.'),
        ],
      },
    ],
    videoLessons: [
      {
        title: c('视频 1：底池赔率速算训练', 'Video 1: Pot-Odds Speed Training'),
        duration: '22m',
        objective: c('建立 2 秒门槛胜率速算能力。', 'Build 2-second break-even equity calculations.'),
        deliverable: c('完成 60 道门槛速算题。', 'Complete 60 threshold-speed drills.'),
      },
      {
        title: c('视频 2：SPR 三档策略模板', 'Video 2: Three-Tier SPR Strategy Templates'),
        duration: '18m',
        objective: c('掌握低/中/高 SPR 的默认策略框架。', 'Master default frameworks for low, medium, and high SPR.'),
        deliverable: c('提交 3 手同牌不同 SPR 对照。', 'Submit 3 same-hand, different-SPR comparisons.'),
      },
    ],
    handCases: [
      {
        title: c('案例 A：赔率够但兑现不足', 'Case A: Odds Are Fine but Realization Is Poor'),
        setup: c('BB OOP 面对 BTN 小注，赔率可跟但后续被压制。', 'BB OOP faces BTN small bet with callable odds but poor future playability.'),
        objective: c('识别“数学可跟、实战应弃”的节点。', 'Identify spots where math allows a call but execution favors fold.'),
        streetPlan: [
          c('Flop：先算门槛，再评估 turn 可继续路径。', 'Flop: compute threshold first, then assess turn continuations.'),
          c('Turn：若权益下降且无主动权，执行降频防守。', 'Turn: if equity drops and initiative is absent, reduce continuation frequency.'),
          c('River：无清晰赢法时提前止损。', 'River: cut losses early without clear winning paths.'),
        ],
        coachTakeaways: [
          c('赔率是门槛，不是许可。', 'Odds are a threshold, not permission.'),
          c('兑现率决定长期盈利稳定性。', 'Realization quality drives long-term stability.'),
        ],
        passChecks: [
          c('能准确给出该点门槛胜率。', 'Can accurately compute the threshold equity.'),
          c('能解释为何 OOP 需要提高弃牌率。', 'Can explain why OOP requires higher fold frequency.'),
        ],
      },
      {
        title: c('案例 B：低 SPR 的价值压缩', 'Case B: Value Compression in Low SPR Pots'),
        setup: c('3bet 底池进入翻牌，SPR 约 3.5，出现过度花式操作。', 'A 3bet pot reaches flop at SPR about 3.5 with unnecessary complexity.'),
        objective: c('建立低 SPR 下的高执行率简化策略。', 'Build high-execution simplified strategy in low SPR spots.'),
        streetPlan: [
          c('Flop：优先价值与保护，不做无目的混频。', 'Flop: prioritize value and protection, avoid purposeless mixing.'),
          c('Turn：按承诺阈值决定继续投入。', 'Turn: continue investment by commitment thresholds.'),
          c('River：避免把清晰价值点复杂化。', 'River: avoid overcomplicating clear value spots.'),
        ],
        coachTakeaways: [
          c('低 SPR 先拿确定 EV，再谈精细平衡。', 'Secure clear EV first in low SPR before fine balancing.'),
          c('稳定执行比炫技更有价值。', 'Stable execution is worth more than flashy lines.'),
        ],
        passChecks: [
          c('能描述低 SPR 默认行动框架。', 'Can describe default action framework in low SPR.'),
          c('能指出何时不需要高混频。', 'Can identify when high mixing is unnecessary.'),
        ],
      },
    ],
    acceptanceChecks: [
      c('赔率题正确率 >= 88%。', 'Pot-odds drill accuracy >= 88%.'),
      c('关键跟注均有门槛记录。', 'All key calls include threshold logs.'),
      c('低 SPR 节点重大亏损显著下降。', 'Major losses in low-SPR spots are significantly reduced.'),
    ],
    homework: [
      c('提交 12 手“赔率够但弃牌”解释报告。', 'Submit 12 reports of “odds okay but fold” spots.'),
      c('制作 1 份 SPR 分档行动卡。', 'Create one SPR-tier action card.'),
    ],
    targetSample: c('样本要求：180 手 + 100 道赔率题', 'Sample: 180 hands + 100 pot-odds drills'),
    passRule: c('过关：关键跟注门槛判断正确率 >= 88%', 'Pass: key-call threshold accuracy >= 88%'),
  },
  {
    id: 'M3',
    week: 'Week 3',
    track: 'foundation',
    level: 'L1',
    title: c('概率速记与 EV', 'Odds Memory and EV'),
    summary: c('建立高压局面下的速算能力与 EV 决策语言。', 'Build fast-math ability and EV decision language under pressure.'),
    coachCore: c('课程目标：2 秒出命中率，5 秒完成跟弃 EV 判断。', 'Goal: 2 seconds for hit-rate, 5 seconds for EV call-fold judgment.'),
    conceptLessons: [
      {
        title: c('概念 1：Outs 与假 outs 过滤', 'Concept 1: Outs and False-Out Filtering'),
        bullets: [
          c('2/4 法则是近似值，边缘点必须修正。', 'Rule of 2 and 4 is approximate and needs correction in close spots.'),
          c('去重 outs 后再考虑反向隐含赔率。', 'Deduplicate outs first, then include reverse implied odds.'),
          c('有效 outs 才能转化为可兑现权益。', 'Only effective outs convert into realizable equity.'),
        ],
      },
      {
        title: c('概念 2：EV 取舍与错误分级', 'Concept 2: EV Tradeoff and Error Tiers'),
        bullets: [
          c('先判断是否正 EV，再比较哪条线更高 EV。', 'First confirm positive EV, then compare higher-EV lines.'),
          c('减少大错率比追求极限最优更关键。', 'Reducing big errors is more critical than chasing perfect optimality.'),
          c('复盘记录“前提-行动-结果”，而非只看输赢。', 'Review premise-action-result instead of only outcomes.'),
        ],
      },
    ],
    videoLessons: [
      {
        title: c('视频 1：高压速算训练', 'Video 1: High-Pressure Speed Math'),
        duration: '20m',
        objective: c('在倒计时下稳定完成门槛与命中率计算。', 'Stably compute thresholds and hit rates under countdown.'),
        deliverable: c('完成 80 道限时速算题。', 'Complete 80 timed speed-math drills.'),
      },
      {
        title: c('视频 2：EV 决策表达模板', 'Video 2: EV Decision Expression Template'),
        duration: '18m',
        objective: c('把“我感觉”替换为“我估值”。', 'Replace “I feel” with “I estimate”.'),
        deliverable: c('提交 20 手 EV 决策口述。', 'Submit EV narrations for 20 hands.'),
      },
    ],
    handCases: [
      {
        title: c('案例 A：同花听牌的假 outs 扣减', 'Case A: False-Out Deduction on a Flush Draw'),
        setup: c('Turn 面对大注，表面赔率可跟，但存在高张同花反向风险。', 'Turn faces a big bet with callable surface odds but domination risk on flush completion.'),
        objective: c('将假 outs 与反向隐含赔率纳入跟弃判断。', 'Integrate false outs and reverse implied odds into call-fold decisions.'),
        streetPlan: [
          c('Turn：先算原始门槛，再扣减假 outs。', 'Turn: compute raw threshold, then deduct false outs.'),
          c('River：命中后优先判断是否具备价值下注条件。', 'River: after hitting, evaluate value-bet eligibility first.'),
          c('未命中：按阈值执行弃牌，不做情绪跟注。', 'When missed: fold by threshold and avoid emotional calls.'),
        ],
        coachTakeaways: [
          c('outs 数量不等于有效权益。', 'Raw outs are not equivalent to effective equity.'),
          c('反向隐含赔率会吞噬薄 EV 跟注。', 'Reverse implied odds can erase thin-EV calls.'),
        ],
        passChecks: [
          c('能区分有效 outs 与假 outs。', 'Can distinguish effective outs from false outs.'),
          c('能给出修正后的跟注依据。', 'Can provide corrected call rationale.'),
        ],
      },
      {
        title: c('案例 B：两头顺听牌的 call vs raise', 'Case B: OESD Call vs Raise Comparison'),
        setup: c('Flop 面对半池 c-bet，听牌权益高但加注会扩大波动。', 'Flop faces half-pot c-bet with strong draw equity but raise increases variance.'),
        objective: c('比较两条线路的总 EV 与执行难度。', 'Compare total EV and execution difficulty of both lines.'),
        streetPlan: [
          c('Flop：分别估算 call EV 与 raise 所需弃牌率。', 'Flop: estimate call EV and required fold equity for raise.'),
          c('Turn：按牌面改善与对手反应切换计划。', 'Turn: switch plans by runout and villain response.'),
          c('River：用阻断与阈值决定收尾诈唬或放弃。', 'River: use blockers and thresholds to choose bluff finish or give-up.'),
        ],
        coachTakeaways: [
          c('高权益听牌不是自动激进。', 'High-equity draws do not mandate automatic aggression.'),
          c('最优线要同时考虑 EV 与可执行性。', 'Best line must balance EV and executability.'),
        ],
        passChecks: [
          c('能给出 call 与 raise 的关键前提。', 'Can state key assumptions for call and raise lines.'),
          c('能说明何时停止半诈延续。', 'Can explain when to stop semibluff continuation.'),
        ],
      },
    ],
    acceptanceChecks: [
      c('速算题正确率 >= 90%。', 'Speed-math accuracy >= 90%.'),
      c('关键底池决策具备 EV 证据链。', 'Key-pot decisions include an explicit EV evidence chain.'),
      c('结果导向型误判显著下降。', 'Result-oriented misjudgments are significantly reduced.'),
    ],
    homework: [
      c('提交 30 手“先算后打”时间戳记录。', 'Submit 30 timestamped “calculate before action” logs.'),
      c('整理 1 套常见听牌 EV 决策卡。', 'Compile one EV decision card set for common draws.'),
    ],
    targetSample: c('样本要求：140 道速算题 + 140 手实战', 'Sample: 140 speed drills + 140 live hands'),
    passRule: c('过关：高压节点 EV 判断稳定，速算 >= 90%', 'Pass: stable EV judgment in pressure spots and speed math >= 90%'),
  },
];
