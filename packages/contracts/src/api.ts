import type { TrainingZone } from './poker';

export interface HealthResponse {
  status: 'ok';
  service: 'poker-god-api';
  timestamp: string;
}

export interface TrainingZonesResponse {
  zones: TrainingZone[];
}

export type StudySpotFormat = 'Cash 6-max' | 'Cash Heads-Up' | 'MTT 9-max';
export type StudySpotPosition = 'BTN vs BB' | 'CO vs BTN' | 'SB vs BB' | 'UTG vs BB';
export type StudySpotStackBb = 20 | 40 | 60 | 100 | 200;
export type StudySpotStreet = 'Flop' | 'Turn' | 'River';
export type StudyConfidence = 'High' | 'Medium' | 'Low';

export interface StudyStrategyMixItem {
  action: string;
  frequencyPct: number;
  evBb: number;
}

export interface StudyRangeBucket {
  bucket: string;
  combos: number;
  frequencyPct: number;
}

export interface StudyLeakItem {
  label: string;
  frequencyGapPct: number;
  evLossBb100: number;
}

export interface StudyNodeDetail {
  nodeCode: string;
  board: string;
  hero: string;
  villain: string;
  potBb: number;
  strategy: {
    recommendedLine: string;
    aggregateEvBb: number;
    actionMix: StudyStrategyMixItem[];
  };
  ranges: {
    defenseFreqPct: number;
    buckets: StudyRangeBucket[];
  };
  breakdown: {
    sampleSize: number;
    avgEvLossBb100: number;
    confidence: StudyConfidence;
    leaks: StudyLeakItem[];
  };
}

export interface StudySpot {
  id: string;
  title: string;
  format: StudySpotFormat;
  position: StudySpotPosition;
  stackBb: StudySpotStackBb;
  street: StudySpotStreet;
  node: StudyNodeDetail;
}

export interface StudySpotListResponse {
  requestId: string;
  total: number;
  spots: StudySpot[];
}

export interface StudyHandActionFrequency {
  action: string;
  frequencyPct: number;
}

export interface StudyHandMatrixItem {
  hand: string;
  frequencies: StudyHandActionFrequency[];
  aggressionPct: number;
}

export interface StudySpotMatrixResponse {
  requestId: string;
  spotId: string;
  nodeCode: string;
  source: 'seed' | 'robopoker';
  actions: string[];
  hands: StudyHandMatrixItem[];
}

export type ZenChatRole = 'user' | 'assistant';

export interface ZenChatMessage {
  role: ZenChatRole;
  content: string;
  createdAt?: string;
}

export interface ZenChatRequest {
  sessionId: string;
  message: string;
  history?: ZenChatMessage[];
  locale?: 'zh-CN' | 'en-US';
  context?: Record<string, unknown>;
}

export interface ZenChatResponse {
  sessionId: string;
  reply: string;
  suggestions: string[];
  provider: 'heuristic' | 'openai' | 'qwen' | 'fallback';
  createdAt: string;
}

export type SourceType = 'study' | 'analyze' | 'coach' | 'manual';

export interface DrillItem {
  id: string;
  prompt: string;
  options: string[];
  recommendedAction: string;
  evLossBb100: number;
  frequencyGapPct: number;
}

export interface Drill {
  id: string;
  title: string;
  sourceType: SourceType;
  sourceRefId?: string;
  tags: string[];
  itemCount: number;
  createdAt: string;
  items: DrillItem[];
}

export interface DrillCreateRequest {
  title: string;
  sourceType: SourceType;
  sourceRefId?: string;
  tags?: string[];
  itemCount: number;
}

export interface DrillCreateResponse {
  requestId: string;
  drill: Drill;
}

export interface DrillListResponse {
  requestId: string;
  drills: Drill[];
}

export type PracticeMode = 'by_spot' | 'by_street' | 'full_hand';
export type PracticeDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'elite';
export type PracticeSessionStatus = 'active' | 'completed';

export interface PracticeQuestion {
  itemId: string;
  prompt: string;
  options: string[];
}

export interface PracticeSession {
  id: string;
  drillId: string;
  mode: PracticeMode;
  difficulty: PracticeDifficulty;
  status: PracticeSessionStatus;
  totalItems: number;
  answeredItems: number;
  startedAt: string;
  completedAt?: string;
}

export interface PracticeSessionStartRequest {
  drillId: string;
  mode: PracticeMode;
  difficulty: PracticeDifficulty;
}

export interface PracticeSessionStartResponse {
  requestId: string;
  session: PracticeSession;
  nextQuestion: PracticeQuestion | null;
}

export interface PracticeSubmitAnswerRequest {
  itemId: string;
  chosenAction: string;
  decisionTimeMs: number;
}

export interface PracticeAnswerFeedback {
  correct: boolean;
  recommendedAction: string;
  evLossBb100: number;
  frequencyGapPct: number;
  explanation: string;
}

export interface PracticeSubmitAnswerResponse {
  requestId: string;
  session: PracticeSession;
  progress: {
    answered: number;
    total: number;
  };
  feedback: PracticeAnswerFeedback;
  nextQuestion: PracticeQuestion | null;
}

export interface PracticeSessionSummary {
  totalItems: number;
  answeredItems: number;
  totalEvLossBb100: number;
  averageFrequencyGapPct: number;
  averageDecisionTimeMs: number;
  scorePct: number;
}

export interface PracticeCompleteSessionResponse {
  requestId: string;
  session: PracticeSession;
  summary: PracticeSessionSummary;
}

export type AnalyzeUploadStatus = 'uploaded' | 'parsing' | 'parsed' | 'failed';

export interface AnalyzeUploadCreateRequest {
  sourceSite: string;
  fileName: string;
  content: string;
}

export interface AnalyzeUpload {
  id: string;
  sourceSite: string;
  fileName: string;
  status: AnalyzeUploadStatus;
  handsCount: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyzeUploadResponse {
  requestId: string;
  upload: AnalyzeUpload;
}

export interface AnalyzedHand {
  id: string;
  uploadId: string;
  playedAt: string;
  position: string;
  street: 'preflop' | 'flop' | 'turn' | 'river';
  evLossBb100: number;
  tags: string[];
  summary: string;
}

export interface AnalyzeHandsResponse {
  requestId: string;
  hands: AnalyzedHand[];
}

export type LeakConfidence = 'high' | 'medium' | 'low';

export interface LeakReportItem {
  id: string;
  title: string;
  sampleSize: number;
  confidence: LeakConfidence;
  impactScore: number;
  evLossBb100: number;
  recommendation: string;
  relatedTag: string;
}

export interface LeakReportResponse {
  requestId: string;
  windowDays: 7 | 30 | 90;
  generatedAt: string;
  items: LeakReportItem[];
}

export type CoachModule = 'study' | 'practice' | 'analyze' | 'reports';
export type CoachMode = 'Explain' | 'Fix' | 'Drill' | 'Plan';

export interface CoachChatRequest {
  conversationId: string;
  module: CoachModule;
  mode: CoachMode;
  message: string;
  history?: ZenChatMessage[];
  context?: Record<string, unknown>;
}

export type CoachSectionName = '结论' | '依据数据' | '行动建议' | '风险提示' | '置信度';
export type CoachActionType = 'create_drill' | 'create_plan';

export interface CoachSection {
  name: CoachSectionName;
  content: string;
}

export interface CoachActionSuggestion {
  type: CoachActionType;
  label: string;
  requiresConfirmation: boolean;
  payload: Record<string, unknown>;
}

export interface CoachChatResponse {
  requestId: string;
  conversationId: string;
  provider: 'heuristic' | 'openai' | 'qwen' | 'fallback';
  sections: CoachSection[];
  actions: CoachActionSuggestion[];
  createdAt: string;
}

export interface CoachCreateDrillRequest {
  conversationId: string;
  title: string;
  itemCount: number;
  sourceRefId?: string;
  confirm?: boolean;
}

export interface WeeklyPlan {
  id: string;
  focus: string;
  weekStart: string;
  tasks: string[];
  createdAt: string;
}

export interface CoachCreatePlanRequest {
  conversationId: string;
  focus: string;
  weekStart: string;
  overwrite: boolean;
  confirm?: boolean;
}

export interface CoachCreatePlanResponse {
  requestId: string;
  plan: WeeklyPlan;
}

export type AnalyticsEventName =
  | 'study_node_opened'
  | 'drill_started'
  | 'drill_completed'
  | 'hand_uploaded'
  | 'report_opened'
  | 'coach_message_sent'
  | 'coach_action_executed';

export interface AnalyticsEvent {
  eventName: AnalyticsEventName;
  eventTime: string;
  sessionId: string;
  userId?: string;
  route: string;
  module: 'study' | 'practice' | 'analyze' | 'reports' | 'coach';
  requestId?: string;
  payload?: Record<string, unknown>;
}

export interface AnalyticsIngestRequest {
  events: AnalyticsEvent[];
}

export interface AnalyticsIngestResponse {
  requestId: string;
  accepted: number;
}
