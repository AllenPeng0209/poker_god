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
      if (args[key] == null) {
        args[key] = value;
      } else if (Array.isArray(args[key])) {
        args[key].push(value);
      } else {
        args[key] = [args[key], value];
      }
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      if (args[key] == null) {
        args[key] = 'true';
      } else if (Array.isArray(args[key])) {
        args[key].push('true');
      } else {
        args[key] = [args[key], 'true'];
      }
      continue;
    }
    if (args[key] == null) {
      args[key] = next;
    } else if (Array.isArray(args[key])) {
      args[key].push(next);
    } else {
      args[key] = [args[key], next];
    }
    i += 1;
  }
  return { args, positionals };
}

function asArray(value) {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function readArg(args, names) {
  for (const name of names) {
    if (args[name] != null) {
      return args[name];
    }
  }
  return undefined;
}

function parseCsv(text) {
  return String(text ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeCardCode(code) {
  const text = String(code ?? '').trim();
  if (!/^[2-9TJQKA][cdhsCDHS]$/.test(text)) {
    return text;
  }
  return `${text[0].toUpperCase()}${text[1].toLowerCase()}`;
}

function boardKey(board) {
  return board.map((card) => normalizeCardCode(card)).sort().join('-');
}

function parseBoardArg(text) {
  return String(text ?? '')
    .split(/[,\s]+/)
    .map((card) => normalizeCardCode(card))
    .filter((card) => card.length > 0);
}

function parsePositionBucket(text) {
  const value = String(text ?? '').toLowerCase();
  return value === 'ip' || value === '1' || value === 'in_position' ? 1 : 0;
}

function parseAggressorBucket(text) {
  const value = String(text ?? '').toLowerCase();
  if (value === 'self' || value === '1') {
    return 1;
  }
  if (value === 'opponent' || value === '2') {
    return 2;
  }
  return 0;
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

function normalize(values) {
  const sum = values.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) {
    return values.map(() => 0);
  }
  return values.map((value) => value / sum);
}

function toBasisPoints(values) {
  const normalized = normalize(values.map((value) => Math.max(0, Number(value) || 0)));
  const bp = normalized.map((value) => Math.round(value * 10000));
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

function actionClassFromLayoutToken(token) {
  const value = String(token ?? '').toLowerCase();
  if (value === 'fold' || value === 'f') {
    return 0;
  }
  if (value === 'call' || value === 'check' || value === 'c' || value === 'x') {
    return 1;
  }
  if (value === 'raise' || value === 'bet' || value === 'allin' || value === 'all-in' || value === 'r' || value === 'b' || value === 'a') {
    return 2;
  }
  throw new Error(`Unknown action layout token '${token}'. Use fold/call/check/raise.`);
}

function parseLayout(text) {
  const parts = parseCsv(text);
  if (parts.length === 0) {
    return null;
  }
  return parts.map((part) => actionClassFromLayoutToken(part));
}

function defaultActionClass(index, toCall) {
  if (toCall > 0) {
    if (index === 0) {
      return 1;
    }
    if (index === 1) {
      return 0;
    }
    return 2;
  }
  if (index === 0) {
    return 1;
  }
  return 2;
}

function lineToSample(line) {
  const text = String(line ?? '').trim();
  if (text.length === 0 || !text.includes(' / ')) {
    return null;
  }

  const splitIdx = text.indexOf(' / ');
  const boardPart = text.slice(0, splitIdx).trim();
  const restPart = text.slice(splitIdx + 3).trim();
  const board = boardPart
    .split(/\s+/)
    .map((token) => normalizeCardCode(token))
    .filter((token) => /^[2-9TJQKA][cdhs]$/.test(token));
  if (board.length === 0) {
    return null;
  }

  const tokens = restPart.split(/\s+/).filter((token) => token.length > 0);
  const holeCards = tokens
    .slice(0, 2)
    .map((token) => normalizeCardCode(token))
    .filter((token) => /^[2-9TJQKA][cdhs]$/.test(token));
  if (holeCards.length !== 2) {
    return null;
  }

  const probs = [];
  for (let i = 2; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.startsWith('(pa') || token.startsWith('(b')) {
      break;
    }
    if (/^-?\d+(\.\d+)?$/.test(token)) {
      probs.push(Number(token));
      const next = tokens[i + 1];
      if (next && /^\([^)]*\)$/.test(next) && !next.startsWith('(pa') && !next.startsWith('(b')) {
        i += 1;
      }
    }
  }
  if (probs.length === 0) {
    return null;
  }

  return {
    board,
    holeCards,
    probs,
  };
}

function canonicalHoleKey(holeCards) {
  const sorted = [...holeCards].sort();
  return sorted.join('');
}

function lookupHandWeight(weightMap, holeCards) {
  if (!weightMap) {
    return 1;
  }
  const direct = `${holeCards[0]}${holeCards[1]}`;
  if (weightMap[direct] != null) {
    return Math.max(0, Number(weightMap[direct]) || 0);
  }
  const reverse = `${holeCards[1]}${holeCards[0]}`;
  if (weightMap[reverse] != null) {
    return Math.max(0, Number(weightMap[reverse]) || 0);
  }
  const canonical = canonicalHoleKey(holeCards);
  if (weightMap[canonical] != null) {
    return Math.max(0, Number(weightMap[canonical]) || 0);
  }
  return 1;
}

function parseProfileSpec(spec) {
  const eq = spec.indexOf('=');
  if (eq <= 0) {
    throw new Error(`Invalid --profile '${spec}'. Expected KEY=FILE or KEY=FILE@PLAYER_INDEX`);
  }
  const key = spec.slice(0, eq).trim();
  const rhs = spec.slice(eq + 1).trim();
  if (!key || !rhs) {
    throw new Error(`Invalid --profile '${spec}'. Expected KEY=FILE or KEY=FILE@PLAYER_INDEX`);
  }

  const at = rhs.lastIndexOf('@');
  if (at > 0 && /^\d+$/.test(rhs.slice(at + 1))) {
    return {
      key,
      file: rhs.slice(0, at),
      playerIndex: Number(rhs.slice(at + 1)),
    };
  }
  return {
    key,
    file: rhs,
    playerIndex: null,
  };
}

function parseWeightsSpec(spec) {
  const eq = spec.indexOf('=');
  if (eq <= 0) {
    throw new Error(`Invalid --weights '${spec}'. Expected KEY=FILE`);
  }
  return {
    key: spec.slice(0, eq).trim(),
    file: spec.slice(eq + 1).trim(),
  };
}

function loadJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveRootNodeMix(params) {
  const {
    profilePath,
    board,
    actionLayout,
    toCall,
    weightMap,
  } = params;
  const raw = fs.readFileSync(profilePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const targetBoardKey = boardKey(board);

  const actionMass = [0, 0, 0];
  let totalWeight = 0;
  let matchedLines = 0;
  let skippedBoard = 0;
  let skippedParse = 0;

  for (const line of lines) {
    const sample = lineToSample(line);
    if (!sample) {
      skippedParse += 1;
      continue;
    }
    if (boardKey(sample.board) !== targetBoardKey) {
      skippedBoard += 1;
      continue;
    }

    const weight = lookupHandWeight(weightMap, sample.holeCards);
    if (weight <= 0) {
      continue;
    }

    const local = [0, 0, 0];
    for (let i = 0; i < sample.probs.length; i += 1) {
      const cls = actionLayout?.[i] ?? defaultActionClass(i, toCall);
      if (cls == null) {
        continue;
      }
      local[cls] += Math.max(0, sample.probs[i] ?? 0);
    }

    const localNorm = normalize(local);
    for (let i = 0; i < 3; i += 1) {
      actionMass[i] += localNorm[i] * weight;
    }
    totalWeight += weight;
    matchedLines += 1;
  }

  if (totalWeight <= 0) {
    throw new Error(`No matching show_probs rows found for board ${targetBoardKey} in ${profilePath}`);
  }

  return {
    mix: normalize(actionMass),
    basisPoints: toBasisPoints(actionMass),
    matchedLines,
    skippedBoard,
    skippedParse,
  };
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const args = parsed.args;
  const positionals = parsed.positionals;

  const streetValue = String(readArg(args, ['street']) ?? positionals[0] ?? '').toLowerCase();
  if (streetValue !== 'turn' && streetValue !== 'river') {
    throw new Error(`--street must be 'turn' or 'river'. Got '${streetValue || '<empty>'}'`);
  }
  const street = streetValue;

  const board = parseBoardArg(readArg(args, ['board']) ?? positionals[1]);
  const expectedBoardLength = street === 'turn' ? 4 : 5;
  if (board.length !== expectedBoardLength) {
    throw new Error(`Expected ${expectedBoardLength} board cards for ${street}, got ${board.length}`);
  }

  const activePlayers = Math.max(3, Number(readArg(args, ['active-players', 'active_players', 'activePlayers']) ?? positionals[2] ?? 3));
  const pot = Number(readArg(args, ['pot']) ?? positionals[3] ?? 1000);
  const stack = Number(readArg(args, ['stack']) ?? positionals[4] ?? 9500);
  const toCall = Number(readArg(args, ['to-call', 'to_call', 'toCall']) ?? positionals[5] ?? 0);
  const position = parsePositionBucket(readArg(args, ['position']) ?? 'ip');
  const aggressor = parseAggressorBucket(readArg(args, ['aggressor']) ?? 'none');
  const nodeKey = String(readArg(args, ['node-key', 'node_key', 'nodeKey']) ?? 'root');
  const algo = String(readArg(args, ['algo']) ?? 'mccfr');
  const append = String(readArg(args, ['append']) ?? 'false').toLowerCase() === 'true';

  const directProfileSpecs = asArray(readArg(args, ['profile', 'profiles']));
  let positionalProfileSpecs = [];
  let positionalOutput = null;
  if (directProfileSpecs.length === 0 && positionals.length >= 7) {
    const tail = positionals.slice(6);
    if (tail.length >= 2) {
      positionalOutput = tail[tail.length - 1];
      positionalProfileSpecs = tail.slice(0, -1);
    } else {
      positionalProfileSpecs = tail;
    }
  }
  const profileSpecs = directProfileSpecs.length > 0 ? directProfileSpecs : positionalProfileSpecs;
  if (profileSpecs.length === 0) {
    throw new Error('At least one --profile KEY=FILE is required.');
  }

  const weightSpecs = asArray(readArg(args, ['weights']));
  const weightMapByKey = new Map();
  for (const spec of weightSpecs) {
    const parsedWeight = parseWeightsSpec(String(spec));
    const filePath = path.resolve(parsedWeight.file);
    const rawWeight = loadJsonIfExists(filePath);
    if (!rawWeight || typeof rawWeight !== 'object') {
      throw new Error(`Weights file '${filePath}' is missing or not a JSON object.`);
    }
    weightMapByKey.set(parsedWeight.key, rawWeight);
  }

  const actionLayout = parseLayout(readArg(args, ['action-layout', 'action_layout', 'actionLayout']));
  if (actionLayout && actionLayout.length > 0) {
    console.log(`[slumbot] custom action layout: ${actionLayout.join(',')}`);
  }

  const outputPath = path.resolve(readArg(args, ['output']) ?? positionalOutput ?? 'src/solver/data/multiway-postflop-overrides.json');
  const pressure = pressureBucket(toCall, pot);
  const spr = sprBucket(stack, pot);
  const spotKey = `${street}|b${boardKey(board)}|n${activePlayers}|p${pressure}|r${spr}|i${position}|a${aggressor}`;

  const outputJson = (!append
    ? null
    : loadJsonIfExists(outputPath)) ?? {
    meta: {
      name: 'multiway-postflop-overrides',
      version: 1,
      note: 'Training/review data only. Do not use for live play assistance.',
    },
    spots: {},
  };

  if (!outputJson.spots || typeof outputJson.spots !== 'object') {
    outputJson.spots = {};
  }

  outputJson.meta = {
    ...(outputJson.meta ?? {}),
    generated_at: new Date().toISOString(),
    converter: 'tools/third_party/bridge/convert-slumbot-multiway.mjs',
    note: 'Training/review data only. Do not use for live play assistance.',
  };

  const existingSpot = outputJson.spots[spotKey] ?? {};
  const existingProfiles = existingSpot.profiles && typeof existingSpot.profiles === 'object'
    ? { ...existingSpot.profiles }
    : {};

  const imported = [];
  for (const spec of profileSpecs) {
    const parsedProfile = parseProfileSpec(String(spec));
    const profilePath = path.resolve(parsedProfile.file);
    if (!fs.existsSync(profilePath)) {
      throw new Error(`Profile file not found: ${profilePath}`);
    }

    const resolved = resolveRootNodeMix({
      profilePath,
      board,
      actionLayout,
      toCall,
      weightMap: weightMapByKey.get(parsedProfile.key),
    });

    existingProfiles[parsedProfile.key] = {
      root_key: nodeKey,
      root_mix_bp: resolved.basisPoints,
      node_mix_bp: {
        [nodeKey]: resolved.basisPoints,
      },
      source: {
        repo: 'ericgjackson/slumbot2019',
        strategy_file: path.relative(process.cwd(), profilePath),
        config_file: null,
        player_index: parsedProfile.playerIndex,
        profile_key: parsedProfile.key,
        algo,
        to_call: toCall,
        pot,
        stack,
      },
    };

    imported.push({
      key: parsedProfile.key,
      playerIndex: parsedProfile.playerIndex,
      basisPoints: resolved.basisPoints.join(','),
      matchedLines: resolved.matchedLines,
      skippedBoard: resolved.skippedBoard,
      skippedParse: resolved.skippedParse,
    });
  }

  outputJson.spots[spotKey] = {
    street,
    board,
    active_players: activePlayers,
    pressure_bucket: pressure,
    spr_bucket: spr,
    position_bucket: position,
    aggressor_bucket: aggressor,
    profiles: existingProfiles,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(outputJson, null, 2));

  console.log(`[slumbot] spot key: ${spotKey}`);
  for (const item of imported) {
    console.log(`[slumbot] profile ${item.key} (player ${item.playerIndex ?? 'n/a'}) -> mix_bp ${item.basisPoints}`);
    console.log(`[slumbot]   matched rows: ${item.matchedLines}, skipped board rows: ${item.skippedBoard}, skipped unparsable rows: ${item.skippedParse}`);
  }
  console.log(`[slumbot] output: ${outputPath}`);
}

main();
