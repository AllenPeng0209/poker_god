import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, DimensionValue, Easing, GestureResponderEvent, LayoutChangeEvent, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { leakLabels, trainingZones } from './src/data/zones';
import { cardToDisplay } from './src/engine/cards';
import { analyzeCurrentSpot, applyHeroAction, createNewHand } from './src/engine/game';
import { accumulateHeroStats, createEmptyHeroStats, statRatePercent } from './src/engine/heroStats';
import type { HeroStatsSnapshot, RatioStat } from './src/engine/heroStats';
import { buildSpotInsight } from './src/engine/insights';
import { buildLocalCoachSummary, requestQwenCoachAdvice } from './src/engine/qwenCoach';
import { applyDecisionResult, applyHandResult, getTopLeak, initialProgress, winRate } from './src/engine/progression';
import { countRecordedHands, ensureDefaultProfile, initializeLocalDb, listRecordedZoneHandStats, loadProfileSnapshot, saveCompletedHandRecord, saveProfileSnapshot } from './src/storage/localDb';
import type { LocalProfile } from './src/storage/localDb';
import { ActionAdvice, ActionType, AiProfile, Card, HandState, HeroLeak, ProgressState, Street, TablePosition, TrainingZone } from './src/types/poker';

type Phase = 'lobby' | 'table';
type OppLeakGuess = keyof AiProfile['leakProfile'];
type SeatRole = 'hero' | 'ai' | 'empty';
type TableEventKind = 'deal' | 'blind' | 'action' | 'street' | 'reveal' | 'hint';
type SfxKey = 'deal' | 'blind' | 'check' | 'call' | 'raise' | 'allIn' | 'fold' | 'reveal' | 'ui';
type SfxVariant = { asset: number; volume: number };
type CoachMissionKind = 'steal_preflop' | 'bluff_catch' | 'profit_bb' | 'triple_barrel' | 'win_hands';
type CoachStatKey = 'vpip' | 'pfr' | 'threeBetPreflop' | 'foldToThreeBet' | 'flopCBet' | 'foldVsFlopCBet' | 'postflopReraise';
type CoachBenchmarkRange = { min: number; max: number };
type CoachBenchmarkVerdictTone = 'pending' | 'inRange' | 'high' | 'low';
type TrainingMode = 'career' | 'practice';

type Seat = { id: string; pos: TablePosition; role: SeatRole; ai?: AiProfile };
type SeatVisual = { cardsDealt: number; inHand: boolean; folded: boolean; lastAction: string };
type CoachMission = {
  id: string;
  kind: CoachMissionKind;
  title: string;
  detail: string;
  target: number;
  rewardXp: number;
  progress: number;
  completed: boolean;
  rewarded: boolean;
};
type ZoneTrainingState = {
  bankroll: Record<string, number>;
  heroBaseline: number;
  missions: CoachMission[];
  heroStats: HeroStatsSnapshot;
  handsPlayed: number;
  handsWon: number;
  handsTied: number;
  aidUses: number;
  subsidyClaimDate: string | null;
  loanDebt: number;
};
type HandMissionSignals = {
  heroWon: boolean;
  stealWin: boolean;
  bluffCatchWin: boolean;
  tripleBarrelWin: boolean;
};
type MissionResolution = {
  nextState: ZoneTrainingState;
  rewardXp: number;
  completedMissionTitles: string[];
};
type TableEvent = {
  id: string;
  kind: TableEventKind;
  seatId?: string;
  text: string;
  action?: ActionType;
  amount?: number;
  allIn?: boolean;
};

type SeatAnchor = {
  id: string;
  pos: TablePosition;
  seatLeft: DimensionValue;
  seatTop: DimensionValue;
};

type PersistedSeat = {
  id: string;
  role: SeatRole;
  aiId?: string;
};

type PersistedAppSnapshot = {
  schemaVersion: number;
  savedAt: string;
  zoneIndex: number;
  lobbyZone: number;
  progress: ProgressState;
  zoneTrainingById: Record<string, ZoneTrainingState>;
  seats: PersistedSeat[];
  buttonSeatId: string;
  selectedSeatId: string;
  battleSeatId: string | null;
  politeMode: boolean;
  autoPlayEvents: boolean;
  sfxEnabled: boolean;
  aiVoiceAssistEnabled?: boolean;
  trainingMode?: TrainingMode;
};

const HERO_SEAT = 'btn';
const BIG_BLIND_SIZE = 2;
const STARTING_BB = 100;
const STARTING_STACK = BIG_BLIND_SIZE * STARTING_BB;
const ACTION_FEED_LIMIT = 200;
const APP_SNAPSHOT_SCHEMA_VERSION = 1;
const BANKRUPTCY_RETURN_DELAY_MS = 16000;
const PRACTICE_XP_MULTIPLIER = 0.35;
const CAREER_XP_RESCUE_PENALTY_STEP = 0.3;
const CAREER_XP_RESCUE_MIN_MULTIPLIER = 0.4;
const SUBSIDY_BB = 40;
const LOAN_BB = 100;
const LOAN_REPAY_RATE = 0.25;
const tableOrder: TablePosition[] = ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
function positionRelativeToButton(position: TablePosition, buttonPosition: TablePosition): TablePosition {
  const positionIdx = tableOrder.indexOf(position);
  const buttonIdx = tableOrder.indexOf(buttonPosition);
  const canonicalButtonIdx = tableOrder.indexOf('BTN');
  if (positionIdx === -1 || buttonIdx === -1 || canonicalButtonIdx === -1) {
    return position;
  }
  const relativeIdx = (positionIdx - buttonIdx + canonicalButtonIdx + tableOrder.length) % tableOrder.length;
  return tableOrder[relativeIdx];
}
const COACH_STAT_BENCHMARKS: Record<CoachStatKey, CoachBenchmarkRange> = {
  vpip: { min: 22, max: 32 },
  pfr: { min: 16, max: 26 },
  threeBetPreflop: { min: 6, max: 12 },
  foldToThreeBet: { min: 45, max: 65 },
  flopCBet: { min: 48, max: 68 },
  foldVsFlopCBet: { min: 35, max: 55 },
  postflopReraise: { min: 8, max: 18 },
};
const SFX_VARIANTS: Record<SfxKey, SfxVariant[]> = {
  deal: [
    { asset: require('./assets/sfx/deal-1.ogg'), volume: 0.95 },
    { asset: require('./assets/sfx/deal-2.ogg'), volume: 0.95 },
  ],
  blind: [
    { asset: require('./assets/sfx/blind-1.ogg'), volume: 0.88 },
    { asset: require('./assets/sfx/blind-2.ogg'), volume: 0.88 },
  ],
  check: [
    { asset: require('./assets/sfx/check-1.ogg'), volume: 0.7 },
    { asset: require('./assets/sfx/check-2.ogg'), volume: 0.7 },
  ],
  call: [
    { asset: require('./assets/sfx/call-1.ogg'), volume: 0.9 },
    { asset: require('./assets/sfx/call-2.ogg'), volume: 0.9 },
  ],
  raise: [
    { asset: require('./assets/sfx/raise-1.ogg'), volume: 0.96 },
    { asset: require('./assets/sfx/raise-2.ogg'), volume: 0.96 },
  ],
  allIn: [
    { asset: require('./assets/sfx/allin-1.ogg'), volume: 1.0 },
    { asset: require('./assets/sfx/allin-2.ogg'), volume: 1.0 },
  ],
  fold: [
    { asset: require('./assets/sfx/fold-1.ogg'), volume: 0.8 },
    { asset: require('./assets/sfx/fold-2.ogg'), volume: 0.8 },
  ],
  reveal: [
    { asset: require('./assets/sfx/reveal-1.ogg'), volume: 0.8 },
    { asset: require('./assets/sfx/reveal-2.ogg'), volume: 0.8 },
  ],
  ui: [
    { asset: require('./assets/sfx/ui-1.ogg'), volume: 0.75 },
  ],
};

const EMPTY_SPOT_INSIGHT = {
  outsGroups: [],
  outsCount: 0,
  oneCardHitRate: 0,
  twoCardHitRate: 0,
  rangeBuckets: [],
  rangeSamples: [],
  equity: { heroWin: 0, tie: 0, villainWin: 0 },
  potOddsNeed: 0,
  combosConsidered: 0,
  simulations: 0,
  notes: [],
};

function createEmptySfxMap(): Record<SfxKey, Audio.Sound[]> {
  return {
    deal: [],
    blind: [],
    check: [],
    call: [],
    raise: [],
    allIn: [],
    fold: [],
    reveal: [],
    ui: [],
  };
}

function findAiById(aiId?: string): AiProfile | undefined {
  if (!aiId) return undefined;
  for (const zone of trainingZones) {
    const hit = zone.aiPool.find((ai) => ai.id === aiId);
    if (hit) return hit;
  }
  return undefined;
}

const seatLayout: SeatAnchor[] = [
  { id: 'utg', pos: 'UTG', seatLeft: '20%', seatTop: '22%' },
  { id: 'lj', pos: 'LJ', seatLeft: '50%', seatTop: '9%' },
  { id: 'hj', pos: 'HJ', seatLeft: '80%', seatTop: '22%' },
  { id: 'co', pos: 'CO', seatLeft: '87%', seatTop: '47%' },
  { id: 'btn', pos: 'BTN', seatLeft: '69%', seatTop: '78%' },
  { id: 'sb', pos: 'SB', seatLeft: '31%', seatTop: '78%' },
  { id: 'bb', pos: 'BB', seatLeft: '13%', seatTop: '47%' },
];

const oppLeakKeys: OppLeakGuess[] = ['overFoldToRaise', 'callsTooWide', 'overBluffsRiver', 'cBetsTooMuch', 'missesThinValue'];
const oppLeakLabels: Record<OppLeakGuess, string> = {
  overFoldToRaise: '被加注常棄牌',
  callsTooWide: '跟注過寬',
  overBluffsRiver: '河牌唬牌過量',
  cBetsTooMuch: 'c-bet 過高',
  missesThinValue: '薄價值下注不足',
};

function coachMissionTemplates(zoneId: string): Array<Omit<CoachMission, 'progress' | 'completed' | 'rewarded'>> {
  if (zoneId === 'rookie') {
    return [
      { id: 'rk-steal', kind: 'steal_preflop', title: '偷盲入門', detail: 'Preflop 主動加注後直接拿下底池 3 次', target: 3, rewardXp: 38 },
      { id: 'rk-win', kind: 'win_hands', title: '穩定拿池', detail: '贏下 4 手牌，先養成基礎勝率', target: 4, rewardXp: 34 },
      { id: 'rk-profit', kind: 'profit_bb', title: '淨贏 80bb', detail: '本區資金相對起始累積 +80bb', target: 80, rewardXp: 90 },
    ];
  }
  if (zoneId === 'starter') {
    return [
      { id: 'st-steal', kind: 'steal_preflop', title: '位置偷雞', detail: '利用 CO/BTN/SB 位置偷盲成功 4 次', target: 4, rewardXp: 56 },
      { id: 'st-catch', kind: 'bluff_catch', title: '抓河牌唬牌', detail: 'River 跟注抓唬後贏牌 2 次', target: 2, rewardXp: 72 },
      { id: 'st-profit', kind: 'profit_bb', title: '淨贏 120bb', detail: '本區資金累積 +120bb', target: 120, rewardXp: 120 },
    ];
  }
  if (zoneId === 'advanced') {
    return [
      { id: 'ad-catch', kind: 'bluff_catch', title: '高壓 bluff catch', detail: '在河牌做正確 bluff catch 並贏牌 3 次', target: 3, rewardXp: 92 },
      { id: 'ad-3barrel', kind: 'triple_barrel', title: '三槍壓制', detail: 'Flop/Turn/River 連續進攻並拿下底池 2 次', target: 2, rewardXp: 108 },
      { id: 'ad-profit', kind: 'profit_bb', title: '淨贏 180bb', detail: '本區資金累積 +180bb', target: 180, rewardXp: 155 },
    ];
  }
  if (zoneId === 'pro') {
    return [
      { id: 'pr-catch', kind: 'bluff_catch', title: '精準抓牌', detail: '對高強度對手抓唬成功 4 次', target: 4, rewardXp: 118 },
      { id: 'pr-3barrel', kind: 'triple_barrel', title: '多街線路規劃', detail: '完成三槍施壓並贏牌 3 次', target: 3, rewardXp: 142 },
      { id: 'pr-profit', kind: 'profit_bb', title: '淨贏 240bb', detail: '本區資金累積 +240bb', target: 240, rewardXp: 188 },
    ];
  }
  if (zoneId === 'legend') {
    return [
      { id: 'lg-catch', kind: 'bluff_catch', title: '大神抓牌課', detail: '河牌 bluff catch 成功 5 次', target: 5, rewardXp: 146 },
      { id: 'lg-3barrel', kind: 'triple_barrel', title: '極限三槍', detail: '三槍壓制成功 4 次', target: 4, rewardXp: 182 },
      { id: 'lg-profit', kind: 'profit_bb', title: '淨贏 300bb', detail: '本區資金累積 +300bb', target: 300, rewardXp: 260 },
    ];
  }
  if (zoneId === 'godrealm') {
    return [
      { id: 'gr-catch', kind: 'bluff_catch', title: '神域讀牌', detail: '高壓河牌 bluff catch 成功 6 次', target: 6, rewardXp: 176 },
      { id: 'gr-3barrel', kind: 'triple_barrel', title: '終局連壓', detail: '三槍壓制成功 5 次', target: 5, rewardXp: 228 },
      { id: 'gr-profit', kind: 'profit_bb', title: '淨贏 380bb', detail: '本區資金累積 +380bb', target: 380, rewardXp: 320 },
    ];
  }
  return [
    { id: 'lg-catch', kind: 'bluff_catch', title: '大神抓牌課', detail: '河牌 bluff catch 成功 5 次', target: 5, rewardXp: 146 },
    { id: 'lg-3barrel', kind: 'triple_barrel', title: '極限三槍', detail: '三槍壓制成功 4 次', target: 4, rewardXp: 182 },
    { id: 'lg-profit', kind: 'profit_bb', title: '淨贏 300bb', detail: '本區資金累積 +300bb', target: 300, rewardXp: 260 },
  ];
}

function createCoachMissions(zoneId: string): CoachMission[] {
  return coachMissionTemplates(zoneId).map((template) => ({
    ...template,
    progress: 0,
    completed: false,
    rewarded: false,
  }));
}

function normalizeStackValue(raw: number): number {
  return Math.max(0, Math.round(raw));
}

function normalizeCounter(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return 0;
  }
  return Math.max(0, Math.round(raw));
}

function normalizeDateKey(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function normalizeTrainingMode(mode: TrainingMode | undefined): TrainingMode {
  return mode === 'practice' ? 'practice' : 'career';
}

function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function bbToChips(bb: number): number {
  return Math.max(0, Math.round(bb * BIG_BLIND_SIZE));
}

function chipsToBb(chips: number, bigBlind: number = BIG_BLIND_SIZE): number {
  return Math.floor(Math.max(0, chips) / Math.max(1, bigBlind));
}

function careerXpMultiplier(aidUses: number): number {
  const adjusted = 1 - normalizeCounter(aidUses) * CAREER_XP_RESCUE_PENALTY_STEP;
  return Math.max(CAREER_XP_RESCUE_MIN_MULTIPLIER, Number(adjusted.toFixed(2)));
}

function resolveXpMultiplier(mode: TrainingMode, zoneState: ZoneTrainingState): number {
  if (mode === 'practice') {
    return PRACTICE_XP_MULTIPLIER;
  }
  return careerXpMultiplier(zoneState.aidUses);
}

function applyXpMultiplier(prev: ProgressState, next: ProgressState, multiplier: number): ProgressState {
  if (multiplier >= 0.999) {
    return next;
  }
  const delta = next.xp - prev.xp;
  if (delta <= 0) {
    return next;
  }
  const scaledXp = prev.xp + Math.round(delta * Math.max(0, multiplier));
  return {
    ...next,
    xp: scaledXp,
    zoneIndex: Math.max(prev.zoneIndex, unlockedZoneByXp(scaledXp)),
  };
}

function normalizeBankrollForSeats(seats: Seat[], bankroll?: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {};
  seats.forEach((seat) => {
    if (seat.role === 'empty') return;
    const raw = bankroll?.[seat.id];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      next[seat.id] = normalizeStackValue(raw);
      return;
    }
    next[seat.id] = STARTING_STACK;
  });
  return next;
}

function createZoneTrainingState(zone: TrainingZone, seats: Seat[]): ZoneTrainingState {
  const bankroll = normalizeBankrollForSeats(seats);
  return {
    bankroll,
    heroBaseline: bankroll[HERO_SEAT] ?? STARTING_STACK,
    missions: createCoachMissions(zone.id),
    heroStats: createEmptyHeroStats(),
    handsPlayed: 0,
    handsWon: 0,
    handsTied: 0,
    aidUses: 0,
    subsidyClaimDate: null,
    loanDebt: 0,
  };
}

function syncZoneTrainingState(zone: TrainingZone, seats: Seat[], current?: ZoneTrainingState): ZoneTrainingState {
  if (!current) {
    return createZoneTrainingState(zone, seats);
  }
  return {
    ...current,
    bankroll: normalizeBankrollForSeats(seats, current.bankroll),
    heroStats: current.heroStats ?? createEmptyHeroStats(),
    handsPlayed: normalizeCounter(current.handsPlayed),
    handsWon: normalizeCounter(current.handsWon),
    handsTied: normalizeCounter(current.handsTied),
    aidUses: normalizeCounter(current.aidUses),
    subsidyClaimDate: normalizeDateKey(current.subsidyClaimDate),
    loanDebt: normalizeCounter(current.loanDebt),
  };
}

type LobbyZoneStats = {
  handsPlayed: number;
  handsWon: number;
  handsTied: number;
};

function winRateFromCounts(handsPlayed: number, handsWon: number): number {
  if (handsPlayed <= 0) {
    return 0;
  }
  return Math.round((handsWon / handsPlayed) * 100);
}

function resolveLobbyZoneStats(zoneState: ZoneTrainingState): LobbyZoneStats {
  const handsPlayed = normalizeCounter(zoneState.handsPlayed);
  const handsWon = Math.min(handsPlayed, normalizeCounter(zoneState.handsWon));
  const handsTied = Math.min(Math.max(0, handsPlayed - handsWon), normalizeCounter(zoneState.handsTied));
  return {
    handsPlayed,
    handsWon,
    handsTied,
  };
}

function extractBankrollFromHand(hand: HandState, seats: Seat[], fallback: Record<string, number>): Record<string, number> {
  const next = normalizeBankrollForSeats(seats, fallback);
  seats.forEach((seat) => {
    if (seat.role === 'empty') return;
    const player = hand.players.find((p) => p.id === seat.id);
    if (player) {
      next[seat.id] = normalizeStackValue(player.stack);
    }
  });
  return next;
}

function buildHandBankrollForMode(
  mode: TrainingMode,
  seats: Seat[],
  bankroll: Record<string, number>,
): Record<string, number> {
  if (mode === 'career') {
    return normalizeBankrollForSeats(seats, bankroll);
  }
  const next: Record<string, number> = {};
  seats.forEach((seat) => {
    if (seat.role === 'empty') {
      return;
    }
    const current = bankroll[seat.id] ?? STARTING_STACK;
    next[seat.id] = Math.max(STARTING_STACK, normalizeStackValue(current));
  });
  return next;
}

function cloneProgressState(progress: ProgressState): ProgressState {
  return {
    ...progress,
    leaks: { ...progress.leaks },
  };
}

function normalizeProgressSnapshot(progress?: ProgressState): ProgressState {
  if (!progress) {
    return cloneProgressState(initialProgress);
  }
  return {
    xp: Number.isFinite(progress.xp) ? Math.max(0, Math.round(progress.xp)) : 0,
    zoneIndex: Number.isFinite(progress.zoneIndex) ? Math.max(0, Math.round(progress.zoneIndex)) : 0,
    handsPlayed: Number.isFinite(progress.handsPlayed) ? Math.max(0, Math.round(progress.handsPlayed)) : 0,
    handsWon: Number.isFinite(progress.handsWon) ? Math.max(0, Math.round(progress.handsWon)) : 0,
    leaks: {
      overFold: Number.isFinite(progress.leaks?.overFold) ? Math.max(0, Math.round(progress.leaks.overFold)) : 0,
      overCall: Number.isFinite(progress.leaks?.overCall) ? Math.max(0, Math.round(progress.leaks.overCall)) : 0,
      overBluff: Number.isFinite(progress.leaks?.overBluff) ? Math.max(0, Math.round(progress.leaks.overBluff)) : 0,
      missedValue: Number.isFinite(progress.leaks?.missedValue) ? Math.max(0, Math.round(progress.leaks.missedValue)) : 0,
      passiveCheck: Number.isFinite(progress.leaks?.passiveCheck) ? Math.max(0, Math.round(progress.leaks.passiveCheck)) : 0,
    },
  };
}

function normalizeZoneIndex(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  const rounded = Math.round(value);
  return Math.max(0, Math.min(trainingZones.length - 1, rounded));
}

function restoreZoneTrainingById(snapshot?: Record<string, ZoneTrainingState>): Record<string, ZoneTrainingState> {
  return trainingZones.reduce<Record<string, ZoneTrainingState>>((acc, zone, idx) => {
    const defaultSeats = makeSeats(idx);
    acc[zone.id] = syncZoneTrainingState(zone, defaultSeats, snapshot?.[zone.id]);
    return acc;
  }, {});
}

function mergeZoneTrainingWithRecordedStats(
  zoneTrainingById: Record<string, ZoneTrainingState>,
  recordedStats: Array<{ zoneId: string; handsPlayed: number; handsWon: number; handsTied: number }>,
): Record<string, ZoneTrainingState> {
  const statsByZoneId = new Map(recordedStats.map((item) => [item.zoneId, item]));
  return trainingZones.reduce<Record<string, ZoneTrainingState>>((acc, zone, idx) => {
    const base = zoneTrainingById[zone.id] ?? syncZoneTrainingState(zone, makeSeats(idx));
    const stats = statsByZoneId.get(zone.id);
    if (!stats) {
      acc[zone.id] = base;
      return acc;
    }

    const handsPlayed = normalizeCounter(stats.handsPlayed);
    const handsWon = Math.min(handsPlayed, normalizeCounter(stats.handsWon));
    const handsTied = Math.min(Math.max(0, handsPlayed - handsWon), normalizeCounter(stats.handsTied));
    acc[zone.id] = {
      ...base,
      handsPlayed,
      handsWon,
      handsTied,
    };
    return acc;
  }, {});
}

function serializeSeatsForSnapshot(seats: Seat[]): PersistedSeat[] {
  return seats.map((seat) => ({
    id: seat.id,
    role: seat.role,
    aiId: seat.role === 'ai' ? seat.ai?.id : undefined,
  }));
}

function restoreSeatsFromSnapshot(snapshotSeats: PersistedSeat[] | undefined, zoneIndex: number): Seat[] {
  if (!snapshotSeats || snapshotSeats.length === 0) {
    return makeSeats(zoneIndex);
  }
  const snapshotBySeatId = new Map(snapshotSeats.map((seat) => [seat.id, seat]));
  const restored: Seat[] = seatLayout.map((anchor) => {
    if (anchor.id === HERO_SEAT) {
      return {
        id: anchor.id,
        pos: anchor.pos,
        role: 'hero',
      };
    }
    const savedSeat = snapshotBySeatId.get(anchor.id);
    if (savedSeat?.role === 'ai') {
      return {
        id: anchor.id,
        pos: anchor.pos,
        role: 'ai',
        ai: findAiById(savedSeat.aiId) ?? pickAi(zoneIndex),
      };
    }
    return {
      id: anchor.id,
      pos: anchor.pos,
      role: 'empty',
    };
  });

  if (!restored.some((seat) => seat.role === 'ai')) {
    const fallback =
      restored.find((seat) => seat.id === 'utg' && seat.role === 'empty')
      ?? restored.find((seat) => seat.id !== HERO_SEAT && seat.role === 'empty');
    if (fallback) {
      fallback.role = 'ai';
      fallback.ai = pickAi(zoneIndex);
    }
  }
  return restored;
}

function summarizeHandSignals(hand: HandState): HandMissionSignals {
  const heroId = hand.heroPlayerId;
  const heroWon = hand.winner === 'hero';
  const heroRaisedPreflop = hand.history.some(
    (log) => log.actorId === heroId && log.street === 'preflop' && log.action === 'raise' && !log.forcedBlind,
  );
  const hasPlayerPostflopAction = hand.history.some(
    (log) => log.actorId && (log.street === 'flop' || log.street === 'turn' || log.street === 'river'),
  );
  const bluffCatchWin = heroWon && hand.history.some((log) => log.actorId === heroId && log.street === 'river' && log.action === 'call');
  const heroRaiseFlop = hand.history.some((log) => log.actorId === heroId && log.street === 'flop' && log.action === 'raise');
  const heroRaiseTurn = hand.history.some((log) => log.actorId === heroId && log.street === 'turn' && log.action === 'raise');
  const heroRaiseRiver = hand.history.some((log) => log.actorId === heroId && log.street === 'river' && log.action === 'raise');
  return {
    heroWon,
    stealWin: heroWon && heroRaisedPreflop && !hasPlayerPostflopAction,
    bluffCatchWin,
    tripleBarrelWin: heroWon && heroRaiseFlop && heroRaiseTurn && heroRaiseRiver,
  };
}

function missionIncrement(kind: CoachMissionKind, signals: HandMissionSignals): number {
  if (kind === 'steal_preflop') return signals.stealWin ? 1 : 0;
  if (kind === 'bluff_catch') return signals.bluffCatchWin ? 1 : 0;
  if (kind === 'triple_barrel') return signals.tripleBarrelWin ? 1 : 0;
  if (kind === 'win_hands') return signals.heroWon ? 1 : 0;
  return 0;
}

function applyZoneMissionUpdates(zoneState: ZoneTrainingState, hand: HandState, bankrollAfter: Record<string, number>): MissionResolution {
  const heroStack = bankrollAfter[hand.heroPlayerId] ?? hand.heroStack;
  const bigBlind = Math.max(1, hand.bigBlind || BIG_BLIND_SIZE);
  const signals = summarizeHandSignals(hand);
  let rewardXp = 0;
  const completedMissionTitles: string[] = [];

  const missions = zoneState.missions.map((missionItem) => {
    let progress = missionItem.progress;
    if (missionItem.kind === 'profit_bb') {
      progress = Math.max(0, Math.floor((heroStack - zoneState.heroBaseline) / bigBlind));
    } else if (!missionItem.completed) {
      progress += missionIncrement(missionItem.kind, signals);
    }

    const completed = missionItem.completed || progress >= missionItem.target;
    let rewarded = missionItem.rewarded;
    if (completed && !rewarded) {
      rewarded = true;
      rewardXp += missionItem.rewardXp;
      completedMissionTitles.push(missionItem.title);
    }

    return {
      ...missionItem,
      progress: Math.min(Math.max(progress, missionItem.completed ? missionItem.target : 0), missionItem.target),
      completed,
      rewarded,
    };
  });

  return {
    nextState: {
      ...zoneState,
      bankroll: bankrollAfter,
      missions,
    },
    rewardXp,
    completedMissionTitles,
  };
}

function nextEventId(seed: number): string {
  return `ev-${seed}-${Date.now()}`;
}

function streetBoardCount(street: string): number {
  if (street === 'flop') return 3;
  if (street === 'turn') return 4;
  if (street === 'river') return 5;
  return 0;
}

function eventDelayMs(event: TableEvent): number {
  if (event.kind === 'deal') return 260;
  if (event.kind === 'blind') return 320;
  if (event.kind === 'action') return event.action === 'fold' ? 300 : 360;
  if (event.kind === 'street') return 360;
  if (event.kind === 'reveal') return 420;
  return 260;
}

function buildSeatVisualMap(seats: Seat[]): Record<string, SeatVisual> {
  const result: Record<string, SeatVisual> = {};
  seats.forEach((seat) => {
    result[seat.id] = {
      cardsDealt: 0,
      inHand: seat.role !== 'empty',
      folded: seat.role === 'empty',
      lastAction: seat.role === 'empty' ? '點擊新增' : '等待中',
    };
  });
  return result;
}

const initialSeatsForApp = makeSeats(0);
const initialZoneTrainingState = createZoneTrainingState(trainingZones[0], initialSeatsForApp);

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function pickAi(zoneIndex: number): AiProfile {
  const pool = trainingZones[zoneIndex].aiPool;
  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
}

function makeSeats(zoneIndex: number): Seat[] {
  const seats: Seat[] = seatLayout.map((s) => ({ id: s.id, pos: s.pos, role: s.id === HERO_SEAT ? 'hero' : 'empty' }));
  ['utg', 'bb'].forEach((id) => {
    const target = seats.find((s) => s.id === id);
    if (target && target.role === 'empty') {
      target.role = 'ai';
      target.ai = pickAi(zoneIndex);
    }
  });
  return seats;
}

function seatName(seat: Seat): string {
  if (seat.role === 'hero') return 'Hero';
  if (seat.role === 'ai') return seat.ai?.name ?? 'AI';
  return '空位';
}

function unlockedZoneByXp(xp: number): number {
  let idx = 0;
  for (let i = 0; i < trainingZones.length; i += 1) if (xp >= trainingZones[i].unlockXp) idx = i;
  return idx;
}

function zoneMissionsCompleted(zoneState?: ZoneTrainingState): boolean {
  if (!zoneState || zoneState.missions.length === 0) {
    return false;
  }
  return zoneState.missions.every((missionItem) => missionItem.completed);
}

function unlockedZoneByCompletedMissions(zoneTrainingById: Record<string, ZoneTrainingState>): number {
  let idx = 0;
  for (let i = 0; i < trainingZones.length - 1; i += 1) {
    const zoneState = zoneTrainingById[trainingZones[i].id];
    if (!zoneMissionsCompleted(zoneState)) {
      break;
    }
    idx = i + 1;
  }
  return idx;
}

function unlockedZone(progress: ProgressState, zoneTrainingById: Record<string, ZoneTrainingState>): number {
  return Math.max(progress.zoneIndex, unlockedZoneByXp(progress.xp), unlockedZoneByCompletedMissions(zoneTrainingById));
}

function zoneUnlockHint(zoneIdx: number, progress: ProgressState): string {
  const zoneDef = trainingZones[zoneIdx] ?? trainingZones[0];
  const needXp = Math.max(0, zoneDef.unlockXp - progress.xp);
  if (zoneIdx <= 0) {
    return '已解鎖';
  }
  const prevZone = trainingZones[zoneIdx - 1] ?? trainingZones[0];
  return `完成 ${prevZone.name} 全部任務 或 再拿 ${needXp} XP`;
}

function addXp(p: ProgressState, delta: number): ProgressState {
  const xp = p.xp + delta;
  return { ...p, xp, zoneIndex: Math.max(p.zoneIndex, unlockedZoneByXp(xp)) };
}

function actionLabel(a: ActionType): string {
  if (a === 'fold') return '棄牌';
  if (a === 'check') return '過牌';
  if (a === 'call') return '跟注';
  return '加注';
}

function actionDisplayText(action: ActionType | undefined, amount: number | undefined, allIn: boolean | undefined): string {
  if (allIn) {
    return `All-in${(amount ?? 0) > 0 ? ` ${amount}` : ''}`;
  }
  const label = action ? actionLabel(action) : '行動';
  if ((amount ?? 0) > 0 && action !== 'fold' && action !== 'check') {
    return `${label} ${amount}`;
  }
  return label;
}

function actionSfxKey(action: ActionType | undefined, amount: number | undefined, allIn: boolean | undefined, text?: string): SfxKey {
  if (text?.includes('盲')) return 'blind';
  if (allIn) return 'allIn';
  if (action === 'raise') return 'raise';
  if (action === 'call') return 'call';
  if (action === 'check') return 'check';
  if (action === 'fold') return 'fold';
  return (amount ?? 0) > 0 ? 'call' : 'check';
}

function createHeroTurnSpotKey(hand: HandState): string {
  const board = hand.board.slice(0, hand.revealedBoardCount).map((card) => card.code).join(',');
  const hero = hand.heroCards.map((card) => card.code).join(',');
  const historyTail = hand.history
    .slice(-18)
    .map((log) => `${log.street}:${log.actorId ?? log.actor}:${log.action}:${log.amount}:${log.allIn ? 'A' : 'N'}`)
    .join('|');
  return [
    hand.street,
    hand.actingPlayerId ?? '-',
    hand.pot,
    hand.toCall,
    hand.minRaise,
    hand.heroStack,
    hand.villainStack,
    hero,
    board,
    hand.history.length,
    historyTail,
  ].join('#');
}

function mission(leak: HeroLeak): string {
  if (leak === 'overFold') return '任務：多做符合賠率的防守跟注';
  if (leak === 'overCall') return '任務：高壓下注前先算 pot odds';
  if (leak === 'overBluff') return '任務：減少無效唬牌';
  if (leak === 'missedValue') return '任務：中強牌多拿價值';
  return '任務：找 3 個可主動施壓節點';
}

function shortName(name: string): string {
  return name.length <= 6 ? name : `${name.slice(0, 6)}…`;
}

function CardView({ card, hidden, compact }: { card?: Card; hidden?: boolean; compact?: boolean }) {
  const cardStyle = compact ? styles.tableCardCompact : styles.tableCard;
  if (!card || hidden) {
    return (
      <LinearGradient colors={['#1b2d4f', '#0f1a2f']} style={[cardStyle, styles.cardBack]}>
        <View style={styles.cardBackStripe} />
        <Text style={styles.cardBackText}>?</Text>
      </LinearGradient>
    );
  }
  const red = card.suit === 'h' || card.suit === 'd';
  return (
    <LinearGradient colors={['#fdfefe', '#d8dde5']} style={cardStyle}>
      <Text style={[styles.cardFaceText, red && styles.cardFaceRed]}>{cardToDisplay(card)}</Text>
    </LinearGradient>
  );
}

function Advice({ title, advice }: { title: string; advice: ActionAdvice }) {
  return (
    <View style={styles.adviceBox}>
      <Text style={styles.adviceTitle}>{title}</Text>
      <Text style={styles.adviceMain}>
        {actionLabel(advice.action)}
        {advice.amount ? ` ${advice.amount}` : ''} · 信心 {Math.round(advice.confidence * 100)}%
      </Text>
      <Text style={styles.textMuted}>{advice.summary}</Text>
      {advice.rationale.map((line) => (
        <Text key={`${title}-${line}`} style={styles.textTiny}>
          - {line}
        </Text>
      ))}
    </View>
  );
}

function PercentMeter({ label, value, accent }: { label: string; value: number; accent: string }) {
  const pct = clamp(value, 0, 100);
  return (
    <View style={styles.meterRow}>
      <View style={styles.meterHead}>
        <Text style={styles.textTiny}>{label}</Text>
        <Text style={styles.textTiny}>{pct.toFixed(1)}%</Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${pct}%`, backgroundColor: accent }]} />
      </View>
    </View>
  );
}

function sampleTier(opportunities: number): 'low' | 'mid' | 'high' {
  if (opportunities >= 80) return 'high';
  if (opportunities >= 20) return 'mid';
  return 'low';
}

function sampleTierLabel(opportunities: number): string {
  const tier = sampleTier(opportunities);
  if (tier === 'high') return '高樣本';
  if (tier === 'mid') return '中樣本';
  return '低樣本';
}

function coachBenchmarkRangeLabel(range: CoachBenchmarkRange): string {
  return `${range.min}-${range.max}%`;
}

function coachBenchmarkVerdict(stat: RatioStat, range: CoachBenchmarkRange): { text: string; tone: CoachBenchmarkVerdictTone } {
  if (stat.opportunities <= 0) {
    return { text: '待收樣本', tone: 'pending' };
  }

  const rate = statRatePercent(stat);
  if (rate > range.max) {
    return { text: `偏高 +${(rate - range.max).toFixed(1)}%`, tone: 'high' };
  }
  if (rate < range.min) {
    return { text: `偏低 -${(range.min - rate).toFixed(1)}%`, tone: 'low' };
  }
  return { text: '標準內', tone: 'inRange' };
}

function coachStatsSummary(stats: HeroStatsSnapshot): string {
  if (stats.hands < 12) {
    return '樣本仍少，先累積 12-20 手再判讀頻率偏差。';
  }

  const vpip = statRatePercent(stats.vpip);
  const pfr = statRatePercent(stats.pfr);
  const vpipGap = vpip - pfr;
  if (stats.vpip.opportunities >= 20 && vpipGap > 12) {
    return 'VPIP-PFR 差距偏大，可能冷跟注過多，建議縮減被動入池。';
  }

  const flopCbet = statRatePercent(stats.flopCBet);
  if (stats.flopCBet.opportunities >= 15 && flopCbet > 72) {
    return 'Flop c-bet 偏高，建議加入更多 check back 來保護中段範圍。';
  }

  const foldVsCbet = statRatePercent(stats.foldVsFlopCBet);
  if (stats.foldVsFlopCBet.opportunities >= 12 && foldVsCbet > 58) {
    return '面對 flop c-bet 的棄牌偏高，建議擴充最低防守頻率。';
  }

  const foldTo3bet = statRatePercent(stats.foldToThreeBet);
  if (stats.foldToThreeBet.opportunities >= 10 && foldTo3bet > 65) {
    return '面對 preflop 3bet 棄牌偏高，對手可高頻 exploit 你。';
  }

  return '目前頻率沒有明顯失衡，持續觀察樣本與對手類型變化。';
}

function CoachStatTile({ label, statKey, stat }: { label: string; statKey: CoachStatKey; stat: RatioStat }) {
  const rate = statRatePercent(stat);
  const tier = sampleTier(stat.opportunities);
  const benchmark = COACH_STAT_BENCHMARKS[statKey];
  const verdict = coachBenchmarkVerdict(stat, benchmark);

  return (
    <View style={styles.coachStatTile}>
      <View style={styles.coachStatHead}>
        <Text style={styles.textTiny}>{label}</Text>
        <Text style={styles.coachStatRate}>{rate.toFixed(1)}%</Text>
      </View>
      <View style={styles.coachStatMeta}>
        <Text style={styles.coachStatCount}>{stat.hits}/{stat.opportunities}</Text>
        <Text style={styles.coachStatRange}>標準 {coachBenchmarkRangeLabel(benchmark)}</Text>
      </View>
      <View style={styles.coachStatMeta}>
        <Text
          style={[
            styles.coachStatBenchmark,
            verdict.tone === 'inRange'
              ? styles.coachStatBenchmarkInRange
              : verdict.tone === 'high'
                ? styles.coachStatBenchmarkHigh
                : verdict.tone === 'low'
                  ? styles.coachStatBenchmarkLow
                  : styles.coachStatBenchmarkPending,
          ]}
        >
          {verdict.text}
        </Text>
        <Text
          style={[
            styles.coachStatTier,
            tier === 'high' ? styles.coachStatTierHigh : tier === 'mid' ? styles.coachStatTierMid : styles.coachStatTierLow,
          ]}
        >
          {sampleTierLabel(stat.opportunities)}
        </Text>
      </View>
    </View>
  );
}

export default function App() {
  const { width, height } = useWindowDimensions();
  const [phase, setPhase] = useState<Phase>('lobby');
  const [lobbyZone, setLobbyZone] = useState(0);
  const [zoneIndex, setZoneIndex] = useState(0);

  const [progress, setProgress] = useState<ProgressState>({ ...initialProgress, leaks: { ...initialProgress.leaks } });
  const [zoneTrainingById, setZoneTrainingById] = useState<Record<string, ZoneTrainingState>>(() => ({
    [trainingZones[0].id]: initialZoneTrainingState,
  }));
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);
  const [missionOpen, setMissionOpen] = useState(false);
  const [trainingMode, setTrainingMode] = useState<TrainingMode>('career');
  const [politeMode, setPoliteMode] = useState(false);
  const [aiVoiceAssistEnabled, setAiVoiceAssistEnabled] = useState(true);
  const [aiVoiceBusy, setAiVoiceBusy] = useState(false);
  const [aiVoiceLastAdvice, setAiVoiceLastAdvice] = useState('');
  const [autoPlayEvents, setAutoPlayEvents] = useState(true);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [sfxReady, setSfxReady] = useState(false);
  const [sfxLoadError, setSfxLoadError] = useState(false);
  const [note, setNote] = useState('先選牌桌水平，進桌後可直接點座位新增/移除 AI。');
  const [bankruptcyPromptOpen, setBankruptcyPromptOpen] = useState(false);
  const [bankruptcyPromptText, setBankruptcyPromptText] = useState('');
  const [bankruptcyCountdown, setBankruptcyCountdown] = useState(0);
  const [activeProfile, setActiveProfile] = useState<LocalProfile | null>(null);
  const [localDbReady, setLocalDbReady] = useState(false);
  const [handRecordCount, setHandRecordCount] = useState(0);

  const [seats, setSeats] = useState<Seat[]>(() => initialSeatsForApp);
  const [buttonSeatId, setButtonSeatId] = useState(HERO_SEAT);
  const [selectedSeatId, setSelectedSeatId] = useState('utg');
  const [battleSeatId, setBattleSeatId] = useState<string | null>('utg');
  const [pendingReplacementSeatIds, setPendingReplacementSeatIds] = useState<string[]>([]);
  const [leakGuess, setLeakGuess] = useState<OppLeakGuess | null>(null);
  const [seatVisual, setSeatVisual] = useState<Record<string, SeatVisual>>(() => buildSeatVisualMap(initialSeatsForApp));
  const [eventQueue, setEventQueue] = useState<TableEvent[]>([]);
  const [tableFeed, setTableFeed] = useState<string[]>([]);
  const [actionFeed, setActionFeed] = useState<string[]>([]);
  const [displayedBoardCount, setDisplayedBoardCount] = useState(0);
  const [eventSeed, setEventSeed] = useState(1);
  const [activeSeatAnimId, setActiveSeatAnimId] = useState<string | null>(null);
  const seatPulse = useRef(new Animated.Value(0)).current;
  const chipPulse = useRef(new Animated.Value(0)).current;
  const drawerTranslateX = useRef(new Animated.Value(Math.max(900, width + 60))).current;
  const drawerBackdropOpacity = useRef(new Animated.Value(0)).current;
  const opsTranslateX = useRef(new Animated.Value(Math.max(760, width + 40))).current;
  const opsBackdropOpacity = useRef(new Animated.Value(0)).current;
  const missionTranslateX = useRef(new Animated.Value(760)).current;
  const missionBackdropOpacity = useRef(new Animated.Value(0)).current;
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bankruptcyReturnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bankruptcyCountdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const snapshotSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundsRef = useRef<Record<SfxKey, Audio.Sound[]>>(createEmptySfxMap());
  const aiCoachAbortRef = useRef<AbortController | null>(null);
  const aiCoachSpotRef = useRef('');

  const [hand, setHand] = useState(() => {
    const firstAi = initialSeatsForApp.find((s) => s.role === 'ai')?.ai ?? trainingZones[0].aiPool[0];
    return createNewHand(trainingZones[0], firstAi, {
      tablePlayers: initialSeatsForApp
        .filter((s) => s.role !== 'empty')
        .map((s) => ({
          id: s.id,
          position: s.pos,
          role: s.role === 'hero' ? 'hero' as const : 'ai' as const,
          ai: s.ai,
          name: s.role === 'hero' ? 'Hero' : s.ai?.name ?? 'AI',
        })),
      focusVillainId: initialSeatsForApp.find((s) => s.role === 'ai')?.id,
      buttonPosition: 'BTN',
      stackByPlayerId: initialZoneTrainingState.bankroll,
    });
  });
  const [raiseAmount, setRaiseAmount] = useState(10);
  const [raiseSliderWidth, setRaiseSliderWidth] = useState(0);

  const zone = trainingZones[zoneIndex] ?? trainingZones[0];
  const unlockedIdx = unlockedZone(progress, zoneTrainingById);
  const unlockedZoneName = trainingZones[unlockedIdx]?.name ?? trainingZones[0].name;
  const selectedSeat = seats.find((s) => s.id === selectedSeatId) ?? seats[0];
  const selectedSeatDisplayPos = positionRelativeToButton(selectedSeat.pos, hand.buttonPosition);
  const battleSeat = seats.find((s) => s.id === battleSeatId) ?? null;
  const analysis = useMemo(() => hand.lastAnalysis ?? analyzeCurrentSpot(hand), [hand]);
  const spotInsight = useMemo(() => (analysisOpen ? buildSpotInsight(hand) : EMPTY_SPOT_INSIGHT), [analysisOpen, hand]);
  const analysisDrawerWidth = useMemo(() => {
    const ratio = width >= 1380 ? 0.76 : width >= 1120 ? 0.82 : width >= 860 ? 0.88 : 0.96;
    return Math.round(clamp(width * ratio, 360, 1180));
  }, [width]);
  const analysisDrawerHiddenX = analysisDrawerWidth + 40;
  const opsPanelHiddenX = Math.max(760, width + 40);
  const topLeak = getTopLeak(progress);
  const zoneTrainingState = syncZoneTrainingState(zone, seats, zoneTrainingById[zone.id]);
  const zoneHeroStats = zoneTrainingState.heroStats;
  const zoneStatsCoachNote = coachStatsSummary(zoneHeroStats);
  const zoneVpipPfrGap = Number((statRatePercent(zoneHeroStats.vpip) - statRatePercent(zoneHeroStats.pfr)).toFixed(1));
  const todayKey = localDateKey();
  const canClaimSubsidyToday = zoneTrainingState.subsidyClaimDate !== todayKey;
  const zoneCareerXpFactor = careerXpMultiplier(zoneTrainingState.aidUses);
  const activeXpFactor = resolveXpMultiplier(trainingMode, zoneTrainingState);
  const zoneLoanDebt = zoneTrainingState.loanDebt;
  const zoneBankroll = zoneTrainingState.bankroll;
  const zoneHeroStack = zoneBankroll[HERO_SEAT] ?? STARTING_STACK;
  const heroPlayer = hand.players.find((player) => player.id === hand.heroPlayerId);
  const currentHeroStack = heroPlayer?.stack ?? hand.heroStack;
  const headerHeroStack = trainingMode === 'practice' ? currentHeroStack : zoneHeroStack;
  const headerHeroBb = Math.floor(headerHeroStack / Math.max(1, hand.bigBlind || BIG_BLIND_SIZE));
  const zoneHeroBb = Math.floor(zoneHeroStack / Math.max(1, hand.bigBlind || BIG_BLIND_SIZE));
  const zoneLoanDebtBb = chipsToBb(zoneLoanDebt, Math.max(1, hand.bigBlind || BIG_BLIND_SIZE));
  const zoneProfitBb = Math.floor((zoneHeroStack - zoneTrainingState.heroBaseline) / Math.max(1, hand.bigBlind || BIG_BLIND_SIZE));
  const completedMissionCount = zoneTrainingState.missions.filter((missionItem) => missionItem.completed).length;
  const lobbyZoneDef = trainingZones[lobbyZone] ?? trainingZones[0];
  const lobbyZoneState = syncZoneTrainingState(lobbyZoneDef, seats, zoneTrainingById[lobbyZoneDef.id]);
  const lobbyZoneStack = lobbyZoneState.bankroll[HERO_SEAT] ?? STARTING_STACK;
  const lobbyZoneBb = Math.floor(lobbyZoneStack / BIG_BLIND_SIZE);
  const lobbyZoneProfitBb = Math.floor((lobbyZoneStack - lobbyZoneState.heroBaseline) / BIG_BLIND_SIZE);
  const lobbyZoneMissionDone = lobbyZoneState.missions.filter((missionItem) => missionItem.completed).length;
  const lobbyZoneLocked = lobbyZone > unlockedIdx;
  const lobbyUnlockHint = zoneUnlockHint(lobbyZone, progress);
  const lobbyAvgSkill = Math.round(
    lobbyZoneDef.aiPool.reduce((sum, ai) => sum + ai.skill, 0) / Math.max(1, lobbyZoneDef.aiPool.length),
  );
  const lobbyArchetypes = Array.from(new Set(lobbyZoneDef.aiPool.map((ai) => ai.archetype))).join(' / ');
  const lobbyZoneStats = resolveLobbyZoneStats(lobbyZoneState);
  const lobbyZoneLosses = Math.max(0, lobbyZoneStats.handsPlayed - lobbyZoneStats.handsWon - lobbyZoneStats.handsTied);
  const lobbyZoneRecord = lobbyZoneStats.handsTied > 0
    ? `${lobbyZoneStats.handsWon}W-${lobbyZoneLosses}L-${lobbyZoneStats.handsTied}T`
    : `${lobbyZoneStats.handsWon}W-${lobbyZoneLosses}L`;
  const lobbyZoneWinRate = winRateFromCounts(lobbyZoneStats.handsPlayed, lobbyZoneStats.handsWon);
  const compactLobby = width < 1080 || height < 620;
  const heroEquityEdge = Number((spotInsight.equity.heroWin + spotInsight.equity.tie * 0.5 - spotInsight.potOddsNeed).toFixed(1));

  const visibleBoard = hand.board.slice(0, displayedBoardCount);
  const holes = Math.max(0, 5 - visibleBoard.length);
  const callOrCheck: ActionType = hand.toCall > 0 ? 'call' : 'check';
  const minRaise = hand.toCall + hand.minRaise;
  const raiseCap = Math.max(minRaise, hand.heroStack);
  const heroAllIn = !!heroPlayer?.allIn || currentHeroStack <= 0;
  const canRaise = !heroAllIn && hand.heroStack >= minRaise;
  const raiseRange = Math.max(0, raiseCap - minRaise);
  const raiseSliderRatio = !canRaise ? 0 : raiseRange <= 0 ? 1 : clamp((raiseAmount - minRaise) / raiseRange, 0, 1);
  const raiseSliderPercent: DimensionValue = `${Math.round(raiseSliderRatio * 100)}%`;
  const isAllInRaise = canRaise && raiseAmount >= raiseCap;
  const hasPendingEvent = eventQueue.length > 0;
  const recentActionLines = actionFeed;
  const isHeroTurn =
    phase === 'table'
    && !hand.isOver
    && !hasPendingEvent
    && hand.actingPlayerId === hand.heroPlayerId;
  const canHeroActNow = isHeroTurn && !heroAllIn;
  const heroTurnSpotKey = useMemo(() => createHeroTurnSpotKey(hand), [hand]);

  const clearBankruptcyTimers = useCallback(() => {
    if (bankruptcyReturnTimerRef.current) {
      clearTimeout(bankruptcyReturnTimerRef.current);
      bankruptcyReturnTimerRef.current = null;
    }
    if (bankruptcyCountdownTimerRef.current) {
      clearInterval(bankruptcyCountdownTimerRef.current);
      bankruptcyCountdownTimerRef.current = null;
    }
  }, []);

  const closeBankruptcyOverlay = useCallback(() => {
    clearBankruptcyTimers();
    setBankruptcyPromptOpen(false);
    setBankruptcyCountdown(0);
  }, [clearBankruptcyTimers]);

  const returnToLobbyAfterBankruptcy = useCallback(() => {
    closeBankruptcyOverlay();
    setPhase('lobby');
    setNote('你的當前籌碼已歸零，已返回遊戲大廳。');
  }, [closeBankruptcyOverlay]);

  useEffect(() => setRaiseAmount((v) => clamp(v, minRaise, raiseCap)), [minRaise, raiseCap]);
  useEffect(() => {
    let active = true;

    async function bootstrapLocalPersistence() {
      try {
        await initializeLocalDb();
        const profile = await ensureDefaultProfile();
        const [snapshot, savedHands, recordedZoneStats] = await Promise.all([
          loadProfileSnapshot<PersistedAppSnapshot>(profile.id),
          countRecordedHands(profile.id),
          listRecordedZoneHandStats(profile.id),
        ]);
        if (!active) {
          return;
        }

        setActiveProfile(profile);
        setHandRecordCount(savedHands);

        if (snapshot && snapshot.schemaVersion === APP_SNAPSHOT_SCHEMA_VERSION) {
          const restoredZoneIndex = normalizeZoneIndex(snapshot.zoneIndex);
          const restoredLobbyZone = normalizeZoneIndex(snapshot.lobbyZone);
          const restoredProgress = normalizeProgressSnapshot(snapshot.progress);
          const restoredZoneTraining = mergeZoneTrainingWithRecordedStats(
            restoreZoneTrainingById(snapshot.zoneTrainingById),
            recordedZoneStats,
          );
          const restoredSeats = restoreSeatsFromSnapshot(snapshot.seats, restoredZoneIndex);
          const seatIdSet = new Set(restoredSeats.map((seat) => seat.id));
          const restoredButtonSeatId = seatIdSet.has(snapshot.buttonSeatId) ? snapshot.buttonSeatId : HERO_SEAT;
          const restoredSelectedSeatId = seatIdSet.has(snapshot.selectedSeatId) ? snapshot.selectedSeatId : HERO_SEAT;
          const restoredBattleSeatId =
            snapshot.battleSeatId && restoredSeats.some((seat) => seat.id === snapshot.battleSeatId && seat.role === 'ai')
              ? snapshot.battleSeatId
              : restoredSeats.find((seat) => seat.role === 'ai')?.id ?? null;
          const restoredZone = trainingZones[restoredZoneIndex] ?? trainingZones[0];
          const restoredZoneState = syncZoneTrainingState(restoredZone, restoredSeats, restoredZoneTraining[restoredZone.id]);
          const restoredFocusSeat =
            restoredSeats.find((seat) => seat.id === restoredBattleSeatId && seat.role === 'ai' && seat.ai)
            ?? restoredSeats.find((seat) => seat.role === 'ai' && seat.ai);
          const restoredButtonSeat = restoredSeats.find((seat) => seat.id === restoredButtonSeatId);
          const restoredHand = createNewHand(restoredZone, restoredFocusSeat?.ai ?? restoredZone.aiPool[0], {
            tablePlayers: restoredSeats
              .filter((seat) => seat.role !== 'empty')
              .map((seat) => ({
                id: seat.id,
                position: seat.pos,
                role: seat.role === 'hero' ? 'hero' as const : 'ai' as const,
                ai: seat.ai,
                name: seat.role === 'hero' ? 'Hero' : seat.ai?.name ?? 'AI',
              })),
            focusVillainId: restoredFocusSeat?.id,
            buttonPosition: restoredButtonSeat?.pos ?? 'BTN',
            stackByPlayerId: restoredZoneState.bankroll,
            startingStack: STARTING_STACK,
          });

          setProgress(restoredProgress);
          setZoneTrainingById(restoredZoneTraining);
          setZoneIndex(restoredZoneIndex);
          setLobbyZone(restoredLobbyZone);
          setSeats(restoredSeats);
          setButtonSeatId(restoredButtonSeatId);
          setSelectedSeatId(restoredSelectedSeatId);
          setBattleSeatId(restoredBattleSeatId);
          setPoliteMode(!!snapshot.politeMode);
          setAiVoiceAssistEnabled(snapshot.aiVoiceAssistEnabled !== false);
          setAutoPlayEvents(snapshot.autoPlayEvents !== false);
          setSfxEnabled(snapshot.sfxEnabled !== false);
          setTrainingMode(normalizeTrainingMode(snapshot.trainingMode));
          setPhase('lobby');
          setAnalysisOpen(false);
          setOpsOpen(false);
          setMissionOpen(false);
          setLeakGuess(null);
          setSeatVisual(buildSeatVisualMap(restoredSeats));
          setEventQueue([]);
          setTableFeed([]);
          setActionFeed([]);
          setDisplayedBoardCount(0);
          setEventSeed(1);
          setHand(restoredHand);
          setRaiseAmount(restoredHand.toCall + restoredHand.minRaise);
          setNote(`已載入本地資料：${profile.displayName}，歷史保存 ${savedHands} 手牌。`);
        } else {
          setZoneTrainingById((prev) => mergeZoneTrainingWithRecordedStats(restoreZoneTrainingById(prev), recordedZoneStats));
          setNote('本地資料庫已啟用，之後會自動保存籌碼、統計與牌局紀錄。');
        }
      } catch (err) {
        if (!active) {
          return;
        }
        console.warn('Local DB bootstrap failed', err);
        setNote('本地資料庫初始化失敗，暫以本次會話資料運行。');
      } finally {
        if (active) {
          setLocalDbReady(true);
        }
      }
    }

    void bootstrapLocalPersistence();
    return () => {
      active = false;
      if (snapshotSaveTimerRef.current) {
        clearTimeout(snapshotSaveTimerRef.current);
        snapshotSaveTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!localDbReady || !activeProfile) {
      return;
    }
    if (snapshotSaveTimerRef.current) {
      clearTimeout(snapshotSaveTimerRef.current);
      snapshotSaveTimerRef.current = null;
    }

    const snapshot: PersistedAppSnapshot = {
      schemaVersion: APP_SNAPSHOT_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      zoneIndex,
      lobbyZone,
      progress: cloneProgressState(progress),
      zoneTrainingById,
      seats: serializeSeatsForSnapshot(seats),
      buttonSeatId,
      selectedSeatId,
      battleSeatId,
      politeMode,
      aiVoiceAssistEnabled,
      autoPlayEvents,
      sfxEnabled,
      trainingMode,
    };

    snapshotSaveTimerRef.current = setTimeout(() => {
      void saveProfileSnapshot(activeProfile.id, snapshot).catch((err) => {
        console.warn('Local snapshot save failed', err);
      });
    }, 260);

    return () => {
      if (snapshotSaveTimerRef.current) {
        clearTimeout(snapshotSaveTimerRef.current);
        snapshotSaveTimerRef.current = null;
      }
    };
  }, [
    activeProfile,
    aiVoiceAssistEnabled,
    autoPlayEvents,
    battleSeatId,
    buttonSeatId,
    localDbReady,
    lobbyZone,
    politeMode,
    progress,
    seats,
    selectedSeatId,
    sfxEnabled,
    trainingMode,
    zoneIndex,
    zoneTrainingById,
  ]);

  useEffect(() => {
    if (hand.focusVillainId && seats.some((s) => s.id === hand.focusVillainId && s.role === 'ai')) {
      setBattleSeatId(hand.focusVillainId);
    }
  }, [hand.focusVillainId, seats]);

  useEffect(() => {
    if (phase !== 'table' || trainingMode === 'practice' || !hand.isOver || currentHeroStack > 0 || bankruptcyPromptOpen) {
      return;
    }
    setAnalysisOpen(false);
    setOpsOpen(false);
    setMissionOpen(false);
    setEventQueue([]);
    const resultLine = hand.resultText || '本手結束，Hero 籌碼歸零。';
    const lastActions = hand.history.slice(-4).map((entry) => entry.text).filter((entry) => !!entry);
    const detailLine = lastActions.length > 0 ? `最後動作：${lastActions.join(' ｜ ')}` : '';
    setBankruptcyPromptText(detailLine ? `${resultLine}\n${detailLine}` : resultLine);
    setBankruptcyPromptOpen(true);
    const countdownSeconds = Math.max(1, Math.ceil(BANKRUPTCY_RETURN_DELAY_MS / 1000));
    setBankruptcyCountdown(countdownSeconds);
    clearBankruptcyTimers();
    bankruptcyReturnTimerRef.current = setTimeout(() => {
      returnToLobbyAfterBankruptcy();
    }, BANKRUPTCY_RETURN_DELAY_MS);
    bankruptcyCountdownTimerRef.current = setInterval(() => {
      setBankruptcyCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => {
      clearBankruptcyTimers();
    };
  }, [clearBankruptcyTimers, currentHeroStack, hand.history, hand.isOver, hand.resultText, phase, returnToLobbyAfterBankruptcy, trainingMode]);

  useEffect(() => {
    if (phase === 'table') {
      return;
    }
    clearBankruptcyTimers();
    if (bankruptcyPromptOpen) {
      setBankruptcyPromptOpen(false);
    }
    if (bankruptcyCountdown !== 0) {
      setBankruptcyCountdown(0);
    }
  }, [bankruptcyCountdown, bankruptcyPromptOpen, clearBankruptcyTimers, phase]);

  useEffect(() => {
    if (!analysisOpen) {
      drawerTranslateX.setValue(analysisDrawerHiddenX);
    }
  }, [analysisDrawerHiddenX, analysisOpen, drawerTranslateX]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(drawerTranslateX, {
        toValue: analysisOpen ? 0 : analysisDrawerHiddenX,
        duration: analysisOpen ? 230 : 190,
        easing: analysisOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(drawerBackdropOpacity, {
        toValue: analysisOpen ? 1 : 0,
        duration: analysisOpen ? 230 : 190,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  }, [analysisDrawerHiddenX, analysisOpen, drawerBackdropOpacity, drawerTranslateX]);

  useEffect(() => {
    if (!opsOpen) {
      opsTranslateX.setValue(opsPanelHiddenX);
    }
  }, [opsOpen, opsPanelHiddenX, opsTranslateX]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opsTranslateX, {
        toValue: opsOpen ? 0 : opsPanelHiddenX,
        duration: opsOpen ? 230 : 190,
        easing: opsOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opsBackdropOpacity, {
        toValue: opsOpen ? 1 : 0,
        duration: opsOpen ? 230 : 190,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opsOpen, opsPanelHiddenX, opsBackdropOpacity, opsTranslateX]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(missionTranslateX, {
        toValue: missionOpen ? 0 : 760,
        duration: missionOpen ? 230 : 190,
        easing: missionOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(missionBackdropOpacity, {
        toValue: missionOpen ? 1 : 0,
        duration: missionOpen ? 230 : 190,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  }, [missionOpen, missionBackdropOpacity, missionTranslateX]);

  useEffect(() => {
    let active = true;
    const emptyMap = createEmptySfxMap();

    async function loadSounds() {
      const loadedMap = createEmptySfxMap();
      const loadedSounds: Audio.Sound[] = [];
      try {
        setSfxReady(false);
        setSfxLoadError(false);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const keys = Object.keys(SFX_VARIANTS) as SfxKey[];
        for (const key of keys) {
          const sounds = await Promise.all(
            SFX_VARIANTS[key].map((variant) => Audio.Sound.createAsync(variant.asset, { volume: variant.volume })),
          );
          loadedMap[key] = sounds.map((item) => item.sound);
          loadedSounds.push(...loadedMap[key]);
        }
        if (!active) {
          await Promise.all(loadedSounds.map((sound) => sound.unloadAsync().catch(() => undefined)));
          return;
        }
        soundsRef.current = loadedMap;
        setSfxReady(true);
      } catch (err) {
        await Promise.all(loadedSounds.map((sound) => sound.unloadAsync().catch(() => undefined)));
        setSfxLoadError(true);
        setSfxReady(false);
        console.warn('SFX init failed', err);
      }
    }

    void loadSounds();
    return () => {
      active = false;
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      if (bankruptcyReturnTimerRef.current) {
        clearTimeout(bankruptcyReturnTimerRef.current);
        bankruptcyReturnTimerRef.current = null;
      }
      if (bankruptcyCountdownTimerRef.current) {
        clearInterval(bankruptcyCountdownTimerRef.current);
        bankruptcyCountdownTimerRef.current = null;
      }
      setSfxReady(false);
      const current = soundsRef.current;
      soundsRef.current = emptyMap;
      Object.values(current).flat().forEach((sound) => {
        void sound.unloadAsync();
      });
    };
  }, []);

  useEffect(() => {
    if (aiVoiceAssistEnabled) {
      return;
    }
    aiCoachSpotRef.current = '';
    if (aiCoachAbortRef.current) {
      aiCoachAbortRef.current.abort();
      aiCoachAbortRef.current = null;
    }
    setAiVoiceBusy(false);
    void Speech.stop().catch(() => undefined);
  }, [aiVoiceAssistEnabled]);

  useEffect(() => () => {
    if (aiCoachAbortRef.current) {
      aiCoachAbortRef.current.abort();
      aiCoachAbortRef.current = null;
    }
    void Speech.stop().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!aiVoiceAssistEnabled || !isHeroTurn) {
      return;
    }
    if (aiCoachSpotRef.current === heroTurnSpotKey) {
      return;
    }
    aiCoachSpotRef.current = heroTurnSpotKey;
    if (aiCoachAbortRef.current) {
      aiCoachAbortRef.current.abort();
      aiCoachAbortRef.current = null;
    }

    const abortController = new AbortController();
    aiCoachAbortRef.current = abortController;
    setAiVoiceBusy(true);

    const currentSpotInsight = analysisOpen ? spotInsight : buildSpotInsight(hand, 900);
    const coachInput = {
      hand,
      analysis,
      spotInsight: currentSpotInsight,
      recentActionLines,
    };

    void requestQwenCoachAdvice(coachInput, abortController.signal)
      .then((result) => {
        if (abortController.signal.aborted) {
          return;
        }
        const spokenText = result.text || buildLocalCoachSummary(coachInput);
        setAiVoiceLastAdvice(spokenText);
        setNote(
          result.source === 'qwen'
            ? `AI 語音建議：${spokenText}`
            : `AI 語音建議（本地回退）：${spokenText}`,
        );
        void Speech.stop().catch(() => undefined);
        Speech.speak(spokenText, {
          language: 'zh-TW',
          rate: 0.95,
          pitch: 1.0,
        });
      })
      .catch((err) => {
        if (abortController.signal.aborted) {
          return;
        }
        console.warn('AI voice coach failed', err);
        const fallbackText = buildLocalCoachSummary(coachInput);
        setAiVoiceLastAdvice(fallbackText);
        setNote(`AI 語音建議（本地回退）：${fallbackText}`);
        void Speech.stop().catch(() => undefined);
        Speech.speak(fallbackText, {
          language: 'zh-TW',
          rate: 0.95,
          pitch: 1.0,
        });
      })
      .finally(() => {
        if (aiCoachAbortRef.current === abortController) {
          aiCoachAbortRef.current = null;
        }
        if (!abortController.signal.aborted) {
          setAiVoiceBusy(false);
        }
      });

    return () => {
      abortController.abort();
      if (aiCoachAbortRef.current === abortController) {
        aiCoachAbortRef.current = null;
      }
    };
  }, [
    aiVoiceAssistEnabled,
    isHeroTurn,
    heroTurnSpotKey,
    analysisOpen,
    spotInsight,
    hand,
    analysis,
    recentActionLines,
  ]);

  const engineLabel =
    analysis.gto.source === 'preflop_cfr'
      ? '本地 Preflop HU-CFR'
      : analysis.gto.source === 'postflop_cfr'
        ? '本地 Postflop 抽象 CFR'
        : '啟發式';

  function enqueueTableEvents(events: TableEvent[]) {
    if (events.length === 0) return;
    setEventQueue((prev) => [...prev, ...events]);
  }

  function playSfx(kind: SfxKey) {
    if (!sfxEnabled || !sfxReady) return;
    const pool = soundsRef.current[kind];
    if (!pool || pool.length === 0) return;
    const sound = pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
    void sound.replayAsync().catch((err) => {
      console.warn(`SFX play failed: ${kind}`, err);
    });
  }

  function seatById(id: string, list: Seat[] = seats): Seat | undefined {
    return list.find((s) => s.id === id);
  }

  function nextButtonSeatId(list: Seat[], current: string): string {
    const occupiedIds = seatLayout
      .map((anchor) => anchor.id)
      .filter((seatId) => list.some((seat) => seat.id === seatId && seat.role !== 'empty'));
    if (occupiedIds.length === 0) {
      return current;
    }

    const occupiedSet = new Set(occupiedIds);
    const currentInOccupied = occupiedSet.has(current);
    const currentIdx = seatLayout.findIndex((anchor) => anchor.id === current);
    if (currentInOccupied) {
      const idx = occupiedIds.indexOf(current);
      return occupiedIds[(idx + 1) % occupiedIds.length];
    }

    if (currentIdx === -1) {
      return occupiedIds[0];
    }

    for (let step = 1; step <= seatLayout.length; step += 1) {
      const candidate = seatLayout[(currentIdx + step) % seatLayout.length]?.id;
      if (candidate && occupiedSet.has(candidate)) {
        return candidate;
      }
    }

    return occupiedIds[0];
  }

  function buildTableConfig(list: Seat[]) {
    return list
      .filter((seat) => seat.role !== 'empty')
      .map((seat) => ({
        id: seat.id,
        position: seat.pos,
        role: seat.role === 'hero' ? 'hero' as const : 'ai' as const,
        ai: seat.ai,
        name: seat.role === 'hero' ? 'Hero' : seat.ai?.name ?? 'AI',
      }));
  }

  function dealOrderFromSmallBlind(smallBlind: TablePosition, players: typeof hand.players): TablePosition[] {
    // Dealing should follow strict clockwise order from SB and include everyone
    // who was actually dealt cards this hand, even if they folded before UI replay.
    const dealtPositions = tableOrder.filter((pos) => {
      const player = players.find((p) => p.position === pos);
      if (!player) return false;
      return player.inHand;
    });

    if (dealtPositions.length === 0) {
      return [];
    }

    const sbIdx = dealtPositions.indexOf(smallBlind);
    const startIdx = sbIdx === -1 ? 0 : sbIdx;
    const order: TablePosition[] = [];
    for (let i = 0; i < dealtPositions.length; i += 1) {
      order.push(dealtPositions[(startIdx + i) % dealtPositions.length]);
    }
    return order;
  }

  function buildHandOpeningEvents(nextSeats: Seat[], nextHand: typeof hand): TableEvent[] {
    let seed = eventSeed;
    const events: TableEvent[] = [];
    const push = (event: Omit<TableEvent, 'id'>) => {
      events.push({ id: nextEventId(seed), ...event });
      seed += 1;
    };

    const dealOrder = dealOrderFromSmallBlind(nextHand.smallBlindPosition, nextHand.players);
    for (let round = 0; round < 2; round += 1) {
      dealOrder.forEach((pos) => {
        const seat = nextSeats.find((s) => s.pos === pos && s.role !== 'empty');
        if (!seat || seat.role === 'empty') return;
        push({ kind: 'deal', seatId: seat.id, text: `發牌：${seatName(seat)} 收到第 ${round + 1} 張` });
      });
    }

    let trackedStreet: Street = 'preflop';
    nextHand.history.forEach((log) => {
      if (log.street !== trackedStreet) {
        const revealDelta = streetBoardCount(log.street) - streetBoardCount(trackedStreet);
        if (revealDelta > 0) {
          push({ kind: 'street', text: `進入 ${log.street.toUpperCase()}` });
          for (let i = 0; i < revealDelta; i += 1) {
            push({ kind: 'reveal', text: `發出 ${log.street.toUpperCase()} 公牌 ${i + 1}` });
          }
        }
        trackedStreet = log.street;
      }
      const kind: TableEventKind = log.forcedBlind ? 'blind' : 'action';
      push({
        kind,
        seatId: log.actorId,
        action: log.action,
        amount: log.amount,
        allIn: log.allIn,
        text: log.text,
      });
    });

    push({ kind: 'hint', text: nextHand.isOver ? nextHand.resultText : '輪到你行動。' });
    setEventSeed(seed);
    return events;
  }

  function buildTransitionEvents(prevHand: typeof hand, nextHand: typeof hand): TableEvent[] {
    let seed = eventSeed;
    const events: TableEvent[] = [];
    const push = (event: Omit<TableEvent, 'id'>) => {
      events.push({ id: nextEventId(seed), ...event });
      seed += 1;
    };

    const newLogs = nextHand.history.slice(prevHand.history.length);
    let trackedStreet = prevHand.street;
    newLogs.forEach((log) => {
      if (log.street !== trackedStreet) {
        const revealDelta = streetBoardCount(log.street) - streetBoardCount(trackedStreet);
        if (revealDelta > 0) {
          push({ kind: 'street', text: `進入 ${log.street.toUpperCase()}` });
          for (let i = 0; i < revealDelta; i += 1) {
            push({ kind: 'reveal', text: `發出 ${log.street.toUpperCase()} 公牌 ${i + 1}` });
          }
        }
        trackedStreet = log.street;
      }
      const kind: TableEventKind = log.forcedBlind ? 'blind' : 'action';
      push({
        kind,
        seatId: log.actorId ?? (log.actor === 'hero' ? HERO_SEAT : undefined),
        action: log.action,
        amount: log.amount,
        allIn: log.allIn,
        text: log.text,
      });
    });

    if (nextHand.isOver) {
      push({ kind: 'hint', text: nextHand.resultText || '本手結束' });
    }

    setEventSeed(seed);
    return events;
  }

  function animateSeatDeal(seatId: string) {
    setActiveSeatAnimId(seatId);
    seatPulse.setValue(0);
    Animated.sequence([
      Animated.timing(seatPulse, {
        toValue: 1,
        duration: 170,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(seatPulse, {
        toValue: 0,
        duration: 170,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveSeatAnimId((current) => (current === seatId ? null : current));
    });
  }

  function animateChipPush() {
    chipPulse.setValue(0);
    Animated.timing(chipPulse, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(chipPulse, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  }

  function applyTableEvent(event: TableEvent) {
    setTableFeed((prev) => [event.text, ...prev].slice(0, 18));
    if (event.kind === 'action' || event.kind === 'blind') {
      setActionFeed((prev) => [event.text, ...prev].slice(0, ACTION_FEED_LIMIT));
    }

    if (event.kind === 'street') {
      playSfx('reveal');
      return;
    }

    if (event.kind === 'reveal') {
      playSfx('reveal');
      setDisplayedBoardCount((count) => Math.min(hand.revealedBoardCount, count + 1));
      return;
    }

    if (event.kind === 'hint') {
      playSfx('ui');
      return;
    }

    if (!event.seatId) {
      return;
    }
    const seatId = event.seatId;

    setSeatVisual((prev) => {
      const target = prev[seatId];
      if (!target) return prev;
      const next = { ...prev };
      const updated = { ...target };
      if (event.kind === 'deal') {
        playSfx('deal');
        animateSeatDeal(seatId);
        updated.cardsDealt = Math.min(2, updated.cardsDealt + 1);
        updated.lastAction = '收牌';
      } else if (event.kind === 'blind') {
        playSfx('blind');
        if ((event.amount ?? 0) > 0) {
          animateChipPush();
        }
        updated.lastAction = `盲注 ${event.amount ?? ''}`.trim();
      } else if (event.kind === 'action') {
        const soundKey = actionSfxKey(event.action, event.amount, event.allIn, event.text);
        playSfx(soundKey);
        if (soundKey === 'call' || soundKey === 'raise' || soundKey === 'allIn' || soundKey === 'blind') {
          animateChipPush();
        }
        updated.lastAction = actionDisplayText(event.action, event.amount, event.allIn);
        if (event.action === 'fold') {
          updated.folded = true;
          updated.inHand = false;
        } else if (event.action === 'raise' || event.action === 'call' || event.action === 'check') {
          updated.inHand = true;
          updated.folded = false;
        }
      }
      next[seatId] = updated;
      return next;
    });
  }

  function runNextEvent() {
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    setEventQueue((prev) => {
      if (prev.length === 0) return prev;
      const [head, ...rest] = prev;
      applyTableEvent(head);
      return rest;
    });
  }

  useEffect(() => {
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    if (!autoPlayEvents || eventQueue.length === 0) return;
    autoPlayTimerRef.current = setTimeout(() => {
      runNextEvent();
    }, eventDelayMs(eventQueue[0]));
    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [autoPlayEvents, eventQueue]);

  function setRaiseAmountBySliderLocation(locationX: number) {
    if (!canRaise || raiseSliderWidth <= 0) {
      return;
    }
    const ratio = clamp(locationX / raiseSliderWidth, 0, 1);
    if (raiseRange <= 0) {
      setRaiseAmount(raiseCap);
      return;
    }
    const nextAmount = minRaise + Math.round(raiseRange * ratio);
    setRaiseAmount(clamp(nextAmount, minRaise, raiseCap));
  }

  function handleRaiseSliderLayout(event: LayoutChangeEvent) {
    setRaiseSliderWidth(event.nativeEvent.layout.width);
  }

  function handleRaiseSliderGesture(event: GestureResponderEvent) {
    setRaiseAmountBySliderLocation(event.nativeEvent.locationX);
  }

  function stackText(seat: Seat): string {
    if (seat.role === 'empty') return '--';
    const player = hand.players.find((p) => p.id === seat.id);
    if (player) {
      const stack = normalizeStackValue(player.stack);
      if (seat.role === 'ai' && hand.isOver && stack <= 0) {
        return '出局';
      }
      return `${stack}`;
    }
    const persistentStack = zoneBankroll[seat.id];
    if (typeof persistentStack === 'number') {
      if (seat.role === 'ai' && persistentStack <= 0) {
        return '出局';
      }
      return `${normalizeStackValue(persistentStack)}`;
    }
    if (seat.role === 'hero') return `${normalizeStackValue(hand.heroStack)}`;
    return `${STARTING_STACK}`;
  }

  function startHand(targetSeatId?: string, options?: { zoneStateOverride?: ZoneTrainingState; modeOverride?: TrainingMode }) {
    const mode = options?.modeOverride ?? trainingMode;
    const syncedZoneState = options?.zoneStateOverride ?? syncZoneTrainingState(zone, seats, zoneTrainingById[zone.id]);
    const bankroll = syncedZoneState.bankroll;
    const handBankroll = buildHandBankrollForMode(mode, seats, bankroll);
    if (mode === 'career' && (bankroll[HERO_SEAT] ?? STARTING_STACK) <= 0) {
      setNote('你在本區已無可用籌碼，請到燈泡抽屜點「重置本區 100bb」。');
      return;
    }

    const aiSeats = seats.filter((s): s is Seat & { role: 'ai' } => s.role === 'ai');
    if (aiSeats.length === 0) {
      setNote('請先新增一位 AI 再開局。');
      return;
    }

    const preferredSeatId = targetSeatId ?? battleSeatId ?? aiSeats[0]?.id;
    const preferredSeat = aiSeats.find((s) => s.id === preferredSeatId);
    const seat = mode === 'practice'
      ? (preferredSeat ?? aiSeats[0])
      : ((preferredSeat && (handBankroll[preferredSeat.id] ?? STARTING_STACK) > 0)
        ? preferredSeat
        : aiSeats.find((candidate) => (handBankroll[candidate.id] ?? STARTING_STACK) > 0));

    if (!seat) {
      setNote('所有 AI 都已出局，請新增 AI 或重置本區資金。');
      return;
    }
    if (!seat.ai) {
      setNote('請先新增或選擇一位 AI 當本手對手');
      return;
    }

    const switchedOpponent = !!preferredSeat && preferredSeat.id !== seat.id;
    const tableConfig = buildTableConfig(seats);
    const nextButtonId = nextButtonSeatId(seats, buttonSeatId);
    const buttonSeat = seatById(nextButtonId, seats);
    const fresh = createNewHand(zone, seat.ai, {
      tablePlayers: tableConfig,
      focusVillainId: seat.id,
      buttonPosition: buttonSeat?.pos ?? 'BTN',
      stackByPlayerId: handBankroll,
      startingStack: STARTING_STACK,
    });
    setZoneTrainingById((prev) => ({
      ...prev,
      [zone.id]: {
        ...syncedZoneState,
        bankroll: { ...bankroll },
      },
    }));
    setBattleSeatId(seat.id);
    setPendingReplacementSeatIds([]);
    setButtonSeatId(nextButtonId);
    setHand(fresh);
    setRaiseAmount(fresh.toCall + fresh.minRaise);
    setDisplayedBoardCount(0);
    setTableFeed([]);
    setActionFeed([]);
    const visual = buildSeatVisualMap(seats);
    setSeatVisual(visual);
    setEventQueue([]);
    enqueueTableEvents(buildHandOpeningEvents(seats, fresh));
    const actor = fresh.players.find((p) => p.id === fresh.actingPlayerId);
    const heroStack = handBankroll[HERO_SEAT] ?? STARTING_STACK;
    const switchHint = switchedOpponent ? `已切換對手為 ${seatName(seat)}。` : '';
    const modeHint = mode === 'practice'
      ? `練習模式（不消耗區域資金，XP ${Math.round(PRACTICE_XP_MULTIPLIER * 100)}%）`
      : `生涯模式（XP ${Math.round(careerXpMultiplier(syncedZoneState.aidUses) * 100)}%）`;
    setNote(
      `${switchHint}新手牌：${fresh.position.situationLabel}，按鈕 ${buttonSeat?.pos ?? 'BTN'}。資金 ${heroStack}（${Math.floor(heroStack / Math.max(1, fresh.bigBlind))}bb）。${modeHint}。${actor?.name === 'Hero' ? '輪到你行動。' : `目前行動：${actor?.name ?? '等待'}`}`,
    );
  }

  function enterTable(z: number) {
    if (z > unlockedIdx) {
      const zoneDef = trainingZones[z] ?? trainingZones[0];
      setNote(`目前只解鎖到 ${unlockedZoneName}。${zoneDef.name} 解鎖條件：${zoneUnlockHint(z, progress)}。`);
      return;
    }
    const zoneDef = trainingZones[z];
    const mode = trainingMode;
    const nextSeats = makeSeats(z);
    const syncedZoneState = syncZoneTrainingState(zoneDef, nextSeats, zoneTrainingById[zoneDef.id]);
    const bankroll = syncedZoneState.bankroll;
    const handBankroll = buildHandBankrollForMode(mode, nextSeats, bankroll);
    if (mode === 'career' && (bankroll[HERO_SEAT] ?? STARTING_STACK) <= 0) {
      setNote(`${zoneDef.name} 的 Hero 籌碼已歸零，請先重置本區 100bb。`);
      return;
    }
    const aiSeats = nextSeats.filter((s): s is Seat & { role: 'ai' } => s.role === 'ai');
    const firstAiSeat = mode === 'practice'
      ? aiSeats.find((s) => !!s.ai)
      : aiSeats.find((s) => !!s.ai && (handBankroll[s.id] ?? STARTING_STACK) > 0)
        ?? aiSeats.find((s) => !!s.ai);
    const firstAiId = firstAiSeat?.id ?? null;
    const firstAi = firstAiSeat?.ai ?? pickAi(z);
    const nextButtonId = nextSeats.some((seat) => seat.id === buttonSeatId && seat.role !== 'empty')
      ? buttonSeatId
      : (nextSeats.find((seat) => seat.role !== 'empty')?.id ?? HERO_SEAT);
    const buttonSeat = seatById(nextButtonId, nextSeats);
    const hasPlayableAi = mode === 'practice'
      ? aiSeats.some((s) => !!s.ai)
      : aiSeats.some((s) => !!s.ai && (handBankroll[s.id] ?? STARTING_STACK) > 0);

    setZoneIndex(z);
    setSeats(nextSeats);
    setButtonSeatId(nextButtonId);
    setSelectedSeatId(firstAiId ?? HERO_SEAT);
    setBattleSeatId(firstAiId);
    setPendingReplacementSeatIds([]);
    setLeakGuess(null);
    setZoneTrainingById((prev) => ({
      ...prev,
      [zoneDef.id]: {
        ...syncedZoneState,
        bankroll: { ...bankroll },
      },
    }));

    if (!hasPlayableAi) {
      setDisplayedBoardCount(0);
      setTableFeed([]);
      setActionFeed([]);
      setSeatVisual(buildSeatVisualMap(nextSeats));
      setEventQueue([]);
      setPhase('lobby');
      setNote(`無法進桌：${zoneDef.name} 目前沒有可對戰 AI，請重置本區資金或先補上 AI。`);
      return;
    }

    const fresh = createNewHand(zoneDef, firstAi, {
      tablePlayers: buildTableConfig(nextSeats),
      focusVillainId: firstAiId ?? undefined,
      buttonPosition: buttonSeat?.pos ?? 'BTN',
      stackByPlayerId: handBankroll,
      startingStack: STARTING_STACK,
    });
    setHand(fresh);
    setDisplayedBoardCount(0);
    setTableFeed([]);
    setActionFeed([]);
    const visual = buildSeatVisualMap(nextSeats);
    setSeatVisual(visual);
    setEventQueue([]);
    if (firstAiId) {
      enqueueTableEvents(buildHandOpeningEvents(nextSeats, fresh));
    }
    setPhase('table');
    const heroStack = handBankroll[HERO_SEAT] ?? STARTING_STACK;
    const heroBb = Math.floor(heroStack / Math.max(1, fresh.bigBlind));
    setNote(
      mode === 'practice'
        ? `已進入 ${zoneDef.name}：練習模式起手資金 ${heroStack}（${heroBb}bb），不消耗生涯資金。`
        : `已進入 ${zoneDef.name}：起手資金 ${heroStack}（${heroBb}bb），同區域資金會累積不重置。`,
    );
  }

  function addAiToSeats(seatIds: string[]): Array<{ seatId: string; ai: AiProfile; pos: TablePosition }> {
    const requested = new Set(seatIds);
    if (requested.size === 0) {
      return [];
    }

    const additions: Array<{ seatId: string; ai: AiProfile; pos: TablePosition }> = [];
    const nextSeats = seats.map((seat) => {
      if (!requested.has(seat.id) || seat.role !== 'empty') {
        return seat;
      }
      const ai = pickAi(zoneIndex);
      additions.push({ seatId: seat.id, ai, pos: seat.pos });
      return { ...seat, role: 'ai' as const, ai };
    });

    if (additions.length === 0) {
      return [];
    }

    const addedIds = new Set(additions.map((item) => item.seatId));
    setSeats(nextSeats);
    const syncedZoneState = syncZoneTrainingState(zone, nextSeats, zoneTrainingById[zone.id]);
    const bankroll = { ...syncedZoneState.bankroll };
    additions.forEach((item) => {
      bankroll[item.seatId] = STARTING_STACK;
    });
    setZoneTrainingById((prev) => ({
      ...prev,
      [zone.id]: {
        ...syncedZoneState,
        bankroll,
      },
    }));
    setSeatVisual((prev) => {
      const next = { ...prev };
      additions.forEach((item) => {
        next[item.seatId] = { cardsDealt: 0, inHand: true, folded: false, lastAction: '等待中' };
      });
      return next;
    });

    const firstAddedSeatId = additions[0]?.seatId;
    if (firstAddedSeatId) {
      setSelectedSeatId(firstAddedSeatId);
      setBattleSeatId(firstAddedSeatId);
    }
    setPendingReplacementSeatIds((prev) => prev.filter((id) => !addedIds.has(id)));
    return additions;
  }

  function addAiToSeat(seatId: string): boolean {
    const additions = addAiToSeats([seatId]);
    if (additions.length === 0) {
      return false;
    }
    const added = additions[0];
    setNote(`已在 ${added.pos} 新增 ${added.ai.name}。再次點同座位可移除。`);
    return true;
  }

  function addPendingReplacementPlayers(): void {
    const additions = addAiToSeats(pendingReplacementSeatIds);
    if (additions.length === 0) {
      setPendingReplacementSeatIds([]);
      setNote('目前沒有可補位的空座位。');
      return;
    }
    const seatPositions = additions.map((item) => item.pos).join('、');
    setPendingReplacementSeatIds([]);
    setNote(`已補進 ${additions.length} 位新玩家（${seatPositions}）。點「下一手」繼續。`);
  }

  function skipPendingReplacementPlayers(): void {
    setPendingReplacementSeatIds([]);
    setNote('已保留空位。之後可隨時點空位加入新玩家。');
  }

  function removeAiFromSeat(seatId: string): boolean {
    const targetSeat = seats.find((s) => s.id === seatId);
    if (!targetSeat || targetSeat.role !== 'ai') {
      return false;
    }

    const nextSeats = seats.map((seat) => (seat.id === seatId ? { ...seat, role: 'empty' as const, ai: undefined } : seat));
    setSeats(nextSeats);
    const syncedZoneState = syncZoneTrainingState(zone, nextSeats, zoneTrainingById[zone.id]);
    setZoneTrainingById((prev) => ({
      ...prev,
      [zone.id]: syncedZoneState,
    }));
    setSeatVisual((prev) => ({
      ...prev,
      [seatId]: { cardsDealt: 0, inHand: false, folded: true, lastAction: '點擊新增' },
    }));

    const nextAi = nextSeats.find((seat) => seat.role === 'ai');
    setSelectedSeatId(nextAi?.id ?? HERO_SEAT);
    if (battleSeatId === seatId) {
      setBattleSeatId(nextAi?.id ?? null);
    }
    setNote(`已移除 ${targetSeat.pos} 的 AI。`);
    return true;
  }

  function handleSeatTap(seat: Seat) {
    const wasSelected = selectedSeatId === seat.id;
    const wasBattleSeat = battleSeatId === seat.id;
    setSelectedSeatId(seat.id);

    if (seat.role === 'hero') {
      setNote('這是 Hero 座位。點空位可新增 AI，點已鎖定 AI 可移除。');
      return;
    }

    if (seat.role === 'empty') {
      if (!hand.isOver) {
        setNote('本手進行中，請先打完本手再新增 AI。');
        return;
      }
      setLeakGuess(null);
      void addAiToSeat(seat.id);
      return;
    }

    if (!wasSelected || !wasBattleSeat) {
      setBattleSeatId(seat.id);
      setNote(`已鎖定 ${seatName(seat)} 為本手對手。再次點同座位可移除。`);
      return;
    }

    if (!hand.isOver) {
      setNote('本手進行中，請先打完本手再移除 AI。');
      return;
    }

    setLeakGuess(null);
    void removeAiFromSeat(seat.id);
  }

  function resetZoneTrainingState() {
    const fresh = createZoneTrainingState(zone, seats);
    setZoneTrainingById((prev) => ({
      ...prev,
      [zone.id]: fresh,
    }));
    setNote(`已重置 ${zone.name}：所有在座玩家回到 ${STARTING_BB}bb 起手。`);
  }

  function applyCareerBankruptcyRescue(kind: 'subsidy' | 'loan') {
    const syncedZoneState = syncZoneTrainingState(zone, seats, zoneTrainingById[zone.id]);
    const today = localDateKey();
    if (kind === 'subsidy' && syncedZoneState.subsidyClaimDate === today) {
      setNote('本區今日補助已領取，請改用教練貸款或切換練習模式。');
      return;
    }

    const rescueBb = kind === 'subsidy' ? SUBSIDY_BB : LOAN_BB;
    const rescueChips = bbToChips(rescueBb);
    const heroStack = syncedZoneState.bankroll[HERO_SEAT] ?? 0;
    const nextZoneState: ZoneTrainingState = {
      ...syncedZoneState,
      bankroll: {
        ...syncedZoneState.bankroll,
        [HERO_SEAT]: normalizeStackValue(heroStack + rescueChips),
      },
      aidUses: syncedZoneState.aidUses + 1,
      subsidyClaimDate: kind === 'subsidy' ? today : syncedZoneState.subsidyClaimDate,
      loanDebt: kind === 'loan' ? syncedZoneState.loanDebt + rescueChips : syncedZoneState.loanDebt,
    };

    setZoneTrainingById((prev) => ({
      ...prev,
      [zone.id]: nextZoneState,
    }));

    closeBankruptcyOverlay();
    startHand(battleSeatId ?? selectedSeatId, { zoneStateOverride: nextZoneState, modeOverride: 'career' });
  }

  function continueInPracticeMode() {
    setTrainingMode('practice');
    closeBankruptcyOverlay();
    startHand(battleSeatId ?? selectedSeatId, { modeOverride: 'practice' });
  }

  function doAction(action: ActionType) {
    if (!seats.find((s) => s.id === battleSeatId && s.role === 'ai')) {
      setNote('先指定一位 AI 當本手對手');
      return;
    }
    if (heroAllIn) {
      setNote('你已全下，牌局會自動推演到攤牌。');
      return;
    }
    if (hand.actingPlayerId && hand.actingPlayerId !== HERO_SEAT) {
      const actor = hand.players.find((p) => p.id === hand.actingPlayerId);
      setNote(`目前行動權在 ${actor?.name ?? '其他玩家'}，等系統播放到你。`);
      return;
    }
    if (hasPendingEvent) {
      setNote('桌上動作仍在播放中，等到你時再決策。');
      return;
    }
    if (hand.isOver) {
      setNote('本手已結束，請開下一手');
      return;
    }
    const prevHand = hand;
    const res = applyHeroAction(hand, { action, raiseAmount }, politeMode);
    let missionRewardXp = 0;
    let missionCompleteText = '';
    let missionUnlockText = '';
    let seatUpdateText = '';
    let modeUpdateText = '';
    let missionUnlockTargetIdx: number | null = null;
    let recordedZoneState = syncZoneTrainingState(zone, seats, zoneTrainingById[zone.id]);
    const xpMultiplier = resolveXpMultiplier(trainingMode, recordedZoneState);
    if (res.hand.isOver) {
      const heroWon = res.hand.winner === 'hero';
      const heroTied = res.hand.winner === 'tie';
      let seatsAfterHand = seats;
      let nextZoneStateBase: ZoneTrainingState;

      if (trainingMode === 'career') {
        const handStartHeroStack = recordedZoneState.bankroll[HERO_SEAT] ?? 0;
        const bankrollAfter = extractBankrollFromHand(res.hand, seats, recordedZoneState.bankroll);
        let loanDebtAfter = recordedZoneState.loanDebt;
        if (loanDebtAfter > 0) {
          const heroAfter = bankrollAfter[HERO_SEAT] ?? 0;
          const handProfit = Math.max(0, heroAfter - handStartHeroStack);
          const repay = Math.min(loanDebtAfter, Math.floor(handProfit * LOAN_REPAY_RATE));
          if (repay > 0) {
            bankrollAfter[HERO_SEAT] = Math.max(0, heroAfter - repay);
            loanDebtAfter -= repay;
            seatUpdateText += `｜自動還款 ${chipsToBb(repay, Math.max(1, res.hand.bigBlind || BIG_BLIND_SIZE))}bb`;
            if (loanDebtAfter <= 0) {
              seatUpdateText += '（已清償）';
            }
          }
        }

        const bustedAiSeats = seats.filter(
          (seat): seat is Seat & { role: 'ai' } => seat.role === 'ai' && (bankrollAfter[seat.id] ?? STARTING_STACK) <= 0,
        );
        if (bustedAiSeats.length > 0) {
          const bustedIds = new Set(bustedAiSeats.map((seat) => seat.id));
          seatsAfterHand = seats.map((seat) => (
            bustedIds.has(seat.id)
              ? { ...seat, role: 'empty' as const, ai: undefined }
              : seat
          ));
          setSeats(seatsAfterHand);
          setSeatVisual((prev) => {
            const next = { ...prev };
            bustedAiSeats.forEach((seat) => {
              next[seat.id] = { cardsDealt: 0, inHand: false, folded: true, lastAction: '點擊新增' };
            });
            return next;
          });
          const nextAi = seatsAfterHand.find((seat) => seat.role === 'ai');
          if (bustedIds.has(selectedSeatId)) {
            setSelectedSeatId(nextAi?.id ?? HERO_SEAT);
          }
          if (battleSeatId && bustedIds.has(battleSeatId)) {
            setBattleSeatId(nextAi?.id ?? null);
          }
          setPendingReplacementSeatIds((prev) => Array.from(new Set([...prev, ...bustedAiSeats.map((seat) => seat.id)])));
          seatUpdateText += `｜${bustedAiSeats.map((seat) => seat.pos).join('、')} 籌碼歸零已離桌，請選擇是否補位。`;
        }

        const missionResolution = applyZoneMissionUpdates(recordedZoneState, res.hand, bankrollAfter);
        missionRewardXp = missionResolution.rewardXp;
        if (missionResolution.completedMissionTitles.length > 0) {
          missionCompleteText = `｜任務完成：${missionResolution.completedMissionTitles.join('、')}（+${missionRewardXp} XP）`;
        }
        nextZoneStateBase = {
          ...missionResolution.nextState,
          loanDebt: loanDebtAfter,
          heroStats: accumulateHeroStats(missionResolution.nextState.heroStats, res.hand),
          handsPlayed: missionResolution.nextState.handsPlayed + 1,
          handsWon: missionResolution.nextState.handsWon + (heroWon ? 1 : 0),
          handsTied: missionResolution.nextState.handsTied + (heroTied ? 1 : 0),
        };
      } else {
        modeUpdateText = '｜練習模式：不消耗資金、不推進任務。';
        nextZoneStateBase = {
          ...recordedZoneState,
          heroStats: accumulateHeroStats(recordedZoneState.heroStats, res.hand),
          handsPlayed: recordedZoneState.handsPlayed + 1,
          handsWon: recordedZoneState.handsWon + (heroWon ? 1 : 0),
          handsTied: recordedZoneState.handsTied + (heroTied ? 1 : 0),
        };
      }

      const nextZoneState = syncZoneTrainingState(zone, seatsAfterHand, nextZoneStateBase);
      if (trainingMode === 'career') {
        const zoneCompletedBefore = zoneMissionsCompleted(recordedZoneState);
        const zoneCompletedAfter = zoneMissionsCompleted(nextZoneState);
        if (zoneCompletedAfter && !zoneCompletedBefore && zoneIndex < trainingZones.length - 1) {
          missionUnlockTargetIdx = zoneIndex + 1;
          const unlockedZoneDef = trainingZones[missionUnlockTargetIdx];
          missionUnlockText = `｜區域通關：${unlockedZoneDef.name} 已解鎖`;
        }
      }
      setZoneTrainingById((prev) => ({
        ...prev,
        [zone.id]: nextZoneState,
      }));
      recordedZoneState = nextZoneState;
    }
    setHand(res.hand);
    const transitionEvents = buildTransitionEvents(prevHand, res.hand);
    if (transitionEvents.length > 0) {
      const [first, ...rest] = transitionEvents;
      applyTableEvent(first);
      enqueueTableEvents(rest);
    }
    const xpModeText = xpMultiplier < 0.999 ? `｜XP 係數 ${Math.round(xpMultiplier * 100)}%` : '';
    setNote(
      `${res.decisionBest ? `正確：${res.analysis.best.summary}` : `可優化：${res.analysis.best.summary}`}${missionCompleteText}${missionUnlockText}${seatUpdateText}${modeUpdateText}${xpModeText}`,
    );
    let nextProgress = applyDecisionResult(progress, res.decisionBest, res.leakTag);
    if (res.hand.isOver) nextProgress = applyHandResult(nextProgress, res.hand);
    if (missionRewardXp > 0) nextProgress = addXp(nextProgress, missionRewardXp);
    nextProgress = applyXpMultiplier(progress, nextProgress, xpMultiplier);
    if (missionUnlockTargetIdx !== null && missionUnlockTargetIdx > nextProgress.zoneIndex) {
      nextProgress = { ...nextProgress, zoneIndex: missionUnlockTargetIdx };
    }
    nextProgress = {
      ...nextProgress,
      zoneIndex: Math.max(nextProgress.zoneIndex, progress.zoneIndex, unlockedZoneByXp(nextProgress.xp)),
    };
    setProgress(nextProgress);

    if (res.hand.isOver && localDbReady && activeProfile) {
      void saveCompletedHandRecord({
        profileId: activeProfile.id,
        zoneId: zone.id,
        phase,
        hand: res.hand,
        bankrollSnapshot: recordedZoneState.bankroll,
        heroStatsSnapshot: recordedZoneState.heroStats,
        progressSnapshot: nextProgress,
      })
        .then(() => {
          setHandRecordCount((count) => count + 1);
        })
        .catch((err) => {
          console.warn('Save hand record failed', err);
        });
    }
  }

  function verifyLeak() {
    if (selectedSeat.role !== 'ai' || !selectedSeat.ai) {
      setNote('先選 AI 座位');
      return;
    }
    if (!leakGuess) {
      setNote('先選你判斷的漏洞');
      return;
    }
    const ok = selectedSeat.ai.leakProfile[leakGuess];
    const firstActual = oppLeakKeys.find((k) => selectedSeat.ai?.leakProfile[k]);
    const xpGain = Math.max(1, Math.round((ok ? 24 : 6) * activeXpFactor));
    if (ok) {
      setProgress((p) => addXp(p, xpGain));
      setNote(`判斷正確：${oppLeakLabels[leakGuess]}（+${xpGain} XP）`);
    } else {
      setProgress((p) => addXp(p, xpGain));
      setNote(`這次不準。提示：${firstActual ? oppLeakLabels[firstActual] : '此對手漏洞較少'}（+${xpGain} XP）`);
    }
  }

  if (phase === 'lobby') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <LinearGradient colors={['#03070f', '#081d32', '#06261a']} style={styles.bg}>
          <View style={[styles.lobbyScreen, compactLobby && styles.lobbyScreenCompact]}>
            <View pointerEvents="none" style={styles.lobbyAuraA} />
            <View pointerEvents="none" style={styles.lobbyAuraB} />

            {!compactLobby ? (
              <View style={styles.lobbyMarquee}>
                <Text style={styles.lobbyMarqueeText} numberOfLines={1}>
                  今日重點：用已解鎖房間穩定累積資金與任務 XP，再往高難度區推進。
                </Text>
              </View>
            ) : null}

            <LinearGradient colors={['rgba(16, 67, 89, 0.96)', 'rgba(10, 38, 56, 0.96)']} style={[styles.lobbyHeader, compactLobby && styles.lobbyHeaderCompact]}>
              <View style={styles.brandBlock}>
                <Text style={styles.brandText}>POKER GOD</Text>
                <Text style={[styles.h1, compactLobby && styles.h1Compact]}>德州撲克牌桌大廳</Text>
                <Text style={[styles.sub, compactLobby && styles.subCompact]} numberOfLines={1}>固定橫向佈局，直接點房間進場，不用下拉捲動。</Text>
              </View>
              <View style={styles.lobbyHeaderStats}>
                <View style={styles.lobbyHeaderStat}>
                  <Text style={styles.lobbyHeaderStatLabel}>XP</Text>
                  <Text style={styles.lobbyHeaderStatValue}>{progress.xp}</Text>
                </View>
                <View style={styles.lobbyHeaderStat}>
                  <Text style={styles.lobbyHeaderStatLabel}>已解鎖</Text>
                  <Text style={styles.lobbyHeaderStatValue}>{unlockedZoneName}</Text>
                </View>
                <View style={styles.lobbyHeaderStat}>
                  <Text style={styles.lobbyHeaderStatLabel}>對局</Text>
                  <Text style={styles.lobbyHeaderStatValue}>{lobbyZoneStats.handsPlayed}</Text>
                </View>
                <View style={styles.lobbyHeaderStat}>
                  <Text style={styles.lobbyHeaderStatLabel}>紀錄</Text>
                  <Text style={styles.lobbyHeaderStatValue}>{lobbyZoneRecord}</Text>
                </View>
                <View style={styles.lobbyHeaderStat}>
                  <Text style={styles.lobbyHeaderStatLabel}>勝率</Text>
                  <Text style={styles.lobbyHeaderStatValue}>{lobbyZoneWinRate}%</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={[styles.lobbyBody, compactLobby && styles.lobbyBodyCompact]}>
              <LinearGradient colors={['rgba(10, 35, 50, 0.96)', 'rgba(7, 23, 34, 0.96)']} style={styles.lobbyRoomsPanel}>
                <View style={styles.lobbyRoomsHead}>
                  <Text style={styles.lobbyRoomsTitle}>房間難度選擇</Text>
                  <Text style={styles.textMuted}>{trainingZones.length} 區房間</Text>
                </View>

                <View style={[styles.lobbyRoomGrid, compactLobby && styles.lobbyRoomGridCompact]}>
                  {trainingZones.map((z, i) => {
                    const locked = i > unlockedIdx;
                    const selected = i === lobbyZone;
                    const zoneState = syncZoneTrainingState(z, seats, zoneTrainingById[z.id]);
                    const zoneMissionDone = zoneState.missions.filter((missionItem) => missionItem.completed).length;
                    const zoneStack = zoneState.bankroll[HERO_SEAT] ?? STARTING_STACK;
                    const zoneBb = Math.floor(zoneStack / BIG_BLIND_SIZE);
                    const zoneLockHint = zoneUnlockHint(i, progress);
                    const tableCount = 2 + ((i + progress.handsPlayed) % 5);
                    const tableTraffic = 20 + (((i + 1) * 17 + progress.handsPlayed * 3 + progress.xp) % 61);
                    const zoneAvgSkill = Math.round(
                      z.aiPool.reduce((sum, ai) => sum + ai.skill, 0) / Math.max(1, z.aiPool.length),
                    );
                    const roomColors: [string, string] = locked
                      ? ['#1e2833', '#151d26']
                      : selected
                        ? ['#1a6654', '#12453e']
                        : i % 2 === 0
                          ? ['#15374c', '#102737']
                          : ['#1b3146', '#122334'];
                    return (
                      <TouchableOpacity
                        key={z.id}
                        style={[styles.lobbyRoomTouch, compactLobby && styles.lobbyRoomTouchCompact, locked && styles.lobbyRoomLocked]}
                        onPress={() => {
                          if (locked) {
                            setNote(`尚未解鎖 ${z.name}。條件：${zoneLockHint}。`);
                            return;
                          }
                          setLobbyZone(i);
                        }}
                      >
                        <LinearGradient colors={roomColors} style={[styles.lobbyRoomCard, compactLobby && styles.lobbyRoomCardCompact, selected && styles.lobbyRoomCardOn]}>
                          <View style={styles.lobbyRoomCardHead}>
                            <Text style={[styles.lobbyRoomTitle, compactLobby && styles.lobbyRoomTitleCompact]} numberOfLines={1}>{z.name}</Text>
                            <Text
                              style={[
                                styles.lobbyDoorChip,
                                locked ? styles.lobbyDoorChipLocked : selected ? styles.lobbyDoorChipLive : styles.lobbyDoorChipOpen,
                              ]}
                            >
                              {locked ? 'LOCK' : selected ? 'LIVE' : 'OPEN'}
                            </Text>
                          </View>
                          <Text style={[styles.lobbyRoomSub, compactLobby && styles.lobbyRoomSubCompact]} numberOfLines={1}>{z.subtitle}</Text>
                          <View style={styles.lobbyRoomMetaRow}>
                            <Text style={[styles.lobbyRoomMeta, compactLobby && styles.lobbyRoomMetaCompact]}>桌 {tableCount}</Text>
                            <Text style={[styles.lobbyRoomMeta, compactLobby && styles.lobbyRoomMetaCompact]}>在線 {tableTraffic}</Text>
                            <Text style={[styles.lobbyRoomMeta, compactLobby && styles.lobbyRoomMetaCompact]}>Skill {zoneAvgSkill}</Text>
                          </View>
                          <Text style={[styles.lobbyRoomTail, compactLobby && styles.lobbyRoomTailCompact, locked && styles.lobbyRoomTailLocked]} numberOfLines={1}>
                            {locked ? zoneLockHint : `資金 ${zoneBb}bb · 任務 ${zoneMissionDone}/${zoneState.missions.length}`}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </LinearGradient>

              <LinearGradient
                colors={['rgba(13, 54, 51, 0.98)', 'rgba(8, 26, 35, 0.98)']}
                style={[styles.lobbyControlPanel, compactLobby && styles.lobbyControlPanelCompact]}
              >
                <View style={[styles.lobbyControlContent, compactLobby && styles.lobbyControlContentCompact]}>
                  <View style={[styles.lobbyControlTop, compactLobby && styles.lobbyControlTopCompact]}>
                    <View style={[styles.lobbyControlTitleRow, compactLobby && styles.lobbyControlTitleRowCompact]}>
                      <View>
                        <Text style={[styles.lobbyControlTitle, compactLobby && styles.lobbyControlTitleCompact]}>{lobbyZoneDef.name}</Text>
                        <Text style={[styles.lobbyControlSub, compactLobby && styles.lobbyControlSubCompact]} numberOfLines={compactLobby ? 1 : 2}>
                          {lobbyZoneDef.subtitle}
                        </Text>
                      </View>
                      <Text style={[styles.lobbyDoorChip, lobbyZoneLocked ? styles.lobbyDoorChipLocked : styles.lobbyDoorChipLive]}>
                        {lobbyZoneLocked ? '待解鎖' : '可立即進場'}
                      </Text>
                    </View>

                    <View style={[styles.lobbyModeRow, compactLobby && styles.lobbyModeRowCompact]}>
                      <TouchableOpacity
                        style={[styles.lobbyModeBtn, compactLobby && styles.lobbyModeBtnCompact, trainingMode === 'career' && styles.lobbyModeBtnOn]}
                        onPress={() => setTrainingMode('career')}
                      >
                        <Text style={[styles.lobbyModeBtnText, compactLobby && styles.lobbyModeBtnTextCompact, trainingMode === 'career' && styles.lobbyModeBtnTextOn]}>
                          生涯模式
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.lobbyModeBtn, compactLobby && styles.lobbyModeBtnCompact, trainingMode === 'practice' && styles.lobbyModeBtnOn]}
                        onPress={() => setTrainingMode('practice')}
                      >
                        <Text style={[styles.lobbyModeBtnText, compactLobby && styles.lobbyModeBtnTextCompact, trainingMode === 'practice' && styles.lobbyModeBtnTextOn]}>
                          練習模式
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.lobbyModeHint, compactLobby && styles.lobbyModeHintCompact]} numberOfLines={1}>
                      {trainingMode === 'practice'
                        ? `練習模式：不限資金續打，任務停用，XP ${Math.round(PRACTICE_XP_MULTIPLIER * 100)}%。`
                        : `生涯模式：資金與任務生效，XP 係數 ${Math.round(zoneCareerXpFactor * 100)}%。`}
                    </Text>

                    <View style={[styles.lobbyFocusList, compactLobby && styles.lobbyFocusListCompact]}>
                      {lobbyZoneDef.recommendedFocus.slice(0, compactLobby ? 1 : 3).map((focus, idx) => (
                        <Text key={`${lobbyZoneDef.id}-focus-${focus}`} style={[styles.lobbyFocusLine, compactLobby && styles.lobbyFocusLineCompact]} numberOfLines={1}>
                          {idx + 1}. {focus}
                        </Text>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.lobbyControlMetaGrid, compactLobby && styles.lobbyControlMetaGridCompact]}>
                    <View style={[styles.lobbyControlMetaCard, compactLobby && styles.lobbyControlMetaCardCompact]}>
                      <Text style={[styles.lobbyControlMetaLabel, compactLobby && styles.lobbyControlMetaLabelCompact]}>區域資金</Text>
                      <Text style={[styles.lobbyControlMetaValue, compactLobby && styles.lobbyControlMetaValueCompact]}>{lobbyZoneBb}bb</Text>
                    </View>
                    <View style={[styles.lobbyControlMetaCard, compactLobby && styles.lobbyControlMetaCardCompact]}>
                      <Text style={[styles.lobbyControlMetaLabel, compactLobby && styles.lobbyControlMetaLabelCompact]}>資金累積</Text>
                      <Text style={[styles.lobbyControlMetaValue, compactLobby && styles.lobbyControlMetaValueCompact]}>{lobbyZoneProfitBb >= 0 ? '+' : ''}{lobbyZoneProfitBb}bb</Text>
                    </View>
                    <View style={[styles.lobbyControlMetaCard, compactLobby && styles.lobbyControlMetaCardCompact]}>
                      <Text style={[styles.lobbyControlMetaLabel, compactLobby && styles.lobbyControlMetaLabelCompact]}>任務進度</Text>
                      <Text style={[styles.lobbyControlMetaValue, compactLobby && styles.lobbyControlMetaValueCompact]}>{lobbyZoneMissionDone}/{lobbyZoneState.missions.length}</Text>
                    </View>
                    <View style={[styles.lobbyControlMetaCard, compactLobby && styles.lobbyControlMetaCardCompact]}>
                      <Text style={[styles.lobbyControlMetaLabel, compactLobby && styles.lobbyControlMetaLabelCompact]}>對手池</Text>
                      <Text style={[styles.lobbyControlMetaValue, compactLobby && styles.lobbyControlMetaValueCompact]} numberOfLines={1}>
                        Skill {lobbyAvgSkill} · {lobbyArchetypes}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.lobbyControlBottom, compactLobby && styles.lobbyControlBottomCompact]}>
                    <TouchableOpacity
                      style={[styles.primary, lobbyZoneLocked && styles.dim]}
                      disabled={lobbyZoneLocked}
                      onPress={() => enterTable(lobbyZone)}
                    >
                      <LinearGradient
                        colors={lobbyZoneLocked ? ['#305069', '#26445b'] : ['#2ad88f', '#1d8f67']}
                        style={[styles.primaryGrad, compactLobby && styles.primaryGradCompact]}
                      >
                        <Text style={[styles.primaryText, compactLobby && styles.primaryTextCompact]}>
                          {lobbyZoneLocked ? lobbyUnlockHint : `進入 ${lobbyZoneDef.name} 牌桌 · ${trainingMode === 'practice' ? '練習' : '生涯'}`}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    {!compactLobby ? (
                      <Text style={styles.lobbyControlNote} numberOfLines={2}>{note}</Text>
                    ) : null}
                  </View>
                </View>
              </LinearGradient>
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <LinearGradient colors={['#05070b', '#081b2d', '#062215']} style={styles.bg}>
        <View style={styles.tableScreen}>
          <View style={styles.topRow}>
            <View style={styles.brandBlockMini}>
              <Text style={styles.brandText}>POKER GOD</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {zone.name} · {battleSeat?.ai?.name ?? '尚未指定對手'} · {trainingMode === 'practice' ? '練習' : '生涯'}資金 {headerHeroStack}（{headerHeroBb}bb）
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {hand.position.situationLabel} · 盲注 {hand.smallBlind}/{hand.bigBlind} · 按鈕 {hand.buttonPosition} · XP {Math.round(activeXpFactor * 100)}%
              </Text>
            </View>
            <View style={styles.topActions}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  setAnalysisOpen(false);
                  setOpsOpen(false);
                  setMissionOpen(false);
                  setPhase('lobby');
                }}
              >
                <Text style={styles.iconBtnText}>選局</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  setAnalysisOpen(false);
                  setMissionOpen(false);
                  setOpsOpen((v) => !v);
                }}
              >
                <Text style={styles.iconEmoji}>📊</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  setOpsOpen(false);
                  setMissionOpen(false);
                  setAnalysisOpen((v) => !v);
                }}
              >
                <Text style={styles.iconEmoji}>💡</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  setOpsOpen(false);
                  setAnalysisOpen(false);
                  setMissionOpen((v) => !v);
                }}
              >
                <Text style={styles.iconEmoji}>📘</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  const next = !sfxEnabled;
                  setSfxEnabled(next);
                  if (next && sfxReady) {
                    const preview = soundsRef.current.ui[0];
                    if (preview) {
                      void preview.replayAsync().catch((err) => {
                        console.warn('SFX preview failed: ui', err);
                      });
                    }
                  }
                }}
              >
                <Text style={styles.iconBtnText}>
                  {sfxLoadError ? '音效錯誤' : sfxEnabled ? (sfxReady ? '音效開' : '音效載入') : '音效關'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  const next = !aiVoiceAssistEnabled;
                  setAiVoiceAssistEnabled(next);
                  if (!next) {
                    aiCoachSpotRef.current = '';
                    if (aiCoachAbortRef.current) {
                      aiCoachAbortRef.current.abort();
                      aiCoachAbortRef.current = null;
                    }
                    void Speech.stop().catch(() => undefined);
                    setAiVoiceBusy(false);
                    setNote('AI 輔助打牌語音已關閉。');
                  } else {
                    setNote('AI 輔助打牌語音已開啟，輪到你時會自動播報最佳建議。');
                  }
                }}
              >
                <Text style={styles.iconBtnText}>
                  {aiVoiceAssistEnabled ? (aiVoiceBusy ? 'AI語音中' : 'AI語音開') : 'AI語音關'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tableCore}>
            <View style={styles.tableShell}>
              <LinearGradient colors={['#392814', '#281d0f']} style={styles.tableRail}>
                <LinearGradient colors={['#11483d', '#0c3a33', '#0b302a']} style={styles.tableFelt}>
                  <View style={styles.feltGlowA} />
                  <View style={styles.feltGlowB} />

                  <View style={styles.centerBoardWrap}>
                    <Text style={styles.centerLabel}>POT {hand.pot}</Text>
                    <Text style={styles.centerSub}>
                      {hasPendingEvent
                        ? `動作回放中（剩 ${eventQueue.length}）`
                        : `Street ${hand.street.toUpperCase()} · To Call ${hand.toCall}`}
                    </Text>
                    <Text style={styles.centerSub}>{hand.position.preflopOrderHint}</Text>
                    <Text style={styles.centerSub}>
                      {hasPendingEvent
                        ? `播放：${tableFeed[0] ?? '等待事件'}`
                        : `Action: ${hand.players.find((p) => p.id === hand.actingPlayerId)?.name ?? '等待下一街'}`}
                    </Text>
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.chipPulse,
                        {
                          opacity: chipPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
                          transform: [
                            { scale: chipPulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.25] }) },
                            { translateY: chipPulse.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
                          ],
                        },
                      ]}
                    >
                      <Text style={styles.chipPulseText}>◎</Text>
                    </Animated.View>
                    <View style={styles.boardRow}>
                      {visibleBoard.map((c) => (
                        <CardView key={c.code} card={c} compact />
                      ))}
                      {Array.from({ length: holes }).map((_, i) => (
                        <CardView key={`hole-${i}`} hidden compact />
                      ))}
                    </View>
                  </View>

                  {seatLayout.map((layout) => {
                    const seat = seats.find((s) => s.id === layout.id);
                    if (!seat || seat.role === 'empty') return null;
                    const visual = seatVisual[seat.id];
                    const dealt = visual?.cardsDealt ?? 0;
                    if (dealt <= 0) return null;

                    const isHero = seat.role === 'hero';
                    const player = hand.players.find((p) => p.id === seat.id);
                    const reachedShowdown = !!player && player.inHand && !player.folded;
                    const showFace = isHero || (hand.isOver && reachedShowdown);
                    const sourceCards = player?.cards;
                    const isPulseSeat = activeSeatAnimId === seat.id;

                    return (
                      <Animated.View
                        key={`cards-${seat.id}`}
                        style={[
                          styles.seatCards,
                          styles.seatCardsOffset,
                          { left: layout.seatLeft, top: layout.seatTop },
                          isPulseSeat
                            ? {
                                transform: [{ scale: seatPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }],
                              }
                            : undefined,
                        ]}
                      >
                        {dealt >= 1 ? <CardView card={sourceCards?.[0]} hidden={!showFace} compact /> : null}
                        {dealt >= 2 ? <CardView card={sourceCards?.[1]} hidden={!showFace} compact /> : null}
                      </Animated.View>
                    );
                  })}

                  {seatLayout.map((layout) => {
                    const seat = seats.find((s) => s.id === layout.id);
                    if (!seat) return null;
                    const isSelected = seat.id === selectedSeatId;
                    const isBattle = seat.id === battleSeatId;
                    const visual = seatVisual[seat.id];
                    const displayPos = positionRelativeToButton(seat.pos, hand.buttonPosition);
                    const isButton = displayPos === 'BTN';

                    return (
                      <TouchableOpacity
                        key={layout.id}
                        onPress={() => handleSeatTap(seat)}
                        style={[
                          styles.seatBadge,
                          { left: layout.seatLeft, top: layout.seatTop },
                          isSelected && styles.seatBadgeOn,
                          isBattle && styles.seatBadgeBattle,
                          seat.role === 'empty' && styles.seatBadgeEmpty,
                          visual?.folded && styles.seatBadgeFolded,
                        ]}
                      >
                        <View style={styles.avatarDot} />
                        <Text style={styles.seatPos}>{displayPos}{isButton ? ' (D)' : ''}</Text>
                        <Text style={styles.seatName}>{shortName(seatName(seat))}</Text>
                        <Text style={styles.seatStack}>{stackText(seat)}</Text>
                        <Text style={styles.seatActionText}>{visual?.lastAction ?? '等待'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </LinearGradient>
              </LinearGradient>
            </View>

            <View style={styles.actionDock}>
              <View style={styles.actionDockTop}>
                <Text style={styles.text}>
                  {hasPendingEvent
                    ? autoPlayEvents
                      ? `桌上動作播放中（剩 ${eventQueue.length}）`
                      : `已暫停播放（剩 ${eventQueue.length}）`
                    : hand.isOver
                      ? hand.resultText
                      : canHeroActNow
                        ? '輪到你決策'
                        : '等待牌局推演'}
                </Text>
                <Text style={styles.textTiny} numberOfLines={2}>
                  {aiVoiceAssistEnabled
                    ? aiVoiceBusy
                      ? 'AI 語音助手分析中...'
                      : aiVoiceLastAdvice
                        ? `AI 語音助手：${aiVoiceLastAdvice}`
                        : 'AI 語音助手待命中（輪到你時自動播報）'
                    : 'AI 語音助手已關閉'}
                </Text>

                <View style={styles.actionSummaryCard}>
                  <Text style={styles.actionSummaryTitle}>最近動作</Text>
                  <ScrollView
                    style={styles.actionSummaryScroll}
                    contentContainerStyle={styles.actionSummaryScrollContent}
                    showsVerticalScrollIndicator
                    nestedScrollEnabled
                  >
                    {recentActionLines.length > 0 ? (
                      recentActionLines.map((line, i) => (
                        <Text key={`dock-action-${line}-${i}`} numberOfLines={1} style={styles.actionSummaryLine}>
                          {line}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.actionSummaryEmpty}>尚未有動作，等待開局。</Text>
                    )}
                  </ScrollView>
                </View>
              </View>

              <View style={styles.actionDockBottom}>
                {hand.isOver && pendingReplacementSeatIds.length > 0 ? (
                  <View style={styles.noteCard}>
                    <Text style={styles.textTiny}>有 {pendingReplacementSeatIds.length} 位 AI 籌碼歸零離桌，要補進新玩家嗎？</Text>
                    <View style={styles.row3}>
                      <TouchableOpacity style={styles.secondary} onPress={addPendingReplacementPlayers}>
                        <Text style={styles.secondaryText}>補進新玩家</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.secondary} onPress={skipPendingReplacementPlayers}>
                        <Text style={styles.secondaryText}>先不要</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                <View style={styles.row3}>
                  <TouchableOpacity style={styles.secondary} onPress={() => setAutoPlayEvents((v) => !v)}>
                    <Text style={styles.secondaryText}>{autoPlayEvents ? '暫停播牌' : '播放牌局'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.secondary, (!hasPendingEvent || autoPlayEvents) && styles.dim]} disabled={!hasPendingEvent || autoPlayEvents} onPress={runNextEvent}>
                    <Text style={styles.secondaryText}>{hasPendingEvent ? `單步 ${eventQueue.length}` : '單步'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondary} onPress={() => startHand(battleSeatId ?? selectedSeatId)}>
                    <Text style={styles.secondaryText}>{hand.isOver ? '下一手' : '重新開局'}</Text>
                  </TouchableOpacity>
                </View>

                {!hand.isOver ? (
                  <>
                    <View style={styles.raiseRow}>
                      <Text style={styles.raiseValue}>加注額 {isAllInRaise ? 'All-in' : raiseAmount}</Text>
                      <View
                        style={[styles.raiseSliderTrack, (!canRaise || !canHeroActNow) && styles.raiseSliderTrackDisabled]}
                        onLayout={handleRaiseSliderLayout}
                        onStartShouldSetResponder={() => canRaise && canHeroActNow}
                        onMoveShouldSetResponder={() => canRaise && canHeroActNow}
                        onResponderGrant={handleRaiseSliderGesture}
                        onResponderMove={handleRaiseSliderGesture}
                      >
                        <LinearGradient
                          colors={isAllInRaise ? ['#b16a1a', '#d6a344'] : ['#1d6687', '#3ca2c9']}
                          start={{ x: 0, y: 0.5 }}
                          end={{ x: 1, y: 0.5 }}
                          style={[styles.raiseSliderFill, { width: raiseSliderPercent }]}
                        />
                        <View style={[styles.raiseSliderThumb, { left: raiseSliderPercent }, isAllInRaise && styles.raiseSliderThumbAllIn]} />
                      </View>
                      <View style={styles.raiseMetaRow}>
                        <Text style={styles.raiseMetaText}>最小 {minRaise}</Text>
                        <Text style={[styles.raiseMetaText, isAllInRaise && styles.raiseMetaTextHot]}>All-in {raiseCap}</Text>
                      </View>
                    </View>

                    <View style={styles.row3}>
                      <TouchableOpacity style={[styles.actionDanger, !canHeroActNow && styles.dim]} disabled={!canHeroActNow} onPress={() => doAction('fold')}>
                        <Text style={styles.actionText}>棄牌</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionMain, !canHeroActNow && styles.dim]} disabled={!canHeroActNow} onPress={() => doAction(callOrCheck)}>
                        <Text style={styles.actionText}>{callOrCheck === 'call' ? `跟注 ${hand.toCall}` : '過牌'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionGold, (!canRaise || !canHeroActNow) && styles.dim]} disabled={!canRaise || !canHeroActNow} onPress={() => doAction('raise')}>
                        <Text style={styles.actionText}>加注 {isAllInRaise ? 'All-in' : raiseAmount}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {bankruptcyPromptOpen ? (
          <View pointerEvents="auto" style={styles.bankruptcyOverlay}>
            <ScrollView style={styles.bankruptcyScroll} contentContainerStyle={styles.bankruptcyScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.bankruptcyCard}>
                <Text style={styles.bankruptcyTitle}>資金歸零</Text>
                <Text style={styles.bankruptcyText}>{bankruptcyPromptText}</Text>
                <Text style={styles.bankruptcyHint}>
                  生涯模式 XP 係數 {Math.round(zoneCareerXpFactor * 100)}% · 未償貸款 {zoneLoanDebtBb}bb
                </Text>
                <Text style={styles.bankruptcyCoachHint}>主要漏點：{leakLabels[topLeak]} · {mission(topLeak)}</Text>
                <View style={styles.bankruptcyActionRow}>
                  <TouchableOpacity
                    style={[styles.bankruptcyActionBtn, !canClaimSubsidyToday && styles.dim]}
                    disabled={!canClaimSubsidyToday}
                    onPress={() => applyCareerBankruptcyRescue('subsidy')}
                  >
                    <Text style={styles.bankruptcyActionTitle}>訓練補助 +{SUBSIDY_BB}bb</Text>
                    <Text style={styles.bankruptcyActionSub}>{canClaimSubsidyToday ? '每日一次（本區）' : '今日已領取'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.bankruptcyActionBtn}
                    onPress={() => applyCareerBankruptcyRescue('loan')}
                  >
                    <Text style={styles.bankruptcyActionTitle}>教練貸款 +{LOAN_BB}bb</Text>
                    <Text style={styles.bankruptcyActionSub}>後續盈利自動償還 {Math.round(LOAN_REPAY_RATE * 100)}%</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.bankruptcyActionRow}>
                  <TouchableOpacity style={styles.bankruptcyActionBtn} onPress={continueInPracticeMode}>
                    <Text style={styles.bankruptcyActionTitle}>切換練習模式續打</Text>
                    <Text style={styles.bankruptcyActionSub}>不消耗資金 · 任務停用 · XP {Math.round(PRACTICE_XP_MULTIPLIER * 100)}%</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.bankruptcyActionBtn} onPress={returnToLobbyAfterBankruptcy}>
                    <Text style={styles.bankruptcyActionTitle}>返回大廳</Text>
                    <Text style={styles.bankruptcyActionSub}>可切房間或重置本區資金</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.bankruptcyHint}>未操作將在 {bankruptcyCountdown} 秒後自動返回大廳</Text>
              </View>
            </ScrollView>
          </View>
        ) : null}

        <View pointerEvents={analysisOpen ? 'auto' : 'none'} style={styles.drawerRoot}>
          <Animated.View style={[styles.drawerBackdrop, { opacity: drawerBackdropOpacity }]}>
            <TouchableOpacity style={styles.drawerBackdropTouch} activeOpacity={1} onPress={() => setAnalysisOpen(false)} />
          </Animated.View>

          <Animated.View style={[styles.drawerPanel, { width: analysisDrawerWidth, maxWidth: analysisDrawerWidth }, { transform: [{ translateX: drawerTranslateX }] }]}>
            <View style={styles.drawerHeader}>
              <Text style={styles.text}>完整打法解說</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setAnalysisOpen(false)}>
                <Text style={styles.iconBtnText}>關閉</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator>
              <View style={styles.panelBlue}>
                <Text style={styles.text}>完整打法解說</Text>
                <Text style={styles.textMuted}>最佳局面：{analysis.bestMode === 'gto' ? 'GTO' : '剝削'} · 引擎 {engineLabel}</Text>
                <Text style={styles.textMuted}>目標漏洞：{analysis.targetLeak}</Text>
                <View style={styles.adviceCompareRow}>
                  <View style={styles.adviceCompareCol}>
                    <Advice title="GTO" advice={analysis.gto} />
                  </View>
                  <View style={styles.adviceCompareCol}>
                    <Advice title="剝削" advice={analysis.exploit} />
                  </View>
                </View>

                <View style={styles.insightGrid}>
                  <View style={styles.insightCardWide}>
                    <Text style={styles.text}>勝率估算（非 EV）</Text>
                    <Text style={styles.textMuted}>
                      Hero 勝率 {spotInsight.equity.heroWin}% · 平手 {spotInsight.equity.tie}% · 對手 {spotInsight.equity.villainWin}%
                    </Text>
                    <Text style={styles.textMuted}>
                      Pot Odds 需求 {spotInsight.potOddsNeed}% · 權益差值 (Equity - Pot Odds) {heroEquityEdge >= 0 ? '+' : ''}
                      {heroEquityEdge}%
                    </Text>
                    <Text style={styles.textTiny}>此區塊顯示的是權益估算，不能直接視為每手 bbEV。</Text>
                    <View style={styles.stackBarTrack}>
                      <View style={[styles.stackBarHero, { width: `${spotInsight.equity.heroWin}%` }]} />
                      <View style={[styles.stackBarTie, { width: `${spotInsight.equity.tie}%` }]} />
                      <View style={[styles.stackBarVillain, { width: `${Math.max(0, 100 - spotInsight.equity.heroWin - spotInsight.equity.tie)}%` }]} />
                    </View>
                    <View style={styles.stackLegendRow}>
                      <Text style={styles.stackLegendText}>Hero</Text>
                      <Text style={styles.stackLegendText}>Tie</Text>
                      <Text style={styles.stackLegendText}>Villain</Text>
                    </View>
                    <PercentMeter label="Hero Win" value={spotInsight.equity.heroWin} accent="#50c8f0" />
                    <PercentMeter label="可接受最低勝率 (Pot Odds)" value={spotInsight.potOddsNeed} accent="#d9ab4a" />
                  </View>

                  <View style={styles.insightCard}>
                    <Text style={styles.text}>Outs 組合</Text>
                    {spotInsight.outsCount > 0 ? (
                      <>
                        <Text style={styles.textMuted}>
                          總 outs {spotInsight.outsCount} 張 · 下一張命中 {spotInsight.oneCardHitRate}%
                          {hand.street === 'flop' ? ` · 到河牌約 ${spotInsight.twoCardHitRate}%` : ''}
                        </Text>
                        {spotInsight.outsGroups.map((group) => (
                          <View key={`outs-${group.label}`} style={styles.outsRow}>
                            <Text style={styles.outsRowTitle}>
                              {group.label} · {group.count} 張
                            </Text>
                            <Text style={styles.textTiny}>{group.cards.join(' ')}</Text>
                          </View>
                        ))}
                      </>
                    ) : (
                      <Text style={styles.textMuted}>目前街口沒有可直接統計的 outs（翻牌前或已到河牌）。</Text>
                    )}
                  </View>

                  <View style={styles.insightCard}>
                    <Text style={styles.text}>對手範圍估算</Text>
                    <Text style={styles.textMuted}>加權組合 {spotInsight.combosConsidered} 組</Text>
                    {spotInsight.rangeBuckets.map((bucket) => (
                      <PercentMeter
                        key={`range-${bucket.key}`}
                        label={`${bucket.label} · ${bucket.combos} 組`}
                        value={bucket.ratio}
                        accent={
                          bucket.key === 'value'
                            ? '#5eb2ff'
                            : bucket.key === 'made'
                              ? '#57d3b2'
                              : bucket.key === 'draw'
                                ? '#f0ba5d'
                                : '#8f9aaa'
                        }
                      />
                    ))}
                    <View style={styles.rangeSampleWrap}>
                      {spotInsight.rangeSamples.map((sample, idx) => (
                        <View key={`range-sample-${sample.text}-${idx}`} style={styles.rangeSamplePill}>
                          <Text style={styles.rangeSampleText}>{sample.text}</Text>
                          <Text style={styles.rangeSampleTextMuted}>{sample.ratio}%</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.algoBox}>
                  <Text style={styles.text}>當前背後算法</Text>
                  <Text style={styles.textTiny}>- GTO：Preflop 用本地 CFR 查表（20/40/100bb 插值）；Postflop 先命中第三方 river subgame override，未命中再回退本地 MCCFR 抽象查表。</Text>
                  <Text style={styles.textTiny}>- 剝削：依 AI 漏洞標籤（過度棄牌、過寬跟注等）做規則型 exploit 調整。</Text>
                  <Text style={styles.textTiny}>- 最佳局面：比較 GTO / 剝削信心分數，若可穩定放大 EV 才切剝削。</Text>
                  <Text style={styles.textTiny}>- 位置模型：UTG/LJ/HJ/CO/BTN/SB/BB；同牌力在 IP 與 OOP 會套不同門檻。</Text>
                  <Text style={styles.textTiny}>- AI API：可選用 Qwen3-Max（設定 EXPO_PUBLIC_QWEN_API_KEY）；未設定時自動回退本地建議。</Text>
                </View>
                {spotInsight.notes.map((line, idx) => (
                  <Text key={`insight-note-${idx}`} style={styles.textTiny}>
                    - {line}
                  </Text>
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        </View>

        <View pointerEvents={opsOpen ? 'auto' : 'none'} style={styles.drawerRoot}>
          <Animated.View style={[styles.drawerBackdrop, { opacity: opsBackdropOpacity }]}>
            <TouchableOpacity style={styles.drawerBackdropTouch} activeOpacity={1} onPress={() => setOpsOpen(false)} />
          </Animated.View>

          <Animated.View style={[styles.opsDrawerPanel, { transform: [{ translateX: opsTranslateX }] }]}>
            <View style={styles.drawerHeader}>
              <Text style={styles.text}>桌況概覽 · 桌位管理</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setOpsOpen(false)}>
                <Text style={styles.iconBtnText}>關閉</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.opsScrollContent} showsVerticalScrollIndicator>
              <LinearGradient colors={['#184d67', '#123848', '#102d3b']} style={styles.opsHeroCard}>
                <Text style={styles.opsHeroTitle}>桌況概覽</Text>
                <Text style={styles.opsHeroSub}>
                  {zone.name} · {battleSeat?.ai?.name ?? '尚未指定對手'} · 盲注 {hand.smallBlind}/{hand.bigBlind}
                </Text>
                <View style={styles.opsHeroGrid}>
                  <View style={styles.opsHeroItem}>
                    <Text style={styles.opsHeroLabel}>XP</Text>
                    <Text style={styles.opsHeroValue}>{progress.xp}</Text>
                  </View>
                  <View style={styles.opsHeroItem}>
                    <Text style={styles.opsHeroLabel}>勝率</Text>
                    <Text style={styles.opsHeroValue}>{winRate(progress)}%</Text>
                  </View>
                  <View style={styles.opsHeroItem}>
                    <Text style={styles.opsHeroLabel}>對局數</Text>
                    <Text style={styles.opsHeroValue}>{progress.handsPlayed}</Text>
                  </View>
                  <View style={styles.opsHeroItem}>
                    <Text style={styles.opsHeroLabel}>區域資金</Text>
                    <Text style={styles.opsHeroValue}>{zoneHeroBb}bb</Text>
                  </View>
                </View>
                <Text style={styles.textMuted}>
                  區域資金 {zoneHeroStack}（{zoneHeroBb}bb）· 累積 {zoneProfitBb >= 0 ? '+' : ''}{zoneProfitBb}bb · 紀錄 {handRecordCount}
                  {activeProfile ? ` · 帳號 ${activeProfile.displayName}` : ''}
                </Text>
                <Text style={styles.textMuted}>桌上語音：{hand.trashTalk}</Text>
                <Text style={styles.textTiny}>教練：{note}</Text>
                <Text style={styles.textTiny}>目前主要破綻：{leakLabels[topLeak]} · {mission(topLeak)}</Text>
              </LinearGradient>

              <View style={styles.opsGrid}>
                <View style={[styles.panelBlue, styles.opsGridCard]}>
                  <Text style={styles.text}>教練統計儀表</Text>
                  <Text style={styles.textMuted}>
                    本區樣本 {zoneHeroStats.hands} 手 · VPIP-PFR 差 {zoneVpipPfrGap >= 0 ? '+' : ''}
                    {zoneVpipPfrGap}%
                  </Text>
                  <View style={styles.coachStatsGrid}>
                    <CoachStatTile label="VPIP" statKey="vpip" stat={zoneHeroStats.vpip} />
                    <CoachStatTile label="PFR" statKey="pfr" stat={zoneHeroStats.pfr} />
                    <CoachStatTile label="Preflop 3Bet" statKey="threeBetPreflop" stat={zoneHeroStats.threeBetPreflop} />
                    <CoachStatTile label="Fold to 3Bet" statKey="foldToThreeBet" stat={zoneHeroStats.foldToThreeBet} />
                    <CoachStatTile label="Flop C-Bet" statKey="flopCBet" stat={zoneHeroStats.flopCBet} />
                    <CoachStatTile label="Fold vs Flop C-Bet" statKey="foldVsFlopCBet" stat={zoneHeroStats.foldVsFlopCBet} />
                    <CoachStatTile label="翻後再加注" statKey="postflopReraise" stat={zoneHeroStats.postflopReraise} />
                  </View>
                  <Text style={styles.textTiny}>- {zoneStatsCoachNote}</Text>
                </View>

                <View style={[styles.panel, styles.opsGridCard]}>
                  <Text style={styles.text}>桌位管理</Text>
                  <Text style={styles.textMuted}>
                    選中座位：{selectedSeatDisplayPos}
                    {selectedSeatDisplayPos === 'BTN' ? ' (D)' : ''} · {seatName(selectedSeat)}
                  </Text>
                  <Text style={styles.textTiny}>- 點空位：新增 AI。點 AI：先鎖定對手，再點同座位可移除。</Text>
                  <TouchableOpacity style={styles.secondary} onPress={() => startHand(selectedSeat.role === 'ai' ? selectedSeat.id : battleSeatId ?? undefined)}>
                    <Text style={styles.secondaryText}>對該座位開局</Text>
                  </TouchableOpacity>
                  {selectedSeat.role === 'ai' && selectedSeat.ai ? (
                    <>
                      <Text style={styles.textMuted}>風格：{selectedSeat.ai.styleLabel} · Skill {selectedSeat.ai.skill}</Text>
                      <Text style={styles.text}>漏洞識別（自行判斷）</Text>
                      <View style={styles.chips}>
                        {oppLeakKeys.map((k) => (
                          <TouchableOpacity key={k} style={[styles.chip, leakGuess === k && styles.chipOn]} onPress={() => setLeakGuess(k)}>
                            <Text style={styles.chipText}>{oppLeakLabels[k]}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TouchableOpacity style={styles.secondary} onPress={verifyLeak}><Text style={styles.secondaryText}>提交漏洞判斷</Text></TouchableOpacity>
                    </>
                  ) : (
                    <Text style={styles.textMuted}>選擇一個 AI 座位可做漏洞判斷練習。</Text>
                  )}
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        </View>

        <View pointerEvents={missionOpen ? 'auto' : 'none'} style={styles.drawerRoot}>
          <Animated.View style={[styles.drawerBackdrop, { opacity: missionBackdropOpacity }]}>
            <TouchableOpacity style={styles.drawerBackdropTouch} activeOpacity={1} onPress={() => setMissionOpen(false)} />
          </Animated.View>

          <Animated.View style={[styles.missionDrawerPanel, { transform: [{ translateX: missionTranslateX }] }]}>
            <View style={styles.drawerHeader}>
              <Text style={styles.text}>任務課程 · {zone.name}</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setMissionOpen(false)}>
                <Text style={styles.iconBtnText}>關閉</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator>
              <View style={styles.panelBlue}>
                <Text style={styles.text}>區域資金</Text>
                <Text style={styles.textMuted}>目前 {zoneHeroStack}（{zoneHeroBb}bb）</Text>
                <Text style={styles.textMuted}>相對起手 {zoneProfitBb >= 0 ? '+' : ''}{zoneProfitBb}bb</Text>
                <Text style={styles.textMuted}>任務完成 {completedMissionCount}/{zoneTrainingState.missions.length}</Text>
                <Text style={styles.textMuted}>
                  模式 {trainingMode === 'practice' ? '練習（任務停用）' : '生涯'} · XP {Math.round(activeXpFactor * 100)}%
                  {zoneLoanDebtBb > 0 ? ` · 貸款餘額 ${zoneLoanDebtBb}bb` : ''}
                </Text>
                <TouchableOpacity style={styles.missionResetBtn} onPress={resetZoneTrainingState}>
                  <Text style={styles.missionResetText}>重置本區 100bb</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.panel}>
                <Text style={styles.text}>當前任務列表</Text>
                {zoneTrainingState.missions.map((missionItem) => (
                  <View key={missionItem.id} style={[styles.missionCard, missionItem.completed && styles.missionCardDone]}>
                    <Text style={styles.missionTitle}>{missionItem.title}</Text>
                    <Text style={styles.textTiny}>{missionItem.detail}</Text>
                    <Text style={styles.textMuted}>
                      進度 {missionItem.progress}/{missionItem.target} · 獎勵 XP {missionItem.rewardXp}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#04070d' },
  bg: { flex: 1 },
  wrap: { padding: 14, paddingBottom: 28, gap: 10 },
  tableScreen: { flex: 1, padding: 10, gap: 8 },
  tableCore: { flex: 1, gap: 8, flexDirection: 'row', minHeight: 0 },

  brandBlock: { gap: 3, marginBottom: 4 },
  brandBlockMini: { gap: 2 },
  brandText: { color: '#6ff0b9', fontSize: 12, letterSpacing: 2, fontFamily: 'monospace' },
  h1: { fontSize: 26, fontWeight: '900', color: '#ecfff7', fontFamily: 'serif' },
  sub: { fontSize: 12, color: '#a8d6c7' },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  topActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 1, maxWidth: '58%' },
  iconBtn: {
    minWidth: 50,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2c5f6a',
    backgroundColor: '#112733',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  iconBtnText: { color: '#e1f5ff', fontSize: 12, fontWeight: '700' },
  iconEmoji: { fontSize: 18 },

  lobbyScreen: { flex: 1, position: 'relative', overflow: 'hidden', padding: 10, gap: 8 },
  lobbyScreenCompact: { padding: 8, gap: 6 },
  lobbyAuraA: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 999,
    backgroundColor: 'rgba(44, 187, 160, 0.14)',
    top: -140,
    left: -110,
  },
  lobbyAuraB: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 999,
    backgroundColor: 'rgba(38, 131, 196, 0.12)',
    bottom: -210,
    right: -140,
  },
  lobbyMarquee: {
    borderWidth: 1,
    borderColor: '#317b68',
    borderRadius: 10,
    backgroundColor: 'rgba(11, 48, 39, 0.80)',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  lobbyMarqueeText: { color: '#9af8d3', fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  lobbyHeader: {
    borderWidth: 1,
    borderColor: '#397990',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  lobbyHeaderCompact: { paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  h1Compact: { fontSize: 22 },
  subCompact: { fontSize: 11 },
  lobbyHeaderStats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6, flex: 1, maxWidth: '55%' },
  lobbyHeaderStat: {
    minWidth: 86,
    borderWidth: 1,
    borderColor: '#2a5f75',
    borderRadius: 9,
    backgroundColor: 'rgba(8, 29, 42, 0.82)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 1,
  },
  lobbyHeaderStatLabel: { color: '#9cc3d3', fontSize: 9, fontFamily: 'monospace' },
  lobbyHeaderStatValue: { color: '#f0fff9', fontSize: 13, fontWeight: '900' },
  lobbyBody: { flex: 1, minHeight: 0, flexDirection: 'row', gap: 8 },
  lobbyBodyCompact: { gap: 6 },
  lobbyRoomsPanel: {
    flex: 1.5,
    borderWidth: 1,
    borderColor: '#2d6178',
    borderRadius: 14,
    padding: 8,
    gap: 6,
    minHeight: 0,
  },
  lobbyRoomsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lobbyRoomsTitle: { color: '#e8fff8', fontSize: 15, fontWeight: '900', fontFamily: 'serif' },
  lobbyRoomGrid: { flex: 1, minHeight: 0, flexDirection: 'row', flexWrap: 'wrap', rowGap: 6, columnGap: 6, alignContent: 'space-between' },
  lobbyRoomGridCompact: { rowGap: 4, columnGap: 4 },
  lobbyRoomTouch: { width: '32.4%', height: '46.8%', minHeight: 0, borderRadius: 12 },
  lobbyRoomTouchCompact: { width: '32.4%', height: '45.2%' },
  lobbyRoomCard: { borderWidth: 1, borderColor: '#2f5f72', borderRadius: 12, paddingHorizontal: 7, paddingVertical: 6, gap: 4, flex: 1 },
  lobbyRoomCardCompact: { paddingHorizontal: 6, paddingVertical: 5, gap: 3 },
  lobbyRoomCardOn: {
    borderColor: '#79ffe0',
    shadowColor: '#5effd8',
    shadowOpacity: 0.32,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  lobbyRoomLocked: { opacity: 0.65 },
  lobbyRoomCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  lobbyRoomTitle: { color: '#f3fffc', fontWeight: '900', fontSize: 15, fontFamily: 'serif', flexShrink: 1 },
  lobbyRoomTitleCompact: { fontSize: 13 },
  lobbyRoomSub: { color: '#a8ccdb', fontSize: 9 },
  lobbyRoomSubCompact: { fontSize: 8 },
  lobbyDoorChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    color: '#cef6ea',
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '800',
  },
  lobbyDoorChipOpen: { borderColor: '#2f866d', backgroundColor: 'rgba(19, 82, 65, 0.72)' },
  lobbyDoorChipLive: { borderColor: '#72ffd8', backgroundColor: 'rgba(21, 112, 90, 0.86)', color: '#e8fff7' },
  lobbyDoorChipLocked: { borderColor: '#4a6279', backgroundColor: 'rgba(36, 52, 67, 0.84)', color: '#afc5d9' },
  lobbyRoomMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  lobbyRoomMeta: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2f5f70',
    backgroundColor: 'rgba(8, 26, 39, 0.82)',
    color: '#d7ecf7',
    fontFamily: 'monospace',
    fontSize: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  lobbyRoomMetaCompact: { fontSize: 7, paddingHorizontal: 4 },
  lobbyRoomTail: { color: '#91ebc7', fontSize: 9, fontWeight: '700' },
  lobbyRoomTailCompact: { fontSize: 8 },
  lobbyRoomTailLocked: { color: '#b5c9d8' },
  lobbyControlPanel: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2c6c6f',
    borderRadius: 14,
    padding: 10,
    gap: 8,
    minHeight: 0,
  },
  lobbyControlPanelCompact: { padding: 8, gap: 6 },
  lobbyControlContent: { flex: 1, minHeight: 0, gap: 8 },
  lobbyControlContentCompact: { gap: 5, justifyContent: 'space-between', paddingBottom: 8 },
  lobbyControlTop: { gap: 6 },
  lobbyControlTopCompact: { gap: 4, flexShrink: 1 },
  lobbyControlBottom: { gap: 6 },
  lobbyControlBottomCompact: { gap: 4, marginTop: 2, marginBottom: 6 },
  lobbyControlTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  lobbyControlTitleRowCompact: { gap: 6 },
  lobbyControlTitle: { color: '#f2fffa', fontSize: 20, fontWeight: '900', fontFamily: 'serif' },
  lobbyControlTitleCompact: { fontSize: 16 },
  lobbyControlSub: { color: '#b7d8cd', fontSize: 11, maxWidth: 250 },
  lobbyControlSubCompact: { fontSize: 10, maxWidth: 200 },
  lobbyModeRow: { flexDirection: 'row', gap: 8 },
  lobbyModeRowCompact: { gap: 6 },
  lobbyModeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#3e6674',
    borderRadius: 8,
    backgroundColor: 'rgba(10, 33, 45, 0.82)',
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lobbyModeBtnCompact: { paddingVertical: 5 },
  lobbyModeBtnOn: {
    borderColor: '#86ffe3',
    backgroundColor: 'rgba(18, 72, 59, 0.82)',
  },
  lobbyModeBtnText: { color: '#c5dce9', fontSize: 11, fontWeight: '800' },
  lobbyModeBtnTextCompact: { fontSize: 10 },
  lobbyModeBtnTextOn: { color: '#ebfff7' },
  lobbyModeHint: { color: '#b8d8ce', fontSize: 10, lineHeight: 14 },
  lobbyModeHintCompact: { fontSize: 9, lineHeight: 12 },
  lobbyFocusList: {
    borderWidth: 1,
    borderColor: '#35696b',
    borderRadius: 10,
    backgroundColor: 'rgba(9, 38, 34, 0.72)',
    paddingHorizontal: 9,
    paddingVertical: 7,
    gap: 4,
  },
  lobbyFocusListCompact: { paddingHorizontal: 7, paddingVertical: 4, gap: 2 },
  lobbyFocusLine: { color: '#d9f8e9', fontSize: 11 },
  lobbyFocusLineCompact: { fontSize: 10 },
  lobbyControlMetaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  lobbyControlMetaGridCompact: { gap: 4 },
  lobbyControlMetaCard: {
    width: '48.5%',
    borderWidth: 1,
    borderColor: '#345f70',
    borderRadius: 8,
    backgroundColor: 'rgba(9, 30, 43, 0.78)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  lobbyControlMetaCardCompact: { paddingHorizontal: 6, paddingVertical: 4, gap: 1 },
  lobbyControlMetaLabel: { color: '#9dbac8', fontSize: 9, fontFamily: 'monospace' },
  lobbyControlMetaLabelCompact: { fontSize: 8 },
  lobbyControlMetaValue: { color: '#f2fffb', fontSize: 12, fontWeight: '800' },
  lobbyControlMetaValueCompact: { fontSize: 10 },
  primaryGradCompact: { paddingVertical: 6 },
  primaryTextCompact: { fontSize: 10 },
  lobbyControlNote: { color: '#b8d8ce', fontSize: 10, lineHeight: 14 },

  tableShell: { borderRadius: 24, overflow: 'hidden', flex: 1, minHeight: 0, minWidth: 0 },
  tableRail: { borderRadius: 24, padding: 8, borderWidth: 1, borderColor: '#9a7441', flex: 1 },
  tableFelt: { position: 'relative', borderRadius: 20, overflow: 'hidden', flex: 1, minHeight: 0 },
  feltGlowA: { position: 'absolute', width: 250, height: 250, borderRadius: 999, backgroundColor: 'rgba(64, 185, 138, 0.10)', left: '18%', top: '16%' },
  feltGlowB: { position: 'absolute', width: 180, height: 180, borderRadius: 999, backgroundColor: 'rgba(122, 245, 194, 0.08)', right: '10%', bottom: '10%' },

  centerBoardWrap: {
    position: 'absolute',
    left: '23%',
    right: '23%',
    top: '30%',
    borderRadius: 16,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: 'rgba(8, 32, 29, 0.82)',
    borderWidth: 1,
    borderColor: '#2a6153',
    gap: 4,
    zIndex: 6,
  },
  centerLabel: { color: '#f6fffb', fontSize: 14, fontWeight: '900', fontFamily: 'monospace' },
  centerSub: { color: '#99d5c3', fontSize: 10, fontFamily: 'monospace' },
  chipPulse: { position: 'absolute', top: 10, right: 12 },
  chipPulseText: { color: '#f7d27d', fontSize: 16, fontWeight: '900' },
  boardRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },

  seatCards: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 4,
    zIndex: 30,
    elevation: 12,
  },
  seatCardsOffset: {
    marginLeft: 16,
    marginTop: 14,
  },
  seatBadge: {
    position: 'absolute',
    width: 86,
    marginLeft: -43,
    marginTop: -22,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#29554a',
    backgroundColor: 'rgba(8, 22, 22, 0.86)',
    alignItems: 'center',
    gap: 1,
    zIndex: 14,
  },
  seatBadgeOn: { borderColor: '#83ffe4' },
  seatBadgeBattle: { borderColor: '#f5d38a' },
  seatBadgeEmpty: { opacity: 0.44 },
  seatBadgeFolded: { opacity: 0.5 },
  avatarDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: '#57ffc8' },
  seatPos: { color: '#ffe6b3', fontSize: 9, fontWeight: '800', fontFamily: 'monospace' },
  seatName: { color: '#f1fffb', fontSize: 10, fontWeight: '800' },
  seatStack: { color: '#8fd9bd', fontSize: 9, fontFamily: 'monospace' },
  seatActionText: { color: '#9ecad8', fontSize: 9, fontFamily: 'monospace' },

  tableCard: {
    width: 38,
    height: 54,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#a0adbc',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tableCardCompact: {
    width: 30,
    height: 44,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a0adbc',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardBack: { borderColor: '#364f7c' },
  cardBackStripe: { position: 'absolute', top: 0, bottom: 0, width: 9, backgroundColor: 'rgba(118, 158, 238, 0.25)' },
  cardBackText: { color: '#d5e6ff', fontWeight: '900', fontSize: 12 },
  cardFaceText: { color: '#0f1825', fontWeight: '900', fontSize: 15, fontFamily: 'serif' },
  cardFaceRed: { color: '#a91c2f' },

  row3: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionDock: {
    width: '31%',
    minWidth: 240,
    maxWidth: 320,
    flexGrow: 0,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#245564',
    borderRadius: 12,
    backgroundColor: 'rgba(9, 29, 40, 0.88)',
    padding: 8,
    gap: 8,
    justifyContent: 'space-between',
  },
  actionDockTop: {
    flex: 1,
    minHeight: 0,
    gap: 8,
    overflow: 'hidden',
  },
  actionDockBottom: {
    gap: 8,
  },
  replacementPrompt: {
    borderWidth: 1,
    borderColor: '#3c6776',
    borderRadius: 9,
    backgroundColor: 'rgba(10, 39, 52, 0.76)',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 6,
  },
  actionSummaryCard: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: '#316374',
    borderRadius: 10,
    backgroundColor: 'rgba(10, 38, 52, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 4,
    overflow: 'hidden',
  },
  actionSummaryScroll: {
    flex: 1,
    minHeight: 0,
  },
  actionSummaryScrollContent: {
    gap: 4,
    paddingBottom: 2,
  },
  actionSummaryTitle: {
    color: '#d7f4ff',
    fontSize: 11,
    fontWeight: '800',
  },
  actionSummaryLine: {
    color: '#b9dcec',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  actionSummaryEmpty: {
    color: '#83b3c6',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  panel: {
    borderWidth: 1,
    borderColor: '#245564',
    borderRadius: 12,
    backgroundColor: 'rgba(9, 29, 40, 0.88)',
    padding: 10,
    gap: 6,
  },
  panelBlue: {
    borderWidth: 1,
    borderColor: '#447086',
    borderRadius: 12,
    backgroundColor: 'rgba(14, 39, 52, 0.95)',
    padding: 10,
    gap: 6,
  },
  opsScrollContent: { gap: 12, paddingBottom: 16, paddingTop: 10 },
  opsHeroCard: {
    borderWidth: 1,
    borderColor: '#4f7f95',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  opsHeroTitle: { color: '#f0fbff', fontSize: 22, fontWeight: '900' },
  opsHeroSub: { color: '#bde4f2', fontSize: 12, fontWeight: '700' },
  opsHeroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opsHeroItem: {
    minWidth: 130,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#5b8596',
    borderRadius: 10,
    backgroundColor: 'rgba(8, 30, 43, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  opsHeroLabel: { color: '#a8d0de', fontSize: 10, fontWeight: '700' },
  opsHeroValue: { color: '#ebfcff', fontSize: 18, fontWeight: '900', fontFamily: 'monospace' },
  opsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' },
  opsGridCard: { flexBasis: 520, flexGrow: 1, minWidth: 320 },
  coachStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  coachStatTile: {
    flexBasis: 200,
    flexGrow: 1,
    minWidth: 178,
    borderWidth: 1,
    borderColor: '#4e7384',
    borderRadius: 8,
    backgroundColor: '#173847',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 5,
  },
  coachStatHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coachStatRate: {
    color: '#e7f7ff',
    fontSize: 12,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  coachStatMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  coachStatCount: {
    color: '#9fc3d3',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  coachStatRange: {
    color: '#9fc3d3',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  coachStatBenchmark: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  coachStatBenchmarkPending: { color: '#a2b2bc' },
  coachStatBenchmarkInRange: { color: '#8fe0bf' },
  coachStatBenchmarkHigh: { color: '#f3bb86' },
  coachStatBenchmarkLow: { color: '#88b5ff' },
  coachStatTier: {
    fontSize: 10,
    fontWeight: '800',
  },
  coachStatTierLow: { color: '#b7c2c9' },
  coachStatTierMid: { color: '#e3d08e' },
  coachStatTierHigh: { color: '#8fe0bf' },
  missionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  missionResetBtn: {
    borderWidth: 1,
    borderColor: '#4f7f92',
    borderRadius: 8,
    backgroundColor: '#194153',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  missionResetText: { color: '#e1f5ff', fontSize: 10, fontWeight: '700' },
  missionCard: {
    borderWidth: 1,
    borderColor: '#4d6f7f',
    borderRadius: 8,
    backgroundColor: '#15303d',
    padding: 8,
    gap: 3,
  },
  missionCardDone: {
    borderColor: '#4fae8a',
    backgroundColor: '#183c34',
  },
  missionTitle: { color: '#eef8ff', fontWeight: '900', fontSize: 12 },
  bankruptcyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(3, 8, 14, 0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    zIndex: 40,
  },
  bankruptcyScroll: { width: '100%' },
  bankruptcyScrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  bankruptcyCard: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '94%',
    borderWidth: 1,
    borderColor: '#925e40',
    borderRadius: 14,
    backgroundColor: 'rgba(31, 17, 12, 0.97)',
    padding: 14,
    gap: 8,
  },
  bankruptcyTitle: { color: '#ffe3c7', fontSize: 19, fontWeight: '900' },
  bankruptcyText: { color: '#fff2e1', fontSize: 12, lineHeight: 18 },
  bankruptcyHint: { color: '#f2c899', fontSize: 11, fontWeight: '700' },
  bankruptcyCoachHint: { color: '#f3d7b5', fontSize: 11, lineHeight: 16 },
  bankruptcyActionRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch', flexWrap: 'wrap' },
  bankruptcyActionBtn: {
    flex: 1,
    minWidth: 220,
    borderWidth: 1,
    borderColor: '#7f5a45',
    borderRadius: 9,
    backgroundColor: 'rgba(49, 26, 17, 0.9)',
    paddingHorizontal: 9,
    paddingVertical: 8,
    gap: 2,
  },
  bankruptcyActionTitle: { color: '#fff0df', fontSize: 11, fontWeight: '900' },
  bankruptcyActionSub: { color: '#f1caa2', fontSize: 10, fontWeight: '700' },
  drawerRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4, 8, 14, 0.6)',
  },
  drawerBackdropTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawerPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '76%',
    maxWidth: 1180,
    minWidth: 360,
    borderWidth: 1,
    borderColor: '#3f6675',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    backgroundColor: 'rgba(8, 22, 32, 0.98)',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 6,
  },
  opsDrawerPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    borderWidth: 1,
    borderColor: '#3a6272',
    backgroundColor: 'rgba(8, 22, 32, 0.99)',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
  },
  missionDrawerPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '33%',
    maxWidth: 460,
    minWidth: 300,
    borderWidth: 1,
    borderColor: '#4d6f7f',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    backgroundColor: 'rgba(8, 22, 32, 0.98)',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 6,
  },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drawerScroll: { flex: 1 },
  drawerScrollContent: { gap: 8, paddingBottom: 10, paddingTop: 8 },

  raiseRow: { gap: 6 },
  raiseValue: { color: '#d9f4ff', fontWeight: '800', fontFamily: 'monospace', fontSize: 12 },
  raiseSliderTrack: {
    height: 30,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4f7191',
    backgroundColor: '#112f42',
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
  },
  raiseSliderTrackDisabled: { opacity: 0.4 },
  raiseSliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  raiseSliderThumb: {
    position: 'absolute',
    top: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#e9f7ff',
    backgroundColor: '#4fb2d6',
    transform: [{ translateX: -11 }],
  },
  raiseSliderThumbAllIn: {
    borderColor: '#ffe7b3',
    backgroundColor: '#d9ab4a',
  },
  raiseMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  raiseMetaText: { color: '#90b9cb', fontSize: 11, fontWeight: '700' },
  raiseMetaTextHot: { color: '#ffdca1' },
  nextEventBtn: {
    borderWidth: 1,
    borderColor: '#46a4cf',
    borderRadius: 9,
    backgroundColor: '#184a62',
    paddingVertical: 7,
    alignItems: 'center',
  },
  nextEventBtnText: { color: '#e7f7ff', fontWeight: '800', fontSize: 11 },

  actionDanger: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#974f57',
    backgroundColor: '#4e1f28',
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionMain: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#47a3d3',
    backgroundColor: '#164966',
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionGold: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c89a42',
    backgroundColor: '#624716',
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionText: { color: '#fff8e9', fontWeight: '900', fontSize: 12 },

  secondary: {
    flex: 1,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#336878',
    backgroundColor: '#123241',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: '#ddf4ff', fontWeight: '700', fontSize: 11, textAlign: 'center', paddingHorizontal: 4 },
  primary: { borderRadius: 10, overflow: 'hidden' },
  primaryGrad: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10 },
  primaryText: { color: '#ecfff8', fontSize: 12, fontWeight: '900', textAlign: 'center', paddingHorizontal: 6 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#2f6a79',
    borderRadius: 999,
    backgroundColor: '#143846',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipOn: { borderColor: '#f8d78f', backgroundColor: '#4c3a1f' },
  chipText: { color: '#d7efff', fontSize: 11, fontWeight: '700' },

  adviceCompareRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' },
  adviceCompareCol: { flex: 1, minWidth: 280 },
  adviceBox: { borderWidth: 1, borderColor: '#48748a', borderRadius: 8, backgroundColor: '#163a4a', padding: 8, gap: 3 },
  adviceTitle: { color: '#eef8ff', fontWeight: '900' },
  adviceMain: { color: '#d8efff', fontWeight: '800', fontSize: 12 },
  algoBox: { borderWidth: 1, borderColor: '#4d6f7f', borderRadius: 8, backgroundColor: '#15303d', padding: 8, gap: 2 },
  insightGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  insightCardWide: {
    flexBasis: 620,
    flexGrow: 1,
    minWidth: 320,
    borderWidth: 1,
    borderColor: '#4c7281',
    borderRadius: 10,
    backgroundColor: '#143340',
    padding: 8,
    gap: 6,
  },
  insightCard: {
    flexBasis: 320,
    flexGrow: 1,
    minWidth: 280,
    borderWidth: 1,
    borderColor: '#4b6d7d',
    borderRadius: 10,
    backgroundColor: '#14303c',
    padding: 8,
    gap: 6,
  },
  stackBarTrack: {
    height: 14,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#385362',
    backgroundColor: '#102532',
  },
  stackBarHero: { height: '100%', backgroundColor: '#50c8f0' },
  stackBarTie: { height: '100%', backgroundColor: '#e6c879' },
  stackBarVillain: { height: '100%', backgroundColor: '#7a879b' },
  stackLegendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stackLegendText: { color: '#b6d0db', fontSize: 10, fontWeight: '700' },
  meterRow: { gap: 4 },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meterTrack: {
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#36505f',
    overflow: 'hidden',
    backgroundColor: '#0f2430',
  },
  meterFill: { height: '100%' },
  outsRow: {
    borderWidth: 1,
    borderColor: '#416173',
    borderRadius: 8,
    backgroundColor: '#173746',
    paddingHorizontal: 7,
    paddingVertical: 6,
    gap: 2,
  },
  outsRowTitle: { color: '#e2f5ff', fontSize: 11, fontWeight: '800' },
  rangeSampleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  rangeSamplePill: {
    borderWidth: 1,
    borderColor: '#4f7384',
    borderRadius: 999,
    backgroundColor: '#193847',
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    gap: 5,
  },
  rangeSampleText: { color: '#d9efff', fontSize: 11, fontWeight: '700' },
  rangeSampleTextMuted: { color: '#9dc3d4', fontSize: 10, fontWeight: '700' },

  noteCard: { borderWidth: 1, borderColor: '#3c6d55', borderRadius: 10, backgroundColor: 'rgba(18, 45, 32, 0.84)', padding: 10, gap: 3 },

  text: { color: '#eefcf6', fontWeight: '800' },
  textMuted: { color: '#c8e3ee', fontSize: 12 },
  textTiny: { color: '#c6dff1', fontSize: 11 },
  dim: { opacity: 0.45 },
});

