import postflopData from './data/postflop-srp-cfr.json';
import riverOverridesData from './data/river-subgame-overrides.json';
import multiwayOverridesData from './data/multiway-postflop-overrides.json';
import { ActionType, Card, Street, TablePosition } from '@poker-god/contracts';

interface PostflopState {
  mix_bp: number[];
}

interface PostflopDataset {
  meta: {
    name: string;
    version: number;
    model: string;
    iterations: number;
    actions: string[];
    buckets: {
      streets: Street[];
      strength: number;
      pressure: number;
      spr: number;
      wetness: number;
      position?: number;
      aggressor?: number;
    };
    note: string;
  };
  states: Record<string, PostflopState>;
}

interface RiverOverrideProfile {
  root_key?: string;
  root_mix_bp: number[];
  node_mix_bp?: Record<string, number[]>;
  source?: {
    repo?: string;
    strategy_file?: string;
    config_file?: string | null;
    player_index?: number;
    profile_key?: string;
    algo?: string | null;
    to_call?: number;
    pot?: number;
    stack?: number;
  };
}

interface RiverOverrideSpot {
  board: string[];
  pressure_bucket: number;
  spr_bucket: number;
  position_bucket: number;
  aggressor_bucket: number;
  profiles?: Record<string, RiverOverrideProfile>;
  root_key?: string;
  root_mix_bp?: number[];
  node_mix_bp?: Record<string, number[]>;
  source?: RiverOverrideProfile['source'];
}

interface RiverOverrideDataset {
  meta?: {
    name?: string;
    version?: number;
    generated_at?: string;
    converter?: string;
    note?: string;
  };
  spots?: Record<string, RiverOverrideSpot>;
}

interface MultiwayOverrideSpot {
  street: Extract<Street, 'turn' | 'river'>;
  board: string[];
  active_players: number;
  pressure_bucket: number;
  spr_bucket: number;
  position_bucket: number;
  aggressor_bucket: number;
  profiles?: Record<string, RiverOverrideProfile>;
  root_key?: string;
  root_mix_bp?: number[];
  node_mix_bp?: Record<string, number[]>;
  source?: RiverOverrideProfile['source'];
}

interface MultiwayOverrideDataset {
  meta?: {
    name?: string;
    version?: number;
    generated_at?: string;
    converter?: string;
    note?: string;
  };
  spots?: Record<string, MultiwayOverrideSpot>;
}

const dataset = postflopData as unknown as PostflopDataset;
const riverOverrides = riverOverridesData as unknown as RiverOverrideDataset;
const multiwayOverrides = multiwayOverridesData as unknown as MultiwayOverrideDataset;

export interface PostflopSolverResult {
  found: boolean;
  stateKey: string;
  recommendedAction: ActionType;
  recommendedAmount?: number;
  bestProb: number;
  mixText: string;
  actionMix: Array<{ action: ActionType; prob: number }>;
  source: string;
}

export type PostflopAggressorBucket = 'none' | 'self' | 'opponent';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalize(values: number[]): number[] {
  const sum = values.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) {
    return values.map(() => 0);
  }
  return values.map((value) => value / sum);
}

function normalizeProfileKey(value: string | undefined): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function strengthBucket(heroStrength: number): number {
  const thresholds = [20, 32, 44, 56, 68, 80, 90];
  let bucket = 0;
  for (let i = 0; i < thresholds.length; i += 1) {
    if (heroStrength >= thresholds[i]) {
      bucket = i + 1;
    }
  }
  return clamp(bucket, 0, 7);
}

function pressureBucket(toCall: number, pot: number): number {
  if (toCall <= 0) {
    return 0;
  }

  const pressure = toCall / Math.max(1, pot + toCall);
  if (pressure < 0.12) {
    return 1;
  }
  if (pressure < 0.24) {
    return 2;
  }
  if (pressure < 0.42) {
    return 3;
  }
  return 4;
}

function sprBucket(effectiveStack: number, pot: number): number {
  const spr = effectiveStack / Math.max(1, pot);
  if (spr < 1.4) {
    return 0;
  }
  if (spr < 3) {
    return 1;
  }
  if (spr < 6) {
    return 2;
  }
  return 3;
}

function uniqueSortedRanks(cards: Card[]): number[] {
  const rankMap: Record<string, number> = {
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

  return Array.from(new Set(cards.map((card) => rankMap[card.rank]))).sort((a, b) => a - b);
}

function boardWetnessBucket(board: Card[]): number {
  if (board.length < 3) {
    return 1;
  }

  const suitCount = new Map<string, number>();
  board.forEach((card) => {
    suitCount.set(card.suit, (suitCount.get(card.suit) ?? 0) + 1);
  });
  const maxSuit = Math.max(...Array.from(suitCount.values()));

  const ranks = uniqueSortedRanks(board);
  let closeGaps = 0;
  for (let i = 1; i < ranks.length; i += 1) {
    if (Math.abs(ranks[i] - ranks[i - 1]) <= 2) {
      closeGaps += 1;
    }
  }

  const paired = ranks.length < board.length;

  let score = 0;
  if (maxSuit >= 4) {
    score += 2;
  } else if (maxSuit === 3) {
    score += 1;
  }

  if (closeGaps >= 2) {
    score += 1;
  }

  if (paired) {
    score += 1;
  }

  return clamp(score, 0, 3);
}

function streetKey(street: Street): 'flop' | 'turn' | 'river' {
  if (street === 'turn') {
    return 'turn';
  }
  if (street === 'river') {
    return 'river';
  }
  return 'flop';
}

function stateKey(street: Street, strength: number, pressure: number, spr: number, wetness: number): string {
  return `${streetKey(street)}|s${strength}|p${pressure}|r${spr}|w${wetness}`;
}

function stateKeyWithContext(
  street: Street,
  strength: number,
  pressure: number,
  spr: number,
  wetness: number,
  position: number,
  aggressor: number,
): string {
  return `${stateKey(street, strength, pressure, spr, wetness)}|i${position}|a${aggressor}`;
}

function positionBucket(inPosition: boolean): number {
  return inPosition ? 1 : 0;
}

function aggressorBucket(aggressor: PostflopAggressorBucket): number {
  if (aggressor === 'self') {
    return 1;
  }
  if (aggressor === 'opponent') {
    return 2;
  }
  return 0;
}

function cardCode(card: Card): string {
  return card.code?.length === 2 ? card.code : `${card.rank}${card.suit}`;
}

function boardCodeKey(board: Card[]): string {
  return board.map((card) => cardCode(card)).sort().join('-');
}

function riverSpotKey(
  board: Card[],
  pressure: number,
  spr: number,
  position: number,
  aggressor: number,
): string {
  return `river|b${boardCodeKey(board)}|p${pressure}|r${spr}|i${position}|a${aggressor}`;
}

function multiwaySpotKey(
  street: Extract<Street, 'turn' | 'river'>,
  board: Card[],
  activePlayers: number,
  pressure: number,
  spr: number,
  position: number,
  aggressor: number,
): string {
  return `${street}|b${boardCodeKey(board)}|n${activePlayers}|p${pressure}|r${spr}|i${position}|a${aggressor}`;
}

function normalizeBasisPointMix(values: number[]): number[] {
  if (values.length === 0) {
    return [0, 0, 0];
  }
  const normalized = normalize(values.slice(0, 3).map((value) => Math.max(0, value)));
  return [normalized[0] ?? 0, normalized[1] ?? 0, normalized[2] ?? 0];
}

function resolveOverrideProfile(spot: {
  profiles?: Record<string, RiverOverrideProfile>;
  root_key?: string;
  root_mix_bp?: number[];
  node_mix_bp?: Record<string, number[]>;
  source?: RiverOverrideProfile['source'];
}, actorInPosition: boolean, actorProfileKey?: string): {
  profileKey: string;
  profile: RiverOverrideProfile;
  profileFallback: boolean;
} | null {
  const profiles = spot.profiles ?? {};
  const profileEntries = Object.entries(profiles);

  const candidates: string[] = [];
  const explicitProfile = normalizeProfileKey(actorProfileKey);
  if (explicitProfile) {
    candidates.push(explicitProfile);
    candidates.push(explicitProfile.toUpperCase());
    candidates.push(explicitProfile.toLowerCase());
  }
  candidates.push(actorInPosition ? 'p1' : 'p0');

  const uniqueCandidates = Array.from(new Set(candidates));
  for (const candidate of uniqueCandidates) {
    if (!profiles[candidate]) {
      continue;
    }
    return {
      profileKey: candidate,
      profile: profiles[candidate],
      profileFallback: false,
    };
  }

  if (profileEntries.length > 0) {
    const byLower = new Map(profileEntries.map(([key, profile]) => [key.toLowerCase(), { key, profile }]));
    for (const candidate of uniqueCandidates) {
      const matched = byLower.get(candidate.toLowerCase());
      if (!matched) {
        continue;
      }
      return {
        profileKey: matched.key,
        profile: matched.profile,
        profileFallback: matched.key !== candidate,
      };
    }
  }

  if (profileEntries.length > 0) {
    const [profileKey, profile] = profileEntries[0];
    return {
      profileKey,
      profile,
      profileFallback: true,
    };
  }

  // Backward compatibility for legacy single-profile schema.
  if (spot.root_mix_bp) {
    return {
      profileKey: 'legacy',
      profile: {
        root_key: spot.root_key,
        root_mix_bp: spot.root_mix_bp,
        node_mix_bp: spot.node_mix_bp,
        source: spot.source,
      },
      profileFallback: false,
    };
  }

  return null;
}

function resolveRiverOverride(params: {
  street: Street;
  board: Card[];
  pressure: number;
  spr: number;
  position: number;
  aggressor: number;
  actionPath: string[];
  actorInPosition: boolean;
  actorProfileKey?: string;
}): { key: string; mix: number[]; sourceSuffix?: string } | null {
  if (params.street !== 'river') {
    return null;
  }

  const spots = riverOverrides.spots ?? {};

  const fullKey = riverSpotKey(params.board, params.pressure, params.spr, params.position, params.aggressor);
  const fullSpot = spots[fullKey];
  if (fullSpot) {
    const resolvedProfile = resolveOverrideProfile(fullSpot, params.actorInPosition, params.actorProfileKey);
    if (!resolvedProfile) {
      return null;
    }
    const nodeKey = params.actionPath.length > 0 ? params.actionPath.join('/') : (resolvedProfile.profile.root_key ?? 'root');
    const nodeMix = resolvedProfile.profile.node_mix_bp?.[nodeKey];
    const mix = normalizeBasisPointMix(nodeMix ?? resolvedProfile.profile.root_mix_bp);
    const fallbackReason = nodeMix ? '' : ' (node fallback to root)';
    return {
      key: `${fullKey}#${resolvedProfile.profileKey}:${nodeKey}`,
      mix,
      sourceSuffix: ` (third-party river override${resolvedProfile.profileFallback ? ', profile fallback' : ''}${fallbackReason})`,
    };
  }

  const neutralAggressorKey = riverSpotKey(params.board, params.pressure, params.spr, params.position, 0);
  const neutralSpot = spots[neutralAggressorKey];
  if (neutralSpot) {
    const resolvedProfile = resolveOverrideProfile(neutralSpot, params.actorInPosition, params.actorProfileKey);
    if (!resolvedProfile) {
      return null;
    }
    const nodeKey = params.actionPath.length > 0 ? params.actionPath.join('/') : (resolvedProfile.profile.root_key ?? 'root');
    const nodeMix = resolvedProfile.profile.node_mix_bp?.[nodeKey];
    const mix = normalizeBasisPointMix(nodeMix ?? resolvedProfile.profile.root_mix_bp);
    const fallbackReason = nodeMix ? '' : ' (node fallback to root)';
    return {
      key: `${neutralAggressorKey}#${resolvedProfile.profileKey}:${nodeKey}`,
      mix,
      sourceSuffix: ` (third-party river override, aggressor fallback${resolvedProfile.profileFallback ? ', profile fallback' : ''}${fallbackReason})`,
    };
  }

  return null;
}

function resolveMultiwayOverride(params: {
  street: Street;
  board: Card[];
  activePlayers: number;
  pressure: number;
  spr: number;
  position: number;
  aggressor: number;
  actionPath: string[];
  actorInPosition: boolean;
  actorProfileKey?: string;
}): { key: string; mix: number[]; sourceSuffix?: string } | null {
  if (params.street !== 'turn' && params.street !== 'river') {
    return null;
  }

  const spots = multiwayOverrides.spots ?? {};

  const fullKey = multiwaySpotKey(
    params.street,
    params.board,
    params.activePlayers,
    params.pressure,
    params.spr,
    params.position,
    params.aggressor,
  );
  const fullSpot = spots[fullKey];
  if (fullSpot) {
    const resolvedProfile = resolveOverrideProfile(fullSpot, params.actorInPosition, params.actorProfileKey);
    if (!resolvedProfile) {
      return null;
    }
    const nodeKey = params.actionPath.length > 0 ? params.actionPath.join('/') : (resolvedProfile.profile.root_key ?? 'root');
    const nodeMix = resolvedProfile.profile.node_mix_bp?.[nodeKey];
    const mix = normalizeBasisPointMix(nodeMix ?? resolvedProfile.profile.root_mix_bp);
    const fallbackReason = nodeMix ? '' : ' (node fallback to root)';
    return {
      key: `${fullKey}#${resolvedProfile.profileKey}:${nodeKey}`,
      mix,
      sourceSuffix: ` (third-party multiway override${resolvedProfile.profileFallback ? ', profile fallback' : ''}${fallbackReason})`,
    };
  }

  const neutralAggressorKey = multiwaySpotKey(
    params.street,
    params.board,
    params.activePlayers,
    params.pressure,
    params.spr,
    params.position,
    0,
  );
  const neutralSpot = spots[neutralAggressorKey];
  if (neutralSpot) {
    const resolvedProfile = resolveOverrideProfile(neutralSpot, params.actorInPosition, params.actorProfileKey);
    if (!resolvedProfile) {
      return null;
    }
    const nodeKey = params.actionPath.length > 0 ? params.actionPath.join('/') : (resolvedProfile.profile.root_key ?? 'root');
    const nodeMix = resolvedProfile.profile.node_mix_bp?.[nodeKey];
    const mix = normalizeBasisPointMix(nodeMix ?? resolvedProfile.profile.root_mix_bp);
    const fallbackReason = nodeMix ? '' : ' (node fallback to root)';
    return {
      key: `${neutralAggressorKey}#${resolvedProfile.profileKey}:${nodeKey}`,
      mix,
      sourceSuffix: ` (third-party multiway override, aggressor fallback${resolvedProfile.profileFallback ? ', profile fallback' : ''}${fallbackReason})`,
    };
  }

  return null;
}

function resolveState(params: {
  street: Street;
  strength: number;
  pressure: number;
  spr: number;
  wetness: number;
  position: number;
  aggressor: number;
}): { key: string; state: PostflopState; sourceSuffix?: string } | null {
  const { street, strength, pressure, spr, wetness, position, aggressor } = params;
  const fullKey = stateKeyWithContext(street, strength, pressure, spr, wetness, position, aggressor);
  if (dataset.states[fullKey]) {
    return { key: fullKey, state: dataset.states[fullKey] };
  }

  const neutralAggressorKey = stateKeyWithContext(street, strength, pressure, spr, wetness, position, 0);
  if (dataset.states[neutralAggressorKey]) {
    return {
      key: neutralAggressorKey,
      state: dataset.states[neutralAggressorKey],
      sourceSuffix: ' (aggressor fallback)',
    };
  }

  const legacyKey = stateKey(street, strength, pressure, spr, wetness);
  if (dataset.states[legacyKey]) {
    return {
      key: legacyKey,
      state: dataset.states[legacyKey],
      sourceSuffix: ' (legacy state key)',
    };
  }

  return null;
}

function toActionLabel(action: ActionType, toCall: number): string {
  if (action === 'call') {
    return toCall > 0 ? 'Call' : 'Check';
  }
  if (action === 'check') {
    return 'Check';
  }
  if (action === 'raise') {
    return 'Raise';
  }
  return 'Fold';
}

function mapActionByIndex(index: number, toCall: number): ActionType {
  if (index === 0) {
    return toCall > 0 ? 'fold' : 'check';
  }
  if (index === 1) {
    return toCall > 0 ? 'call' : 'check';
  }
  return 'raise';
}

function raiseAmountByStreet(
  street: Street,
  pot: number,
  minRaise: number,
  heroStack: number,
  strength: number,
  inPosition: boolean,
  aggressor: PostflopAggressorBucket,
): number {
  const baseFactor = street === 'flop' ? 0.65 : street === 'turn' ? 0.72 : 0.8;
  const strengthBoost = ((strength / 7) - 0.5) * 0.18;
  const positionBoost = inPosition ? 0.04 : -0.02;
  const aggressorBoost = aggressor === 'self' ? 0.03 : aggressor === 'opponent' ? -0.03 : 0;
  const factor = clamp(baseFactor + strengthBoost + positionBoost + aggressorBoost, 0.48, 1.08);
  const raw = Math.round(pot * factor);
  return clamp(Math.max(minRaise, raw), minRaise, heroStack);
}

function buildAdviceFromMix(
  params: {
    street: Street;
    toCall: number;
    pot: number;
    minRaise: number;
    heroStack: number;
    heroInPositionPostflop?: boolean;
    aggressor?: PostflopAggressorBucket;
  },
  mixInput: number[],
  strength: number,
  stateKey: string,
  source: string,
): PostflopSolverResult {
  let mix = [...mixInput];

  if (params.toCall === 0) {
    mix[0] = 0;
    mix = normalize(mix);
  }

  let bestIndex = 0;
  let bestProb = -1;
  mix.forEach((prob, index) => {
    if (prob > bestProb) {
      bestProb = prob;
      bestIndex = index;
    }
  });

  const recommendedAction = mapActionByIndex(bestIndex, params.toCall);
  const recommendedAmount =
    recommendedAction === 'raise'
      ? raiseAmountByStreet(
        params.street,
        params.pot,
        params.minRaise,
        params.heroStack,
        strength,
        params.heroInPositionPostflop ?? false,
        params.aggressor ?? 'none',
      )
      : undefined;

  const actionMix = mix
    .map((prob, index) => ({
      action: mapActionByIndex(index, params.toCall),
      prob,
    }))
    .filter((item) => item.prob > 0.01)
    .sort((a, b) => b.prob - a.prob);

  const mixText = actionMix
    .map((item) => `${toActionLabel(item.action, params.toCall)} ${Math.round(item.prob * 100)}%`)
    .join(' | ');

  return {
    found: true,
    stateKey,
    recommendedAction,
    recommendedAmount,
    bestProb: clamp(bestProb, 0, 1),
    mixText,
    actionMix,
    source,
  };
}

export function getPostflopSolverAdvice(params: {
  street: Street;
  heroStrength: number;
  toCall: number;
  pot: number;
  minRaise: number;
  heroStack: number;
  villainStack: number;
  board: Card[];
  heroInPositionPostflop?: boolean;
  activePlayerCount?: number;
  actorProfileKey?: TablePosition | string;
  aggressor?: PostflopAggressorBucket;
  riverActionPath?: string[];
  disableMultiwayOverrides?: boolean;
}): PostflopSolverResult {
  if (params.street === 'preflop' || params.street === 'showdown') {
    return {
      found: false,
      stateKey: 'n/a',
      recommendedAction: params.toCall > 0 ? 'call' : 'check',
      bestProb: 0,
      mixText: '',
      actionMix: [],
      source: 'postflop abstraction unavailable',
    };
  }

  const strength = strengthBucket(params.heroStrength);
  const pressure = pressureBucket(params.toCall, params.pot);
  const spr = sprBucket(Math.min(params.heroStack, params.villainStack), params.pot);
  const wetness = boardWetnessBucket(params.board);
  const position = positionBucket(params.heroInPositionPostflop ?? false);
  const aggressor = aggressorBucket(params.aggressor ?? 'none');
  const activePlayerCount = Math.max(2, Math.round(params.activePlayerCount ?? 2));
  const multiway = activePlayerCount > 2;
  const actionPath = params.riverActionPath ?? [];

  if (multiway) {
    if (!params.disableMultiwayOverrides) {
      const multiwayOverride = resolveMultiwayOverride({
        street: params.street,
        board: params.board,
        activePlayers: activePlayerCount,
        pressure,
        spr,
        position,
        aggressor,
        actionPath,
        actorInPosition: params.heroInPositionPostflop ?? false,
        actorProfileKey: params.actorProfileKey,
      });
      if (multiwayOverride) {
        return buildAdviceFromMix(
          params,
          multiwayOverride.mix,
          strength,
          multiwayOverride.key,
          `third-party multiway subgame solver${multiwayOverride.sourceSuffix ?? ''}`,
        );
      }
    }

    if (params.street === 'river') {
      const riverOverride = resolveRiverOverride({
        street: params.street,
        board: params.board,
        pressure,
        spr,
        position,
        aggressor,
        actionPath,
        actorInPosition: params.heroInPositionPostflop ?? false,
        actorProfileKey: params.actorProfileKey,
      });
      if (riverOverride) {
        return buildAdviceFromMix(
          params,
          riverOverride.mix,
          strength,
          riverOverride.key,
          `third-party river subgame solver (legacy multiway fallback)${riverOverride.sourceSuffix ?? ''}`,
        );
      }
    }

    const missKey =
      params.street === 'turn' || params.street === 'river'
        ? multiwaySpotKey(params.street, params.board, activePlayerCount, pressure, spr, position, aggressor)
        : stateKeyWithContext(params.street, strength, pressure, spr, wetness, position, aggressor);
    const missingReason =
      params.street === 'turn' || params.street === 'river'
        ? 'postflop multiway override missing state'
        : 'postflop multiway abstraction disabled (turn/river override only)';
    return {
      found: false,
      stateKey: missKey,
      recommendedAction: params.toCall > 0 ? 'call' : 'check',
      bestProb: 0,
      mixText: '',
      actionMix: [],
      source: missingReason,
    };
  }

  const riverOverride = resolveRiverOverride({
    street: params.street,
    board: params.board,
    pressure,
    spr,
    position,
    aggressor,
    actionPath,
    actorInPosition: params.heroInPositionPostflop ?? false,
    actorProfileKey: params.actorProfileKey,
  });
  if (riverOverride) {
    return buildAdviceFromMix(
      params,
      riverOverride.mix,
      strength,
      riverOverride.key,
      `third-party river subgame solver${riverOverride.sourceSuffix ?? ''}`,
    );
  }

  const resolved = resolveState({
    street: params.street,
    strength,
    pressure,
    spr,
    wetness,
    position,
    aggressor,
  });
  if (!resolved) {
    const missKey = stateKeyWithContext(params.street, strength, pressure, spr, wetness, position, aggressor);
    return {
      found: false,
      stateKey: missKey,
      recommendedAction: params.toCall > 0 ? 'call' : 'check',
      bestProb: 0,
      mixText: '',
      actionMix: [],
      source: 'postflop abstraction missing state',
    };
  }
  const { key, state, sourceSuffix } = resolved;

  return buildAdviceFromMix(
    params,
    state.mix_bp.map((value) => value / 10000),
    strength,
    key,
    `local real-card MCCFR abstraction${sourceSuffix ?? ''}`,
  );
}
