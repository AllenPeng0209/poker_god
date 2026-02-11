#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
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

function runOrThrow(command, args, options = {}) {
  const pretty = [command, ...args].join(' ');
  console.log(`[bridge] ${pretty}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${pretty}`);
  }
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

function expectedSpotKey({ board, toCall, pot, stack, position, aggressor }) {
  return `river|b${boardKey(board)}|p${pressureBucket(toCall, pot)}|r${sprBucket(stack, pot)}|i${parsePositionBucket(position)}|a${parseAggressorBucket(aggressor)}`;
}

function main() {
  const rawArgs = process.argv.slice(2);
  const parsed = parseArgs(rawArgs);
  const args = parsed.args;
  const positionals = parsed.positionals;

  const root = process.cwd();
  const strategyPath = path.resolve(readArg(args, ['strategy']) ?? 'tools/third_party/bridge/river-strategy.json');
  const configPath = path.resolve(readArg(args, ['config']) ?? positionals[0] ?? 'tools/third_party/bridge/sample-river-subgame.json');
  const outputPath = path.resolve(readArg(args, ['output']) ?? positionals[1] ?? 'src/solver/data/river-subgame-overrides.json');
  const algo = readArg(args, ['algo']) ?? positionals[2] ?? 'cfr+';
  const targetExp = String(readArg(args, ['target-exp', 'target_exp', 'targetExp']) ?? positionals[3] ?? 120);
  const position = readArg(args, ['position']) ?? positionals[4] ?? 'ip';
  const aggressor = readArg(args, ['aggressor']) ?? positionals[5] ?? 'none';
  const toCall = String(readArg(args, ['to-call', 'to_call', 'toCall']) ?? positionals[6] ?? 0);
  const keepStrategy = String(readArg(args, ['keep-strategy', 'keep_strategy', 'keepStrategy']) ?? 'false').toLowerCase() === 'true';
  const append = String(readArg(args, ['append']) ?? 'false').toLowerCase() === 'true';

  const configJson = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const board = Array.isArray(configJson.board) ? configJson.board : [];
  const pot = Number(configJson.pot ?? 1000);
  const stack = Number(configJson.stack ?? 9500);

  const pythonPath = path.resolve('tools/third_party/poker_solver/python/src');
  const mergedPyPath = process.env.PYTHONPATH
    ? `${pythonPath}${path.delimiter}${process.env.PYTHONPATH}`
    : pythonPath;

  runOrThrow(
    'python',
    [
      '-m',
      'cli.run_river_exploitability',
      '--algo',
      algo,
      '--target-exp',
      targetExp,
      '--config',
      configPath,
      '--dump-strategy',
      strategyPath,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        PYTHONPATH: mergedPyPath,
      },
    },
  );

  if (!append && fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
    console.log(`[bridge] reset output: ${outputPath}`);
  }

  for (const player of ['0', '1']) {
    runOrThrow(
      'node',
      [
        'tools/third_party/bridge/convert-river-strategy.mjs',
        '--strategy',
        strategyPath,
        '--config',
        configPath,
        '--player',
        player,
        '--position',
        position,
        '--aggressor',
        aggressor,
        '--to-call',
        toCall,
        '--output',
        outputPath,
        '--algo',
        algo,
      ],
      { cwd: root },
    );
  }

  const outputJson = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  const spots = outputJson?.spots ?? {};
  const expected = expectedSpotKey({
    board,
    toCall: Number(toCall),
    pot,
    stack,
    position,
    aggressor,
  });
  if (!spots[expected]) {
    const keys = Object.keys(spots);
    throw new Error(`Missing expected spot '${expected}'. Existing spots: ${keys.join(', ')}`);
  }
  if (!spots[expected]?.profiles?.p0 || !spots[expected]?.profiles?.p1) {
    throw new Error(`Expected both p0 and p1 profiles under '${expected}'`);
  }

  if (!keepStrategy && fs.existsSync(strategyPath)) {
    fs.unlinkSync(strategyPath);
    console.log(`[bridge] removed temp strategy dump: ${strategyPath}`);
  }

  console.log(`[bridge] completed: ${outputPath}`);
}

main();
