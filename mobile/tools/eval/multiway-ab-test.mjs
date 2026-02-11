#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const TABLE_ORDER = ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const STREET_BOARD_COUNT = {
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
  showdown: 5,
};

function parseArgs(argv) {
  const args = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    const eq = token.indexOf('=');
    if (eq >= 0) {
      args[token.slice(2, eq)] = token.slice(eq + 1);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return { args, positionals };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(values) {
  const sum = values.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) {
    return values.map(() => 0);
  }
  return values.map((value) => value / sum);
}

function normalizeCardCode(code) {
  const text = String(code ?? '').trim();
  if (!/^[2-9TJQKA][cdhsCDHS]$/.test(text)) {
    return text;
  }
  return `${text[0].toUpperCase()}${text[1].toLowerCase()}`;
}

function cardCode(card) {
  if (card?.code && card.code.length === 2) {
    return normalizeCardCode(card.code);
  }
  return normalizeCardCode(`${card?.rank ?? ''}${card?.suit ?? ''}`);
}

function boardCodeKey(board) {
  return board.map((card) => cardCode(card)).sort().join('-');
}

function pressureBucket(toCall, pot) {
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

function sprBucket(effectiveStack, pot) {
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

function positionBucket(inPosition) {
  return inPosition ? 1 : 0;
}

function aggressorBucket(aggressor) {
  if (aggressor === 'self') {
    return 1;
  }
  if (aggressor === 'opponent') {
    return 2;
  }
  return 0;
}

function normalizeProfileKey(value) {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function resolveOverrideProfile(spot, actorInPosition, actorProfileKey) {
  const profiles = spot?.profiles ?? {};
  const entries = Object.entries(profiles);

  const candidates = [];
  const explicit = normalizeProfileKey(actorProfileKey);
  if (explicit) {
    candidates.push(explicit, explicit.toUpperCase(), explicit.toLowerCase());
  }
  candidates.push(actorInPosition ? 'p1' : 'p0');

  const unique = Array.from(new Set(candidates));
  for (const candidate of unique) {
    if (!profiles[candidate]) {
      continue;
    }
    return { profileKey: candidate, profile: profiles[candidate], profileFallback: false };
  }

  if (entries.length > 0) {
    const byLower = new Map(entries.map(([key, profile]) => [key.toLowerCase(), { key, profile }]));
    for (const candidate of unique) {
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

  if (entries.length > 0) {
    const [profileKey, profile] = entries[0];
    return { profileKey, profile, profileFallback: true };
  }

  if (spot?.root_mix_bp) {
    return {
      profileKey: 'legacy',
      profile: {
        root_key: spot.root_key,
        root_mix_bp: spot.root_mix_bp,
        node_mix_bp: spot.node_mix_bp,
      },
      profileFallback: false,
    };
  }

  return null;
}

function normalizeBasisPointMix(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return [0, 0, 0];
  }
  return normalize(values.slice(0, 3).map((value) => Math.max(0, Number(value) || 0)));
}

function mapActionByIndex(index, toCall) {
  if (index === 0) {
    return toCall > 0 ? 'fold' : 'check';
  }
  if (index === 1) {
    return toCall > 0 ? 'call' : 'check';
  }
  return 'raise';
}

function mixProbForAction(mix, action, toCall) {
  const normalized = action === 'check' && toCall > 0 ? 'call' : action;
  if (toCall > 0) {
    if (normalized === 'fold') return mix[0] ?? 0;
    if (normalized === 'call') return mix[1] ?? 0;
    if (normalized === 'raise') return mix[2] ?? 0;
    return 0;
  }
  if (normalized === 'raise') {
    return mix[2] ?? 0;
  }
  if (normalized === 'check' || normalized === 'call') {
    return (mix[0] ?? 0) + (mix[1] ?? 0);
  }
  return 0;
}

function riverSpotKey(board, pressure, spr, position, aggressor) {
  return `river|b${boardCodeKey(board)}|p${pressure}|r${spr}|i${position}|a${aggressor}`;
}

function multiwaySpotKey(street, board, activePlayers, pressure, spr, position, aggressor) {
  return `${street}|b${boardCodeKey(board)}|n${activePlayers}|p${pressure}|r${spr}|i${position}|a${aggressor}`;
}

function resolveRiverOverride(input, riverOverrides) {
  if (input.street !== 'river') {
    return null;
  }
  const spots = riverOverrides?.spots ?? {};

  const fullKey = riverSpotKey(input.board, input.pressure, input.spr, input.position, input.aggressor);
  const fullSpot = spots[fullKey];
  if (fullSpot) {
    const resolved = resolveOverrideProfile(fullSpot, input.actorInPosition, input.actorProfileKey);
    if (!resolved) {
      return null;
    }
    const nodeKey = input.actionPath.length > 0 ? input.actionPath.join('/') : (resolved.profile.root_key ?? 'root');
    const nodeMix = resolved.profile.node_mix_bp?.[nodeKey];
    return {
      key: `${fullKey}#${resolved.profileKey}:${nodeKey}`,
      mix: normalizeBasisPointMix(nodeMix ?? resolved.profile.root_mix_bp),
      source: 'river',
    };
  }

  const neutralKey = riverSpotKey(input.board, input.pressure, input.spr, input.position, 0);
  const neutralSpot = spots[neutralKey];
  if (!neutralSpot) {
    return null;
  }
  const resolved = resolveOverrideProfile(neutralSpot, input.actorInPosition, input.actorProfileKey);
  if (!resolved) {
    return null;
  }
  const nodeKey = input.actionPath.length > 0 ? input.actionPath.join('/') : (resolved.profile.root_key ?? 'root');
  const nodeMix = resolved.profile.node_mix_bp?.[nodeKey];
  return {
    key: `${neutralKey}#${resolved.profileKey}:${nodeKey}`,
    mix: normalizeBasisPointMix(nodeMix ?? resolved.profile.root_mix_bp),
    source: 'river-neutral',
  };
}

function resolveMultiwayOverride(input, multiwayOverrides) {
  if (input.street !== 'turn' && input.street !== 'river') {
    return null;
  }
  const spots = multiwayOverrides?.spots ?? {};
  const fullKey = multiwaySpotKey(
    input.street,
    input.board,
    input.activePlayers,
    input.pressure,
    input.spr,
    input.position,
    input.aggressor,
  );
  const fullSpot = spots[fullKey];
  if (fullSpot) {
    const resolved = resolveOverrideProfile(fullSpot, input.actorInPosition, input.actorProfileKey);
    if (!resolved) {
      return null;
    }
    const nodeKey = input.actionPath.length > 0 ? input.actionPath.join('/') : (resolved.profile.root_key ?? 'root');
    const nodeMix = resolved.profile.node_mix_bp?.[nodeKey];
    return {
      key: `${fullKey}#${resolved.profileKey}:${nodeKey}`,
      mix: normalizeBasisPointMix(nodeMix ?? resolved.profile.root_mix_bp),
      source: 'multiway',
    };
  }

  const neutralKey = multiwaySpotKey(
    input.street,
    input.board,
    input.activePlayers,
    input.pressure,
    input.spr,
    input.position,
    0,
  );
  const neutralSpot = spots[neutralKey];
  if (!neutralSpot) {
    return null;
  }
  const resolved = resolveOverrideProfile(neutralSpot, input.actorInPosition, input.actorProfileKey);
  if (!resolved) {
    return null;
  }
  const nodeKey = input.actionPath.length > 0 ? input.actionPath.join('/') : (resolved.profile.root_key ?? 'root');
  const nodeMix = resolved.profile.node_mix_bp?.[nodeKey];
  return {
    key: `${neutralKey}#${resolved.profileKey}:${nodeKey}`,
    mix: normalizeBasisPointMix(nodeMix ?? resolved.profile.root_mix_bp),
    source: 'multiway-neutral',
  };
}

function rankValue(rank) {
  const map = {
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
  return map[rank] ?? 0;
}

function buildRankCounts(cards) {
  const map = new Map();
  for (const card of cards) {
    const value = rankValue(card.rank);
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return map;
}

function buildSuitCounts(cards) {
  const map = new Map();
  for (const card of cards) {
    map.set(card.suit, (map.get(card.suit) ?? 0) + 1);
  }
  return map;
}

function straightScore(cards) {
  const unique = Array.from(new Set(cards.map((card) => rankValue(card.rank)))).sort((a, b) => a - b);
  if (unique.includes(14)) {
    unique.unshift(1);
  }

  let run = 1;
  let bestRun = 1;
  for (let i = 1; i < unique.length; i += 1) {
    if (unique[i] === unique[i - 1] + 1) {
      run += 1;
      bestRun = Math.max(bestRun, run);
    } else {
      run = 1;
    }
  }

  if (bestRun >= 5) return 22;
  if (bestRun === 4) return 9;
  if (bestRun === 3) return 4;
  return 0;
}

function evaluateHandStrength(hole, board) {
  const cards = [...hole, ...board];
  const rankCounts = buildRankCounts(cards);
  const suitCounts = buildSuitCounts(cards);
  const frequencies = Array.from(rankCounts.values()).sort((a, b) => b - a);
  const holeValues = hole.map((card) => rankValue(card.rank)).sort((a, b) => b - a);
  const avgHole = (holeValues[0] + holeValues[1]) / 2;

  let score = 15 + avgHole * 2.2;
  if (holeValues[0] === holeValues[1]) {
    score += 18 + holeValues[0] * 0.8;
  } else if (hole[0]?.suit === hole[1]?.suit) {
    score += 4;
  }

  if ((frequencies[0] ?? 0) === 4) score += 45;
  else if ((frequencies[0] ?? 0) === 3 && (frequencies[1] ?? 0) >= 2) score += 35;
  else if ((frequencies[0] ?? 0) === 3) score += 24;
  else if ((frequencies[0] ?? 0) === 2 && (frequencies[1] ?? 0) === 2) score += 18;
  else if ((frequencies[0] ?? 0) === 2) score += 11;

  const highestSuitCount = Math.max(...Array.from(suitCounts.values()), 0);
  if (highestSuitCount >= 5) score += 30;
  else if (highestSuitCount === 4) score += 9;

  score += straightScore(cards);
  if (board.length >= 3) {
    const topBoard = board.map((card) => rankValue(card.rank)).sort((a, b) => b - a)[0] ?? 0;
    if ((holeValues[0] ?? 0) > topBoard) {
      score += 4;
    }
  }

  return clamp(Math.round(score), 5, 99);
}

function nextPosition(position, players) {
  const active = TABLE_ORDER.filter((pos) => {
    const p = players.find((player) => player.position === pos);
    return Boolean(p && p.inHand && !p.folded);
  });
  if (active.length === 0) {
    return position;
  }
  const idx = active.indexOf(position);
  if (idx === -1) {
    return active[0];
  }
  return active[(idx + 1) % active.length];
}

function canPlayerAct(player) {
  return player.inHand && !player.folded && !player.allIn && player.stack > 0;
}

function actionOrderFrom(start, players) {
  const active = TABLE_ORDER.filter((position) => players.find((player) => player.position === position)?.inHand && !players.find((player) => player.position === position)?.folded);
  if (active.length === 0) {
    return [];
  }
  const startIdx = active.indexOf(start);
  const safeStart = startIdx === -1 ? 0 : startIdx;
  const ordered = [];
  for (let i = 0; i < active.length; i += 1) {
    const pos = active[(safeStart + i) % active.length];
    const player = players.find((item) => item.position === pos);
    if (player) {
      ordered.push(player);
    }
  }
  return ordered;
}

function heroInPositionPostflop(hand, playersState) {
  const start = nextPosition(hand.buttonPosition, playersState);
  const order = actionOrderFrom(start, playersState).filter((player) => canPlayerAct(player));
  if (order.length === 0) {
    return Boolean(hand.position?.heroInPositionPostflop);
  }
  return order[order.length - 1]?.id === hand.heroPlayerId;
}

function normalizeChosenAction(action, toCall) {
  if (action === 'check' && toCall > 0) {
    return 'call';
  }
  if (action === 'call' && toCall === 0) {
    return 'check';
  }
  return action;
}

function createArmStats() {
  return {
    decisions: 0,
    found: 0,
    sumRegretProxy: 0,
    sumDeltaAll: 0,
    sumDeltaFound: 0,
    followed: 0,
    sumDeltaFollowed: 0,
    mismatched: 0,
    sumDeltaMismatched: 0,
    byStreet: {
      turn: { decisions: 0, found: 0 },
      river: { decisions: 0, found: 0 },
    },
  };
}

function resolveDecisionAdvice(input, datasets, disableMultiwayOverrides) {
  const common = {
    street: input.street,
    board: input.board,
    pressure: pressureBucket(input.toCall, input.pot),
    spr: sprBucket(Math.min(input.heroStack, input.villainStack), input.pot),
    position: positionBucket(input.heroInPositionPostflop),
    aggressor: aggressorBucket(input.aggressor),
    actionPath: [],
    actorInPosition: input.heroInPositionPostflop,
    actorProfileKey: input.actorProfileKey,
    activePlayers: input.activePlayers,
  };

  if (input.activePlayers > 2) {
    if (!disableMultiwayOverrides) {
      const multiway = resolveMultiwayOverride(common, datasets.multiwayOverrides);
      if (multiway) {
        let bestIdx = 0;
        let bestProb = -1;
        multiway.mix.forEach((prob, idx) => {
          if (prob > bestProb) {
            bestProb = prob;
            bestIdx = idx;
          }
        });
        return {
          found: true,
          source: 'multiway',
          mix: multiway.mix,
          recommendedAction: mapActionByIndex(bestIdx, input.toCall),
          bestProb,
          stateKey: multiway.key,
        };
      }
    }

    if (input.street === 'river') {
      const river = resolveRiverOverride(common, datasets.riverOverrides);
      if (river) {
        let bestIdx = 0;
        let bestProb = -1;
        river.mix.forEach((prob, idx) => {
          if (prob > bestProb) {
            bestProb = prob;
            bestIdx = idx;
          }
        });
        return {
          found: true,
          source: 'river-legacy',
          mix: river.mix,
          recommendedAction: mapActionByIndex(bestIdx, input.toCall),
          bestProb,
          stateKey: river.key,
        };
      }
    }

    return {
      found: false,
      source: 'missing',
      mix: [0, 0, 0],
      recommendedAction: input.toCall > 0 ? 'call' : 'check',
      bestProb: 0,
      stateKey: 'missing',
    };
  }

  return {
    found: false,
    source: 'not-multiway',
    mix: [0, 0, 0],
    recommendedAction: input.toCall > 0 ? 'call' : 'check',
    bestProb: 0,
    stateKey: 'n/a',
  };
}

function extractHandFromItem(item) {
  if (item == null) {
    return null;
  }
  if (typeof item.hand_json === 'string') {
    try {
      return JSON.parse(item.hand_json);
    } catch {
      return null;
    }
  }
  if (item.hand_json && typeof item.hand_json === 'object') {
    return item.hand_json;
  }
  if (item.hand && typeof item.hand === 'object') {
    return item.hand;
  }
  if (item.history && item.players && item.heroCards) {
    return item;
  }
  return null;
}

function loadHands(inputPath) {
  const raw = readJson(inputPath);
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.hands) ? raw.hands : [];
  return rows
    .map((item) => extractHandFromItem(item))
    .filter((item) => item && Array.isArray(item.history));
}

function collectDecisionsFromHand(hand) {
  const playersState = (hand.players ?? []).map((player) => ({
    id: player.id,
    name: player.name,
    position: player.position,
    startingStack: Number(player.startingStack ?? player.stack ?? 0),
    stack: Number(player.startingStack ?? player.stack ?? 0),
    committedStreet: 0,
    totalCommitted: 0,
    inHand: Number(player.startingStack ?? player.stack ?? 0) > 0,
    folded: false,
    allIn: false,
  }));

  const playerById = new Map(playersState.map((player) => [player.id, player]));
  const hero = playerById.get(hand.heroPlayerId);
  if (!hero) {
    return [];
  }

  let street = 'preflop';
  let pot = 0;
  let currentBet = 0;
  let minRaise = Math.max(1, Number(hand.bigBlind ?? 1));
  let lastRaiseActorId = null;
  const decisions = [];

  const history = Array.isArray(hand.history) ? hand.history : [];
  for (const log of history) {
    const logStreet = String(log.street ?? street);
    if (logStreet !== street) {
      street = logStreet;
      for (const player of playersState) {
        player.committedStreet = 0;
      }
      currentBet = 0;
      minRaise = Math.max(1, Number(hand.bigBlind ?? 1));
    }

    if (!log.actorId || !playerById.has(log.actorId)) {
      continue;
    }

    const actor = playerById.get(log.actorId);
    if (!actor || !actor.inHand || actor.folded) {
      continue;
    }

    const toCall = Math.max(0, currentBet - actor.committedStreet);
    const activePlayers = playersState.filter((player) => player.inHand && !player.folded).length;

    if (
      actor.id === hand.heroPlayerId
      && (street === 'turn' || street === 'river')
      && activePlayers > 2
    ) {
      const boardCards = (hand.board ?? []).slice(0, STREET_BOARD_COUNT[street] ?? 0);
      const heroCards = Array.isArray(hand.heroCards) ? hand.heroCards : [];
      if (heroCards.length === 2 && boardCards.length >= 4) {
        const strength = evaluateHandStrength(heroCards, boardCards);
        const opponents = playersState.filter((player) => player.id !== hero.id && player.inHand && !player.folded);
        const villainStack = opponents.length > 0
          ? Math.max(...opponents.map((player) => player.stack + player.committedStreet))
          : actor.stack;
        const aggressor = !lastRaiseActorId
          ? 'none'
          : lastRaiseActorId === actor.id
            ? 'self'
            : 'opponent';

        decisions.push({
          street,
          board: boardCards,
          toCall,
          pot,
          minRaise,
          heroStack: actor.stack,
          villainStack,
          activePlayers,
          heroInPositionPostflop: heroInPositionPostflop(hand, playersState),
          actorProfileKey: hand.position?.hero ?? actor.position,
          aggressor,
          heroStrength: strength,
          chosenAction: normalizeChosenAction(String(log.action ?? ''), toCall),
        });
      }
    }

    const action = String(log.action ?? '');
    const spent = Math.max(0, Number(log.amount ?? 0));
    if (action === 'fold') {
      actor.folded = true;
      actor.inHand = false;
    }
    actor.stack = Math.max(0, actor.stack - spent);
    actor.totalCommitted += spent;
    actor.committedStreet += spent;
    pot += spent;
    if (actor.stack <= 0) {
      actor.allIn = true;
    }

    if (action === 'raise') {
      const newBet = actor.committedStreet;
      const raiseDelta = Math.max(0, newBet - currentBet);
      currentBet = newBet;
      minRaise = Math.max(Math.max(1, Number(hand.bigBlind ?? 1)), raiseDelta || minRaise);
      if (!log.forcedBlind && spent > 0) {
        lastRaiseActorId = actor.id;
      }
    }
  }

  const finalHero = (hand.players ?? []).find((player) => player.id === hand.heroPlayerId);
  const heroStart = Number(finalHero?.startingStack ?? hero.startingStack ?? 0);
  const heroEnd = Number(finalHero?.stack ?? hero.stack ?? 0);
  const delta = heroEnd - heroStart;
  return decisions.map((decision) => ({ ...decision, handDelta: delta }));
}

function updateArmStats(stats, decision, advice) {
  stats.decisions += 1;
  stats.sumDeltaAll += decision.handDelta;
  if (stats.byStreet[decision.street]) {
    stats.byStreet[decision.street].decisions += 1;
  }

  if (!advice.found) {
    stats.sumRegretProxy += 1;
    return;
  }

  stats.found += 1;
  stats.sumDeltaFound += decision.handDelta;
  if (stats.byStreet[decision.street]) {
    stats.byStreet[decision.street].found += 1;
  }

  const chosenProb = clamp(mixProbForAction(advice.mix, decision.chosenAction, decision.toCall), 0, 1);
  stats.sumRegretProxy += 1 - chosenProb;

  if (decision.chosenAction === advice.recommendedAction) {
    stats.followed += 1;
    stats.sumDeltaFollowed += decision.handDelta;
  } else {
    stats.mismatched += 1;
    stats.sumDeltaMismatched += decision.handDelta;
  }
}

function summarizeArm(stats) {
  return {
    decisions: stats.decisions,
    coverage: stats.decisions > 0 ? stats.found / stats.decisions : 0,
    decision_regret_proxy: stats.decisions > 0 ? stats.sumRegretProxy / stats.decisions : 0,
    avg_hand_delta_per_decision: stats.decisions > 0 ? stats.sumDeltaAll / stats.decisions : 0,
    avg_hand_delta_when_found: stats.found > 0 ? stats.sumDeltaFound / stats.found : 0,
    follow_rate_when_found: stats.found > 0 ? stats.followed / stats.found : 0,
    avg_hand_delta_when_followed: stats.followed > 0 ? stats.sumDeltaFollowed / stats.followed : 0,
    avg_hand_delta_when_not_followed: stats.mismatched > 0 ? stats.sumDeltaMismatched / stats.mismatched : 0,
    by_street: {
      turn: {
        decisions: stats.byStreet.turn.decisions,
        coverage: stats.byStreet.turn.decisions > 0 ? stats.byStreet.turn.found / stats.byStreet.turn.decisions : 0,
      },
      river: {
        decisions: stats.byStreet.river.decisions,
        coverage: stats.byStreet.river.decisions > 0 ? stats.byStreet.river.found / stats.byStreet.river.decisions : 0,
      },
    },
  };
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const args = parsed.args;
  const positionals = parsed.positionals;
  const inputPath = args.input ? path.resolve(args.input) : positionals[0] ? path.resolve(positionals[0]) : null;
  if (!inputPath || !fs.existsSync(inputPath)) {
    throw new Error('Provide --input <hands.json>. Supported items: HandState, {hand}, {hand_json}.');
  }

  const riverOverridesPath = path.resolve(args.riverOverrides ?? 'src/solver/data/river-subgame-overrides.json');
  const multiwayOverridesPath = path.resolve(args.multiwayOverrides ?? 'src/solver/data/multiway-postflop-overrides.json');
  const outputPath = args.output ? path.resolve(args.output) : positionals[1] ? path.resolve(positionals[1]) : null;

  const datasets = {
    riverOverrides: readJson(riverOverridesPath),
    multiwayOverrides: readJson(multiwayOverridesPath),
  };

  const hands = loadHands(inputPath);
  const baseline = createArmStats();
  const candidate = createArmStats();

  let multiwayDecisions = 0;
  for (const hand of hands) {
    const decisions = collectDecisionsFromHand(hand);
    for (const decision of decisions) {
      multiwayDecisions += 1;
      const baselineAdvice = resolveDecisionAdvice(decision, datasets, true);
      const candidateAdvice = resolveDecisionAdvice(decision, datasets, false);
      updateArmStats(baseline, decision, baselineAdvice);
      updateArmStats(candidate, decision, candidateAdvice);
    }
  }

  const baselineSummary = summarizeArm(baseline);
  const candidateSummary = summarizeArm(candidate);
  const delta = {
    coverage: candidateSummary.coverage - baselineSummary.coverage,
    decision_regret_proxy: candidateSummary.decision_regret_proxy - baselineSummary.decision_regret_proxy,
    avg_hand_delta_per_decision: candidateSummary.avg_hand_delta_per_decision - baselineSummary.avg_hand_delta_per_decision,
    avg_hand_delta_when_found: candidateSummary.avg_hand_delta_when_found - baselineSummary.avg_hand_delta_when_found,
  };

  const report = {
    meta: {
      generated_at: new Date().toISOString(),
      input: path.relative(process.cwd(), inputPath),
      river_overrides: path.relative(process.cwd(), riverOverridesPath),
      multiway_overrides: path.relative(process.cwd(), multiwayOverridesPath),
      note: 'EV here is realized hand delta proxy, not exact counterfactual EV. Regret is action-probability proxy.',
    },
    totals: {
      hands: hands.length,
      multiway_turn_river_decisions: multiwayDecisions,
    },
    baseline: baselineSummary,
    candidate: candidateSummary,
    delta,
  };

  console.log(`[abtest] hands: ${hands.length}`);
  console.log(`[abtest] multiway turn/river decisions: ${multiwayDecisions}`);
  console.log(`[abtest] baseline coverage: ${(baselineSummary.coverage * 100).toFixed(2)}%`);
  console.log(`[abtest] candidate coverage: ${(candidateSummary.coverage * 100).toFixed(2)}%`);
  console.log(`[abtest] delta coverage: ${(delta.coverage * 100).toFixed(2)}%`);
  console.log(`[abtest] baseline regret proxy: ${baselineSummary.decision_regret_proxy.toFixed(4)}`);
  console.log(`[abtest] candidate regret proxy: ${candidateSummary.decision_regret_proxy.toFixed(4)}`);
  console.log(`[abtest] delta regret proxy: ${delta.decision_regret_proxy.toFixed(4)}`);

  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`[abtest] report written: ${outputPath}`);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}

main();
