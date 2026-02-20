import { Audio } from 'expo-av';

import { trainingZones } from '../../../data/zones';
import type { AiProfile, TablePosition } from '../../../types/poker';

import type {
  CoachBenchmarkRange,
  CoachStatKey,
  OppLeakGuess,
  SeatAnchor,
  SfxKey,
  SfxVariant,
} from './types';

export const HERO_SEAT = 'btn';
export const BIG_BLIND_SIZE = 2;
export const STARTING_BB = 100;
export const STARTING_STACK = BIG_BLIND_SIZE * STARTING_BB;
export const ACTION_FEED_LIMIT = 200;
export const APP_SNAPSHOT_SCHEMA_VERSION = 1;
export const BANKRUPTCY_RETURN_DELAY_MS = 16000;
export const PRACTICE_XP_MULTIPLIER = 0.35;
export const CAREER_XP_RESCUE_PENALTY_STEP = 0.3;
export const CAREER_XP_RESCUE_MIN_MULTIPLIER = 0.4;
export const SUBSIDY_BB = 40;
export const LOAN_BB = 100;
export const LOAN_REPAY_RATE = 0.25;
export const NAV_DRAWER_WIDTH = 90;
export const NAV_COLLAPSED_WIDTH = 44;
export const NAV_IOS_LANDSCAPE_SAFE_LEFT = 0;
export const tableOrder: TablePosition[] = ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
export function positionRelativeToButton(position: TablePosition, buttonPosition: TablePosition): TablePosition {
  const positionIdx = tableOrder.indexOf(position);
  const buttonIdx = tableOrder.indexOf(buttonPosition);
  const canonicalButtonIdx = tableOrder.indexOf('BTN');
  if (positionIdx === -1 || buttonIdx === -1 || canonicalButtonIdx === -1) {
    return position;
  }
  const relativeIdx = (positionIdx - buttonIdx + canonicalButtonIdx + tableOrder.length) % tableOrder.length;
  return tableOrder[relativeIdx];
}
export const COACH_STAT_BENCHMARKS: Record<CoachStatKey, CoachBenchmarkRange> = {
  vpip: { min: 22, max: 32 },
  pfr: { min: 16, max: 26 },
  threeBetPreflop: { min: 6, max: 12 },
  foldToThreeBet: { min: 45, max: 65 },
  flopCBet: { min: 48, max: 68 },
  foldVsFlopCBet: { min: 35, max: 55 },
  postflopReraise: { min: 8, max: 18 },
};
export const SFX_VARIANTS: Record<SfxKey, SfxVariant[]> = {
  deal: [
    { asset: require('../../../../assets/sfx/deal-1.ogg'), volume: 0.95 },
    { asset: require('../../../../assets/sfx/deal-2.ogg'), volume: 0.95 },
  ],
  blind: [
    { asset: require('../../../../assets/sfx/blind-1.ogg'), volume: 0.88 },
    { asset: require('../../../../assets/sfx/blind-2.ogg'), volume: 0.88 },
  ],
  check: [
    { asset: require('../../../../assets/sfx/check-1.ogg'), volume: 0.7 },
    { asset: require('../../../../assets/sfx/check-2.ogg'), volume: 0.7 },
  ],
  call: [
    { asset: require('../../../../assets/sfx/call-1.ogg'), volume: 0.9 },
    { asset: require('../../../../assets/sfx/call-2.ogg'), volume: 0.9 },
  ],
  raise: [
    { asset: require('../../../../assets/sfx/raise-1.ogg'), volume: 0.96 },
    { asset: require('../../../../assets/sfx/raise-2.ogg'), volume: 0.96 },
  ],
  allIn: [
    { asset: require('../../../../assets/sfx/allin-1.ogg'), volume: 1.0 },
    { asset: require('../../../../assets/sfx/allin-2.ogg'), volume: 1.0 },
  ],
  fold: [
    { asset: require('../../../../assets/sfx/fold-1.ogg'), volume: 0.8 },
    { asset: require('../../../../assets/sfx/fold-2.ogg'), volume: 0.8 },
  ],
  reveal: [
    { asset: require('../../../../assets/sfx/reveal-1.ogg'), volume: 0.8 },
    { asset: require('../../../../assets/sfx/reveal-2.ogg'), volume: 0.8 },
  ],
  ui: [
    { asset: require('../../../../assets/sfx/ui-1.ogg'), volume: 0.75 },
  ],
};

export const EMPTY_SPOT_INSIGHT = {
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

export function createEmptySfxMap(): Record<SfxKey, Audio.Sound[]> {
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

export function findAiById(aiId?: string): AiProfile | undefined {
  if (!aiId) return undefined;
  for (const zone of trainingZones) {
    const hit = zone.aiPool.find((ai) => ai.id === aiId);
    if (hit) return hit;
  }
  return undefined;
}

export const seatLayout: SeatAnchor[] = [
  { id: 'utg', pos: 'UTG', seatLeft: '20%', seatTop: '22%' },
  { id: 'lj', pos: 'LJ', seatLeft: '50%', seatTop: '9%' },
  { id: 'hj', pos: 'HJ', seatLeft: '80%', seatTop: '22%' },
  { id: 'co', pos: 'CO', seatLeft: '87%', seatTop: '47%' },
  { id: 'btn', pos: 'BTN', seatLeft: '69%', seatTop: '78%' },
  { id: 'sb', pos: 'SB', seatLeft: '31%', seatTop: '78%' },
  { id: 'bb', pos: 'BB', seatLeft: '13%', seatTop: '47%' },
];

export const oppLeakKeys: OppLeakGuess[] = ['overFoldToRaise', 'callsTooWide', 'overBluffsRiver', 'cBetsTooMuch', 'missesThinValue'];
