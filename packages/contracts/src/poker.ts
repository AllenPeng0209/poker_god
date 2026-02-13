export type Suit = 's' | 'h' | 'd' | 'c';

export type Rank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'T'
  | 'J'
  | 'Q'
  | 'K'
  | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
  code: string;
}

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type ActionType = 'fold' | 'check' | 'call' | 'raise';

export type Actor = 'hero' | 'villain' | 'table';

export type TablePosition = 'UTG' | 'LJ' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

export type PositionTier = 'early' | 'middle' | 'late' | 'blind';

export type HeroLeak =
  | 'overFold'
  | 'overCall'
  | 'overBluff'
  | 'missedValue'
  | 'passiveCheck';

export interface LeakProfile {
  overFoldToRaise: boolean;
  callsTooWide: boolean;
  overBluffsRiver: boolean;
  cBetsTooMuch: boolean;
  missesThinValue: boolean;
}

export interface AiProfile {
  id: string;
  name: string;
  archetype: 'Nit' | 'TAG' | 'LAG' | 'Maniac';
  styleLabel: string;
  skill: number;
  aggression: number;
  bluffRate: number;
  leakProfile: LeakProfile;
  trashTalkMode: 'soft' | 'spicy' | 'cold';
}

export interface TrainingZone {
  id: string;
  name: string;
  subtitle: string;
  unlockXp: number;
  aiPool: AiProfile[];
  recommendedFocus: string[];
}

export interface ActionAdvice {
  action: ActionType;
  amount?: number;
  confidence: number;
  summary: string;
  rationale: string[];
  source?: 'heuristic' | 'preflop_cfr' | 'postflop_cfr';
}

export interface AnalysisResult {
  gto: ActionAdvice;
  exploit: ActionAdvice;
  best: ActionAdvice;
  bestMode: 'gto' | 'exploit';
  heroStrength: number;
  villainStrength: number;
  potOdds: number;
  targetLeak: string;
}

export interface ActionLog {
  actor: Actor;
  actorId?: string;
  actorName?: string;
  action: ActionType;
  amount: number;
  allIn?: boolean;
  forcedBlind?: 'sb' | 'bb';
  street: Street;
  text: string;
}

export interface DecisionRecord {
  street: Street;
  chosen: ActionType;
  best: ActionType;
  usedMode: 'gto' | 'exploit';
  isBest: boolean;
}

export interface PositionContext {
  hero: TablePosition;
  villain: TablePosition;
  heroLabel: string;
  villainLabel: string;
  heroTier: PositionTier;
  villainTier: PositionTier;
  heroInPositionPostflop: boolean;
  preflopOrderHint: string;
  situationLabel: string;
}

export interface TablePlayer {
  id: string;
  name: string;
  position: TablePosition;
  role: 'hero' | 'ai';
  ai?: AiProfile;
  cards: Card[];
  startingStack: number;
  stack: number;
  committedStreet: number;
  totalCommitted: number;
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
}

export interface HandState {
  heroCards: Card[];
  villainCards: Card[];
  board: Card[];
  revealedBoardCount: number;
  street: Street;
  pot: number;
  toCall: number;
  minRaise: number;
  heroStack: number;
  villainStack: number;
  history: ActionLog[];
  isOver: boolean;
  winner: 'hero' | 'villain' | 'tie' | null;
  resultText: string;
  streetActionCount: number;
  currentAi: AiProfile;
  players: TablePlayer[];
  heroPlayerId: string;
  focusVillainId: string;
  actingPlayerId: string | null;
  pendingActors: string[];
  currentBet: number;
  buttonPosition: TablePosition;
  smallBlindPosition: TablePosition;
  bigBlindPosition: TablePosition;
  smallBlind: number;
  bigBlind: number;
  position: PositionContext;
  trashTalk: string;
  lastAnalysis: AnalysisResult | null;
  decisionRecords: DecisionRecord[];
  preflopActionCodes: number[];
  preflopSolverEligible: boolean;
}

export interface AnalysisContext {
  hand: HandState;
  heroStrength: number;
  villainStrength: number;
  ai: AiProfile;
}

export interface ProgressState {
  xp: number;
  zoneIndex: number;
  handsPlayed: number;
  handsWon: number;
  leaks: Record<HeroLeak, number>;
}
