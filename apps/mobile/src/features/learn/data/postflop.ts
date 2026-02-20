import type { CourseModule } from '../types';
import { c } from '../types';

export const postflopModules: CourseModule[] = [
  {
    id: 'M7',
    week: 'Week 8-10',
    track: 'postflop',
    level: 'L3',
    title: c('翻牌圈核心策略', 'Flop Core Strategy'),
    summary: c('按牌面结构与范围关系设计 c-bet 频率和尺寸，拒绝无脑延续下注。', 'Design c-bet frequency and sizing by board texture and range interaction, not autopilot continuation bets.'),
    coachCore: c('课程目标：每一次 flop 决策都能说明它服务于哪条 turn/river 路径。', 'Goal: every flop decision must map to a concrete turn and river path.'),
    conceptLessons: [
      {
        title: c('概念 1：牌面分类与范围优势', 'Concept 1: Board Classes and Range Edge'),
        bullets: [
          c('A-high 干燥板常见范围优势，动态连张板常见优势分裂。', 'A-high dry boards often carry range edge while connected dynamic boards split advantages.'),
          c('静态板适合高频小注，动态板适合降频提质。', 'Static boards favor high-frequency small bets; dynamic boards require lower frequency and higher quality.'),
          c('先分类，再决定下注频率与尺寸。', 'Classify first, then choose betting frequency and sizing.'),
        ],
      },
      {
        title: c('概念 2：IP/OOP 执行差异', 'Concept 2: IP and OOP Execution Differences'),
        bullets: [
          c('IP 通过位置优势提高中等权益兑现。', 'In-position play improves realization of medium equity.'),
          c('OOP 需保留足够强 check 区间防止被剥削。', 'Out-of-position play must retain strong check regions to avoid exploitation.'),
          c('同一手牌在 IP 与 OOP 可对应不同最优动作。', 'The same hand can map to different optimal actions by position.'),
        ],
      },
    ],
    videoLessons: [
      {
        title: c('视频 1：翻牌牌面分类与默认频率', 'Video 1: Flop Texture Classes and Default Frequencies'),
        duration: '26m',
        objective: c('建立常见牌面分类与频率模板。', 'Build templates for common board classes and frequencies.'),
        deliverable: c('完成 100 个 flop 节点分类。', 'Complete classification on 100 flop nodes.'),
      },
      {
        title: c('视频 2：c-bet 尺寸协同设计', 'Video 2: Coordinated c-bet Sizing Design'),
        duration: '24m',
        objective: c('修复“频率对、尺寸错”的核心中级漏洞。', 'Fix the core mid-level leak of correct frequency with wrong sizing.'),
        deliverable: c('提交 30 个节点的频率+尺寸方案。', 'Submit frequency-plus-size plans for 30 nodes.'),
      },
    ],
    handCases: [
      {
        title: c('案例 A：A72r 的高频小注策略', 'Case A: High-Frequency Small-Bet Plan on A72r'),
        setup: c('BTN vs BB，翻牌 A72r，范围优势明显。', 'BTN vs BB on A72r with clear range advantage.'),
        objective: c('执行高频小注并设计 turn 分流。', 'Execute high-frequency small bets and design turn branches.'),
        streetPlan: [
          c('Flop：以小注覆盖中段与空气压制。', 'Flop: use small size to cover middle range and pressure air.'),
          c('Turn：按高牌强化/后门完成进行分流。', 'Turn: branch by overcard shifts and backdoor completions.'),
          c('River：按到达组合密度分配价值与诈唬。', 'River: allocate value and bluffs by arrival combo density.'),
        ],
        coachTakeaways: [
          c('优势节点优先高执行率打法。', 'In edge-heavy nodes, prioritize high-execution lines.'),
          c('小注是范围工具，不是保守动作。', 'Small betting is a range tool, not passive play.'),
        ],
        passChecks: [
          c('能解释为何该点不宜频繁大注。', 'Can explain why frequent big sizing is suboptimal here.'),
          c('能给出至少两类 turn 继续计划。', 'Can provide at least two turn continuation categories.'),
        ],
      },
      {
        title: c('案例 B：JTs8s 的降频高质量下注', 'Case B: Lower-Frequency High-Quality Betting on JTs8s'),
        setup: c('CO vs BB，翻牌 JTs8s，连张听牌密集。', 'CO vs BB on JTs8s with dense connected draws.'),
        objective: c('控制下注频率并提高下注质量。', 'Control betting frequency while increasing bet quality.'),
        streetPlan: [
          c('Flop：收窄下注候选，优先高权益与高阻断。', 'Flop: narrow candidates and prioritize high equity with strong blockers.'),
          c('Turn：按权益变化执行二枪或降速控池。', 'Turn: barrel or downshift by equity evolution.'),
          c('River：依据阻断与对手到达范围决定收尾。', 'River: finish by blocker structure and opponent arrival range.'),
        ],
        coachTakeaways: [
          c('动态板面更重质量而非数量。', 'Dynamic textures reward quality over quantity.'),
          c('降频是提升单次下注 EV 的手段。', 'Lower frequency is a tool to raise EV per bet.'),
        ],
        passChecks: [
          c('能说明为何该牌面应降频。', 'Can explain why frequency should drop on this board.'),
          c('能列出高质量下注候选类型。', 'Can list high-quality betting candidate classes.'),
        ],
      },
    ],
    acceptanceChecks: [
      c('牌面分类正确率 >= 88%。', 'Board-classification accuracy >= 88%.'),
      c('无计划 c-bet 次数显著下降。', 'Unplanned c-bet counts drop significantly.'),
      c('IP/OOP 执行偏差明显缩小。', 'Execution divergence between IP and OOP is reduced.'),
    ],
    homework: [
      c('提交 40 个“牌面 -> 频率 -> 尺寸”链路。', 'Submit 40 board-to-frequency-to-sizing chains.'),
      c('复盘中重做 12 次无计划下注节点。', 'Redo 12 unplanned betting nodes in review.'),
    ],
    targetSample: c('样本要求：360 个 flop 节点 + 200 手复盘', 'Sample: 360 flop nodes + 200 reviewed hands'),
    passRule: c('过关：分类逻辑与 c-bet 计划一致，执行稳定', 'Pass: consistent board classification and c-bet planning with stable execution'),
  },
  {
    id: 'M8',
    week: 'Week 11-13',
    track: 'postflop',
    level: 'L3',
    title: c('转牌与河牌决策', 'Turn and River Decisions'),
    summary: c('建立二枪条件树、河牌价值/诈唬比例与抓诈阈值系统。', 'Build a system for second-barrel conditions, river value-bluff ratios, and bluff-catching thresholds.'),
    coachCore: c('课程目标：河牌决策基于组合与阈值，不靠读心与情绪。', 'Goal: make river decisions with combos and thresholds, not mind-reading or emotion.'),
    conceptLessons: [
      {
        title: c('概念 1：转牌二枪条件树', 'Concept 1: Turn Second-Barrel Condition Tree'),
        bullets: [
          c('继续开火至少满足：权益、阻断、弃牌率中的两项。', 'Continue barreling only when at least two of equity, blockers, and fold equity align.'),
          c('没有河牌计划的二枪默认降频。', 'Second barrels without a river plan should default to lower frequency.'),
          c('转牌决策本质是管理河牌到达分布。', 'Turn decisions fundamentally manage river arrival distribution.'),
        ],
      },
      {
        title: c('概念 2：河牌薄价值与抓诈阈值', 'Concept 2: River Thin Value and Bluff-Catch Thresholds'),
        bullets: [
          c('先估对手价值上限，再估诈唬下限。', 'Estimate opponent value ceiling before bluff floor.'),
          c('抓诈依据组合与赔率，不依据表情和“感觉”。', 'Bluff catches are based on combos and odds, not vibes.'),
          c('薄价值下注必须有被更差牌跟注的证据。', 'Thin value bets require evidence of worse-call density.'),
        ],
      },
    ],
    videoLessons: [
      {
        title: c('视频 1：二枪继续与降频实战', 'Video 1: Continue or Downshift on the Turn'),
        duration: '25m',
        objective: c('熟练执行二枪条件树并减少无计划延续。', 'Execute the second-barrel condition tree and reduce unplanned continuation.'),
        deliverable: c('完成 80 个 turn continue/check 节点。', 'Complete 80 turn continue-versus-check nodes.'),
      },
      {
        title: c('视频 2：河牌抓诈组合审题', 'Video 2: River Bluff-Catch Combo Analysis'),
        duration: '28m',
        objective: c('提升河牌 call/fold 的可解释性与一致性。', 'Improve explainability and consistency in river call-fold decisions.'),
        deliverable: c('提交 20 手河牌判定报告。', 'Submit 20 river decision reports.'),
      },
    ],
    handCases: [
      {
        title: c('案例 A：边缘 turn 二枪是否继续', 'Case A: Continue or Stop a Marginal Turn Barrel'),
        setup: c('flop 半诈后 turn 空白牌，面对黏性对手。', 'After flop semibluff, turn bricks against a sticky opponent.'),
        objective: c('判断应继续施压还是收缩并保留河牌防守。', 'Decide whether to continue pressure or downshift and preserve river defense.'),
        streetPlan: [
          c('Turn：逐项评估权益、阻断、弃牌率。', 'Turn: evaluate equity, blockers, and fold equity item by item.'),
          c('不足两项成立时，优先 check 控池。', 'If fewer than two conditions hold, prefer check and control.'),
          c('River：按改良与阻断重新判定终端动作。', 'River: reassess terminal action by improvement and blockers.'),
        ],
        coachTakeaways: [
          c('“已经打过一枪”不是继续理由。', '“Already bet once” is not a valid reason to continue.'),
          c('少做错误延续，EV 提升通常更快。', 'Reducing bad continuations usually lifts EV faster.'),
        ],
        passChecks: [
          c('能列出三要素评估结果。', 'Can list triad evaluation outcomes.'),
          c('能解释该点 check 为何优于 bet。', 'Can explain why check outperforms bet in this node.'),
        ],
      },
      {
        title: c('案例 B：河牌薄价值 vs 抓诈', 'Case B: River Thin Value Versus Bluff Catch'),
        setup: c('河牌持中强牌，面对对手极化下注。', 'River holds a medium-strong hand facing a polarized bet.'),
        objective: c('用组合密度区分 thin value、call 还是 fold。', 'Use combo density to separate thin value, call, or fold choices.'),
        streetPlan: [
          c('River：先列对手价值上限组合。', 'River: list opponent upper-value combos first.'),
          c('再估诈唬密度和阻断关系。', 'Then estimate bluff density and blocker interactions.'),
          c('按阈值执行 call/fold 或反向薄价值。', 'Execute call-fold or reverse thin value by threshold.'),
        ],
        coachTakeaways: [
          c('河牌是统计决策，不是胆量竞赛。', 'River is a statistical decision, not a bravery contest.'),
          c('薄价值与抓诈都要证据链。', 'Both thin value and bluff-catching require an evidence chain.'),
        ],
        passChecks: [
          c('能给出价值与诈唬区间估计。', 'Can estimate value and bluff ranges.'),
          c('能说明最终动作的阈值依据。', 'Can explain threshold basis for the final action.'),
        ],
      },
    ],
    acceptanceChecks: [
      c('无计划二枪比例显著下降。', 'Unplanned second barrels drop significantly.'),
      c('河牌抓诈准确率 >= 78%。', 'River bluff-catch accuracy >= 78%.'),
      c('薄价值下注均有证据链。', 'Thin-value bets consistently include evidence chains.'),
    ],
    homework: [
      c('提交 24 手 turn 二枪条件树记录。', 'Submit 24 turn second-barrel condition-tree logs.'),
      c('完成 12 手河牌价值/诈唬组合拆解。', 'Complete 12 river value-bluff combo breakdowns.'),
    ],
    targetSample: c('样本要求：180 个 turn/river 节点 + 12 手深复盘', 'Sample: 180 turn-river nodes + 12 deep reviews'),
    passRule: c('过关：转牌二枪有计划，河牌重大误判显著下降', 'Pass: planned turn barreling with significantly fewer major river misreads'),
  },
  {
    id: 'M9',
    week: 'Week 14-15',
    track: 'postflop',
    level: 'L3',
    title: c('下注尺度与线路设计', 'Sizing and Line Design'),
    summary: c('让每个下注尺寸都对应明确目标，并形成三街连贯叙事。', 'Map every bet size to a clear objective and maintain coherent three-street storytelling.'),
    coachCore: c('课程目标：下注前先回答“目标是什么、下一街怎么走”。', 'Goal: before betting, define the objective and next-street plan.'),
    conceptLessons: [
      {
        title: c('概念 1：目标驱动尺寸', 'Concept 1: Objective-Driven Sizing'),
        bullets: [
          c('33%：范围覆盖与低成本施压。', '33%: range coverage with low-cost pressure.'),
          c('50-75%：价值扩张与中段挤压。', '50-75%: value expansion and middle-range compression.'),
          c('Overbet：极化价值与极化诈唬。', 'Overbet: polarized value and polarized bluffs.'),
        ],
      },
      {
        title: c('概念 2：三街线路连贯性', 'Concept 2: Three-Street Line Coherence'),
        bullets: [
          c('当前下注必须让下一街更清晰，而非更混乱。', 'Current bets must simplify, not complicate, the next street.'),
          c('避免 flop/turn/river 叙事互相冲突。', 'Avoid narrative conflict across flop, turn, and river.'),
          c('无目的下注是中高级玩家最贵漏损之一。', 'Purposeless betting is one of the costliest leaks for mid-advanced players.'),
        ],
      },
    ],
    videoLessons: [
      {
        title: c('视频 1：33/50/75/overbet 四档模板', 'Video 1: 33-50-75-Overbet Four-Template Model'),
        duration: '23m',
        objective: c('掌握四类尺寸的启动条件和禁用条件。', 'Master activation and restriction conditions for four sizing families.'),
        deliverable: c('完成 80 道“目标 -> 尺寸”反推题。', 'Complete 80 objective-to-sizing reverse drills.'),
      },
      {
        title: c('视频 2：由尺寸反推整手线路', 'Video 2: Deriving Full Lines from Sizing Choices'),
        duration: '26m',
        objective: c('减少“这枪打完就断线”的执行错误。', 'Reduce execution failures where lines collapse after one bet.'),
        deliverable: c('提交 16 手三街连贯线路。', 'Submit 16 coherent three-street line designs.'),
      },
    ],
    handCases: [
      {
        title: c('案例 A：overbet 还是 75%', 'Case A: Overbet or 75%'),
        setup: c('河牌结构接近极化，但价值密度不确定。', 'River structure is near-polarized but value density is uncertain.'),
        objective: c('在价值密度与诈唬质量之间选择最优尺寸。', 'Choose optimal sizing by balancing value density and bluff quality.'),
        streetPlan: [
          c('River：先计算可稳定价值下注的组合密度。', 'River: first estimate stable value-bet density.'),
          c('若价值不足以支撑 overbet，降级为 75%。', 'If value cannot support overbet, downgrade to 75%.'),
          c('复盘：比较两种尺寸在同池的净 EV。', 'Review: compare net EV of both sizings in similar pools.'),
        ],
        coachTakeaways: [
          c('尺寸越大，比例容错越小。', 'The bigger the sizing, the smaller the ratio tolerance.'),
          c('能打大不等于该打大。', 'Being able to size big does not mean you should.'),
        ],
        passChecks: [
          c('能给出 overbet 触发条件。', 'Can provide overbet trigger conditions.'),
          c('能解释何时应降到 75%。', 'Can explain when to downgrade to 75%.'),
        ],
      },
      {
        title: c('案例 B：三街叙事冲突修复', 'Case B: Repairing Three-Street Narrative Conflict'),
        setup: c('Flop 小注、Turn 大注、River 又小注，线路逻辑冲突。', 'Flop small, turn big, river small creates line inconsistency.'),
        objective: c('重建可解释、可执行的连贯线路。', 'Rebuild an explainable and executable coherent line.'),
        streetPlan: [
          c('Flop：先定义下注目标和受众区间。', 'Flop: define bet objective and target range segment.'),
          c('Turn：延续同一目标，扩大或收缩压力。', 'Turn: maintain objective and scale pressure consistently.'),
          c('River：用一致叙事完成价值终结或诈唬终结。', 'River: finish with consistent narrative for value or bluff completion.'),
        ],
        coachTakeaways: [
          c('线路是系统，不是三次独立动作。', 'A line is a system, not three isolated actions.'),
          c('叙事连贯性直接影响对手防守质量。', 'Narrative coherence directly impacts opponent defense quality.'),
        ],
        passChecks: [
          c('能指出原线路冲突的具体位置。', 'Can identify the exact conflict points in the original line.'),
          c('能输出改造后的三街计划。', 'Can output a redesigned three-street plan.'),
        ],
      },
    ],
    acceptanceChecks: [
      c('尺寸选择合理率 >= 85%。', 'Sizing appropriateness >= 85%.'),
      c('无目的下注次数显著下降。', 'Purposeless betting count is significantly reduced.'),
      c('三街线路一致性明显提升。', 'Three-street line coherence clearly improves.'),
    ],
    homework: [
      c('提交 24 手“目标-尺寸-下街计划”链路。', 'Submit 24 objective-size-next-street chains.'),
      c('整理 1 份个人尺寸误用黑名单。', 'Create one personal blacklist of repeated sizing misuse.'),
    ],
    targetSample: c('样本要求：120 个尺寸节点 + 180 手线路复盘', 'Sample: 120 sizing nodes + 180 line reviews'),
    passRule: c('过关：下注尺寸可解释，三街线路连续且可执行', 'Pass: explainable sizing with continuous and executable three-street lines'),
  },
];
