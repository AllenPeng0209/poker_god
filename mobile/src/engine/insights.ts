import {
  cardToDisplay,
  compareShowdownHands,
  evaluateBestShowdownHand,
  evaluateHandStrength,
} from './cards';
import { ActionType, AiProfile, Card, HandState } from '../types/poker';

type RangeBucketKey = 'value' | 'made' | 'draw' | 'air';

type WeightedCombo = {
  cards: [Card, Card];
  weight: number;
  strength: number;
  bucket: RangeBucketKey;
};

type EquitySummary = {
  heroWin: number;
  tie: number;
  villainWin: number;
};

export interface OutsGroup {
  label: string;
  count: number;
  cards: string[];
}

export interface RangeBucketView {
  key: RangeBucketKey;
  label: string;
  ratio: number;
  combos: number;
}

export interface RangeSample {
  text: string;
  ratio: number;
}

export interface SpotInsight {
  outsGroups: OutsGroup[];
  outsCount: number;
  oneCardHitRate: number;
  twoCardHitRate: number;
  rangeBuckets: RangeBucketView[];
  rangeSamples: RangeSample[];
  equity: EquitySummary;
  potOddsNeed: number;
  combosConsidered: number;
  simulations: number;
  notes: string[];
}

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
const SUITS = ['s', 'h', 'd', 'c'] as const;
const RANK_VALUE: Record<(typeof RANKS)[number], number> = {
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
const RANGE_BUCKET_LABEL: Record<RangeBucketKey, string> = {
  value: '強價值',
  made: '中段成手',
  draw: '聽牌',
  air: '空氣 / 弱攤牌',
};

const DEFAULT_SIMULATIONS = 1400;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function choose2(n: number): number {
  if (n < 2) return 0;
  return (n * (n - 1)) / 2;
}

function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({ rank, suit, code: `${rank}${suit}` });
    }
  }
  return deck;
}

function buildKnownCodeSet(hand: HandState, board: Card[]): Set<string> {
  return new Set([...hand.heroCards, ...board].map((card) => card.code));
}

function latestVillainAction(hand: HandState): ActionType | null {
  const focusId = hand.focusVillainId;
  for (let i = hand.history.length - 1; i >= 0; i -= 1) {
    const log = hand.history[i];
    if (log.actor === 'table' || log.forcedBlind) {
      continue;
    }
    if (!focusId) {
      if (log.actorId) {
        return log.action;
      }
      continue;
    }
    if (log.actorId === focusId) {
      return log.action;
    }
  }
  return null;
}

function hasStraightDraw(cards: Card[]): boolean {
  if (cards.length < 4) {
    return false;
  }
  const values = new Set<number>();
  cards.forEach((card) => {
    const value = RANK_VALUE[card.rank];
    if (value > 0) {
      values.add(value);
      if (value === 14) {
        values.add(1);
      }
    }
  });

  for (let start = 1; start <= 10; start += 1) {
    let hits = 0;
    for (let value = start; value <= start + 4; value += 1) {
      if (values.has(value)) {
        hits += 1;
      }
    }
    if (hits >= 4) {
      return true;
    }
  }
  return false;
}

function hasFlushDraw(cards: Card[]): boolean {
  const suitCount = new Map<string, number>();
  cards.forEach((card) => {
    suitCount.set(card.suit, (suitCount.get(card.suit) ?? 0) + 1);
  });
  return Array.from(suitCount.values()).some((count) => count >= 4);
}

function classifyRangeBucket(strength: number, draw: boolean): RangeBucketKey {
  if (strength >= 76) return 'value';
  if (strength >= 58) return 'made';
  if (draw) return 'draw';
  return 'air';
}

function comboWeight(
  combo: [Card, Card],
  board: Card[],
  ai: AiProfile,
  bucket: RangeBucketKey,
  strength: number,
  lastAction: ActionType | null,
  hand: HandState,
): number {
  const aggression = clamp(ai.aggression / 100, 0, 1);
  const bluffRate = clamp(ai.bluffRate / 100, 0, 1);
  let weight = 1;

  if (ai.archetype === 'Nit') {
    if (bucket === 'value') weight *= 1.45;
    if (bucket === 'made') weight *= 1.12;
    if (bucket === 'draw') weight *= 0.72;
    if (bucket === 'air') weight *= 0.45;
  } else if (ai.archetype === 'TAG') {
    if (bucket === 'value') weight *= 1.25;
    if (bucket === 'made') weight *= 1.07;
    if (bucket === 'draw') weight *= 0.95;
    if (bucket === 'air') weight *= 0.72;
  } else if (ai.archetype === 'LAG') {
    if (bucket === 'value') weight *= 0.98;
    if (bucket === 'made') weight *= 1.08;
    if (bucket === 'draw') weight *= 1.18;
    if (bucket === 'air') weight *= 1.22;
  } else if (ai.archetype === 'Maniac') {
    if (bucket === 'value') weight *= 0.86;
    if (bucket === 'made') weight *= 1.03;
    if (bucket === 'draw') weight *= 1.32;
    if (bucket === 'air') weight *= 1.44;
  }

  if (lastAction === 'raise') {
    if (bucket === 'value') weight *= 1.22 + aggression * 0.35;
    if (bucket === 'made') weight *= 1.02 + aggression * 0.16;
    if (bucket === 'draw') weight *= 0.84 + bluffRate * 0.52;
    if (bucket === 'air') weight *= 0.45 + bluffRate * 0.82;
  } else if (lastAction === 'call') {
    if (bucket === 'value') weight *= 0.86;
    if (bucket === 'made') weight *= 1.16;
    if (bucket === 'draw') weight *= 1.2;
    if (bucket === 'air') weight *= 0.78;
  } else if (lastAction === 'check') {
    if (bucket === 'value') weight *= 0.8;
    if (bucket === 'made') weight *= 1.04;
    if (bucket === 'draw') weight *= 1.07;
    if (bucket === 'air') weight *= 1.12;
  }

  if (ai.leakProfile.overFoldToRaise) {
    if (bucket === 'air') weight *= 0.78;
    if (bucket === 'draw') weight *= 0.88;
  }
  if (ai.leakProfile.callsTooWide) {
    if (bucket === 'made') weight *= 1.08;
    if (bucket === 'draw') weight *= 1.2;
    if (bucket === 'air') weight *= 1.1;
  }
  if (ai.leakProfile.overBluffsRiver && hand.street === 'river') {
    if (bucket === 'air') weight *= 1.28;
  }
  if (ai.leakProfile.cBetsTooMuch && (hand.street === 'flop' || hand.street === 'turn') && lastAction === 'raise') {
    if (bucket === 'draw') weight *= 1.1;
    if (bucket === 'air') weight *= 1.12;
  }
  if (ai.leakProfile.missesThinValue && lastAction === 'raise' && bucket === 'made') {
    weight *= 0.84;
  }

  if (hand.toCall > 0 && strength < 42 && lastAction !== 'raise') {
    weight *= 0.78;
  }

  const boardStrengthBias = board.length >= 4 ? 1.05 : 1;
  return clamp(weight * boardStrengthBias, 0.04, 6);
}

function normalizeRange(combos: WeightedCombo[]): WeightedCombo[] {
  if (combos.length === 0) return [];
  const sorted = [...combos].sort((a, b) => b.weight - a.weight);
  const totalWeight = sorted.reduce((sum, combo) => sum + combo.weight, 0);
  if (totalWeight <= 0) return [];

  const kept: WeightedCombo[] = [];
  let covered = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const combo = sorted[i];
    kept.push(combo);
    covered += combo.weight;
    const coverage = covered / totalWeight;
    if (kept.length >= 80 && (coverage >= 0.93 || kept.length >= 230)) {
      break;
    }
  }

  const keptWeight = kept.reduce((sum, combo) => sum + combo.weight, 0);
  if (keptWeight <= 0) return [];
  return kept.map((combo) => ({ ...combo, weight: combo.weight / keptWeight }));
}

function buildWeightedRange(hand: HandState, board: Card[], unseen: Card[]): WeightedCombo[] {
  const ai = hand.currentAi;
  const lastAction = latestVillainAction(hand);
  const combos: WeightedCombo[] = [];

  for (let i = 0; i < unseen.length - 1; i += 1) {
    for (let j = i + 1; j < unseen.length; j += 1) {
      const cards: [Card, Card] = [unseen[i], unseen[j]];
      const combined = [...cards, ...board];
      const strength = evaluateHandStrength(cards, board);
      const draw = board.length < 5 && (hasFlushDraw(combined) || hasStraightDraw(combined));
      const bucket = classifyRangeBucket(strength, draw);
      const weight = comboWeight(cards, board, ai, bucket, strength, lastAction, hand);
      combos.push({ cards, weight, strength, bucket });
    }
  }

  return normalizeRange(combos);
}

function randomIndexByWeight(weights: number[]): number {
  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < weights.length; i += 1) {
    cumulative += weights[i];
    if (r <= cumulative) {
      return i;
    }
  }
  return Math.max(0, weights.length - 1);
}

function randomRunoutCards(source: Card[], count: number): Card[] {
  if (count <= 0) return [];
  const pool = [...source];
  const picked: Card[] = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

function estimateEquity(hand: HandState, board: Card[], range: WeightedCombo[], simulations: number): EquitySummary {
  if (range.length === 0) {
    return { heroWin: 50, tie: 0, villainWin: 50 };
  }

  const missingBoard = Math.max(0, 5 - board.length);
  const weights = range.map((combo) => combo.weight);
  const deck = fullDeck();
  const knownHeroBoard = new Set([...hand.heroCards, ...board].map((card) => card.code));

  let heroWins = 0;
  let ties = 0;
  let villainWins = 0;
  const loops = Math.max(350, simulations);

  for (let i = 0; i < loops; i += 1) {
    const combo = range[randomIndexByWeight(weights)];
    const blocked = new Set([...knownHeroBoard, combo.cards[0].code, combo.cards[1].code]);
    const runoutPool = deck.filter((card) => !blocked.has(card.code));
    const runout = randomRunoutCards(runoutPool, missingBoard);
    const fullBoard = missingBoard > 0 ? [...board, ...runout] : board;

    const heroResult = evaluateBestShowdownHand(hand.heroCards, fullBoard);
    const villainResult = evaluateBestShowdownHand(combo.cards, fullBoard);
    const cmp = compareShowdownHands(heroResult, villainResult);
    if (cmp > 0) {
      heroWins += 1;
    } else if (cmp === 0) {
      ties += 1;
    } else {
      villainWins += 1;
    }
  }

  const total = Math.max(1, heroWins + ties + villainWins);
  return {
    heroWin: round2((heroWins / total) * 100),
    tie: round2((ties / total) * 100),
    villainWin: round2((villainWins / total) * 100),
  };
}

function buildOutsGroups(hand: HandState, board: Card[], unseen: Card[]) {
  if (board.length < 3 || board.length >= 5) {
    return { groups: [] as OutsGroup[], count: 0, oneCard: 0, twoCard: 0 };
  }

  const current = evaluateBestShowdownHand(hand.heroCards, board);
  const byLabel = new Map<string, string[]>();

  for (let i = 0; i < unseen.length; i += 1) {
    const outCard = unseen[i];
    const nextBoard = [...board, outCard];
    const next = evaluateBestShowdownHand(hand.heroCards, nextBoard);
    const improved = compareShowdownHands(next, current) > 0;
    if (!improved) {
      continue;
    }
    const label = next.category === current.category ? `${next.categoryLabel}補強` : `成 ${next.categoryLabel}`;
    const prev = byLabel.get(label) ?? [];
    prev.push(cardToDisplay(outCard));
    byLabel.set(label, prev);
  }

  const groups = Array.from(byLabel.entries())
    .map(([label, cards]) => ({
      label,
      count: cards.length,
      cards: cards.slice(0, 14),
    }))
    .sort((a, b) => b.count - a.count);

  const outsCount = groups.reduce((sum, group) => sum + group.count, 0);
  const unseenCount = Math.max(1, unseen.length);
  const oneCardRate = outsCount / unseenCount;
  const twoCardRate =
    board.length === 3
      ? 1 - choose2(unseenCount - outsCount) / Math.max(1, choose2(unseenCount))
      : oneCardRate;

  return {
    groups,
    count: outsCount,
    oneCard: round2(oneCardRate * 100),
    twoCard: round2(clamp(twoCardRate, 0, 1) * 100),
  };
}

function buildRangeBuckets(range: WeightedCombo[]): RangeBucketView[] {
  const weightByBucket: Record<RangeBucketKey, number> = {
    value: 0,
    made: 0,
    draw: 0,
    air: 0,
  };
  const comboByBucket: Record<RangeBucketKey, number> = {
    value: 0,
    made: 0,
    draw: 0,
    air: 0,
  };

  range.forEach((combo) => {
    weightByBucket[combo.bucket] += combo.weight;
    comboByBucket[combo.bucket] += 1;
  });

  return (Object.keys(weightByBucket) as RangeBucketKey[])
    .map((key) => ({
      key,
      label: RANGE_BUCKET_LABEL[key],
      ratio: round2(weightByBucket[key] * 100),
      combos: comboByBucket[key],
    }))
    .sort((a, b) => b.ratio - a.ratio);
}

function buildRangeSamples(range: WeightedCombo[]): RangeSample[] {
  return range.slice(0, 8).map((combo) => ({
    text: `${cardToDisplay(combo.cards[0])}${cardToDisplay(combo.cards[1])}`,
    ratio: round2(combo.weight * 100),
  }));
}

export function buildSpotInsight(hand: HandState, simulationCount: number = DEFAULT_SIMULATIONS): SpotInsight {
  const board = hand.board.slice(0, hand.revealedBoardCount);
  const knownCodes = buildKnownCodeSet(hand, board);
  const unseen = fullDeck().filter((card) => !knownCodes.has(card.code));
  const range = buildWeightedRange(hand, board, unseen);
  const outs = buildOutsGroups(hand, board, unseen);
  const equity = estimateEquity(hand, board, range, simulationCount);
  const rangeBuckets = buildRangeBuckets(range);
  const rangeSamples = buildRangeSamples(range);
  const potOddsNeed = hand.toCall > 0 ? round2((hand.toCall / Math.max(1, hand.pot + hand.toCall)) * 100) : 0;

  const notes: string[] = [
    `範圍估算依 AI 風格、漏洞標籤與最近動作加權（樣本 ${range.length} 組）。`,
    `勝率為蒙地卡羅近似（${simulationCount} 次），僅使用目前已揭示公牌。`,
  ];
  if (board.length === 3 && outs.count > 0) {
    notes.push('Flop 的河牌命中率為固定 outs 近似值，實戰會受 turn 改變。');
  }

  return {
    outsGroups: outs.groups,
    outsCount: outs.count,
    oneCardHitRate: outs.oneCard,
    twoCardHitRate: outs.twoCard,
    rangeBuckets,
    rangeSamples,
    equity,
    potOddsNeed,
    combosConsidered: range.length,
    simulations: simulationCount,
    notes,
  };
}
