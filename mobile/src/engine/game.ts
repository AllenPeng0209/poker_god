import { getPreflopSolverAdvice, mapActionToSolverCode } from '../solver/preflopSolver';
import { getPostflopSolverAdvice } from '../solver/postflopSolver';
import type { PostflopAggressorBucket } from '../solver/postflopSolver';
import {
  ActionLog,
  ActionType,
  AiProfile,
  AnalysisResult,
  HandState,
  HeroLeak,
  Street,
  TablePlayer,
  TablePosition,
  TrainingZone,
} from '../types/poker';
import { buildAnalysis } from './analysis';
import {
  boardCountForStreet,
  compareShowdownHands,
  createShuffledDeck,
  drawCards,
  evaluateBestShowdownHand,
  evaluateHandStrength,
  nextStreet,
} from './cards';
import { buildPositionContext } from './position';
import { getTrashTalk } from './trashTalk';

export interface HeroActionInput {
  action: ActionType;
  raiseAmount?: number;
}

export interface ActionResolution {
  hand: HandState;
  analysis: AnalysisResult;
  decisionBest: boolean;
  leakTag: HeroLeak | null;
}

export interface HandSetupOptions {
  heroPosition?: TablePosition;
  villainPosition?: TablePosition;
  tablePlayers?: Array<{
    id: string;
    position: TablePosition;
    role: 'hero' | 'ai';
    ai?: AiProfile;
    name?: string;
  }>;
  focusVillainId?: string;
  buttonPosition?: TablePosition;
  stackByPlayerId?: Record<string, number>;
  startingStack?: number;
}

const STARTING_STACK = 200;
const SMALL_BLIND = 1;
const BIG_BLIND = 2;

const TABLE_ORDER: TablePosition[] = ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pushLog(history: ActionLog[], log: ActionLog): ActionLog[] {
  return [...history, log];
}

function clonePlayers(players: TablePlayer[]): TablePlayer[] {
  return players.map((player) => ({
    ...player,
    cards: [...player.cards],
  }));
}

function cloneHand(hand: HandState): HandState {
  return {
    ...hand,
    heroCards: [...hand.heroCards],
    villainCards: [...hand.villainCards],
    board: [...hand.board],
    history: [...hand.history],
    decisionRecords: [...hand.decisionRecords],
    preflopActionCodes: [...hand.preflopActionCodes],
    players: clonePlayers(hand.players),
    pendingActors: [...hand.pendingActors],
  };
}

function chooseAi(zone: TrainingZone): AiProfile {
  const index = Math.floor(Math.random() * zone.aiPool.length);
  return zone.aiPool[index] ?? zone.aiPool[0];
}

function findPlayer(hand: HandState, id: string): TablePlayer | undefined {
  return hand.players.find((p) => p.id === id);
}

function findByPosition(players: TablePlayer[], position: TablePosition): TablePlayer | undefined {
  return players.find((p) => p.position === position);
}

function activePlayers(players: TablePlayer[]): TablePlayer[] {
  return players.filter((p) => p.inHand && !p.folded);
}

function canPlayerAct(player: TablePlayer | undefined): player is TablePlayer {
  return !!player && player.inHand && !player.folded && !player.allIn && player.stack > 0;
}

function positionRelativeToButton(position: TablePosition, buttonPosition: TablePosition): TablePosition {
  const positionIdx = TABLE_ORDER.indexOf(position);
  const buttonIdx = TABLE_ORDER.indexOf(buttonPosition);
  const canonicalButtonIdx = TABLE_ORDER.indexOf('BTN');
  if (positionIdx === -1 || buttonIdx === -1 || canonicalButtonIdx === -1) {
    return position;
  }
  const relativeIdx = (positionIdx - buttonIdx + canonicalButtonIdx + TABLE_ORDER.length) % TABLE_ORDER.length;
  return TABLE_ORDER[relativeIdx];
}

function positionContextForHand(hero: TablePlayer, focus: TablePlayer, buttonPosition: TablePosition) {
  const heroRelative = positionRelativeToButton(hero.position, buttonPosition);
  const focusRelative = positionRelativeToButton(focus.position, buttonPosition);
  return buildPositionContext(heroRelative, focusRelative);
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

function buildStreetQueue(hand: HandState, street: Street): string[] {
  const candidates = hand.players.filter((p) => canPlayerAct(p));
  if (candidates.length <= 1) {
    return [];
  }

  const startPos = street === 'preflop' ? nextPosition(hand.bigBlindPosition, hand.players) : nextPosition(hand.buttonPosition, hand.players);
  const order = actionOrderFrom(startPos, hand.players);
  return order.filter((p) => canPlayerAct(p)).map((p) => p.id);
}

function buildReopenQueue(hand: HandState, raiserId: string): string[] {
  const raiser = findPlayer(hand, raiserId);
  if (!raiser) {
    return [];
  }

  const startPos = nextPosition(raiser.position, hand.players);
  const order = actionOrderFrom(startPos, hand.players);
  return order.filter((p) => p.id !== raiserId && canPlayerAct(p)).map((p) => p.id);
}

function syncFocusVillain(hand: HandState) {
  const hero = findPlayer(hand, hand.heroPlayerId);
  if (!hero) {
    return;
  }

  const previousFocusId = hand.focusVillainId;
  let focus = findPlayer(hand, hand.focusVillainId);
  if (!focus || !focus.inHand || focus.folded) {
    focus = hand.players.find((p) => p.role === 'ai' && p.inHand && !p.folded);
    if (focus) {
      hand.focusVillainId = focus.id;
    }
  }

  const safeFocus = focus ?? hand.players.find((p) => p.role === 'ai') ?? hero;
  hand.heroCards = [...hero.cards];
  hand.villainCards = [...safeFocus.cards];
  hand.heroStack = hero.stack;
  hand.villainStack = safeFocus.stack;
  hand.currentAi = safeFocus.ai ?? hand.currentAi;
  hand.position = positionContextForHand(hero, safeFocus, hand.buttonPosition);
  hand.toCall = Math.max(0, hand.currentBet - hero.committedStreet);

  if (hand.street === 'preflop') {
    const headsUpNow = activePlayers(hand.players).length === 2;
    if (!headsUpNow) {
      hand.preflopSolverEligible = false;
      hand.preflopActionCodes = [];
      return;
    }
    if (hand.preflopSolverEligible && hand.focusVillainId !== previousFocusId && hand.preflopActionCodes.length > 0) {
      hand.preflopSolverEligible = false;
      hand.preflopActionCodes = [];
    }
  }
}

function appendPreflopCode(hand: HandState, playerId: string, action: ActionType, amount: number, previousToCall: number) {
  if (hand.street !== 'preflop' || !hand.preflopSolverEligible) {
    return;
  }

  const player = findPlayer(hand, playerId);
  if (!player) {
    return;
  }

  if (player.id !== hand.heroPlayerId && player.id !== hand.focusVillainId) {
    hand.preflopSolverEligible = false;
    hand.preflopActionCodes = [];
    return;
  }

  if (activePlayers(hand.players).length !== 2) {
    hand.preflopSolverEligible = false;
    hand.preflopActionCodes = [];
    return;
  }

  const code = mapActionToSolverCode(action, previousToCall, amount, hand.minRaise, player.stack + amount);
  hand.preflopActionCodes = [...hand.preflopActionCodes, code];
}

function inferHeroLeak(chosen: ActionType, analysis: AnalysisResult, toCall: number): HeroLeak | null {
  const best = analysis.best.action;
  if (chosen === best) return null;
  if (chosen === 'fold' && (best === 'call' || best === 'raise')) return 'overFold';
  if (chosen === 'call' && best === 'fold') return 'overCall';
  if (chosen === 'raise' && (best === 'fold' || (best === 'call' && analysis.heroStrength < 58))) return 'overBluff';
  if (chosen === 'check' && best === 'raise' && analysis.heroStrength >= 62) return 'missedValue';
  if (toCall === 0 && chosen !== 'raise' && analysis.heroStrength >= 54) return 'passiveCheck';
  return null;
}

function getRevealedBoard(hand: HandState) {
  return hand.board.slice(0, hand.revealedBoardCount);
}

function isHeadsUpSpot(hand: HandState): boolean {
  return activePlayers(hand.players).length === 2;
}

function actorInPositionPostflop(hand: HandState, actorId: string): boolean {
  const startPos = nextPosition(hand.buttonPosition, hand.players);
  const order = actionOrderFrom(startPos, hand.players).filter((player) => canPlayerAct(player));
  if (order.length === 0) {
    return false;
  }
  return order[order.length - 1]?.id === actorId;
}

function resolveAggressorForActor(hand: HandState, actorId: string): PostflopAggressorBucket {
  const lastRaise = [...hand.history].reverse().find((log) => {
    if (!log.actorId || log.actor === 'table') {
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
  return lastRaise.actorId === actorId ? 'self' : 'opponent';
}

function resolveOpponentEffectiveStack(hand: HandState, actorId: string): number {
  const opponents = hand.players.filter((player) => player.id !== actorId && player.inHand && !player.folded);
  if (opponents.length === 0) {
    return 1;
  }
  return Math.max(1, Math.min(...opponents.map((player) => player.stack + player.committedStreet)));
}

function riverActionPathForSolver(hand: HandState): string[] {
  if (hand.street !== 'river') {
    return [];
  }

  const active = activePlayers(hand.players);
  if (active.length !== 2) {
    return [];
  }

  const hero = findPlayer(hand, hand.heroPlayerId);
  const villain = active.find((player) => player.id !== hand.heroPlayerId);
  if (!hero || !villain) {
    return [];
  }

  const heroInPosition = hand.position.heroInPositionPostflop;
  const oopId = heroInPosition ? villain.id : hero.id;
  const ipId = heroInPosition ? hero.id : villain.id;

  let oopContrib = 0;
  let ipContrib = 0;
  const path: string[] = [];

  for (const log of hand.history) {
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

function estimateForAnalysis(hand: HandState): { heroStrength: number; villainStrength: number } {
  const board = getRevealedBoard(hand);
  const heroStrength = evaluateHandStrength(hand.heroCards, board);
  const villainStrength = evaluateHandStrength(hand.villainCards, board);
  return { heroStrength, villainStrength };
}

export function analyzeCurrentSpot(hand: HandState): AnalysisResult {
  const { heroStrength, villainStrength } = estimateForAnalysis(hand);
  return buildAnalysis({
    hand,
    heroStrength,
    villainStrength,
    ai: hand.currentAi,
  });
}

function normalizeAction(action: ActionType, toCall: number): ActionType {
  if (action === 'check' && toCall > 0) return 'call';
  if (action === 'call' && toCall === 0) return 'check';
  return action;
}

type ActionWeights = {
  fold: number;
  call: number;
  check: number;
  raise: number;
};

type SolverGuidance = {
  weights: ActionWeights;
  confidence: number;
  recommendedRaiseAmount?: number;
};

const defaultLeakProfile: AiProfile['leakProfile'] = {
  overFoldToRaise: false,
  callsTooWide: false,
  overBluffsRiver: false,
  cBetsTooMuch: false,
  missesThinValue: false,
};

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function pickActionByWeight(weights: ActionWeights, options: ActionType[], skill: number): ActionType {
  const flatten = (1 - skill) * 0.34;
  const jitter = (1 - skill) * 0.28;
  const entries = options.map((action) => {
    const base = Math.max(0.001, weights[action] + flatten);
    const noise = 1 + (Math.random() * 2 - 1) * jitter;
    return {
      action,
      weight: Math.max(0.001, base * noise),
    };
  });

  const totalWeight = entries.reduce((sum, item) => sum + item.weight, 0);
  let pivot = Math.random() * totalWeight;
  for (const entry of entries) {
    pivot -= entry.weight;
    if (pivot <= 0) {
      return entry.action;
    }
  }
  return entries[entries.length - 1]?.action ?? options[0];
}

function preflopCodeToAction(code: number, toCall: number): ActionType {
  if (code === 0) {
    return 'fold';
  }
  if (code === 1) {
    return toCall > 0 ? 'call' : 'check';
  }
  return 'raise';
}

function emptyWeights(): ActionWeights {
  return {
    fold: 0,
    call: 0,
    check: 0,
    raise: 0,
  };
}

function aiSolverGuidance(hand: HandState, player: TablePlayer, strength: number, toCall: number): SolverGuidance {
  const weights = emptyWeights();
  let confidence = 0;
  let recommendedRaiseAmount: number | undefined;
  const headsUpSpot = isHeadsUpSpot(hand);
  const board = getRevealedBoard(hand);

  if (hand.street === 'preflop') {
    if (!headsUpSpot || !hand.preflopSolverEligible) {
      return { weights, confidence, recommendedRaiseAmount };
    }
    const opponent = activePlayers(hand.players).find((item) => item.id !== player.id);
    const effectiveStack = Math.min(player.stack + player.committedStreet, (opponent?.stack ?? hand.heroStack) + (opponent?.committedStreet ?? 0));
    const effectiveStackBb = Math.max(5, effectiveStack / Math.max(1, hand.bigBlind));
    const actionCodes = player.id === hand.focusVillainId ? hand.preflopActionCodes : [];
    const solver = getPreflopSolverAdvice({
      stackBb: effectiveStackBb,
      actionCodes,
      heroCards: player.cards,
      toCall,
      minRaise: hand.minRaise,
      heroStack: player.stack,
    });

    if (solver.found) {
      confidence = clamp01(solver.bestProb);
      for (const item of solver.actionMix) {
        const action = preflopCodeToAction(item.code, toCall);
        weights[action] += item.prob;
      }
      if (solver.actionMix.length === 0) {
        weights[solver.recommendedAction] = Math.max(weights[solver.recommendedAction], clamp01(solver.bestProb));
      }
      if (solver.recommendedAction === 'raise') {
        recommendedRaiseAmount = solver.recommendedAmount;
      }
    }

    return { weights, confidence, recommendedRaiseAmount };
  }

  if (hand.street === 'flop' || hand.street === 'turn' || hand.street === 'river') {
    const inPosition = actorInPositionPostflop(hand, player.id);
    const aggressor = resolveAggressorForActor(hand, player.id);
    const solver = getPostflopSolverAdvice({
      street: hand.street,
      heroStrength: strength,
      toCall,
      pot: hand.pot,
      minRaise: hand.minRaise,
      heroStack: player.stack,
      villainStack: resolveOpponentEffectiveStack(hand, player.id),
      board,
      heroInPositionPostflop: inPosition,
      activePlayerCount: activePlayers(hand.players).length,
      actorProfileKey: player.position,
      aggressor,
      riverActionPath: riverActionPathForSolver(hand),
    });

    if (solver.found) {
      confidence = clamp01(solver.bestProb);
      for (const item of solver.actionMix) {
        weights[item.action] += item.prob;
      }
      if (solver.actionMix.length === 0) {
        weights[solver.recommendedAction] = Math.max(weights[solver.recommendedAction], clamp01(solver.bestProb));
      }
      if (solver.recommendedAction === 'raise') {
        recommendedRaiseAmount = solver.recommendedAmount;
      }
    }
  }

  return { weights, confidence, recommendedRaiseAmount };
}

function blendActionWeights(base: ActionWeights, solver: ActionWeights, trust: number, toCall: number) {
  const actions: ActionType[] = toCall > 0 ? ['fold', 'call', 'raise'] : ['check', 'raise'];
  for (const action of actions) {
    const baseWeight = Math.max(0.001, base[action]);
    const solverWeight = Math.max(0.001, solver[action]);
    base[action] = baseWeight * (1 - trust) + solverWeight * trust;
  }
}

function pickAiRaiseAmount(params: {
  hand: HandState;
  player: TablePlayer;
  toCall: number;
  strength: number;
  skill: number;
  aggression: number;
  leak: AiProfile['leakProfile'];
  solverRaiseAmount?: number;
}): number {
  const { hand, player, toCall, strength, skill, aggression, leak, solverRaiseAmount } = params;
  const minAmount = toCall + hand.minRaise;
  const pressure = toCall > 0 ? toCall / Math.max(1, hand.pot + toCall) : 0;
  const strengthEdge = clamp((strength - 58) / 45, -0.35, 0.9);
  let factor = 0.36 + aggression * 0.34 + strengthEdge * 0.24 + pressure * 0.18;

  if (leak.overBluffsRiver && hand.street === 'river' && strength < 45) {
    factor += 0.18;
  }
  if (leak.missesThinValue && strength >= 58 && strength <= 74) {
    factor -= 0.14;
  }

  const heuristicAmount = Math.max(minAmount, Math.round(hand.pot * clamp(factor, 0.28, 1.2)));
  let target = heuristicAmount;

  if (solverRaiseAmount && solverRaiseAmount >= minAmount) {
    const solverTrust = clamp01((skill - 0.45) / 0.5);
    target = Math.round(heuristicAmount * (1 - solverTrust) + solverRaiseAmount * solverTrust);
  }

  const sizingNoise = (1 - skill) * 0.32;
  target = Math.round(target * (1 + (Math.random() * 2 - 1) * sizingNoise));
  return clamp(target, minAmount, player.stack);
}

function chooseAiAction(hand: HandState, player: TablePlayer): { action: ActionType; raiseAmount?: number } {
  const board = getRevealedBoard(hand);
  const toCall = Math.max(0, hand.currentBet - player.committedStreet);
  const strength = evaluateHandStrength(player.cards, board);
  const ai = player.ai ?? hand.currentAi;
  const aggression = clamp01((ai?.aggression ?? 45) / 100);
  const skill = clamp01((ai?.skill ?? 50) / 100);
  const bluffRate = clamp01((ai?.bluffRate ?? 20) / 100);
  const leak = ai?.leakProfile ?? defaultLeakProfile;
  const canRaiseVsBet = player.stack > toCall + hand.minRaise;
  const canLead = player.stack >= hand.minRaise;
  const weights = emptyWeights();

  if (toCall > 0) {
    const potOdds = toCall / Math.max(1, hand.pot + toCall);
    const positionPenalty = player.position === 'SB' || player.position === 'BB' ? 4 : 0;
    const defendThreshold =
      potOdds * 100
      + 11
      + positionPenalty
      + (0.52 - skill) * 6
      + (leak.overFoldToRaise ? 8 : 0)
      + (leak.callsTooWide ? -7 : 0);
    const valueRaiseThreshold = 67 - skill * 9 - aggression * 7;
    const riverBluffBoost = hand.street === 'river' && leak.overBluffsRiver ? 0.24 : 0;

    weights.fold = clamp01((defendThreshold - strength) / 18 + 0.14 + (leak.overFoldToRaise ? 0.22 : 0));
    weights.call = clamp01(
      1 - Math.abs(strength - defendThreshold) / 28 + 0.26 + (leak.callsTooWide ? 0.22 : 0) - (leak.overFoldToRaise ? 0.12 : 0),
    );

    if (canRaiseVsBet) {
      const valueEdge = clamp01((strength - valueRaiseThreshold) / 21);
      const bluffWindow = clamp01((56 - strength) / 26);
      weights.raise = clamp01(
        valueEdge * (0.48 + aggression * 0.62)
        + bluffWindow * (0.18 + bluffRate * 0.58 + riverBluffBoost)
        + (leak.cBetsTooMuch && hand.street === 'flop' ? 0.04 : 0),
      );
    }
  } else {
    const streetAggressionBonus = (hand.street === 'flop' || hand.street === 'turn') && leak.cBetsTooMuch ? 0.2 : 0;
    const thinValuePenalty = leak.missesThinValue && strength >= 58 && strength <= 74 ? 0.18 : 0;
    const valueLead = clamp01((strength - (52 - skill * 8)) / 24);
    const bluffLead = clamp01((50 - strength) / 28) * (0.12 + bluffRate * 0.5);

    weights.raise = canLead
      ? clamp01(valueLead * (0.4 + aggression * 0.75) + bluffLead + streetAggressionBonus - thinValuePenalty)
      : 0;
    weights.check = clamp01(0.42 + (1 - weights.raise) + (leak.missesThinValue ? 0.14 : 0) + (strength < 42 ? 0.18 : 0));
  }

  const solver = aiSolverGuidance(hand, player, strength, toCall);
  const solverTrust = clamp01((skill - 0.45) / 0.5) * (0.55 + solver.confidence * 0.45);
  if (solverTrust > 0.01) {
    blendActionWeights(weights, solver.weights, solverTrust, toCall);
  }

  const action = pickActionByWeight(weights, toCall > 0 ? ['fold', 'call', 'raise'] : ['check', 'raise'], skill);
  if (action !== 'raise') {
    return { action };
  }

  if ((toCall > 0 && !canRaiseVsBet) || (toCall === 0 && !canLead)) {
    return { action: toCall > 0 ? 'call' : 'check' };
  }

  const raiseAmount = pickAiRaiseAmount({
    hand,
    player,
    toCall,
    strength,
    skill,
    aggression,
    leak,
    solverRaiseAmount: solver.recommendedRaiseAmount,
  });

  return { action: 'raise', raiseAmount };
}

function settleSingleWinner(hand: HandState, winner: TablePlayer, politeMode: boolean): HandState {
  winner.stack += hand.pot;
  hand.winner = winner.role === 'hero' ? 'hero' : 'villain';
  hand.resultText = `${winner.name} 拿下底池 ${hand.pot}`;
  hand.isOver = true;
  hand.street = 'showdown';
  hand.revealedBoardCount = 5;
  hand.pendingActors = [];
  hand.actingPlayerId = null;
  hand.trashTalk = winner.role === 'hero' ? getTrashTalk(hand.currentAi, 'heroWin', politeMode) : getTrashTalk(hand.currentAi, 'aiWin', politeMode);
  const bustedAiNames = finalizeBustedPlayers(hand);
  hand.resultText = appendBustedSummary(hand.resultText, bustedAiNames);
  syncFocusVillain(hand);
  hand.lastAnalysis = analyzeCurrentSpot(hand);
  return hand;
}

function finalizeBustedPlayers(hand: HandState): string[] {
  const bustedAiNames: string[] = [];
  hand.players.forEach((player) => {
    if (player.stack > 0) {
      return;
    }
    player.stack = 0;
    player.inHand = false;
    player.folded = true;
    player.allIn = true;
    if (player.role === 'ai') {
      bustedAiNames.push(player.name);
    }
  });
  return bustedAiNames;
}

function appendBustedSummary(resultText: string, bustedAiNames: string[]): string {
  if (bustedAiNames.length === 0) {
    return resultText;
  }
  const summary = `出局：${bustedAiNames.join(' / ')}`;
  if (!resultText) {
    return summary;
  }
  return `${resultText}。${summary}`;
}

interface SidePot {
  label: string;
  amount: number;
  eligibleIds: string[];
}

function payoutOrderFromButton(buttonPosition: TablePosition): TablePosition[] {
  const idx = TABLE_ORDER.indexOf(buttonPosition);
  if (idx === -1) {
    return [...TABLE_ORDER];
  }
  const order: TablePosition[] = [];
  for (let i = 1; i <= TABLE_ORDER.length; i += 1) {
    order.push(TABLE_ORDER[(idx + i) % TABLE_ORDER.length]);
  }
  return order;
}

function buildSidePots(players: TablePlayer[]): SidePot[] {
  const contributions = players
    .map((player) => player.totalCommitted)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);

  if (contributions.length === 0) {
    return [];
  }

  const levels = Array.from(new Set(contributions));
  const pots: SidePot[] = [];
  let previous = 0;
  let sideIndex = 1;

  levels.forEach((level) => {
    const contenders = players.filter((player) => player.totalCommitted >= level);
    const band = level - previous;
    const amount = band * contenders.length;
    previous = level;
    if (amount <= 0) {
      return;
    }

    const eligibleIds = contenders
      .filter((player) => player.inHand && !player.folded)
      .map((player) => player.id);

    pots.push({
      label: pots.length === 0 ? '主池' : `邊池${sideIndex++}`,
      amount,
      eligibleIds,
    });
  });

  return pots;
}

function settleShowdown(hand: HandState, politeMode: boolean): HandState {
  hand.street = 'showdown';
  hand.revealedBoardCount = 5;

  const alive = hand.players.filter((p) => p.inHand && !p.folded);
  if (alive.length === 0) {
    hand.isOver = true;
    hand.winner = 'tie';
    hand.resultText = '所有玩家棄牌，無效手牌';
    hand.pendingActors = [];
    hand.actingPlayerId = null;
    const bustedAiNames = finalizeBustedPlayers(hand);
    hand.resultText = appendBustedSummary(hand.resultText, bustedAiNames);
    hand.lastAnalysis = analyzeCurrentSpot(hand);
    return hand;
  }

  const showdownById = new Map<string, ReturnType<typeof evaluateBestShowdownHand>>();
  alive.forEach((player) => {
    showdownById.set(player.id, evaluateBestShowdownHand(player.cards, hand.board));
  });

  const order = payoutOrderFromButton(hand.buttonPosition);
  const orderIndex = new Map<TablePosition, number>();
  order.forEach((position, idx) => {
    orderIndex.set(position, idx);
  });

  const sidePots = buildSidePots(hand.players);
  const payoutById = new Map<string, number>();
  const potSummary: string[] = [];

  sidePots.forEach((pot) => {
    const eligiblePlayers = hand.players.filter((player) => pot.eligibleIds.includes(player.id));
    if (eligiblePlayers.length === 0) {
      return;
    }

    const firstShowdown = showdownById.get(eligiblePlayers[0].id);
    if (!firstShowdown) {
      return;
    }

    let bestShowdown = firstShowdown;
    eligiblePlayers.forEach((player) => {
      const current = showdownById.get(player.id);
      if (current && compareShowdownHands(current, bestShowdown) > 0) {
        bestShowdown = current;
      }
    });

    const winners = eligiblePlayers.filter((player) => {
      const current = showdownById.get(player.id);
      return current ? compareShowdownHands(current, bestShowdown) === 0 : false;
    });
    if (winners.length === 0) {
      return;
    }

    const sortedWinners = [...winners].sort(
      (a, b) => (orderIndex.get(a.position) ?? 99) - (orderIndex.get(b.position) ?? 99),
    );

    const base = Math.floor(pot.amount / sortedWinners.length);
    let remainder = pot.amount % sortedWinners.length;
    sortedWinners.forEach((winner) => {
      const bonus = remainder > 0 ? 1 : 0;
      remainder = Math.max(0, remainder - 1);
      const gain = base + bonus;
      winner.stack += gain;
      payoutById.set(winner.id, (payoutById.get(winner.id) ?? 0) + gain);
    });

    potSummary.push(`${pot.label} ${pot.amount} -> ${sortedWinners.map((player) => player.name).join(' / ')}`);
  });

  const heroPayout = payoutById.get(hand.heroPlayerId) ?? 0;
  const maxPayout = Math.max(...Array.from(payoutById.values()), 0);
  const topReceivers = Array.from(payoutById.entries()).filter(([, amount]) => amount === maxPayout).map(([id]) => id);
  const heroTop = topReceivers.includes(hand.heroPlayerId);
  hand.winner = heroTop ? (topReceivers.length > 1 ? 'tie' : 'hero') : 'villain';

  let biggestHandText = '';
  const firstAliveShowdown = showdownById.get(alive[0].id);
  if (firstAliveShowdown) {
    let bestOverall = firstAliveShowdown;
    alive.forEach((player) => {
      const current = showdownById.get(player.id);
      if (current && compareShowdownHands(current, bestOverall) > 0) {
        bestOverall = current;
      }
    });
    const topPlayers = alive.filter((player) => {
      const current = showdownById.get(player.id);
      return current ? compareShowdownHands(current, bestOverall) === 0 : false;
    });
    const winnerNames = topPlayers.map((player) => player.name).join(' / ');
    const outcomeText = topPlayers.length > 1 ? '平分最大牌' : '勝利';
    biggestHandText = `${winnerNames} ${bestOverall.categoryLabel} ${bestOverall.cardsText} ${outcomeText}`.trim();
  }

  if (potSummary.length > 0) {
    hand.resultText = `攤牌結算：${potSummary.join('；')}。${biggestHandText ? `最大牌：${biggestHandText}。` : ''}Hero 回收 ${heroPayout}`;
  } else {
    hand.resultText = `攤牌結算完成。${biggestHandText ? `最大牌：${biggestHandText}。` : ''}Hero 回收 ${heroPayout}`;
  }
  const bustedAiNames = finalizeBustedPlayers(hand);
  hand.resultText = appendBustedSummary(hand.resultText, bustedAiNames);
  hand.isOver = true;
  hand.pendingActors = [];
  hand.actingPlayerId = null;
  hand.trashTalk = heroPayout > 0 ? getTrashTalk(hand.currentAi, 'heroWin', politeMode) : getTrashTalk(hand.currentAi, 'aiWin', politeMode);
  syncFocusVillain(hand);
  hand.lastAnalysis = analyzeCurrentSpot(hand);
  return hand;
}

function beginNextStreet(hand: HandState): void {
  const next = nextStreet(hand.street);
  if (next === 'showdown') {
    hand.street = 'showdown';
    hand.revealedBoardCount = 5;
    hand.pendingActors = [];
    hand.actingPlayerId = null;
    return;
  }

  hand.street = next;
  hand.revealedBoardCount = boardCountForStreet(next);
  hand.players.forEach((p) => {
    p.committedStreet = 0;
  });
  hand.currentBet = 0;
  hand.toCall = 0;
  hand.minRaise = hand.bigBlind;
  hand.streetActionCount = 0;
  hand.pendingActors = buildStreetQueue(hand, next);
  hand.actingPlayerId = hand.pendingActors[0] ?? null;
  hand.history = pushLog(hand.history, {
    actor: 'table',
    action: 'check',
    amount: 0,
    street: next,
    text: `進入 ${next.toUpperCase()}，重新開始下注輪。`,
  });
}

function refreshPendingActors(hand: HandState): void {
  hand.pendingActors = hand.pendingActors.filter((id) => canPlayerAct(findPlayer(hand, id)));
  hand.actingPlayerId = hand.pendingActors[0] ?? null;
}

function finalizeRoundIfNeeded(hand: HandState, politeMode: boolean): void {
  const alive = activePlayers(hand.players);
  if (alive.length <= 1) {
    if (alive.length === 1) {
      settleSingleWinner(hand, alive[0], politeMode);
      return;
    }
    settleShowdown(hand, politeMode);
    return;
  }

  refreshPendingActors(hand);

  if (hand.pendingActors.length > 0) {
    hand.actingPlayerId = hand.pendingActors[0];
    return;
  }

  if (hand.street === 'river') {
    settleShowdown(hand, politeMode);
    return;
  }

  beginNextStreet(hand);
  if (!hand.isOver && hand.pendingActors.length === 0) {
    // Run out board automatically when all remaining players are all-in.
    finalizeRoundIfNeeded(hand, politeMode);
  }
}

function applyPlayerAction(
  hand: HandState,
  playerId: string,
  rawAction: ActionType,
  requestedAmount: number | undefined,
  politeMode: boolean,
): void {
  if (hand.isOver) return;

  // Enforce strict action order: only the current acting player can move.
  if (hand.actingPlayerId && hand.actingPlayerId !== playerId) {
    return;
  }
  if (hand.pendingActors.length > 0 && hand.pendingActors[0] !== playerId) {
    return;
  }

  const player = findPlayer(hand, playerId);
  if (!canPlayerAct(player)) {
    hand.pendingActors = hand.pendingActors.filter((id) => id !== playerId);
    hand.actingPlayerId = hand.pendingActors[0] ?? null;
    finalizeRoundIfNeeded(hand, politeMode);
    return;
  }

  if (hand.pendingActors[0] === playerId) {
    hand.pendingActors.shift();
  } else {
    hand.pendingActors = hand.pendingActors.filter((id) => id !== playerId);
  }

  const previousToCall = Math.max(0, hand.currentBet - player.committedStreet);
  const stackBeforeAction = player.stack;
  let action = normalizeAction(rawAction, previousToCall);
  let spent = 0;

  if (action === 'fold') {
    player.folded = true;
    player.inHand = false;
  } else if (action === 'check') {
    spent = 0;
  } else if (action === 'call') {
    spent = Math.min(previousToCall, player.stack);
  } else {
    const minRaise = previousToCall + hand.minRaise;
    if (player.stack < minRaise) {
      action = previousToCall > 0 ? 'call' : 'check';
      spent = action === 'call' ? Math.min(previousToCall, player.stack) : 0;
    } else {
      const desired = requestedAmount ?? minRaise;
      spent = clamp(Math.round(desired), minRaise, player.stack);

      if (spent <= previousToCall) {
        action = 'call';
        spent = Math.min(previousToCall, player.stack);
      }
    }
  }

  spent = clamp(spent, 0, player.stack);
  player.stack -= spent;
  player.totalCommitted += spent;
  player.committedStreet += spent;
  hand.pot += spent;
  if (player.stack <= 0) {
    player.allIn = true;
  }
  const isAllInAction = action !== 'fold' && spent > 0 && spent >= stackBeforeAction;

  if (action === 'raise') {
    const newBet = player.committedStreet;
    const raiseDelta = Math.max(0, newBet - hand.currentBet);
    hand.currentBet = newBet;
    hand.minRaise = Math.max(hand.bigBlind, raiseDelta || hand.minRaise);
    hand.pendingActors = buildReopenQueue(hand, playerId);
    hand.streetActionCount += 1;
  }

  const labelAction = action === 'raise'
    ? (isAllInAction ? `全下 All-in ${spent}` : `加注 ${spent}`)
    : action === 'call'
      ? (isAllInAction ? `跟注 All-in ${spent}` : `跟注 ${spent}`)
      : action === 'check'
        ? '過牌'
        : '棄牌';
  hand.history = pushLog(hand.history, {
    actor: player.role === 'hero' ? 'hero' : 'villain',
    actorId: player.id,
    actorName: player.name,
    action,
    amount: spent,
    allIn: isAllInAction,
    street: hand.street,
    text: `${player.name} ${labelAction}`,
  });

  appendPreflopCode(hand, playerId, action, spent, previousToCall);

  if (action === 'fold' && player.id === hand.focusVillainId) {
    hand.trashTalk = getTrashTalk(hand.currentAi, 'aiFold', politeMode);
  } else if (action === 'raise' && player.role !== 'hero') {
    hand.trashTalk = getTrashTalk(hand.currentAi, 'heroPunished', politeMode);
  } else if (action === 'call' && player.role !== 'hero') {
    hand.trashTalk = getTrashTalk(hand.currentAi, 'heroCall', politeMode);
  }

  syncFocusVillain(hand);
  finalizeRoundIfNeeded(hand, politeMode);
}

function runAiLoop(hand: HandState, politeMode: boolean): void {
  while (!hand.isOver) {
    const actorId = hand.actingPlayerId;
    if (!actorId) {
      finalizeRoundIfNeeded(hand, politeMode);
      if (hand.isOver) {
        break;
      }
      continue;
    }

    const actor = findPlayer(hand, actorId);
    if (!actor) {
      hand.pendingActors = hand.pendingActors.filter((id) => id !== actorId);
      hand.actingPlayerId = hand.pendingActors[0] ?? null;
      continue;
    }

    if (!canPlayerAct(actor)) {
      hand.pendingActors = hand.pendingActors.filter((id) => id !== actorId);
      hand.actingPlayerId = hand.pendingActors[0] ?? null;
      continue;
    }

    if (actor.role === 'hero') {
      break;
    }

    const aiDecision = chooseAiAction(hand, actor);
    applyPlayerAction(hand, actor.id, aiDecision.action, aiDecision.raiseAmount, politeMode);
  }

  syncFocusVillain(hand);
  hand.lastAnalysis = analyzeCurrentSpot(hand);
}

function defaultHeadsUpPlayers(heroPosition: TablePosition, villainPosition: TablePosition, ai: AiProfile) {
  return [
    { id: 'hero', position: heroPosition, role: 'hero' as const, name: 'Hero' },
    { id: 'villain', position: villainPosition, role: 'ai' as const, ai, name: ai.name },
  ];
}

function rotateIfNeeded(position: TablePosition, players: TablePlayer[]): TablePosition {
  const exists = players.some((player) => player.position === position && player.inHand && !player.folded);
  if (exists) {
    return position;
  }
  return players.find((player) => player.role === 'hero')?.position ?? players[0].position;
}

export function createNewHand(zone: TrainingZone, forcedAi?: AiProfile, options?: HandSetupOptions): HandState {
  const ai = forcedAi ?? chooseAi(zone);
  const heroPosition = options?.heroPosition ?? 'BTN';
  const villainPosition = options?.villainPosition ?? 'UTG';
  const basePlayersInput = options?.tablePlayers && options.tablePlayers.length > 0
    ? options.tablePlayers
    : defaultHeadsUpPlayers(heroPosition, villainPosition, ai);

  const normalizedInput = basePlayersInput.map((item) => ({
    ...item,
    name: item.name ?? (item.role === 'hero' ? 'Hero' : item.ai?.name ?? 'AI'),
  }));

  const deck = createShuffledDeck();
  const defaultStack = Math.max(1, Math.round(options?.startingStack ?? STARTING_STACK));
  const players: TablePlayer[] = normalizedInput.map((item) => {
    const requested = options?.stackByPlayerId?.[item.id];
    const stack = requested == null ? defaultStack : Math.max(0, Math.round(requested));
    const canPlay = stack > 0;
    return {
      id: item.id,
      name: item.name,
      position: item.position,
      role: item.role,
      ai: item.ai,
      cards: drawCards(deck, 2),
      startingStack: stack,
      stack,
      committedStreet: 0,
      totalCommitted: 0,
      inHand: canPlay,
      folded: !canPlay,
      allIn: !canPlay,
    };
  });

  const hero = players.find((player) => player.role === 'hero') ?? players[0];
  let focus = options?.focusVillainId ? players.find((p) => p.id === options.focusVillainId) : undefined;
  if (!focus || focus.role !== 'ai') {
    focus = players.find((player) => player.role === 'ai') ?? hero;
  }

  const buttonPosition = rotateIfNeeded(options?.buttonPosition ?? hero.position, players);
  const activeAtStart = activePlayers(players);
  const headsUpAtStart = activeAtStart.length === 2;
  const sbPos = headsUpAtStart ? buttonPosition : nextPosition(buttonPosition, players);
  const bbPos = headsUpAtStart ? nextPosition(buttonPosition, players) : nextPosition(sbPos, players);

  const hand: HandState = {
    heroCards: [...hero.cards],
    villainCards: [...focus.cards],
    board: drawCards(deck, 5),
    revealedBoardCount: 0,
    street: 'preflop',
    pot: 0,
    toCall: 0,
    minRaise: BIG_BLIND,
    heroStack: hero.stack,
    villainStack: focus.stack,
    history: [],
    isOver: false,
    winner: null,
    resultText: '',
    streetActionCount: 0,
    currentAi: focus.ai ?? ai,
    players,
    heroPlayerId: hero.id,
    focusVillainId: focus.id,
    actingPlayerId: null,
    pendingActors: [],
    currentBet: 0,
    buttonPosition,
    smallBlindPosition: sbPos,
    bigBlindPosition: bbPos,
    smallBlind: SMALL_BLIND,
    bigBlind: BIG_BLIND,
    position: positionContextForHand(hero, focus, buttonPosition),
    trashTalk: getTrashTalk(focus.ai ?? ai, 'heroRaise', true),
    lastAnalysis: null,
    decisionRecords: [],
    preflopActionCodes: [],
    preflopSolverEligible: headsUpAtStart,
  };

  const sbPlayer = findByPosition(hand.players, sbPos);
  const bbPlayer = findByPosition(hand.players, bbPos);

  if (sbPlayer) {
    const posted = Math.min(SMALL_BLIND, sbPlayer.stack);
    sbPlayer.stack -= posted;
    sbPlayer.committedStreet += posted;
    sbPlayer.totalCommitted += posted;
    if (sbPlayer.stack <= 0) {
      sbPlayer.allIn = true;
    }
    hand.pot += posted;
    hand.history = pushLog(hand.history, {
      actor: sbPlayer.role === 'hero' ? 'hero' : 'villain',
      actorId: sbPlayer.id,
      actorName: sbPlayer.name,
      action: 'raise',
      amount: posted,
      forcedBlind: 'sb',
      street: 'preflop',
      text: `${sbPlayer.name} 下小盲 ${posted}`,
    });
  }

  if (bbPlayer) {
    const posted = Math.min(BIG_BLIND, bbPlayer.stack);
    bbPlayer.stack -= posted;
    bbPlayer.committedStreet += posted;
    bbPlayer.totalCommitted += posted;
    if (bbPlayer.stack <= 0) {
      bbPlayer.allIn = true;
    }
    hand.pot += posted;
    hand.currentBet = posted;
    hand.minRaise = BIG_BLIND;
    hand.history = pushLog(hand.history, {
      actor: bbPlayer.role === 'hero' ? 'hero' : 'villain',
      actorId: bbPlayer.id,
      actorName: bbPlayer.name,
      action: 'raise',
      amount: posted,
      forcedBlind: 'bb',
      street: 'preflop',
      text: `${bbPlayer.name} 下大盲 ${posted}`,
    });
  }

  hand.pendingActors = buildStreetQueue(hand, 'preflop');
  hand.actingPlayerId = hand.pendingActors[0] ?? null;
  syncFocusVillain(hand);
  runAiLoop(hand, true);
  syncFocusVillain(hand);
  hand.lastAnalysis = analyzeCurrentSpot(hand);
  return hand;
}

export function applyHeroAction(hand: HandState, input: HeroActionInput, politeMode: boolean): ActionResolution {
  if (hand.isOver) {
    const fallbackAnalysis = hand.lastAnalysis ?? analyzeCurrentSpot(hand);
    return {
      hand,
      analysis: fallbackAnalysis,
      decisionBest: true,
      leakTag: null,
    };
  }

  const next = cloneHand(hand);
  syncFocusVillain(next);

  const hero = findPlayer(next, next.heroPlayerId);
  if (!hero) {
    const fallbackAnalysis = next.lastAnalysis ?? analyzeCurrentSpot(next);
    return {
      hand: next,
      analysis: fallbackAnalysis,
      decisionBest: false,
      leakTag: null,
    };
  }

  if (!hero.inHand || hero.folded || hero.allIn || hero.stack <= 0) {
    next.pendingActors = next.pendingActors.filter((id) => id !== hero.id);
    next.actingPlayerId = next.pendingActors[0] ?? null;
    runAiLoop(next, politeMode);
    const fallbackAnalysis = next.lastAnalysis ?? analyzeCurrentSpot(next);
    return {
      hand: next,
      analysis: fallbackAnalysis,
      decisionBest: true,
      leakTag: null,
    };
  }

  if (next.actingPlayerId !== hero.id) {
    runAiLoop(next, politeMode);
    const fallbackAnalysis = next.lastAnalysis ?? analyzeCurrentSpot(next);
    return {
      hand: next,
      analysis: fallbackAnalysis,
      decisionBest: true,
      leakTag: null,
    };
  }

  const currentAnalysis = next.lastAnalysis ?? analyzeCurrentSpot(next);
  const heroToCall = Math.max(0, next.currentBet - hero.committedStreet);
  const normalized = normalizeAction(input.action, heroToCall);
  const leakTag = inferHeroLeak(normalized, currentAnalysis, heroToCall);
  const decisionBest = normalized === currentAnalysis.best.action;
  const decisionStreet = next.street;

  applyPlayerAction(next, hero.id, normalized, input.raiseAmount, politeMode);
  next.decisionRecords = [
    ...next.decisionRecords,
    {
      street: decisionStreet,
      chosen: normalized,
      best: currentAnalysis.best.action,
      usedMode: currentAnalysis.bestMode,
      isBest: decisionBest,
    },
  ];

  if (!next.isOver) {
    runAiLoop(next, politeMode);
  }

  syncFocusVillain(next);
  next.lastAnalysis = analyzeCurrentSpot(next);

  return {
    hand: next,
    analysis: currentAnalysis,
    decisionBest,
    leakTag,
  };
}
