import { getPostflopSolverAdvice } from '../solver/postflopSolver';
import type { PostflopAggressorBucket } from '../solver/postflopSolver';
import { getPreflopSolverAdvice } from '../solver/preflopSolver';
import { cardToDisplay } from './cards';
import { ActionAdvice, ActionLog, AnalysisContext, AnalysisResult, ActionType, Card, Rank, HandState, TablePlayer, TablePosition } from '../types/poker';

const TABLE_ORDER: TablePosition[] = ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function suggestedRaise(pot: number, minRaise: number): number {
  return Math.max(minRaise, Math.round(pot * 0.65));
}

function positionSummary(ctx: AnalysisContext): string {
  return `位置：${ctx.hand.position.heroLabel} 對 ${ctx.hand.position.villainLabel}。`;
}

function positionDiscipline(ctx: AnalysisContext): string {
  return heroInPositionPostflop(ctx.hand)
    ? '你在位置優勢（IP），可更精準控制下注節奏，但邊緣牌仍需避免過度防守。'
    : '你在位置劣勢（OOP），邊緣牌需更保守，避免被多街施壓。';
}

function isHeadsUpHand(ctx: AnalysisContext): boolean {
  return ctx.hand.players.filter((player) => player.inHand && !player.folded).length === 2;
}

function activePlayerCount(hand: HandState): number {
  return hand.players.filter((player) => player.inHand && !player.folded).length;
}

function canPlayerAct(player: TablePlayer): boolean {
  return player.inHand && !player.folded && !player.allIn && player.stack > 0;
}

function findByPosition(players: TablePlayer[], position: TablePosition): TablePlayer | undefined {
  return players.find((player) => player.position === position);
}

function actionOrderFrom(start: TablePosition, players: TablePlayer[]): TablePlayer[] {
  const active = TABLE_ORDER.filter((position) => findByPosition(players, position)?.inHand && !findByPosition(players, position)?.folded);
  if (active.length === 0) {
    return [];
  }

  const startIdx = active.indexOf(start);
  const safeStartIdx = startIdx === -1 ? 0 : startIdx;
  const order: TablePlayer[] = [];
  for (let i = 0; i < active.length; i += 1) {
    const pos = active[(safeStartIdx + i) % active.length];
    const player = findByPosition(players, pos);
    if (player) {
      order.push(player);
    }
  }
  return order;
}

function nextPosition(position: TablePosition, players: TablePlayer[]): TablePosition {
  const active = TABLE_ORDER.filter((p) => findByPosition(players, p)?.inHand && !findByPosition(players, p)?.folded);
  if (active.length === 0) {
    return position;
  }
  const idx = active.indexOf(position);
  if (idx === -1) {
    return active[0];
  }
  return active[(idx + 1) % active.length];
}

function heroInPositionPostflop(hand: HandState): boolean {
  const start = nextPosition(hand.buttonPosition, hand.players);
  const order = actionOrderFrom(start, hand.players).filter((player) => canPlayerAct(player));
  if (order.length === 0) {
    return hand.position.heroInPositionPostflop;
  }
  return order[order.length - 1]?.id === hand.heroPlayerId;
}

function heroAggressorBucket(ctx: AnalysisContext): PostflopAggressorBucket {
  const lastRaise = [...ctx.hand.history].reverse().find((log) => {
    if (log.actor === 'table' || !log.actorId) {
      return false;
    }
    if (log.forcedBlind) {
      return false;
    }
    return log.action === 'raise' && log.amount > 0;
  });
  if (!lastRaise?.actorId) {
    return 'none';
  }
  return lastRaise.actorId === ctx.hand.heroPlayerId ? 'self' : 'opponent';
}

function riverActionPathForHero(hand: HandState): string[] {
  if (hand.street !== 'river') {
    return [];
  }

  if (activePlayerCount(hand) !== 2) {
    return [];
  }

  const heroInPosition = heroInPositionPostflop(hand);
  const oopId = heroInPosition ? hand.focusVillainId : hand.heroPlayerId;
  const ipId = heroInPosition ? hand.heroPlayerId : hand.focusVillainId;
  if (!oopId || !ipId) {
    return [];
  }

  let oopContrib = 0;
  let ipContrib = 0;
  const path: string[] = [];

  for (const log of hand.history as ActionLog[]) {
    if (log.street !== 'river') {
      continue;
    }
    if (log.actor === 'table' || !log.actorId || log.forcedBlind) {
      continue;
    }

    const isOop = log.actorId === oopId;
    const isIp = log.actorId === ipId;
    if (!isOop && !isIp) {
      continue;
    }

    const actorContrib = isOop ? oopContrib : ipContrib;
    const toCall = Math.max(oopContrib, ipContrib) - actorContrib;

    if (log.action === 'fold') {
      path.push('f');
      continue;
    }
    if (log.action === 'check') {
      path.push('c');
      continue;
    }
    if (log.action === 'call') {
      path.push('c');
      const callAdd = Math.max(0, log.amount);
      if (isOop) {
        oopContrib += callAdd;
      } else {
        ipContrib += callAdd;
      }
      continue;
    }
    if (log.action === 'raise') {
      const delta = Math.max(0, log.amount);
      if (toCall <= 0) {
        path.push(`b${delta}`);
      } else {
        const raiseAmount = Math.max(0, delta - toCall);
        path.push(`r${raiseAmount}`);
      }
      if (isOop) {
        oopContrib += delta;
      } else {
        ipContrib += delta;
      }
    }
  }

  return path;
}

function cardListText(cards: Card[]): string {
  if (cards.length === 0) {
    return '（無）';
  }
  return cards.map((card) => cardToDisplay(card)).join(' ');
}

function spotContextLines(ctx: AnalysisContext): string[] {
  const board = ctx.hand.board.slice(0, ctx.hand.revealedBoardCount);
  return [
    `Hero 手牌：${cardListText(ctx.hand.heroCards)}`,
    `當前牌面：${cardListText(board)}`,
  ];
}

function rankValue(rank: Rank): number {
  const map: Record<Rank, number> = {
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    T: 10,
    J: 11,
    Q: 12,
    K: 13,
    A: 14,
  };
  return map[rank];
}

function holeClassKey(cards: Card[]): string {
  const [a, b] = cards;
  const av = rankValue(a.rank);
  const bv = rankValue(b.rank);
  if (av === bv) {
    return `${a.rank}${b.rank}`;
  }
  const high = av > bv ? a : b;
  const low = av > bv ? b : a;
  const suited = a.suit === b.suit ? 's' : 'o';
  return `${high.rank}${low.rank}${suited}`;
}

function isPremiumNoFoldHand(cards: Card[]): boolean {
  const key = holeClassKey(cards);
  return key === 'AA' || key === 'KK' || key === 'QQ' || key === 'AKs' || key === 'AKo';
}

function preflopHoleScore(cards: Card[]): number {
  const [a, b] = cards;
  const av = rankValue(a.rank);
  const bv = rankValue(b.rank);
  const high = Math.max(av, bv);
  const low = Math.min(av, bv);
  const pair = av === bv;
  const suited = a.suit === b.suit;
  const gap = Math.max(0, high - low - 1);

  let score = 8 + high * 2.2 + low * 1.2;

  if (pair) {
    score += 20 + high * 1.8;
  }

  if (suited) {
    score += 5;
  }

  if (!pair) {
    if (gap === 0) {
      score += 6;
    } else if (gap === 1) {
      score += 3;
    } else if (gap >= 4) {
      score -= 4;
    }
  }

  const broadwayCount = [high, low].filter((value) => value >= 10).length;
  if (broadwayCount === 2) {
    score += 8;
  } else if (broadwayCount === 1) {
    score += 3;
  }

  if (high === 14 && low <= 5 && suited) {
    score += 2;
  }

  return clamp(Math.round(score), 5, 99);
}

function createAdvice(
  action: ActionType,
  confidence: number,
  summary: string,
  rationale: string[],
  amount?: number,
  source: 'heuristic' | 'preflop_cfr' | 'postflop_cfr' = 'heuristic',
): ActionAdvice {
  return {
    action,
    amount,
    confidence: round2(clamp(confidence, 0.5, 0.95)),
    summary,
    rationale,
    source,
  };
}

function getPreflopHeuristicAdvice(
  ctx: AnalysisContext,
  potOdds: number,
  positionLine: string,
  disciplineLine: string,
  confidenceShift: number,
  contextLines: string[],
): ActionAdvice {
  const { hand } = ctx;
  const holeScore = preflopHoleScore(hand.heroCards);
  const handClass = holeClassKey(hand.heroCards);
  const activeCount = activePlayerCount(hand);
  const multiwayTighten = Math.max(0, activeCount - 2) * 4;
  const oopPenalty = hand.position.heroInPositionPostflop ? 0 : 5;

  if (hand.toCall === 0) {
    if (holeScore >= 72) {
      return createAdvice(
        'raise',
        0.78 + confidenceShift * 0.4,
        `Preflop（${handClass}）屬強牌，主動加注建立主導。`,
        [
          ...contextLines,
          positionLine,
          disciplineLine,
          `起手牌評分 ${holeScore}/99，建議主動施壓。`,
          '多人池會略收緊頻率，但此牌仍偏向價值加注。',
        ],
        suggestedRaise(hand.pot, hand.minRaise),
      );
    }

    return createAdvice(
      'check',
      0.66,
      `Preflop（${handClass}）以過牌控制底池。`,
      [
        ...contextLines,
        positionLine,
        disciplineLine,
        `起手牌評分 ${holeScore}/99，未達主動加注門檻。`,
      ],
    );
  }

  const callThreshold = potOdds * 100 + 16 + oopPenalty + multiwayTighten;
  const raiseThreshold = callThreshold + (hand.position.heroInPositionPostflop ? 13 : 17);

  if (holeScore >= raiseThreshold) {
    return createAdvice(
      'raise',
      0.74 + confidenceShift * 0.4,
      `Preflop（${handClass}）強度足夠，建議加注懲罰寬範圍。`,
      [
        ...contextLines,
        positionLine,
        disciplineLine,
        `起手牌評分 ${holeScore}/99，超過加注門檻 ${Math.round(raiseThreshold)}。`,
        `當前跟注門檻約 ${Math.round(callThreshold)}，多人池調整後仍具主動價值。`,
      ],
      suggestedRaise(hand.pot, hand.minRaise),
    );
  }

  if (holeScore >= callThreshold) {
    return createAdvice(
      'call',
      0.71 + confidenceShift * 0.35,
      `Preflop（${handClass}）可盈利防守，建議跟注。`,
      [
        ...contextLines,
        positionLine,
        disciplineLine,
        `起手牌評分 ${holeScore}/99，達到跟注門檻 ${Math.round(callThreshold)}。`,
        '保持防守頻率，避免被對手無成本偷盲。',
      ],
    );
  }

  if (isPremiumNoFoldHand(hand.heroCards) && hand.toCall <= Math.max(hand.pot * 0.9, hand.heroStack * 0.35)) {
    return createAdvice(
      'call',
      0.69,
      `Preflop（${handClass}）觸發強牌保護，不建議直接棄牌。`,
      [
        ...contextLines,
        positionLine,
        disciplineLine,
        '雖未達一般分數門檻，但 AK/QQ+ 在此投入下通常不直接棄牌。',
        '改為跟注保留後續決策空間。',
      ],
    );
  }

  return createAdvice(
    'fold',
    0.78 - confidenceShift * 0.2,
    `Preflop（${handClass}）低於防守門檻，建議棄牌止損。`,
    [
      ...contextLines,
      positionLine,
      disciplineLine,
      `起手牌評分 ${holeScore}/99，低於跟注門檻 ${Math.round(callThreshold)}。`,
      '保存籌碼等待更高 EV spot。',
    ],
  );
}

function getGtoAdvice(ctx: AnalysisContext, potOdds: number): ActionAdvice {
  const { hand, heroStrength } = ctx;
  const raiseSize = suggestedRaise(hand.pot, hand.minRaise);
  const positionLine = positionSummary(ctx);
  const disciplineLine = positionDiscipline(ctx);
  const contextLines = spotContextLines(ctx);
  const heroIp = heroInPositionPostflop(hand);
  const confidenceShift = heroIp ? 0.02 : -0.02;
  const headsUpOnly = isHeadsUpHand(ctx);

  if (hand.street === 'preflop' && headsUpOnly && hand.preflopSolverEligible) {
    const heroPlayer = hand.players.find((player) => player.id === hand.heroPlayerId);
    const opponent = hand.players.find((player) => player.id !== hand.heroPlayerId && player.inHand && !player.folded)
      ?? hand.players.find((player) => player.id === hand.focusVillainId)
      ?? hand.players.find((player) => player.role === 'ai');
    const heroEffective = (heroPlayer?.stack ?? hand.heroStack) + (heroPlayer?.committedStreet ?? 0);
    const villainEffective = (opponent?.stack ?? hand.villainStack) + (opponent?.committedStreet ?? 0);
    const effectiveStackBb = Math.max(5, Math.min(heroEffective, villainEffective) / Math.max(1, hand.bigBlind));
    const solver = getPreflopSolverAdvice({
      stackBb: effectiveStackBb,
      actionCodes: hand.preflopActionCodes,
      heroCards: hand.heroCards,
      toCall: hand.toCall,
      minRaise: hand.minRaise,
      heroStack: hand.heroStack,
    });

    if (solver.found) {
      const actionText =
        solver.recommendedAction === 'raise'
          ? '加注'
          : solver.recommendedAction === 'call'
            ? '跟注'
            : solver.recommendedAction === 'check'
              ? '過牌'
              : '棄牌';

      const premiumGuard =
        solver.recommendedAction === 'fold'
        && hand.toCall > 0
        && isPremiumNoFoldHand(hand.heroCards)
        && hand.toCall <= Math.max(hand.pot * 0.9, hand.heroStack * 0.35);

      if (premiumGuard) {
        return createAdvice(
          'call',
          clamp(solver.bestProb + confidenceShift * 0.25, 0.58, 0.9),
          `Preflop CFR 原始建議棄牌，${holeClassKey(hand.heroCards)} 觸發強牌保護改為跟注。`,
          [
            ...contextLines,
            positionLine,
            `Preflop 行動順序：${hand.position.preflopOrderHint}。`,
            disciplineLine,
            `查表節點：${solver.stateKey}，有效籌碼約 ${Math.round(effectiveStackBb)}bb。`,
            `混合頻率：${solver.mixText || '單一動作接近 100%。'}`,
            '此節點使用 HU preflop CFR；multiway 會改用啟發式策略。',
            `資料來源：${solver.source}`,
            '保護規則：AK/QQ+ 在此投入下不直接棄牌，避免明顯違反常識範圍。',
          ],
          undefined,
          'preflop_cfr',
        );
      }

      return createAdvice(
        solver.recommendedAction,
        clamp(solver.bestProb + confidenceShift * 0.5, 0.56, 0.93),
        `Preflop HU-CFR 建議${actionText}（主頻 ${Math.round(solver.bestProb * 100)}%）。`,
        [
          ...contextLines,
          positionLine,
          `Preflop 行動順序：${hand.position.preflopOrderHint}。`,
          disciplineLine,
          `查表節點：${solver.stateKey}，有效籌碼約 ${Math.round(effectiveStackBb)}bb。`,
          `混合頻率：${solver.mixText || '單一動作接近 100%。'}`,
          '此節點使用 HU preflop CFR；multiway 會改用啟發式策略。',
          `資料來源：${solver.source}`,
        ],
        solver.recommendedAmount,
        'preflop_cfr',
      );
    }
  }

  if (hand.street === 'flop' || hand.street === 'turn' || hand.street === 'river') {
    const revealedBoard = hand.board.slice(0, hand.revealedBoardCount);
    const solver = getPostflopSolverAdvice({
      street: hand.street,
      heroStrength,
      toCall: hand.toCall,
      pot: hand.pot,
      minRaise: hand.minRaise,
      heroStack: hand.heroStack,
      villainStack: hand.villainStack,
      board: revealedBoard,
      heroInPositionPostflop: heroIp,
      activePlayerCount: activePlayerCount(hand),
      actorProfileKey: hand.position.hero,
      aggressor: heroAggressorBucket(ctx),
      riverActionPath: riverActionPathForHero(hand),
    });

    if (solver.found) {
      const actionText =
        solver.recommendedAction === 'raise'
          ? '加注'
          : solver.recommendedAction === 'call'
            ? '跟注'
            : solver.recommendedAction === 'check'
              ? '過牌'
              : '棄牌';

      return createAdvice(
        solver.recommendedAction,
        clamp(solver.bestProb + confidenceShift, 0.55, 0.9),
        `${hand.street.toUpperCase()} Solver 建議${actionText}（主頻 ${Math.round(solver.bestProb * 100)}%）。`,
        [
          ...contextLines,
          positionLine,
          disciplineLine,
          `查表節點：${solver.stateKey}`,
          `混合頻率：${solver.mixText || '單一動作接近 100%。'}`,
          `資料來源：${solver.source}`,
        ],
        solver.recommendedAmount,
        'postflop_cfr',
      );
    }
  }

  if (hand.street === 'preflop') {
    return getPreflopHeuristicAdvice(ctx, potOdds, positionLine, disciplineLine, confidenceShift, contextLines);
  }

  if (heroStrength >= 80) {
    return createAdvice(
      'raise',
      0.88 + confidenceShift * 0.5,
      '高牌力進入價值下注區間，主動擴大底池。',
      [
        ...contextLines,
        positionLine,
        disciplineLine,
        '目前牌力位於上段區間。',
        '在平衡策略下，強牌需要主動拿 value。',
        '避免給對手免費看牌。',
      ],
      raiseSize,
    );
  }

  if (heroStrength >= 62) {
    if (hand.toCall === 0) {
      const oopPenalty = heroIp ? 0 : 0.05;
      return createAdvice(
        'raise',
        0.77 - oopPenalty,
        '中高牌力主動施壓，維持進攻頻率。',
        [
          ...contextLines,
          positionLine,
          disciplineLine,
          '此牌力可承受被跟注的風險。',
          '建立 turn/river 主導權。',
        ],
        raiseSize,
      );
    }
    return createAdvice('call', 0.74 + confidenceShift * 0.5, '用跟注保留範圍，控制波動。', [
      ...contextLines,
      positionLine,
      disciplineLine,
      '在這個強度區間，跟注可防止策略過於偏弱。',
    ]);
  }

  if (hand.toCall === 0) {
    const probeThreshold = heroIp ? 44 : 50;
    if (heroStrength >= probeThreshold) {
      return createAdvice('check', 0.68, '中段牌力優先控制底池。', [
        ...contextLines,
        positionLine,
        disciplineLine,
        '目前沒有必要把邊緣牌力打成大底池。',
      ]);
    }
    return createAdvice('check', 0.64, '弱牌免費過牌，保留後續機會。', [
      ...contextLines,
      positionLine,
      disciplineLine,
      '避免無謂投入。',
    ]);
  }

  const positionTighten = heroIp ? -3 : 4;
  const callThreshold = potOdds * 100 + 12 + positionTighten;
  if (heroStrength >= callThreshold) {
    return createAdvice(
      'call',
      0.71 + confidenceShift * 0.4,
      '依底池賠率可防守一次。',
      [
        ...contextLines,
        positionLine,
        disciplineLine,
        `跟注門檻約 ${Math.round(callThreshold)}，目前牌力 ${heroStrength}。`,
        '避免過度棄牌被持續壓榨。',
      ],
    );
  }

  return createAdvice(
    'fold',
    0.79 - confidenceShift * 0.2,
    '牌力低於防守門檻，理性止損。',
    [
      ...contextLines,
      positionLine,
      disciplineLine,
      `底池賠率要求約 ${Math.round(callThreshold)}，目前牌力不足。`,
      '保留籌碼等待更高 EV spot。',
    ],
  );
}

function getExploitAdvice(ctx: AnalysisContext, gto: ActionAdvice): { advice: ActionAdvice; leak: string } {
  const { hand, heroStrength, ai } = ctx;
  const leak = ai.leakProfile;
  const raiseSize = suggestedRaise(hand.pot, hand.minRaise);
  const readability = (100 - ai.skill) / 100;
  const ip = heroInPositionPostflop(hand);
  const positionLine = positionSummary(ctx);
  const disciplineLine = positionDiscipline(ctx);
  const contextLines = spotContextLines(ctx);

  if (leak.overFoldToRaise && heroStrength >= 34) {
    return {
      leak: '對手面對加注棄牌過高',
      advice: createAdvice(
        'raise',
        0.67 + readability * 0.18 + (ip ? 0.04 : -0.03),
        '針對過度棄牌直接施壓拿下底池。',
        [
          ...contextLines,
          positionLine,
          disciplineLine,
          '對手防守不足，唬牌可擴張。',
          '即使中等牌力也有 fold equity。',
        ],
        raiseSize,
      ),
    };
  }

  if (leak.callsTooWide) {
    const valueThreshold = ip ? 62 : 68;
    if (heroStrength >= valueThreshold) {
      return {
        leak: '對手跟注過寬',
        advice: createAdvice(
          'raise',
          0.7 + readability * 0.15 + (ip ? 0.02 : -0.02),
          '對寬跟注玩家做厚 value。',
          [
            ...contextLines,
            positionLine,
            disciplineLine,
            '對手傾向用次佳牌支付。',
            '優先 value，減少花式唬牌。',
          ],
          raiseSize,
        ),
      };
    }

    const weakThreshold = ip ? 40 : 45;
    if (heroStrength < weakThreshold && hand.toCall > 0) {
      return {
        leak: '對手跟注過寬',
        advice: createAdvice('fold', 0.72, '弱牌不做低成功率唬牌，直接止損。', [
          ...contextLines,
          positionLine,
          disciplineLine,
          '此類對手不常被 bluff 掉。',
        ]),
      };
    }
  }

  if (leak.overBluffsRiver && hand.street === 'river' && hand.toCall > 0 && heroStrength >= 38) {
    return {
      leak: '對手河牌過度唬牌',
      advice: createAdvice('call', 0.78 + (ip ? 0.02 : 0), '以 bluff-catcher 跟注捕捉過量唬牌。', [
        ...contextLines,
        positionLine,
        disciplineLine,
        '這是 exploit 回收 EV 的核心點位。',
      ]),
    };
  }

  if (leak.cBetsTooMuch && hand.toCall > 0 && heroStrength >= 44) {
    return {
      leak: '對手 c-bet 過高',
      advice: createAdvice('call', 0.71 + (ip ? 0.03 : -0.02), '增加防守頻率，不讓對手自動印鈔。', [
        ...contextLines,
        positionLine,
        disciplineLine,
        '適度跟注可抑制對手高頻持續下注。',
      ]),
    };
  }

  if (leak.missesThinValue && hand.toCall === 0 && heroStrength >= 58) {
    return {
      leak: '對手薄價值下注不足',
      advice: createAdvice('raise', 0.7 + (ip ? 0.03 : -0.01), '主動薄 value，從次佳牌拿更多籌碼。', [
        ...contextLines,
        positionLine,
        disciplineLine,
        '你需要比對手更積極兌現中強牌價值。',
      ], raiseSize),
    };
  }

  return {
    leak: '暫無明顯可放大漏洞',
    advice: createAdvice(
      gto.action,
      gto.confidence - 0.04,
      '暫時回歸平衡打法，等待可 exploit 節點。',
      [
        ...contextLines,
        positionLine,
        disciplineLine,
        '當對手漏洞不明顯時，GTO 基線更穩定。',
      ],
      gto.amount,
    ),
  };
}

export function buildAnalysis(ctx: AnalysisContext): AnalysisResult {
  const potOdds = ctx.hand.toCall > 0 ? ctx.hand.toCall / (ctx.hand.pot + ctx.hand.toCall) : 0;

  const gto = getGtoAdvice(ctx, potOdds);
  const exploitResult = getExploitAdvice(ctx, gto);
  const exploit = exploitResult.advice;

  const shouldUseExploit = exploitResult.leak !== '暫無明顯可放大漏洞' && exploit.confidence >= gto.confidence - 0.03;
  const bestMode: 'gto' | 'exploit' = shouldUseExploit ? 'exploit' : 'gto';
  const best = shouldUseExploit ? exploit : gto;

  return {
    gto,
    exploit,
    best,
    bestMode,
    heroStrength: ctx.heroStrength,
    villainStrength: ctx.villainStrength,
    potOdds: round2(potOdds),
    targetLeak: exploitResult.leak,
  };
}
