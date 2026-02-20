import type { DimensionValue } from 'react-native';

import type { HeroStatsSnapshot } from '../../../engine/heroStats';
import type { ActionType, AiProfile, ProgressState, TablePosition } from '../../../types/poker';

export type Phase = 'lobby' | 'table';
export type OppLeakGuess = keyof AiProfile['leakProfile'];
export type SeatRole = 'hero' | 'ai' | 'empty';
export type TableEventKind = 'deal' | 'blind' | 'action' | 'street' | 'reveal' | 'hint';
export type SfxKey = 'deal' | 'blind' | 'check' | 'call' | 'raise' | 'allIn' | 'fold' | 'reveal' | 'ui';
export type SfxVariant = { asset: number; volume: number };
export type CoachMissionKind = 'steal_preflop' | 'bluff_catch' | 'profit_bb' | 'triple_barrel' | 'win_hands';
export type CoachStatKey = 'vpip' | 'pfr' | 'threeBetPreflop' | 'foldToThreeBet' | 'flopCBet' | 'foldVsFlopCBet' | 'postflopReraise';
export type CoachBenchmarkRange = { min: number; max: number };
export type CoachBenchmarkVerdictTone = 'pending' | 'inRange' | 'high' | 'low';
export type TrainingMode = 'career' | 'practice';
export type AppLanguage = 'zh-TW' | 'zh-CN' | 'en-US';
export type WebEntryMode = 'default' | 'practice';
export type WebEntryConfig = { mode: WebEntryMode; embed: boolean; language: AppLanguage | null };

export type Seat = { id: string; pos: TablePosition; role: SeatRole; ai?: AiProfile };
export type SeatVisual = { cardsDealt: number; inHand: boolean; folded: boolean; lastAction: string };
export type CoachMission = {
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
export type ZoneTrainingState = {
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
export type HandMissionSignals = {
  heroWon: boolean;
  stealWin: boolean;
  bluffCatchWin: boolean;
  tripleBarrelWin: boolean;
};
export type MissionResolution = {
  nextState: ZoneTrainingState;
  rewardXp: number;
  completedMissionTitles: string[];
};
export type TableEvent = {
  id: string;
  kind: TableEventKind;
  seatId?: string;
  text: string;
  action?: ActionType;
  amount?: number;
  allIn?: boolean;
};

export type SeatAnchor = {
  id: string;
  pos: TablePosition;
  seatLeft: DimensionValue;
  seatTop: DimensionValue;
};

export type PersistedSeat = {
  id: string;
  role: SeatRole;
  aiId?: string;
};

export type PersistedAppSnapshot = {
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
  appLanguage?: AppLanguage;
};
