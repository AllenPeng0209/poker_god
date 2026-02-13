import preflop100 from './data/preflop-100bb.json';
import preflop20 from './data/preflop-20bb.json';
import preflop40 from './data/preflop-40bb.json';
import { ActionType, Card, Rank } from '@poker-god/contracts';

interface SolverMeta {
  source: string;
  license: string;
  stack_bb?: number;
  iterations?: number;
  ev_sb_bb: number;
  exploitability_bb: number;
  scale: string;
}

interface SolverState {
  num_actions: number;
  probs_bp: number[][][];
}

interface SolverDataset {
  meta: SolverMeta;
  states: Record<string, SolverState>;
}

interface StackDataset {
  stackBb: number;
  data: SolverDataset;
}

export interface PreflopSolverResult {
  found: boolean;
  stateKey: string;
  usedStackBb: number;
  bestCode: number;
  bestProb: number;
  recommendedAction: ActionType;
  recommendedAmount?: number;
  mixText: string;
  actionMix: Array<{
    code: number;
    prob: number;
    label: string;
  }>;
  source: string;
}

const datasets: StackDataset[] = [
  { stackBb: 20, data: preflop20 as SolverDataset },
  { stackBb: 40, data: preflop40 as SolverDataset },
  { stackBb: 100, data: preflop100 as SolverDataset },
];

const rankIndexMap: Record<Rank, number> = {
  '2': 0,
  '3': 1,
  '4': 2,
  '5': 3,
  '6': 4,
  '7': 5,
  '8': 6,
  '9': 7,
  T: 8,
  J: 9,
  Q: 10,
  K: 11,
  A: 12,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalize(probs: number[]): number[] {
  const sum = probs.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) {
    return probs.map(() => 0);
  }
  return probs.map((value) => value / sum);
}

function buildStateKey(actionCodes: number[]): string {
  return actionCodes.length === 0 ? 'root' : actionCodes.join('-');
}

function resolveState(
  data: SolverDataset,
  actionCodes: number[],
): { state: SolverState; stateKey: string; fallbackDepth: number } | null {
  const fullKey = buildStateKey(actionCodes);
  const exact = data.states[fullKey];
  if (exact) {
    return { state: exact, stateKey: fullKey, fallbackDepth: 0 };
  }

  const codes = [...actionCodes];

  while (codes.length >= 0) {
    const key = buildStateKey(codes);
    const state = data.states[key];
    if (state) {
      return { state, stateKey: key, fallbackDepth: actionCodes.length - codes.length };
    }

    if (codes.length === 0) {
      break;
    }

    codes.pop();
  }

  const root = data.states.root;
  if (root) {
    return { state: root, stateKey: 'root', fallbackDepth: actionCodes.length };
  }
  return null;
}

function pickDatasets(stackBb: number): {
  lower: StackDataset;
  upper: StackDataset;
  upperWeight: number;
} {
  const sorted = [...datasets].sort((a, b) => a.stackBb - b.stackBb);

  if (stackBb <= sorted[0].stackBb) {
    return { lower: sorted[0], upper: sorted[0], upperWeight: 0 };
  }

  const last = sorted[sorted.length - 1];
  if (stackBb >= last.stackBb) {
    return { lower: last, upper: last, upperWeight: 0 };
  }

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const left = sorted[i];
    const right = sorted[i + 1];
    if (stackBb >= left.stackBb && stackBb <= right.stackBb) {
      const span = right.stackBb - left.stackBb;
      const upperWeight = span === 0 ? 0 : (stackBb - left.stackBb) / span;
      return { lower: left, upper: right, upperWeight };
    }
  }

  return { lower: last, upper: last, upperWeight: 0 };
}

function matrixIndexFromHand(cards: Card[]): { row: number; col: number } {
  const [first, second] = cards;
  const firstRank = rankIndexMap[first.rank];
  const secondRank = rankIndexMap[second.rank];

  if (firstRank === secondRank) {
    return { row: firstRank, col: secondRank };
  }

  const high = Math.max(firstRank, secondRank);
  const low = Math.min(firstRank, secondRank);

  if (first.suit === second.suit) {
    return { row: low, col: high };
  }

  return { row: high, col: low };
}

function probabilityFromState(state: SolverState, actionCode: number, row: number, col: number): number {
  if (actionCode < 0 || actionCode >= state.num_actions) {
    return 0;
  }
  return (state.probs_bp[actionCode]?.[row]?.[col] ?? 0) / 10000;
}

function solverCodeLabel(code: number): string {
  switch (code) {
    case 0:
      return 'Fold';
    case 1:
      return 'Call/Check';
    case 2:
      return 'Raise 2.5x';
    case 3:
      return 'Raise 3x';
    case 4:
      return 'Raise 3.5x';
    case 5:
      return 'Raise 4x';
    case 6:
      return 'All-in';
    default:
      return `Action ${code}`;
  }
}

function toAppAction(code: number, toCall: number): ActionType {
  if (code === 0) {
    return 'fold';
  }
  if (code === 1) {
    return toCall > 0 ? 'call' : 'check';
  }
  return 'raise';
}

function codeToRaiseAmount(code: number, toCall: number, minRaise: number, heroStack: number): number {
  if (code <= 1) {
    return 0;
  }

  const base = Math.max(2, toCall + minRaise);
  let suggested = base;

  if (code === 2) {
    suggested = Math.round(base * 1.1);
  } else if (code === 3) {
    suggested = Math.round(base * 1.25);
  } else if (code === 4) {
    suggested = Math.round(base * 1.4);
  } else if (code === 5) {
    suggested = Math.round(base * 1.7);
  } else if (code >= 6) {
    suggested = heroStack;
  }

  return clamp(suggested, toCall + minRaise, heroStack);
}

export function mapRaiseAmountToSolverCode(raiseAmount: number, toCall: number, minRaise: number, heroStack: number): number {
  if (heroStack <= 0) {
    return 6;
  }

  const minAllowed = Math.max(1, toCall + minRaise);
  const ratio = raiseAmount / minAllowed;

  if (raiseAmount >= heroStack * 0.95) {
    return 6;
  }

  if (ratio < 1.16) {
    return 2;
  }
  if (ratio < 1.33) {
    return 3;
  }
  if (ratio < 1.55) {
    return 4;
  }
  return 5;
}

export function mapActionToSolverCode(action: ActionType, toCall: number, raiseAmount: number, minRaise: number, heroStack: number): number {
  if (action === 'fold') {
    return 0;
  }
  if (action === 'call' || action === 'check') {
    return 1;
  }
  return mapRaiseAmountToSolverCode(raiseAmount, toCall, minRaise, heroStack);
}

export function getPreflopSolverAdvice(params: {
  stackBb: number;
  actionCodes: number[];
  heroCards: Card[];
  toCall: number;
  minRaise: number;
  heroStack: number;
}): PreflopSolverResult {
  const { lower, upper, upperWeight } = pickDatasets(params.stackBb);
  const requestedKey = buildStateKey(params.actionCodes);

  const lowerStateInfo = resolveState(lower.data, params.actionCodes);
  const upperStateInfo = resolveState(upper.data, params.actionCodes);

  if (!lowerStateInfo && !upperStateInfo) {
    return {
      found: false,
      stateKey: buildStateKey(params.actionCodes),
      usedStackBb: params.stackBb,
      bestCode: 1,
      bestProb: 0,
      recommendedAction: params.toCall > 0 ? 'call' : 'check',
      mixText: 'Solver table miss，改用規則引擎。',
      actionMix: [],
      source: 'b-inary/poker-cfr (fallback miss)',
    };
  }

  const lowerFallbackDepth = lowerStateInfo?.fallbackDepth ?? Number.POSITIVE_INFINITY;
  const upperFallbackDepth = upperStateInfo?.fallbackDepth ?? Number.POSITIVE_INFINITY;
  const minFallbackDepth = Math.min(lowerFallbackDepth, upperFallbackDepth);
  if (minFallbackDepth >= 2 && params.actionCodes.length >= 2) {
    return {
      found: false,
      stateKey: requestedKey,
      usedStackBb: params.stackBb,
      bestCode: 1,
      bestProb: 0,
      recommendedAction: params.toCall > 0 ? 'call' : 'check',
      mixText: 'Solver state fallback 深度過大，改用規則引擎。',
      actionMix: [],
      source: 'b-inary/poker-cfr (fallback depth guard)',
    };
  }

  const rowCol = matrixIndexFromHand(params.heroCards);
  const actionCount = Math.max(lowerStateInfo?.state.num_actions ?? 0, upperStateInfo?.state.num_actions ?? 0);
  const rawProbs: number[] = [];

  for (let code = 0; code < actionCount; code += 1) {
    const lowerProb = lowerStateInfo ? probabilityFromState(lowerStateInfo.state, code, rowCol.row, rowCol.col) : 0;
    const upperProb = upperStateInfo ? probabilityFromState(upperStateInfo.state, code, rowCol.row, rowCol.col) : lowerProb;

    let blended = lowerProb;
    if (lower.stackBb !== upper.stackBb) {
      blended = lowerProb * (1 - upperWeight) + upperProb * upperWeight;
    }

    rawProbs.push(blended);
  }

  const probs = normalize(rawProbs);

  let bestCode = 1;
  let bestProb = -1;
  probs.forEach((prob, code) => {
    if (prob > bestProb) {
      bestProb = prob;
      bestCode = code;
    }
  });

  const recommendedAction = toAppAction(bestCode, params.toCall);
  const recommendedAmount = recommendedAction === 'raise'
    ? codeToRaiseAmount(bestCode, params.toCall, params.minRaise, params.heroStack)
    : undefined;

  const actionMix = probs
    .map((prob, code) => ({
      code,
      prob,
      label: solverCodeLabel(code),
    }))
    .filter((item) => item.prob > 0.01)
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 4);

  const mixText = actionMix
    .map((item) => `${item.label} ${Math.round(item.prob * 100)}%`)
    .join(' | ');

  const stateKey = lowerStateInfo?.stateKey ?? upperStateInfo?.stateKey ?? requestedKey;
  const stateFallback = stateKey !== requestedKey;

  return {
    found: true,
    stateKey,
    usedStackBb: lower.stackBb === upper.stackBb ? lower.stackBb : params.stackBb,
    bestCode,
    bestProb,
    recommendedAction,
    recommendedAmount,
    mixText,
    actionMix,
    source: stateFallback ? 'b-inary/poker-cfr (BSD-2-Clause, state fallback)' : 'b-inary/poker-cfr (BSD-2-Clause)',
  };
}
