import { Platform } from 'react-native';

import { trainingZones } from '../../../data/zones';
import { createEmptyHeroStats, statRatePercent } from '../../../engine/heroStats';
import type { HeroStatsSnapshot, RatioStat } from '../../../engine/heroStats';
import { initialProgress } from '../../../engine/progression';
import type { ActionType, AiProfile, HandState, HeroLeak, ProgressState, Street, TrainingZone } from '../../../types/poker';

import {
  BIG_BLIND_SIZE,
  CAREER_XP_RESCUE_MIN_MULTIPLIER,
  CAREER_XP_RESCUE_PENALTY_STEP,
  HERO_SEAT,
  PRACTICE_XP_MULTIPLIER,
  STARTING_STACK,
  findAiById,
  seatLayout,
  tableOrder,
} from './constants';
import { l, t, zoneName } from './i18n';
import type {
  AppLanguage,
  CoachBenchmarkRange,
  CoachBenchmarkVerdictTone,
  CoachMission,
  CoachMissionKind,
  HandMissionSignals,
  MissionResolution,
  PersistedSeat,
  Seat,
  SeatVisual,
  SfxKey,
  TableEvent,
  TrainingMode,
  WebEntryConfig,
  ZoneTrainingState,
} from './types';

export function coachMissionTemplates(zoneId: string): Array<Omit<CoachMission, 'progress' | 'completed' | 'rewarded'>> {
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

export function createCoachMissions(zoneId: string): CoachMission[] {
  return coachMissionTemplates(zoneId).map((template) => ({
    ...template,
    progress: 0,
    completed: false,
    rewarded: false,
  }));
}

export function normalizeStackValue(raw: number): number {
  return Math.max(0, Math.round(raw));
}

export function normalizeCounter(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return 0;
  }
  return Math.max(0, Math.round(raw));
}

export function normalizeDateKey(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export function normalizeTrainingMode(mode: TrainingMode | undefined): TrainingMode {
  return mode === 'practice' ? 'practice' : 'career';
}

export function normalizeAppLanguage(language: AppLanguage | string | undefined): AppLanguage {
  if (language === 'zh-CN' || language === 'en-US') {
    return language;
  }
  return 'zh-TW';
}

export function parseWebEntryLanguage(raw: string | null): AppLanguage | null {
  if (!raw) {
    return null;
  }
  const value = raw.trim();
  return value === 'zh-TW' || value === 'zh-CN' || value === 'en-US' ? value : null;
}

export function readWebEntryConfig(): WebEntryConfig {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { mode: 'default', embed: false, language: null };
  }

  const params = new URLSearchParams(window.location.search);
  const entryRaw = (params.get('entry') ?? '').trim().toLowerCase();
  const embedRaw = (params.get('embed') ?? '').trim().toLowerCase();

  return {
    mode: entryRaw === 'practice' ? 'practice' : 'default',
    embed: embedRaw === '1' || embedRaw === 'true' || embedRaw === 'yes',
    language: parseWebEntryLanguage(params.get('lang')),
  };
}

export function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function bbToChips(bb: number): number {
  return Math.max(0, Math.round(bb * BIG_BLIND_SIZE));
}

export function chipsToBb(chips: number, bigBlind: number = BIG_BLIND_SIZE): number {
  return Math.floor(Math.max(0, chips) / Math.max(1, bigBlind));
}

export function careerXpMultiplier(aidUses: number): number {
  const adjusted = 1 - normalizeCounter(aidUses) * CAREER_XP_RESCUE_PENALTY_STEP;
  return Math.max(CAREER_XP_RESCUE_MIN_MULTIPLIER, Number(adjusted.toFixed(2)));
}

export function resolveXpMultiplier(mode: TrainingMode, zoneState: ZoneTrainingState): number {
  if (mode === 'practice') {
    return PRACTICE_XP_MULTIPLIER;
  }
  return careerXpMultiplier(zoneState.aidUses);
}

export function applyXpMultiplier(prev: ProgressState, next: ProgressState, multiplier: number): ProgressState {
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

export function normalizeBankrollForSeats(seats: Seat[], bankroll?: Record<string, number>): Record<string, number> {
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

export function createZoneTrainingState(zone: TrainingZone, seats: Seat[]): ZoneTrainingState {
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

export function syncZoneTrainingState(zone: TrainingZone, seats: Seat[], current?: ZoneTrainingState): ZoneTrainingState {
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

export type LobbyZoneStats = {
  handsPlayed: number;
  handsWon: number;
  handsTied: number;
};

export function winRateFromCounts(handsPlayed: number, handsWon: number): number {
  if (handsPlayed <= 0) {
    return 0;
  }
  return Math.round((handsWon / handsPlayed) * 100);
}

export function resolveLobbyZoneStats(zoneState: ZoneTrainingState): LobbyZoneStats {
  const handsPlayed = normalizeCounter(zoneState.handsPlayed);
  const handsWon = Math.min(handsPlayed, normalizeCounter(zoneState.handsWon));
  const handsTied = Math.min(Math.max(0, handsPlayed - handsWon), normalizeCounter(zoneState.handsTied));
  return {
    handsPlayed,
    handsWon,
    handsTied,
  };
}

export function extractBankrollFromHand(hand: HandState, seats: Seat[], fallback: Record<string, number>): Record<string, number> {
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

export function buildHandBankrollForMode(
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

export function cloneProgressState(progress: ProgressState): ProgressState {
  return {
    ...progress,
    leaks: { ...progress.leaks },
  };
}

export function normalizeProgressSnapshot(progress?: ProgressState): ProgressState {
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

export function normalizeZoneIndex(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  const rounded = Math.round(value);
  return Math.max(0, Math.min(trainingZones.length - 1, rounded));
}

export function restoreZoneTrainingById(snapshot?: Record<string, ZoneTrainingState>): Record<string, ZoneTrainingState> {
  return trainingZones.reduce<Record<string, ZoneTrainingState>>((acc, zone, idx) => {
    const defaultSeats = makeSeats(idx);
    acc[zone.id] = syncZoneTrainingState(zone, defaultSeats, snapshot?.[zone.id]);
    return acc;
  }, {});
}

export function mergeZoneTrainingWithRecordedStats(
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

export function serializeSeatsForSnapshot(seats: Seat[]): PersistedSeat[] {
  return seats.map((seat) => ({
    id: seat.id,
    role: seat.role,
    aiId: seat.role === 'ai' ? seat.ai?.id : undefined,
  }));
}

export function restoreSeatsFromSnapshot(snapshotSeats: PersistedSeat[] | undefined, zoneIndex: number): Seat[] {
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

export function summarizeHandSignals(hand: HandState): HandMissionSignals {
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

export function missionIncrement(kind: CoachMissionKind, signals: HandMissionSignals): number {
  if (kind === 'steal_preflop') return signals.stealWin ? 1 : 0;
  if (kind === 'bluff_catch') return signals.bluffCatchWin ? 1 : 0;
  if (kind === 'triple_barrel') return signals.tripleBarrelWin ? 1 : 0;
  if (kind === 'win_hands') return signals.heroWon ? 1 : 0;
  return 0;
}

export function applyZoneMissionUpdates(zoneState: ZoneTrainingState, hand: HandState, bankrollAfter: Record<string, number>): MissionResolution {
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

export function nextEventId(seed: number): string {
  return `ev-${seed}-${Date.now()}`;
}

export function streetBoardCount(street: string): number {
  if (street === 'flop') return 3;
  if (street === 'turn') return 4;
  if (street === 'river') return 5;
  return 0;
}

export function eventDelayMs(event: TableEvent): number {
  if (event.kind === 'deal') return 260;
  if (event.kind === 'blind') return 320;
  if (event.kind === 'action') return event.action === 'fold' ? 300 : 360;
  if (event.kind === 'street') return 360;
  if (event.kind === 'reveal') return 420;
  return 260;
}

export function buildSeatVisualMap(seats: Seat[], language: AppLanguage = 'zh-TW'): Record<string, SeatVisual> {
  const result: Record<string, SeatVisual> = {};
  seats.forEach((seat) => {
    result[seat.id] = {
      cardsDealt: 0,
      inHand: seat.role !== 'empty',
      folded: seat.role === 'empty',
      lastAction: seat.role === 'empty'
        ? l(language, '點擊新增', '点击新增', 'Tap to add')
        : l(language, '等待中', '等待中', 'Waiting'),
    };
  });
  return result;
}

export const initialSeatsForApp = makeSeats(0);
export const initialZoneTrainingState = createZoneTrainingState(trainingZones[0], initialSeatsForApp);

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function pickAi(zoneIndex: number): AiProfile {
  const pool = trainingZones[zoneIndex].aiPool;
  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
}

export function makeSeats(zoneIndex: number): Seat[] {
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

export function restoreSeatsFromRecordedHand(handState: HandState, fallbackZoneIndex: number): Seat[] {
  const seats: Seat[] = seatLayout.map((anchor) => ({
    id: anchor.id,
    pos: anchor.pos,
    role: 'empty',
  }));

  handState.players.forEach((player) => {
    const seatIdxById = seats.findIndex((seat) => seat.id === player.id);
    const seatIdx = seatIdxById !== -1 ? seatIdxById : seats.findIndex((seat) => seat.pos === player.position);
    if (seatIdx === -1) {
      return;
    }
    if (player.role === 'hero') {
      seats[seatIdx] = {
        id: seats[seatIdx].id,
        pos: seats[seatIdx].pos,
        role: 'hero',
      };
      return;
    }
    seats[seatIdx] = {
      id: seats[seatIdx].id,
      pos: seats[seatIdx].pos,
      role: 'ai',
      ai: player.ai ?? pickAi(fallbackZoneIndex),
    };
  });

  if (!seats.some((seat) => seat.role === 'hero')) {
    const heroSeatIdx = seats.findIndex((seat) => seat.id === HERO_SEAT);
    if (heroSeatIdx !== -1) {
      seats[heroSeatIdx] = {
        id: seats[heroSeatIdx].id,
        pos: seats[heroSeatIdx].pos,
        role: 'hero',
      };
    }
  }

  return seats;
}

export function seatName(seat: Seat, language: AppLanguage = 'zh-TW'): string {
  if (seat.role === 'hero') return 'Hero';
  if (seat.role === 'ai') return seat.ai?.name ?? 'AI';
  return l(language, '空位', '空位', 'Empty');
}

export function unlockedZoneByXp(xp: number): number {
  let idx = 0;
  for (let i = 0; i < trainingZones.length; i += 1) if (xp >= trainingZones[i].unlockXp) idx = i;
  return idx;
}

export function zoneMissionsCompleted(zoneState?: ZoneTrainingState): boolean {
  if (!zoneState || zoneState.missions.length === 0) {
    return false;
  }
  return zoneState.missions.every((missionItem) => missionItem.completed);
}

export function unlockedZoneByCompletedMissions(zoneTrainingById: Record<string, ZoneTrainingState>): number {
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

export function unlockedZone(progress: ProgressState, zoneTrainingById: Record<string, ZoneTrainingState>): number {
  return Math.max(progress.zoneIndex, unlockedZoneByXp(progress.xp), unlockedZoneByCompletedMissions(zoneTrainingById));
}

export function zoneUnlockHint(zoneIdx: number, progress: ProgressState, language: AppLanguage = 'zh-TW'): string {
  const zoneDef = trainingZones[zoneIdx] ?? trainingZones[0];
  const needXp = Math.max(0, zoneDef.unlockXp - progress.xp);
  if (zoneIdx <= 0) {
    return t(language, 'zone_unlocked');
  }
  const prevZone = trainingZones[zoneIdx - 1] ?? trainingZones[0];
  return t(language, 'zone_unlock_hint', { zone: zoneName(prevZone, language), xp: needXp });
}

export function addXp(p: ProgressState, delta: number): ProgressState {
  const xp = p.xp + delta;
  return { ...p, xp, zoneIndex: Math.max(p.zoneIndex, unlockedZoneByXp(xp)) };
}

export function actionLabel(a: ActionType, language: AppLanguage = 'zh-TW'): string {
  if (a === 'fold') return l(language, '棄牌', '弃牌', 'Fold');
  if (a === 'check') return l(language, '過牌', '过牌', 'Check');
  if (a === 'call') return l(language, '跟注', '跟注', 'Call');
  return l(language, '加注', '加注', 'Raise');
}

export function actionDisplayText(
  action: ActionType | undefined,
  amount: number | undefined,
  allIn: boolean | undefined,
  language: AppLanguage = 'zh-TW',
): string {
  if (allIn) {
    return `All-in${(amount ?? 0) > 0 ? ` ${amount}` : ''}`;
  }
  const label = action ? actionLabel(action, language) : l(language, '行動', '行动', 'Action');
  if ((amount ?? 0) > 0 && action !== 'fold' && action !== 'check') {
    return `${label} ${amount}`;
  }
  return label;
}

export function actionSfxKey(action: ActionType | undefined, amount: number | undefined, allIn: boolean | undefined, text?: string): SfxKey {
  if (text && (/盲/.test(text) || /\bblind\b/i.test(text))) return 'blind';
  if (allIn) return 'allIn';
  if (action === 'raise') return 'raise';
  if (action === 'call') return 'call';
  if (action === 'check') return 'check';
  if (action === 'fold') return 'fold';
  return (amount ?? 0) > 0 ? 'call' : 'check';
}

export function createHeroTurnSpotKey(hand: HandState): string {
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

export function mission(leak: HeroLeak, language: AppLanguage = 'zh-TW'): string {
  if (leak === 'overFold') return l(language, '任務：多做符合賠率的防守跟注', '任务：多做符合赔率的防守跟注', 'Mission: defend more when pot odds are right');
  if (leak === 'overCall') return l(language, '任務：高壓下注前先算 pot odds', '任务：高压下注前先算 pot odds', 'Mission: calculate pot odds before calling pressure');
  if (leak === 'overBluff') return l(language, '任務：減少無效唬牌', '任务：减少无效唬牌', 'Mission: reduce low-EV bluffs');
  if (leak === 'missedValue') return l(language, '任務：中強牌多拿價值', '任务：中强牌多拿价值', 'Mission: extract more value with medium-strong hands');
  return l(language, '任務：找 3 個可主動施壓節點', '任务：找 3 个可主动施压节点', 'Mission: identify 3 proactive pressure spots');
}

export function shortName(name: string): string {
  return name.length <= 6 ? name : `${name.slice(0, 6)}…`;
}

export function sampleTier(opportunities: number): 'low' | 'mid' | 'high' {
  if (opportunities >= 80) return 'high';
  if (opportunities >= 20) return 'mid';
  return 'low';
}

export function sampleTierLabel(opportunities: number, language: AppLanguage = 'zh-TW'): string {
  const tier = sampleTier(opportunities);
  if (tier === 'high') return l(language, '高樣本', '高样本', 'High Sample');
  if (tier === 'mid') return l(language, '中樣本', '中样本', 'Medium Sample');
  return l(language, '低樣本', '低样本', 'Low Sample');
}

export function coachBenchmarkRangeLabel(range: CoachBenchmarkRange): string {
  return `${range.min}-${range.max}%`;
}

export function coachBenchmarkVerdict(
  stat: RatioStat,
  range: CoachBenchmarkRange,
  language: AppLanguage = 'zh-TW',
): { text: string; tone: CoachBenchmarkVerdictTone } {
  if (stat.opportunities <= 0) {
    return { text: l(language, '待收樣本', '待收样本', 'Collecting sample'), tone: 'pending' };
  }

  const rate = statRatePercent(stat);
  if (rate > range.max) {
    return { text: l(language, `偏高 +${(rate - range.max).toFixed(1)}%`, `偏高 +${(rate - range.max).toFixed(1)}%`, `High +${(rate - range.max).toFixed(1)}%`), tone: 'high' };
  }
  if (rate < range.min) {
    return { text: l(language, `偏低 -${(range.min - rate).toFixed(1)}%`, `偏低 -${(range.min - rate).toFixed(1)}%`, `Low -${(range.min - rate).toFixed(1)}%`), tone: 'low' };
  }
  return { text: l(language, '標準內', '标准内', 'Within Range'), tone: 'inRange' };
}

export function coachStatsSummary(stats: HeroStatsSnapshot, language: AppLanguage = 'zh-TW'): string {
  if (stats.hands < 12) {
    return l(language, '樣本仍少，先累積 12-20 手再判讀頻率偏差。', '样本仍少，先累计 12-20 手再判断频率偏差。', 'Sample is still small. Build 12-20 hands before judging frequency bias.');
  }

  const vpip = statRatePercent(stats.vpip);
  const pfr = statRatePercent(stats.pfr);
  const vpipGap = vpip - pfr;
  if (stats.vpip.opportunities >= 20 && vpipGap > 12) {
    return l(language, 'VPIP-PFR 差距偏大，可能冷跟注過多，建議縮減被動入池。', 'VPIP-PFR 差距偏大，可能冷跟注过多，建议缩减被动入池。', 'VPIP-PFR gap is wide. You may be over cold-calling; tighten passive entries.');
  }

  const flopCbet = statRatePercent(stats.flopCBet);
  if (stats.flopCBet.opportunities >= 15 && flopCbet > 72) {
    return l(language, 'Flop c-bet 偏高，建議加入更多 check back 來保護中段範圍。', 'Flop c-bet 偏高，建议加入更多 check back 来保护中段范围。', 'Flop c-bet is high. Add more check-backs to protect your middle range.');
  }

  const foldVsCbet = statRatePercent(stats.foldVsFlopCBet);
  if (stats.foldVsFlopCBet.opportunities >= 12 && foldVsCbet > 58) {
    return l(language, '面對 flop c-bet 的棄牌偏高，建議擴充最低防守頻率。', '面对 flop c-bet 的弃牌偏高，建议扩充最低防守频率。', 'Fold vs flop c-bet is high. Expand your minimum defense frequency.');
  }

  const foldTo3bet = statRatePercent(stats.foldToThreeBet);
  if (stats.foldToThreeBet.opportunities >= 10 && foldTo3bet > 65) {
    return l(language, '面對 preflop 3bet 棄牌偏高，對手可高頻 exploit 你。', '面对 preflop 3bet 弃牌偏高，对手可高频 exploit 你。', 'Fold to preflop 3-bet is high. Opponents can exploit this frequently.');
  }

  return l(language, '目前頻率沒有明顯失衡，持續觀察樣本與對手類型變化。', '目前频率没有明显失衡，持续观察样本与对手类型变化。', 'No obvious frequency imbalance. Keep monitoring sample and opponent types.');
}
