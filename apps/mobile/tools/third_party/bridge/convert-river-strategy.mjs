#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const eqIdx = token.indexOf('=');
    if (eqIdx >= 0) {
      const key = token.slice(2, eqIdx);
      const value = token.slice(eqIdx + 1);
      args[key] = value.length > 0 ? value : 'true';
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return { args, positionals };
}

function readArg(args, names) {
  for (const name of names) {
    if (args[name] != null) {
      return args[name];
    }
  }
  return undefined;
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

function toBasisPoints(values) {
  const normalized = normalize(values);
  const bp = normalized.map((value) => Math.round(clamp(value, 0, 1) * 10000));
  const sum = bp.reduce((acc, value) => acc + value, 0);
  const delta = 10000 - sum;
  if (delta !== 0) {
    let target = 0;
    for (let i = 1; i < bp.length; i += 1) {
      if (bp[i] > bp[target]) {
        target = i;
      }
    }
    bp[target] += delta;
  }
  return bp;
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

function normalizeCardCode(code) {
  const text = String(code || '').trim();
  if (text.length !== 2) {
    return text;
  }
  return `${text[0].toUpperCase()}${text[1].toLowerCase()}`;
}

function boardKey(board) {
  return board.map((card) => normalizeCardCode(card)).sort().join('-');
}

function actionClass(actionToken) {
  const token = String(actionToken || '').toLowerCase();
  if (token === 'f' || token.includes('fold')) {
    return 0;
  }
  if (token === 'c' || token === 'x' || token.includes('check') || token.includes('call')) {
    return 1;
  }
  if (
    token.startsWith('b')
    || token.startsWith('r')
    || token === 'a'
    || token.includes('bet')
    || token.includes('raise')
    || token.includes('all')
  ) {
    return 2;
  }
  return null;
}

function aggregateNodeMix(node, weights) {
  const actions = Array.isArray(node?.actions) ? node.actions : [];
  const strategy = Array.isArray(node?.strategy) ? node.strategy : [];
  if (actions.length === 0 || strategy.length === 0) {
    return null;
  }

  const actionMass = new Array(actions.length).fill(0);
  let totalWeight = 0;

  for (let handIndex = 0; handIndex < strategy.length; handIndex += 1) {
    const row = Array.isArray(strategy[handIndex]) ? strategy[handIndex] : [];
    if (row.length === 0) {
      continue;
    }

    const rowProb = normalize(actions.map((_, idx) => Number(row[idx] ?? 0)));
    const weight = Math.max(0, Number(weights[handIndex] ?? 0));
    if (weight <= 0) {
      continue;
    }

    for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
      actionMass[actionIndex] += rowProb[actionIndex] * weight;
    }
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    return null;
  }

  const foldCallRaise = [0, 0, 0];
  for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
    const cls = actionClass(actions[actionIndex]);
    if (cls == null) {
      continue;
    }
    foldCallRaise[cls] += actionMass[actionIndex] / totalWeight;
  }

  const normalized = normalize(foldCallRaise);
  const bp = toBasisPoints(normalized);
  return { probs: normalized, bp };
}

function parsePositionBucket(text) {
  const value = String(text || '').toLowerCase();
  return value === 'ip' || value === '1' || value === 'in_position' ? 1 : 0;
}

function parseAggressorBucket(text) {
  const value = String(text || '').toLowerCase();
  if (value === 'self' || value === '1') {
    return 1;
  }
  if (value === 'opponent' || value === '2') {
    return 2;
  }
  return 0;
}

function loadJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseBoardArg(text) {
  if (!text) {
    return [];
  }
  return String(text)
    .split(',')
    .map((item) => normalizeCardCode(item))
    .filter((item) => item.length > 0);
}

function pickRootKey(profile) {
  if (profile.root) {
    return 'root';
  }
  if (profile['']) {
    return '';
  }
  const keys = Object.keys(profile);
  if (keys.length === 0) {
    return null;
  }
  return keys.sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
}

function buildSpotKey(board, pressure, spr, position, aggressor) {
  return `river|b${boardKey(board)}|p${pressure}|r${spr}|i${position}|a${aggressor}`;
}

function parseCsv(text) {
  if (text == null) {
    return [];
  }
  return String(text)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parsePlayerIndices(spec, playerCount) {
  const raw = parseCsv(spec);
  if (raw.length === 0) {
    return [0];
  }

  const indices = raw.map((item) => {
    const value = Number(item);
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Invalid player index '${item}'. Use non-negative integers like 0,1,2.`);
    }
    if (value >= playerCount) {
      throw new Error(`Player index ${value} is out of range. Strategy dump has ${playerCount} players.`);
    }
    return value;
  });

  return Array.from(new Set(indices));
}

function profileKeyFromIndex(playerIndex, explicitKey) {
  const text = String(explicitKey ?? '').trim();
  if (text.length > 0) {
    return text;
  }
  return `p${playerIndex}`;
}

function main() {
  const rawArgs = process.argv.slice(2);
  const parsed = parseArgs(rawArgs);
  const args = parsed.args;
  const positionals = parsed.positionals;

  const strategyPath = path.resolve(readArg(args, ['strategy']) ?? positionals[0] ?? 'tools/third_party/bridge/river-strategy.json');
  const configRaw = readArg(args, ['config']) ?? positionals[1];
  const configPath = configRaw ? path.resolve(configRaw) : null;
  const outputPath = path.resolve(readArg(args, ['output']) ?? positionals[2] ?? 'src/solver/data/river-subgame-overrides.json');
  const playerArg = readArg(args, ['players', 'player']) ?? positionals[3] ?? '0';
  const allPlayers = String(readArg(args, ['all-players', 'all_players', 'allPlayers']) ?? 'false').toLowerCase() === 'true';
  const explicitProfileKeys = parseCsv(readArg(args, ['profile-keys', 'profile_keys', 'profileKeys']));
  const explicitSingleProfileKey = readArg(args, ['profile-key', 'profile_key', 'profileKey']) ?? null;
  const explicitRootKey = readArg(args, ['root_key', 'root-key', 'rootKey']);

  if (!fs.existsSync(strategyPath)) {
    throw new Error(`Strategy file not found: ${strategyPath}`);
  }

  const strategyJson = JSON.parse(fs.readFileSync(strategyPath, 'utf8'));
  const players = Array.isArray(strategyJson.players) ? strategyJson.players : [];
  if (players.length === 0) {
    throw new Error('Strategy dump has no players.');
  }

  const playerIndices = allPlayers
    ? players.map((_, index) => index)
    : parsePlayerIndices(playerArg, players.length);

  if (explicitSingleProfileKey && playerIndices.length !== 1) {
    throw new Error('--profile-key can only be used with a single player index. Use --profile-keys for multiple players.');
  }
  if (explicitProfileKeys.length > 0 && explicitProfileKeys.length !== playerIndices.length) {
    throw new Error(`--profile-keys count (${explicitProfileKeys.length}) must match player count (${playerIndices.length}).`);
  }

  const profileKeyByIndex = new Map();
  playerIndices.forEach((playerIndex, idx) => {
    const explicitKey = explicitProfileKeys[idx] ?? (idx === 0 ? explicitSingleProfileKey : null);
    profileKeyByIndex.set(playerIndex, profileKeyFromIndex(playerIndex, explicitKey));
  });

  const configJson = configPath ? loadJsonIfExists(configPath) : null;

  const board = configJson?.board
    ? configJson.board.map((card) => normalizeCardCode(card))
    : parseBoardArg(readArg(args, ['board']) ?? positionals[4]);
  const pot = Number(readArg(args, ['pot']) ?? configJson?.pot ?? positionals[5] ?? 1000);
  const stack = Number(readArg(args, ['stack']) ?? configJson?.stack ?? positionals[6] ?? 9500);
  const toCall = Number(readArg(args, ['to-call', 'to_call', 'toCall']) ?? positionals[7] ?? 0);
  const position = parsePositionBucket(readArg(args, ['position']) ?? positionals[8] ?? 'ip');
  const aggressor = parseAggressorBucket(readArg(args, ['aggressor']) ?? positionals[9] ?? 'none');
  const pressure = pressureBucket(toCall, pot);
  const spr = sprBucket(stack, pot);

  if (board.length !== 5) {
    throw new Error(`Expected 5 board cards for river spot, got ${board.length}. Use --board or --config.`);
  }

  const spotKey = buildSpotKey(board, pressure, spr, position, aggressor);
  const outputJson = loadJsonIfExists(outputPath) ?? {
    meta: {
      name: 'river-subgame-overrides',
      version: 1,
      note: 'Generated from third-party river subgame solvers for training/review only',
    },
    spots: {},
  };

  if (!outputJson.spots || typeof outputJson.spots !== 'object') {
    outputJson.spots = {};
  }

  outputJson.meta = {
    ...(outputJson.meta ?? {}),
    generated_at: new Date().toISOString(),
    converter: 'tools/third_party/bridge/convert-river-strategy.mjs',
    note: 'Training/review data only. Do not use for live play assistance.',
  };

  const existingSpot = outputJson.spots[spotKey] ?? {};
  const existingProfiles = existingSpot.profiles && typeof existingSpot.profiles === 'object'
    ? { ...existingSpot.profiles }
    : {};

  const imported = [];
  for (const playerIndex of playerIndices) {
    const player = players[playerIndex];
    if (!player) {
      throw new Error(`Missing player index ${playerIndex} in strategy dump`);
    }

    const profile = player.profile ?? {};
    const rootKey = explicitRootKey ?? pickRootKey(profile);
    if (rootKey == null || !profile[rootKey]) {
      throw new Error(`Cannot resolve root key for player ${playerIndex}. Resolved key: ${String(rootKey)}`);
    }

    const weights = Array.isArray(player.weights) ? player.weights : [];
    const rootMix = aggregateNodeMix(profile[rootKey], weights);
    if (!rootMix) {
      throw new Error(`Failed to aggregate root strategy for player ${playerIndex}, key '${rootKey}'`);
    }

    const nodeMixBp = {};
    const profileKeys = Object.keys(profile);
    for (const key of profileKeys) {
      const mix = aggregateNodeMix(profile[key], weights);
      if (!mix) {
        continue;
      }
      nodeMixBp[key] = mix.bp;
    }

    const key = profileKeyByIndex.get(playerIndex) ?? profileKeyFromIndex(playerIndex, null);
    existingProfiles[key] = {
      root_key: rootKey,
      root_mix_bp: rootMix.bp,
      node_mix_bp: nodeMixBp,
      source: {
        repo: 'noambrown/poker_solver',
        strategy_file: path.relative(process.cwd(), strategyPath),
        config_file: configPath ? path.relative(process.cwd(), configPath) : null,
        player_index: playerIndex,
        profile_key: key,
        algo: readArg(args, ['algo']) ?? null,
        to_call: toCall,
        pot,
        stack,
      },
    };

    imported.push({ playerIndex, key, rootKey, rootMix: rootMix.bp.join(',') });
  }

  outputJson.spots[spotKey] = {
    board,
    pressure_bucket: pressure,
    spr_bucket: spr,
    position_bucket: position,
    aggressor_bucket: aggressor,
    profiles: existingProfiles,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(outputJson, null, 2));

  for (const item of imported) {
    console.log(`[convert] player ${item.playerIndex} -> profile: ${item.key}`);
    console.log(`[convert] root key: ${item.rootKey}`);
    console.log(`[convert] root mix bp: ${item.rootMix}`);
  }
  console.log(`[convert] spot key: ${spotKey}`);
  console.log(`[convert] output: ${outputPath}`);
}

main();
