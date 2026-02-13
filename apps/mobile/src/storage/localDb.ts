import * as SQLite from 'expo-sqlite';
import type { HeroStatsSnapshot } from '../engine/heroStats';
import type { HandState, ProgressState, Street } from '../types/poker';

const DB_NAME = 'poker-god-local.db';
const DEFAULT_PROFILE_ID = 'local-default-profile';
const DEFAULT_PROFILE_NAME = 'Local Hero';
const STREET_ORDER: Street[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];

type ProfileRow = {
  id: string;
  display_name: string;
  created_at: string;
  last_login_at: string;
};

type SnapshotRow = {
  payload_json: string;
};

type CountRow = {
  count: number;
};

type ZoneHandStatsRow = {
  zone_id: string;
  hands_played: number;
  hands_won: number;
  hands_tied: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export interface LocalProfile {
  id: string;
  displayName: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface StageChipSnapshot {
  contributed: number;
  heroContributed: number;
  focusVillainContributed: number;
  forcedBlindContributed: number;
  byPlayer: Record<string, number>;
  potAfterStreet: number;
}

export type StageChipBreakdown = Record<Street, StageChipSnapshot>;

export interface SaveHandRecordInput {
  profileId: string;
  zoneId: string;
  phase: string;
  hand: HandState;
  bankrollSnapshot: Record<string, number>;
  heroStatsSnapshot: HeroStatsSnapshot;
  progressSnapshot: ProgressState;
}

export interface SaveHandRecordResult {
  id: number;
  stageChips: StageChipBreakdown;
}

export interface ZoneHandStats {
  zoneId: string;
  handsPlayed: number;
  handsWon: number;
  handsTied: number;
}

function toIsoNow(): string {
  return new Date().toISOString();
}

function normalizeAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
}

function profileFromRow(row: ProfileRow): LocalProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function createEmptyStageEntry(): StageChipSnapshot {
  return {
    contributed: 0,
    heroContributed: 0,
    focusVillainContributed: 0,
    forcedBlindContributed: 0,
    byPlayer: {},
    potAfterStreet: 0,
  };
}

function createEmptyStageBreakdown(): StageChipBreakdown {
  return {
    preflop: createEmptyStageEntry(),
    flop: createEmptyStageEntry(),
    turn: createEmptyStageEntry(),
    river: createEmptyStageEntry(),
    showdown: createEmptyStageEntry(),
  };
}

function derivePlayerStacks(hand: HandState, playerId: string, fallback: number): { start: number; end: number } {
  const player = hand.players.find((item) => item.id === playerId);
  if (!player) {
    const safe = normalizeAmount(fallback);
    return { start: safe, end: safe };
  }
  const inferredStart = Number.isFinite(player.startingStack) ? player.startingStack : fallback;
  return {
    start: normalizeAmount(inferredStart),
    end: normalizeAmount(player.stack),
  };
}

export function buildStageChipBreakdown(hand: HandState): StageChipBreakdown {
  const breakdown = createEmptyStageBreakdown();
  let runningPot = 0;

  STREET_ORDER.forEach((street) => {
    const stage = breakdown[street];
    hand.history.forEach((log) => {
      if (log.street !== street) return;
      const amount = normalizeAmount(log.amount);
      if (amount <= 0) return;
      stage.contributed += amount;
      if (log.actorId === hand.heroPlayerId) {
        stage.heroContributed += amount;
      }
      if (log.actorId === hand.focusVillainId) {
        stage.focusVillainContributed += amount;
      }
      if (log.forcedBlind) {
        stage.forcedBlindContributed += amount;
      }
      const actorKey = log.actorId ?? log.actorName ?? log.actor;
      stage.byPlayer[actorKey] = (stage.byPlayer[actorKey] ?? 0) + amount;
    });
    runningPot += stage.contributed;
    stage.potAfterStreet = runningPot;
  });

  return breakdown;
}

export async function initializeLocalDb(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS player_profiles (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      last_login_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_snapshots (
      profile_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(profile_id) REFERENCES player_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS hand_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id TEXT NOT NULL,
      zone_id TEXT NOT NULL,
      phase TEXT NOT NULL,
      winner TEXT,
      result_text TEXT,
      hero_player_id TEXT NOT NULL,
      focus_villain_id TEXT NOT NULL,
      hero_stack_start INTEGER NOT NULL,
      hero_stack_end INTEGER NOT NULL,
      villain_stack_start INTEGER NOT NULL,
      villain_stack_end INTEGER NOT NULL,
      pot_end INTEGER NOT NULL,
      stage_chips_json TEXT NOT NULL,
      action_history_json TEXT NOT NULL,
      decision_records_json TEXT NOT NULL,
      bankroll_snapshot_json TEXT NOT NULL,
      hero_stats_snapshot_json TEXT NOT NULL,
      progress_snapshot_json TEXT NOT NULL,
      hand_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(profile_id) REFERENCES player_profiles(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_hand_records_profile_created_at
      ON hand_records(profile_id, created_at DESC);
  `);
}

export async function ensureDefaultProfile(): Promise<LocalProfile> {
  const db = await getDb();
  const now = toIsoNow();
  await db.runAsync(
    `
      INSERT INTO player_profiles (id, display_name, created_at, last_login_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        last_login_at = excluded.last_login_at
    `,
    DEFAULT_PROFILE_ID,
    DEFAULT_PROFILE_NAME,
    now,
    now,
  );
  const row = await db.getFirstAsync<ProfileRow>(
    `
      SELECT id, display_name, created_at, last_login_at
      FROM player_profiles
      WHERE id = ?
    `,
    DEFAULT_PROFILE_ID,
  );
  if (!row) {
    throw new Error('Failed to create local default profile');
  }
  return profileFromRow(row);
}

export async function saveProfileSnapshot(profileId: string, payload: unknown): Promise<void> {
  const db = await getDb();
  const now = toIsoNow();
  await db.runAsync(
    `
      INSERT INTO app_snapshots (profile_id, payload_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(profile_id) DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `,
    profileId,
    JSON.stringify(payload),
    now,
  );
}

export async function loadProfileSnapshot<T>(profileId: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SnapshotRow>(
    `
      SELECT payload_json
      FROM app_snapshots
      WHERE profile_id = ?
    `,
    profileId,
  );
  if (!row) {
    return null;
  }
  return safeJsonParse<T>(row.payload_json);
}

export async function countRecordedHands(profileId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<CountRow>(
    `
      SELECT COUNT(*) AS count
      FROM hand_records
      WHERE profile_id = ?
    `,
    profileId,
  );
  return Number(row?.count ?? 0);
}

export async function listRecordedZoneHandStats(profileId: string): Promise<ZoneHandStats[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ZoneHandStatsRow>(
    `
      SELECT
        zone_id,
        COUNT(*) AS hands_played,
        SUM(CASE WHEN winner = 'hero' THEN 1 ELSE 0 END) AS hands_won,
        SUM(CASE WHEN winner = 'tie' THEN 1 ELSE 0 END) AS hands_tied
      FROM hand_records
      WHERE profile_id = ?
      GROUP BY zone_id
    `,
    profileId,
  );
  return rows.map((row) => ({
    zoneId: row.zone_id,
    handsPlayed: Number(row.hands_played ?? 0),
    handsWon: Number(row.hands_won ?? 0),
    handsTied: Number(row.hands_tied ?? 0),
  }));
}

export async function saveCompletedHandRecord(input: SaveHandRecordInput): Promise<SaveHandRecordResult> {
  const db = await getDb();
  const stageChips = buildStageChipBreakdown(input.hand);
  const heroStacks = derivePlayerStacks(input.hand, input.hand.heroPlayerId, input.hand.heroStack);
  const villainStacks = derivePlayerStacks(input.hand, input.hand.focusVillainId, input.hand.villainStack);
  const result = await db.runAsync(
    `
      INSERT INTO hand_records (
        profile_id,
        zone_id,
        phase,
        winner,
        result_text,
        hero_player_id,
        focus_villain_id,
        hero_stack_start,
        hero_stack_end,
        villain_stack_start,
        villain_stack_end,
        pot_end,
        stage_chips_json,
        action_history_json,
        decision_records_json,
        bankroll_snapshot_json,
        hero_stats_snapshot_json,
        progress_snapshot_json,
        hand_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    input.profileId,
    input.zoneId,
    input.phase,
    input.hand.winner,
    input.hand.resultText,
    input.hand.heroPlayerId,
    input.hand.focusVillainId,
    heroStacks.start,
    heroStacks.end,
    villainStacks.start,
    villainStacks.end,
    normalizeAmount(input.hand.pot),
    JSON.stringify(stageChips),
    JSON.stringify(input.hand.history),
    JSON.stringify(input.hand.decisionRecords),
    JSON.stringify(input.bankrollSnapshot),
    JSON.stringify(input.heroStatsSnapshot),
    JSON.stringify(input.progressSnapshot),
    JSON.stringify(input.hand),
    toIsoNow(),
  );

  return {
    id: result.lastInsertRowId,
    stageChips,
  };
}
