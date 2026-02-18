from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ErrorBody(BaseModel):
    code: str
    message: str
    requestId: str


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: Literal["poker-god-api"] = "poker-god-api"
    timestamp: str


class TrainingZone(BaseModel):
    id: str
    key: str
    label: str


class TrainingZonesResponse(BaseModel):
    zones: list[TrainingZone]


StudySpotFormat = Literal["Cash 6-max", "Cash Heads-Up", "MTT 9-max"]
StudySpotPosition = Literal["BTN vs BB", "CO vs BTN", "SB vs BB", "UTG vs BB"]
StudySpotStackBb = Literal[20, 40, 60, 100, 200]
StudySpotStreet = Literal["Flop", "Turn", "River"]
StudyConfidence = Literal["High", "Medium", "Low"]


class StudyStrategyMixItem(BaseModel):
    action: str
    frequencyPct: float
    evBb: float


class StudyRangeBucket(BaseModel):
    bucket: str
    combos: int
    frequencyPct: float


class StudyLeakItem(BaseModel):
    label: str
    frequencyGapPct: float
    evLossBb100: float


class StudyNodeStrategy(BaseModel):
    recommendedLine: str
    aggregateEvBb: float
    actionMix: list[StudyStrategyMixItem]


class StudyNodeRanges(BaseModel):
    defenseFreqPct: float
    buckets: list[StudyRangeBucket]


class StudyNodeBreakdown(BaseModel):
    sampleSize: int
    avgEvLossBb100: float
    confidence: StudyConfidence
    leaks: list[StudyLeakItem]


class StudyNodeDetail(BaseModel):
    nodeCode: str
    board: str
    hero: str
    villain: str
    potBb: float
    strategy: StudyNodeStrategy
    ranges: StudyNodeRanges
    breakdown: StudyNodeBreakdown


class StudySpot(BaseModel):
    id: str
    title: str
    format: StudySpotFormat
    position: StudySpotPosition
    stackBb: StudySpotStackBb
    street: StudySpotStreet
    node: StudyNodeDetail


class StudySpotListResponse(BaseModel):
    requestId: str
    total: int
    spots: list[StudySpot]


class StudyHandActionFrequency(BaseModel):
    action: str
    frequencyPct: float


class StudyHandMatrixItem(BaseModel):
    hand: str
    frequencies: list[StudyHandActionFrequency]
    aggressionPct: float


class StudySpotMatrixResponse(BaseModel):
    requestId: str
    spotId: str
    nodeCode: str
    source: Literal["seed", "robopoker"]
    actions: list[str]
    hands: list[StudyHandMatrixItem]


ZenChatRole = Literal["user", "assistant"]


class ZenChatMessage(BaseModel):
    role: ZenChatRole
    content: str
    createdAt: str | None = None


class ZenChatRequest(BaseModel):
    sessionId: str
    message: str = Field(min_length=1, max_length=2000)
    history: list[ZenChatMessage] | None = None
    locale: Literal["zh-CN", "en-US"] | None = None
    context: dict[str, Any] | None = None


class ZenChatResponse(BaseModel):
    sessionId: str
    reply: str
    suggestions: list[str]
    provider: Literal["heuristic", "openai", "qwen", "fallback"]
    createdAt: str


SourceType = Literal["study", "analyze", "coach", "manual"]


class DrillItem(BaseModel):
    id: str
    prompt: str
    options: list[str]
    recommendedAction: str
    evLossBb100: float
    frequencyGapPct: float


class Drill(BaseModel):
    id: str
    title: str
    sourceType: SourceType
    sourceRefId: str | None = None
    tags: list[str] = []
    itemCount: int
    createdAt: str
    items: list[DrillItem] = []


class DrillCreateRequest(BaseModel):
    title: str
    sourceType: SourceType
    sourceRefId: str | None = None
    tags: list[str] | None = None
    itemCount: int = Field(ge=1, le=500)


class DrillCreateResponse(BaseModel):
    requestId: str
    drill: Drill


class DrillListResponse(BaseModel):
    requestId: str
    drills: list[Drill]


PracticeMode = Literal["by_spot", "by_street", "full_hand"]
PracticeDifficulty = Literal["beginner", "intermediate", "advanced", "elite"]
PracticeSessionStatus = Literal["active", "completed"]


class PracticeQuestion(BaseModel):
    itemId: str
    prompt: str
    options: list[str]


class PracticeSession(BaseModel):
    id: str
    drillId: str
    mode: PracticeMode
    difficulty: PracticeDifficulty
    status: PracticeSessionStatus
    totalItems: int
    answeredItems: int
    startedAt: str
    completedAt: str | None = None


class PracticeSessionStartRequest(BaseModel):
    drillId: str
    mode: PracticeMode
    difficulty: PracticeDifficulty


class PracticeSessionStartResponse(BaseModel):
    requestId: str
    session: PracticeSession
    nextQuestion: PracticeQuestion | None = None


class PracticeSubmitAnswerRequest(BaseModel):
    itemId: str
    chosenAction: str
    decisionTimeMs: int = Field(ge=1)


class PracticeAnswerFeedback(BaseModel):
    correct: bool
    recommendedAction: str
    evLossBb100: float
    frequencyGapPct: float
    explanation: str


class PracticeSubmitAnswerResponse(BaseModel):
    requestId: str
    session: PracticeSession
    progress: dict[str, int]
    feedback: PracticeAnswerFeedback
    nextQuestion: PracticeQuestion | None = None


class PracticeSessionSummary(BaseModel):
    totalItems: int
    answeredItems: int
    totalEvLossBb100: float
    averageFrequencyGapPct: float
    averageDecisionTimeMs: int
    scorePct: int


class PracticeCompleteSessionResponse(BaseModel):
    requestId: str
    session: PracticeSession
    summary: PracticeSessionSummary


AnalyzeUploadStatus = Literal["uploaded", "parsing", "parsed", "failed"]


class AnalyzeUploadCreateRequest(BaseModel):
    sourceSite: str
    fileName: str
    content: str


class AnalyzeUpload(BaseModel):
    id: str
    sourceSite: str
    fileName: str
    status: AnalyzeUploadStatus
    handsCount: int
    errorMessage: str | None = None
    createdAt: str
    updatedAt: str


class AnalyzeUploadResponse(BaseModel):
    requestId: str
    upload: AnalyzeUpload


class AnalyzedHand(BaseModel):
    id: str
    uploadId: str
    playedAt: str
    position: str
    street: Literal["preflop", "flop", "turn", "river"]
    evLossBb100: float
    tags: list[str]
    summary: str


class AnalyzeHandsResponse(BaseModel):
    requestId: str
    hands: list[AnalyzedHand]


LeakConfidence = Literal["high", "medium", "low"]


class LeakReportItem(BaseModel):
    id: str
    title: str
    sampleSize: int
    confidence: LeakConfidence
    impactScore: float
    evLossBb100: float
    recommendation: str
    relatedTag: str


class LeakReportResponse(BaseModel):
    requestId: str
    windowDays: Literal[7, 30, 90]
    generatedAt: str
    items: list[LeakReportItem]


CoachModule = Literal["study", "practice", "analyze", "reports"]
CoachMode = Literal["Explain", "Fix", "Drill", "Plan"]
CoachActionType = Literal["create_drill", "create_plan"]


class CoachChatRequest(BaseModel):
    conversationId: str
    module: CoachModule
    mode: CoachMode
    message: str = Field(min_length=1, max_length=2000)
    history: list[ZenChatMessage] | None = None
    context: dict[str, Any] | None = None


class CoachSection(BaseModel):
    name: Literal["结论", "依据数据", "行动建议", "风险提示", "置信度"]
    content: str


class CoachActionSuggestion(BaseModel):
    type: CoachActionType
    label: str
    requiresConfirmation: bool
    payload: dict[str, Any]


class CoachChatResponse(BaseModel):
    requestId: str
    conversationId: str
    provider: Literal["heuristic", "openai", "qwen", "fallback"]
    sections: list[CoachSection]
    actions: list[CoachActionSuggestion]
    createdAt: str


class CoachCreateDrillRequest(BaseModel):
    conversationId: str
    title: str
    itemCount: int = Field(ge=1, le=500)
    sourceRefId: str | None = None
    confirm: bool | None = None


class WeeklyPlan(BaseModel):
    id: str
    focus: str
    weekStart: date
    tasks: list[str]
    createdAt: str


class CoachCreatePlanRequest(BaseModel):
    conversationId: str
    focus: str
    weekStart: date
    overwrite: bool
    confirm: bool | None = None


class CoachCreatePlanResponse(BaseModel):
    requestId: str
    plan: WeeklyPlan


AnalyticsEventName = Literal[
    "study_node_opened",
    "drill_started",
    "drill_completed",
    "hand_uploaded",
    "report_opened",
    "coach_message_sent",
    "coach_action_executed",
]


class AnalyticsEvent(BaseModel):
    eventName: AnalyticsEventName
    eventTime: datetime
    sessionId: str
    userId: str | None = None
    route: str
    module: Literal["study", "practice", "analyze", "reports", "coach"]
    requestId: str | None = None
    payload: dict[str, Any] | None = None


class AnalyticsIngestRequest(BaseModel):
    events: list[AnalyticsEvent]


class AnalyticsIngestResponse(BaseModel):
    requestId: str
    accepted: int
