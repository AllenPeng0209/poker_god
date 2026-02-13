#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const STREETS = ['flop', 'turn', 'river'];
const STREET_CARD_COUNT = {
  flop: 3,
  turn: 4,
  river: 5,
};
const STRENGTH_BUCKETS = 8;
const PRESSURE_BUCKETS = 5;
const SPR_BUCKETS = 4;
const WETNESS_BUCKETS = 4;
const POSITION_BUCKETS = 2;
const AGGRESSOR_BUCKETS = 3;
const MAX_WETNESS_BY_STREET = {
  flop: 2,
  turn: 3,
  river: 3,
};

const CANDIDATE_SCENARIOS_PER_TEXTURE = 4000;
const EQUITY_SAMPLES_PER_SCENARIO = 160;
const SCENARIOS_PER_STATE = 120;
const CFR_ITERATIONS = 1500;
const MAX_TEXTURE_ATTEMPTS = CANDIDATE_SCENARIOS_PER_TEXTURE * 80;
const MISSING_BUCKET_TARGET = 50;
const MAX_MISSING_BUCKET_ATTEMPTS = 180000;

const POT_BASE = 100;
const PRESSURE_TO_CALL_RATIO = [0, 0.15, 0.32, 0.58, 0.95];
const PRESSURE_EQUITY_DISCOUNT = [0, 0.07, 0.16, 0.3, 0.45];
const SPR_MULTIPLIERS = [1.4, 2.5, 4.5, 8.0];
const BET_FACTOR_BY_STREET = {
  flop: 0.55,
  turn: 0.68,
  river: 0.82,
};
const RAISE_FACTOR_BY_STREET = {
  flop: 0.82,
  turn: 0.94,
  river: 1.02,
};

const STRENGTH_THRESHOLDS = [0.2, 0.32, 0.44, 0.56, 0.68, 0.8, 0.9];
const FULL_DECK = Array.from({ length: 52 }, (_, index) => index);

function buildFiveCardCombosFromSeven() {
  const combos = [];
  for (let a = 0; a < 7; a += 1) {
    for (let b = a + 1; b < 7; b += 1) {
      for (let c = b + 1; c < 7; c += 1) {
        for (let d = c + 1; d < 7; d += 1) {
          for (let e = d + 1; e < 7; e += 1) {
            combos.push([a, b, c, d, e]);
          }
        }
      }
    }
  }
  return combos;
}

const FIVE_CARD_COMBOS_FROM_SEVEN = buildFiveCardCombosFromSeven();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomInt(maxExclusive) {
  return Math.floor(Math.random() * maxExclusive);
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const tmp = array[i];
    array[i] = array[j];
    array[j] = tmp;
  }
}

function rankOf(card) {
  return Math.floor(card / 4) + 2;
}

function suitOf(card) {
  return card % 4;
}

function straightHighFromRanks(ranksDesc) {
  const uniqueAsc = Array.from(new Set(ranksDesc)).sort((a, b) => a - b);
  if (uniqueAsc.length < 5) {
    return 0;
  }

  if (uniqueAsc.includes(14)) {
    uniqueAsc.unshift(1);
  }

  let bestHigh = 0;
  let run = 1;

  for (let i = 1; i < uniqueAsc.length; i += 1) {
    if (uniqueAsc[i] === uniqueAsc[i - 1] + 1) {
      run += 1;
      if (run >= 5) {
        bestHigh = uniqueAsc[i];
      }
    } else if (uniqueAsc[i] !== uniqueAsc[i - 1]) {
      run = 1;
    }
  }

  return bestHigh;
}

function compareScores(left, right) {
  const limit = Math.max(left.length, right.length);
  for (let i = 0; i < limit; i += 1) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }
  return 0;
}

function evaluateFiveCards(cards) {
  const ranksDesc = cards.map(rankOf).sort((a, b) => b - a);
  const rankCounts = new Map();
  for (const rank of ranksDesc) {
    rankCounts.set(rank, (rankCounts.get(rank) ?? 0) + 1);
  }

  const grouped = Array.from(rankCounts.entries())
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  const isFlush = cards.every((card) => suitOf(card) === suitOf(cards[0]));
  const straightHigh = straightHighFromRanks(ranksDesc);

  if (isFlush && straightHigh > 0) {
    return [8, straightHigh];
  }

  if (grouped[0].count === 4) {
    return [7, grouped[0].rank, grouped[1].rank];
  }

  if (grouped[0].count === 3 && grouped[1]?.count === 2) {
    return [6, grouped[0].rank, grouped[1].rank];
  }

  if (isFlush) {
    return [5, ...ranksDesc];
  }

  if (straightHigh > 0) {
    return [4, straightHigh];
  }

  if (grouped[0].count === 3) {
    const kickers = grouped
      .filter((item) => item.count === 1)
      .map((item) => item.rank)
      .sort((a, b) => b - a);
    return [3, grouped[0].rank, ...kickers];
  }

  if (grouped[0].count === 2 && grouped[1]?.count === 2) {
    const pairRanks = [grouped[0].rank, grouped[1].rank].sort((a, b) => b - a);
    const kicker = grouped.find((item) => item.count === 1)?.rank ?? 0;
    return [2, pairRanks[0], pairRanks[1], kicker];
  }

  if (grouped[0].count === 2) {
    const kickers = grouped
      .filter((item) => item.count === 1)
      .map((item) => item.rank)
      .sort((a, b) => b - a);
    return [1, grouped[0].rank, ...kickers];
  }

  return [0, ...ranksDesc];
}

function bestScoreFromSeven(cards7) {
  let bestScore = null;

  for (const combo of FIVE_CARD_COMBOS_FROM_SEVEN) {
    const score = evaluateFiveCards([
      cards7[combo[0]],
      cards7[combo[1]],
      cards7[combo[2]],
      cards7[combo[3]],
      cards7[combo[4]],
    ]);

    if (!bestScore || compareScores(score, bestScore) > 0) {
      bestScore = score;
    }
  }

  return bestScore;
}

function showdownResult(heroHole, villainHole, board5) {
  const heroScore = bestScoreFromSeven([...heroHole, ...board5]);
  const villainScore = bestScoreFromSeven([...villainHole, ...board5]);
  return compareScores(heroScore, villainScore);
}

function boardWetnessBucket(board) {
  if (board.length < 3) {
    return 1;
  }

  const suitCounts = [0, 0, 0, 0];
  for (const card of board) {
    suitCounts[suitOf(card)] += 1;
  }
  const maxSuit = Math.max(...suitCounts);

  const uniqueRanks = Array.from(new Set(board.map(rankOf))).sort((a, b) => a - b);
  let closeGaps = 0;
  for (let i = 1; i < uniqueRanks.length; i += 1) {
    if (Math.abs(uniqueRanks[i] - uniqueRanks[i - 1]) <= 2) {
      closeGaps += 1;
    }
  }

  const paired = uniqueRanks.length < board.length;

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

function pickDistinctCards(source, count) {
  const deck = source.slice();
  for (let i = 0; i < count; i += 1) {
    const j = i + randomInt(deck.length - i);
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck.slice(0, count);
}

function estimateHandEquity(heroHole, board, samples) {
  const boardNeeded = STREET_CARD_COUNT.river - board.length;
  const excluded = new Set([...heroHole, ...board]);
  const available = FULL_DECK.filter((card) => !excluded.has(card));

  let wins = 0;
  let ties = 0;
  const drawsNeeded = 2 + boardNeeded;

  for (let i = 0; i < samples; i += 1) {
    const draw = pickDistinctCards(available, drawsNeeded);
    const villainHole = [draw[0], draw[1]];
    const boardTail = boardNeeded > 0 ? draw.slice(2, 2 + boardNeeded) : [];
    const fullBoard = boardNeeded > 0 ? [...board, ...boardTail] : board;

    const result = showdownResult(heroHole, villainHole, fullBoard);
    if (result > 0) {
      wins += 1;
    } else if (result === 0) {
      ties += 1;
    }
  }

  return (wins + ties * 0.5) / samples;
}

function strengthBucketFromEquity(equity) {
  let bucket = 0;
  for (let i = 0; i < STRENGTH_THRESHOLDS.length; i += 1) {
    if (equity >= STRENGTH_THRESHOLDS[i]) {
      bucket = i + 1;
    }
  }
  return clamp(bucket, 0, STRENGTH_BUCKETS - 1);
}

function fallbackBucketIndex(bins, target) {
  if (bins[target].length > 0) {
    return target;
  }

  for (let dist = 1; dist < STRENGTH_BUCKETS; dist += 1) {
    const left = target - dist;
    const right = target + dist;
    if (left >= 0 && bins[left].length > 0) {
      return left;
    }
    if (right < STRENGTH_BUCKETS && bins[right].length > 0) {
      return right;
    }
  }

  return -1;
}

function sampleTextureScenario(street, wetness) {
  const boardCount = STREET_CARD_COUNT[street];
  const deck = FULL_DECK.slice();
  shuffleInPlace(deck);

  const board = deck.slice(0, boardCount);
  if (boardWetnessBucket(board) !== wetness) {
    return null;
  }

  const heroHole = [deck[boardCount], deck[boardCount + 1]];
  const equity = estimateHandEquity(heroHole, board, EQUITY_SAMPLES_PER_SCENARIO);
  const strengthBucket = strengthBucketFromEquity(equity);

  return {
    equity,
    strengthBucket,
  };
}

function createTextureBins(street, wetness) {
  const bins = Array.from({ length: STRENGTH_BUCKETS }, () => []);
  const all = [];
  let attempts = 0;

  while (all.length < CANDIDATE_SCENARIOS_PER_TEXTURE && attempts < MAX_TEXTURE_ATTEMPTS) {
    attempts += 1;
    const scenario = sampleTextureScenario(street, wetness);
    if (!scenario) {
      continue;
    }

    const record = {
      equity: scenario.equity,
    };

    bins[scenario.strengthBucket].push(record);
    all.push(record);
  }

  if (all.length === 0) {
    throw new Error(`No scenarios generated for ${street}/wetness=${wetness}`);
  }

  for (let bucket = 0; bucket < STRENGTH_BUCKETS; bucket += 1) {
    if (bins[bucket].length > 0) {
      continue;
    }

    let topUpAttempts = 0;
    while (bins[bucket].length < MISSING_BUCKET_TARGET && topUpAttempts < MAX_MISSING_BUCKET_ATTEMPTS) {
      topUpAttempts += 1;
      const scenario = sampleTextureScenario(street, wetness);
      if (!scenario) {
        continue;
      }
      if (scenario.strengthBucket !== bucket) {
        continue;
      }

      const record = {
        equity: scenario.equity,
      };
      bins[bucket].push(record);
      all.push(record);
    }
  }

  const sourceByBucket = Array.from({ length: STRENGTH_BUCKETS }, (_, index) => index);

  for (let s = 0; s < STRENGTH_BUCKETS; s += 1) {
    if (bins[s].length > 0) {
      continue;
    }
    const fallback = fallbackBucketIndex(bins, s);
    sourceByBucket[s] = fallback >= 0 ? fallback : s;
    bins[s] = fallback >= 0 ? bins[fallback] : all;
  }

  return {
    bins,
    generated: all.length,
    coverage: Array.from({ length: STRENGTH_BUCKETS }, (_, index) => ({
      target: index,
      source: sourceByBucket[index],
      size: bins[index].length,
    })),
  };
}

function pickScenarios(pool, count) {
  if (pool.length === 0) {
    return [];
  }

  const picked = [];
  for (let i = 0; i < count; i += 1) {
    picked.push(pool[randomInt(pool.length)]);
  }
  return picked;
}

function regretMatching(regrets, enabled) {
  const strategy = regrets.map((value, index) => (enabled[index] ? Math.max(0, value) : 0));
  const sum = strategy.reduce((acc, value) => acc + value, 0);

  if (sum <= 1e-9) {
    const count = enabled.filter(Boolean).length;
    return strategy.map((_, index) => (enabled[index] ? 1 / count : 0));
  }

  return strategy.map((value) => value / sum);
}

function normalizeEnabled(values, enabled) {
  const positive = values.map((value, index) => (enabled[index] ? Math.max(0, value) : 0));
  const sum = positive.reduce((acc, value) => acc + value, 0);
  if (sum <= 1e-9) {
    const count = enabled.filter(Boolean).length;
    return positive.map((_, index) => (enabled[index] ? 1 / count : 0));
  }
  return positive.map((value) => value / sum);
}

function rebalanceBasisPoints(values, enabled) {
  const bp = values.map((value, index) => (enabled[index] ? Math.round(clamp(value, 0, 1) * 10000) : 0));
  const sum = bp.reduce((acc, value) => acc + value, 0);
  const delta = 10000 - sum;

  if (delta === 0) {
    return bp;
  }

  let target = enabled.findIndex(Boolean);
  for (let i = 0; i < bp.length; i += 1) {
    if (enabled[i] && bp[i] > bp[target]) {
      target = i;
    }
  }

  bp[target] += delta;
  return bp;
}

function statePayoffParams(street, pressureBucket, sprBucket, positionBucket, aggressorBucket) {
  const pot = POT_BASE;
  const toCall = pressureBucket === 0 ? 0 : Math.max(1, Math.round(pot * PRESSURE_TO_CALL_RATIO[pressureBucket]));
  const effectiveStack = Math.max(toCall + 2, Math.round(pot * SPR_MULTIPLIERS[sprBucket]));
  const minRaise = Math.max(2, Math.round(Math.max(toCall * 0.5, pot * 0.08)));
  const inPosition = positionBucket === 1;
  const selfAggressor = aggressorBucket === 1;
  const opponentAggressor = aggressorBucket === 2;

  const positionRaiseBias = inPosition ? 0.06 : -0.04;
  const aggressorRaiseBias = selfAggressor ? 0.05 : opponentAggressor ? -0.05 : 0;

  let raiseTo;
  if (toCall === 0) {
    const openFactor = clamp(BET_FACTOR_BY_STREET[street] + positionRaiseBias + aggressorRaiseBias, 0.45, 1.15);
    raiseTo = Math.min(effectiveStack, Math.max(minRaise, Math.round(pot * openFactor)));
  } else {
    const facingFactor = clamp(RAISE_FACTOR_BY_STREET[street] + positionRaiseBias * 0.7 + aggressorRaiseBias, 0.72, 1.28);
    const raw = Math.round((pot + toCall) * facingFactor);
    raiseTo = Math.min(effectiveStack, Math.max(toCall + minRaise, raw));
  }

  const raiseAvailable = raiseTo > toCall;
  const villainCallExtra = Math.max(0, raiseTo - toCall);
  const pressureDiscount = PRESSURE_EQUITY_DISCOUNT[pressureBucket] ?? 0;
  const positionDiscount = inPosition ? -0.02 : 0.03;
  const initiativeDiscount = selfAggressor ? -0.02 : opponentAggressor ? 0.04 : 0;
  const equityDiscount = clamp(pressureDiscount + positionDiscount + initiativeDiscount, 0, 0.75);

  return {
    pot,
    toCall,
    raiseTo,
    raiseAvailable,
    equityDiscount,
    potIfCall: pot + toCall * 2,
    potIfRaiseCall: pot + raiseTo + villainCallExtra,
  };
}

function solveState(scenarios, params) {
  const heroEnabled = [params.toCall > 0, true, params.raiseAvailable];

  const heroRegret = [0, 0, 0];
  const villainRegret = [0, 0];
  const heroStrategySum = [0, 0, 0];

  for (let iter = 0; iter < CFR_ITERATIONS; iter += 1) {
    const scenario = scenarios[iter % scenarios.length];
    const heroStrategy = regretMatching(heroRegret, heroEnabled);
    const villainStrategy = params.raiseAvailable ? regretMatching(villainRegret, [true, true]) : [1, 0];

    heroStrategySum[0] += heroStrategy[0];
    heroStrategySum[1] += heroStrategy[1];
    heroStrategySum[2] += heroStrategy[2];

    const foldUtility = 0;
    const effectiveEquity = clamp(scenario.equity - params.equityDiscount, 0.01, 0.99);
    const callUtility = effectiveEquity * params.potIfCall - params.toCall;
    const raiseFoldUtility = params.pot;
    const raiseCallUtility = effectiveEquity * params.potIfRaiseCall - params.raiseTo;

    const raiseUtility = params.raiseAvailable
      ? villainStrategy[0] * raiseFoldUtility + villainStrategy[1] * raiseCallUtility
      : callUtility;

    const heroActionUtilities = [foldUtility, callUtility, raiseUtility];

    const heroEv = heroStrategy.reduce((acc, prob, action) => acc + prob * heroActionUtilities[action], 0);

    for (let action = 0; action < 3; action += 1) {
      if (!heroEnabled[action]) {
        continue;
      }
      heroRegret[action] += heroActionUtilities[action] - heroEv;
    }

    if (params.raiseAvailable) {
      const villainActionUtilities = [-raiseFoldUtility, -raiseCallUtility];
      const villainEv =
        villainStrategy[0] * villainActionUtilities[0] +
        villainStrategy[1] * villainActionUtilities[1];

      const heroRaiseReach = heroStrategy[2];
      villainRegret[0] += (villainActionUtilities[0] - villainEv) * heroRaiseReach;
      villainRegret[1] += (villainActionUtilities[1] - villainEv) * heroRaiseReach;
    }
  }

  const heroTotal = heroStrategySum.reduce((acc, value) => acc + value, 0);
  const avgHeroStrategy =
    heroTotal <= 1e-9
      ? heroEnabled.map((enabled) => (enabled ? 1 / heroEnabled.filter(Boolean).length : 0))
      : heroStrategySum.map((value) => value / heroTotal);

  const normalized = normalizeEnabled(avgHeroStrategy, heroEnabled);
  return rebalanceBasisPoints(normalized, heroEnabled);
}

function keyOf(street, strength, pressure, spr, wetness, position, aggressor) {
  return `${street}|s${strength}|p${pressure}|r${spr}|w${wetness}|i${position}|a${aggressor}`;
}

function buildDataset() {
  const texturePools = {};
  const textureCoverage = {};

  for (const street of STREETS) {
    const maxWetness = MAX_WETNESS_BY_STREET[street] ?? 3;
    for (let wetness = 0; wetness <= maxWetness; wetness += 1) {
      console.log(`[build] scenarios for ${street}/wetness=${wetness}`);
      const key = `${street}|w${wetness}`;
      const texture = createTextureBins(street, wetness);
      texturePools[key] = texture;
      textureCoverage[key] = {
        generated: texture.generated,
        buckets: texture.coverage,
      };
    }
  }

  const states = {};

  for (const street of STREETS) {
    for (let strength = 0; strength < STRENGTH_BUCKETS; strength += 1) {
      for (let pressure = 0; pressure < PRESSURE_BUCKETS; pressure += 1) {
        for (let spr = 0; spr < SPR_BUCKETS; spr += 1) {
          for (let position = 0; position < POSITION_BUCKETS; position += 1) {
            for (let aggressor = 0; aggressor < AGGRESSOR_BUCKETS; aggressor += 1) {
              for (let wetness = 0; wetness < WETNESS_BUCKETS; wetness += 1) {
                const effectiveWetness = Math.min(wetness, MAX_WETNESS_BY_STREET[street] ?? wetness);
                const bins = texturePools[`${street}|w${effectiveWetness}`].bins;
                const scenarios = pickScenarios(bins[strength], SCENARIOS_PER_STATE);
                const params = statePayoffParams(street, pressure, spr, position, aggressor);
                const mixBp = solveState(scenarios, params);

                states[keyOf(street, strength, pressure, spr, wetness, position, aggressor)] = {
                  mix_bp: mixBp,
                };
              }
            }
          }
        }
      }
    }
  }

  return {
    meta: {
      name: 'postflop-srp-mccfr-real-cards',
      version: 2,
      model: 'monte-carlo CFR over real holdem card rollouts (single-raise abstraction)',
      iterations: CFR_ITERATIONS,
      actions: ['fold', 'call_or_check', 'raise'],
      buckets: {
        streets: STREETS,
        strength: STRENGTH_BUCKETS,
        pressure: PRESSURE_BUCKETS,
        spr: SPR_BUCKETS,
        wetness: WETNESS_BUCKETS,
        position: POSITION_BUCKETS,
        aggressor: AGGRESSOR_BUCKETS,
      },
      sampling: {
        texture_candidates: CANDIDATE_SCENARIOS_PER_TEXTURE,
        equity_samples: EQUITY_SAMPLES_PER_SCENARIO,
        scenarios_per_state: SCENARIOS_PER_STATE,
        missing_bucket_target: MISSING_BUCKET_TARGET,
      },
      texture_coverage: textureCoverage,
      note: 'Payoff values are derived from sampled real card equities and exact 7-card hand ranking, not handcrafted matrices.',
      generated_at: new Date().toISOString(),
    },
    states,
  };
}

const startedAt = Date.now();
const output = buildDataset();
const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

const outputPath = path.resolve(process.cwd(), 'src/solver/data/postflop-srp-cfr.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output));
console.log(`Wrote ${Object.keys(output.states).length} states to ${outputPath} in ${elapsed}s`);
