import type {
  AnalyticsEvent,
  AnalyticsIngestRequest,
  AnalyticsIngestResponse,
  AnalyzeHandsResponse,
  AnalyzeMistakeOverviewResponse,
  AnalyzeMistakeSummaryResponse,
  AnalyzeUpload,
  AnalyzeUploadCreateRequest,
  AnalyzeUploadResponse,
  AnalyzedHand,
  CoachActionSuggestion,
  CoachChatRequest,
  CoachChatResponse,
  CoachCreatePlanRequest,
  CoachCreatePlanResponse,
  Drill,
  DrillCreateRequest,
  DrillCreateResponse,
  DrillItem,
  DrillListResponse,
  LeakConfidence,
  LeakReportItem,
  LeakReportResponse,
  PracticeAnswerFeedback,
  PracticeCompleteSessionResponse,
  PracticeSession,
  PracticeSessionStartRequest,
  PracticeSessionStartResponse,
  PracticeSubmitAnswerRequest,
  PracticeSubmitAnswerResponse,
  WeeklyPlan,
} from '@poker-god/contracts';

type PracticeAnswerRecord = {
  itemId: string;
  chosenAction: string;
  decisionTimeMs: number;
  feedback: PracticeAnswerFeedback;
};

type PracticeSessionRecord = {
  session: PracticeSession;
  answers: PracticeAnswerRecord[];
};

type AnalyzeUploadRecord = {
  upload: AnalyzeUpload;
  hands: AnalyzedHand[];
};

const drills = new Map<string, Drill>();
const practiceSessions = new Map<string, PracticeSessionRecord>();
const analyzeUploads = new Map<string, AnalyzeUploadRecord>();
const weeklyPlans = new Map<string, WeeklyPlan>();
const analyticsEvents: AnalyticsEvent[] = [];

const POSITION_ROTATION = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
const STREET_ROTATION: Array<AnalyzedHand['street']> = ['preflop', 'flop', 'turn', 'river'];
const TAG_ROTATION = [
  'over_bluff',
  'under_bluff',
  'missed_value',
  'over_fold',
  'size_mismatch',
] as const;

const ANALYZE_SUMMARY_CACHE_TTL_MS = 60_000;
const analyzeMistakeSummaryCache = new Map<string, { expiresAt: number; response: AnalyzeMistakeSummaryResponse }>();

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashToNumber(text: string) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function buildDefaultDrillItems(count: number): DrillItem[] {
  const total = clamp(count, 3, 40);
  return Array.from({ length: total }, (_, index) => {
    const bucket = index % 4;
    const recommendedAction = bucket === 0 ? 'Bet 33%' : bucket === 1 ? 'Check' : bucket === 2 ? 'Call' : 'Raise 3x';
    const prompt =
      bucket === 0
        ? 'BTN vs BB single-raised pot, flop A72r, hero in-position. 你的主线动作是什么？'
        : bucket === 1
          ? 'CO vs BTN 3-bet pot, turn pairing card, OOP should choose what baseline action?'
          : bucket === 2
            ? 'SB vs BB flop check-raise facing c-bet. 这一类中等强度牌常规处理？'
            : 'River bluff-catcher spot against polar bet. Which option protects EV best?';

    return {
      id: newId(),
      prompt,
      options: ['Fold', 'Call', 'Check', 'Bet 33%', 'Raise 3x'],
      recommendedAction,
      evLossBb100: clamp(4 + bucket * 2 + (index % 3), 2, 20),
      frequencyGapPct: clamp(6 + bucket * 3 + (index % 2), 3, 22),
    };
  });
}

function createDrillInternal(input: DrillCreateRequest): Drill {
  const createdAt = nowIso();
  const drill = {
    id: newId(),
    title: input.title.trim() || 'Untitled Drill',
    sourceType: input.sourceType,
    sourceRefId: input.sourceRefId,
    tags: input.tags?.slice(0, 8) ?? [],
    itemCount: clamp(input.itemCount, 1, 500),
    createdAt,
    items: buildDefaultDrillItems(input.itemCount),
  } satisfies Drill;

  drills.set(drill.id, drill);
  return drill;
}

function ensureSeedData() {
  if (drills.size > 0) {
    return;
  }

  createDrillInternal({
    title: 'BTN vs BB C-bet Foundation',
    sourceType: 'study',
    sourceRefId: 'seed-study-001',
    tags: ['btn_vs_bb', 'flop_cbet'],
    itemCount: 8,
  });
}

function currentQuestion(sessionRecord: PracticeSessionRecord) {
  const answeredIndex = sessionRecord.session.answeredItems;
  const drill = drills.get(sessionRecord.session.drillId);
  if (!drill) {
    return null;
  }

  const item = drill.items[answeredIndex];
  if (!item) {
    return null;
  }

  return {
    itemId: item.id,
    prompt: item.prompt,
    options: item.options,
  };
}

function buildFeedback(drillItem: DrillItem, chosenAction: string): PracticeAnswerFeedback {
  const correct = chosenAction === drillItem.recommendedAction;
  return {
    correct,
    recommendedAction: drillItem.recommendedAction,
    evLossBb100: correct ? 0 : drillItem.evLossBb100,
    frequencyGapPct: correct ? 0 : drillItem.frequencyGapPct,
    explanation: correct
      ? '动作与 baseline 一致，继续保持当前频率执行。'
      : `该题推荐 ${drillItem.recommendedAction}，你当前动作会导致 EV 下降。`,
  };
}

function parseHandsFromText(uploadId: string, raw: string): AnalyzedHand[] {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const total = clamp(lines.length || 8, 6, 60);
  return Array.from({ length: total }, (_, index) => {
    const seed = hashToNumber(lines[index] ?? `${raw}:${index}`);
    const evLoss = Number(((seed % 350) / 10 + 2).toFixed(1));
    const position = POSITION_ROTATION[index % POSITION_ROTATION.length];
    const street = STREET_ROTATION[index % STREET_ROTATION.length];
    const tagA = TAG_ROTATION[index % TAG_ROTATION.length];
    const tagB = TAG_ROTATION[(index + 2) % TAG_ROTATION.length];

    return {
      id: newId(),
      uploadId,
      playedAt: new Date(Date.now() - index * 1000 * 60 * 8).toISOString(),
      position,
      street,
      evLossBb100: evLoss,
      tags: [tagA, tagB],
      summary: lines[index] ?? `Hand #${index + 1} parsed from upload`,
    };
  });
}

function confidenceBySample(sampleSize: number): LeakConfidence {
  if (sampleSize >= 20) return 'high';
  if (sampleSize >= 8) return 'medium';
  return 'low';
}

function buildLeakRecommendation(tag: string) {
  if (tag === 'over_bluff') return '收紧诈唬频率，优先保留具备阻断价值的组合。';
  if (tag === 'under_bluff') return '补足可盈利诈唬区间，避免对手无成本弃牌。';
  if (tag === 'missed_value') return '提升薄价值下注覆盖，减少 river 被动 check-back。';
  if (tag === 'over_fold') return '降低中等强度牌过度弃牌比例，扩大防守阈值。';
  return '统一 sizing 结构，减少同类牌型下注尺度漂移。';
}

function listSourceHands(uploadId?: string) {
  return uploadId
    ? (analyzeUploads.get(uploadId)?.hands ?? [])
    : Array.from(analyzeUploads.values()).flatMap((record) => record.hands);
}

function buildClusters(hands: AnalyzedHand[]) {
  const byTag = new Map<string, { count: number; totalEvLoss: number }>();
  for (const hand of hands) {
    for (const tag of hand.tags) {
      const existing = byTag.get(tag) ?? { count: 0, totalEvLoss: 0 };
      byTag.set(tag, {
        count: existing.count + 1,
        totalEvLoss: Number((existing.totalEvLoss + hand.evLossBb100).toFixed(2)),
      });
    }
  }

  return Array.from(byTag.entries())
    .map(([tag, value]) => {
      const averageEvLoss = value.count > 0 ? value.totalEvLoss / value.count : 0;
      const severity = averageEvLoss >= 18 ? 'critical' : averageEvLoss >= 10 ? 'high' : 'medium';
      return {
        tag,
        handsCount: value.count,
        averageEvLossBb100: Number(averageEvLoss.toFixed(1)),
        totalEvLossBb100: Number(value.totalEvLoss.toFixed(1)),
        severity,
        recommendation: buildLeakRecommendation(tag),
      };
    })
    .sort((left, right) => right.totalEvLossBb100 - left.totalEvLossBb100);
}

function clearAnalyzeSummaryCache() {
  analyzeMistakeSummaryCache.clear();
}

function buildCoachSections(input: CoachChatRequest): CoachChatResponse['sections'] {
  const modeHint =
    input.mode === 'Fix'
      ? '当前优先修复 EV 损失最高的决策模式。'
      : input.mode === 'Drill'
        ? '当前最优路径是把问题转为可执行训练题集。'
        : input.mode === 'Plan'
          ? '当前建议输出一周计划并分配复训窗口。'
          : '先建立稳定 baseline，再根据样本偏差做 exploit 调整。';

  return [
    { name: '结论', content: modeHint },
    {
      name: '依据数据',
      content: '基于当前模块上下文、最近动作轨迹和已知样本趋势进行判断；若样本不足会降级为保守建议。',
    },
    {
      name: '行动建议',
      content: '优先执行 1 个主动作 + 1 个校验动作，并在下一次训练中复查频率偏差与 EV loss 变化。',
    },
    {
      name: '风险提示',
      content: '若样本量偏小或输入上下文缺失，建议先补充行动历史，避免把短期波动误判为稳定漏洞。',
    },
    {
      name: '置信度',
      content: input.history && input.history.length >= 2 ? 'Medium-High' : 'Medium',
    },
  ];
}

function buildCoachActions(input: CoachChatRequest): CoachActionSuggestion[] {
  if (input.mode === 'Plan') {
    return [
      {
        type: 'create_plan',
        label: '创建 7 天修复计划',
        requiresConfirmation: false,
        payload: { focus: `${input.module}-improvement`, overwrite: false },
      },
    ];
  }

  return [
    {
      type: 'create_drill',
      label: '从当前上下文创建 Drill',
      requiresConfirmation: false,
      payload: { itemCount: input.mode === 'Drill' ? 24 : 12, sourceRefId: input.conversationId },
    },
  ];
}

export function listDrills(requestId: string): DrillListResponse {
  ensureSeedData();
  const data = Array.from(drills.values()).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return { requestId, drills: data };
}

export function createDrill(requestId: string, input: DrillCreateRequest): DrillCreateResponse {
  ensureSeedData();
  const drill = createDrillInternal(input);
  return { requestId, drill };
}

export function getDrillById(drillId: string): Drill | null {
  ensureSeedData();
  return drills.get(drillId) ?? null;
}

export function startPracticeSession(
  requestId: string,
  input: PracticeSessionStartRequest,
): PracticeSessionStartResponse | null {
  ensureSeedData();
  const drill = drills.get(input.drillId);
  if (!drill) {
    return null;
  }

  const startedAt = nowIso();
  const session = {
    id: newId(),
    drillId: input.drillId,
    mode: input.mode,
    difficulty: input.difficulty,
    status: 'active',
    totalItems: drill.items.length,
    answeredItems: 0,
    startedAt,
  } satisfies PracticeSession;

  const record: PracticeSessionRecord = { session, answers: [] };
  practiceSessions.set(session.id, record);

  return {
    requestId,
    session,
    nextQuestion: currentQuestion(record),
  };
}

export function submitPracticeAnswer(
  requestId: string,
  sessionId: string,
  input: PracticeSubmitAnswerRequest,
): PracticeSubmitAnswerResponse | null {
  const sessionRecord = practiceSessions.get(sessionId);
  if (!sessionRecord || sessionRecord.session.status !== 'active') {
    return null;
  }

  const drill = drills.get(sessionRecord.session.drillId);
  if (!drill) {
    return null;
  }

  const currentItem = drill.items[sessionRecord.session.answeredItems];
  if (!currentItem) {
    return null;
  }

  const feedback = buildFeedback(currentItem, input.chosenAction);
  sessionRecord.answers.push({
    itemId: input.itemId,
    chosenAction: input.chosenAction,
    decisionTimeMs: clamp(input.decisionTimeMs, 100, 120000),
    feedback,
  });

  sessionRecord.session = {
    ...sessionRecord.session,
    answeredItems: clamp(sessionRecord.session.answeredItems + 1, 0, sessionRecord.session.totalItems),
  };

  const nextQuestion = currentQuestion(sessionRecord);

  return {
    requestId,
    session: sessionRecord.session,
    progress: {
      answered: sessionRecord.session.answeredItems,
      total: sessionRecord.session.totalItems,
    },
    feedback,
    nextQuestion,
  };
}

export function completePracticeSession(
  requestId: string,
  sessionId: string,
): PracticeCompleteSessionResponse | null {
  const sessionRecord = practiceSessions.get(sessionId);
  if (!sessionRecord) {
    return null;
  }

  const answered = sessionRecord.answers.length || 1;
  const totalEvLoss = Number(
    sessionRecord.answers.reduce((acc, answer) => acc + answer.feedback.evLossBb100, 0).toFixed(1),
  );
  const totalFrequencyGap = sessionRecord.answers.reduce((acc, answer) => acc + answer.feedback.frequencyGapPct, 0);
  const totalDecisionTime = sessionRecord.answers.reduce((acc, answer) => acc + answer.decisionTimeMs, 0);
  const correctCount = sessionRecord.answers.filter((answer) => answer.feedback.correct).length;

  const updatedSession = {
    ...sessionRecord.session,
    status: 'completed',
    answeredItems: sessionRecord.answers.length,
    completedAt: nowIso(),
  } satisfies PracticeSession;

  sessionRecord.session = updatedSession;
  practiceSessions.set(updatedSession.id, sessionRecord);

  return {
    requestId,
    session: updatedSession,
    summary: {
      totalItems: updatedSession.totalItems,
      answeredItems: sessionRecord.answers.length,
      totalEvLossBb100: totalEvLoss,
      averageFrequencyGapPct: Number((totalFrequencyGap / answered).toFixed(1)),
      averageDecisionTimeMs: Math.round(totalDecisionTime / answered),
      scorePct: Math.round((correctCount / answered) * 100),
    },
  };
}

export function createAnalyzeUpload(
  requestId: string,
  input: AnalyzeUploadCreateRequest,
): AnalyzeUploadResponse {
  const id = newId();
  const createdAt = nowIso();
  const upload = {
    id,
    sourceSite: input.sourceSite || 'unknown',
    fileName: input.fileName || 'hand_history.txt',
    status: 'uploaded',
    handsCount: 0,
    createdAt,
    updatedAt: createdAt,
  } satisfies AnalyzeUpload;

  const record: AnalyzeUploadRecord = {
    upload,
    hands: [],
  };
  analyzeUploads.set(id, record);

  const raw = input.content.trim();
  const shouldFail = raw.length === 0;
  const parsedHands = shouldFail ? [] : parseHandsFromText(id, raw);

  setTimeout(() => {
    const maybeRecord = analyzeUploads.get(id);
    if (!maybeRecord) return;
    maybeRecord.upload = {
      ...maybeRecord.upload,
      status: 'parsing',
      updatedAt: nowIso(),
    };
    analyzeUploads.set(id, maybeRecord);
  }, 250);

  setTimeout(() => {
    const maybeRecord = analyzeUploads.get(id);
    if (!maybeRecord) return;
    if (shouldFail) {
      maybeRecord.upload = {
        ...maybeRecord.upload,
        status: 'failed',
        errorMessage: '无法从上传内容中解析出有效手牌，请检查格式。',
        updatedAt: nowIso(),
      };
    } else {
      maybeRecord.hands = parsedHands;
      maybeRecord.upload = {
        ...maybeRecord.upload,
        status: 'parsed',
        handsCount: parsedHands.length,
        updatedAt: nowIso(),
      };
    }
    analyzeUploads.set(id, maybeRecord);
    clearAnalyzeSummaryCache();
  }, 1100);

  return {
    requestId,
    upload,
  };
}

export function getAnalyzeUpload(requestId: string, uploadId: string): AnalyzeUploadResponse | null {
  const record = analyzeUploads.get(uploadId);
  if (!record) {
    return null;
  }

  return {
    requestId,
    upload: record.upload,
  };
}

export function listAnalyzeHands(
  requestId: string,
  filters: {
    uploadId?: string;
    sortBy?: 'ev_loss' | 'played_at';
    position?: string;
    tag?: string;
    limit?: number;
    offset?: number;
  },
): AnalyzeHandsResponse {
  const source = listSourceHands(filters.uploadId);

  const filtered = source.filter((hand) => {
    const matchPosition = !filters.position || hand.position === filters.position;
    const matchTag = !filters.tag || hand.tags.includes(filters.tag);
    return matchPosition && matchTag;
  });

  const sorted = [...filtered].sort((left: AnalyzedHand, right: AnalyzedHand) => {
    if (filters.sortBy === 'played_at') {
      return right.playedAt.localeCompare(left.playedAt);
    }
    return right.evLossBb100 - left.evLossBb100;
  });

  const total = sorted.length;
  const limit = clamp(filters.limit ?? 50, 1, 200);
  const offset = clamp(filters.offset ?? 0, 0, Math.max(total - 1, 0));
  const hands = sorted.slice(offset, offset + limit);

  return {
    requestId,
    hands,
    total,
    limit,
    offset,
    hasMore: offset + hands.length < total,
  };
}

export function buildAnalyzeMistakeSummary(
  requestId: string,
  options: { uploadId?: string; topN?: number },
): AnalyzeMistakeSummaryResponse {
  const topN = clamp(options.topN ?? 3, 1, 8);
  const cacheKey = `${options.uploadId ?? 'all'}:${topN}`;
  const cached = analyzeMistakeSummaryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.response,
      requestId,
      cache: {
        hit: true,
        ttlMs: Math.max(0, cached.expiresAt - Date.now()),
      },
    };
  }

  const rankedByRecent = [...listSourceHands(options.uploadId)].sort((left, right) => right.playedAt.localeCompare(left.playedAt));
  const windowHands = rankedByRecent.slice(0, 300);
  const clusters = buildClusters(windowHands);
  const topClusters = clusters.slice(0, topN);

  const averageEvLossBb100 =
    windowHands.length > 0
      ? Number((windowHands.reduce((sum, hand) => sum + hand.evLossBb100, 0) / windowHands.length).toFixed(1))
      : 0;

  const response: AnalyzeMistakeSummaryResponse = {
    requestId,
    generatedAt: nowIso(),
    windowHands: windowHands.length,
    biggestLeakTag: topClusters[0]?.tag ?? null,
    averageEvLossBb100,
    cache: {
      hit: false,
      ttlMs: ANALYZE_SUMMARY_CACHE_TTL_MS,
    },
    topClusters,
    suggestedHomework: topClusters.map((cluster, index) => ({
      title: `Leak 修复 Drill #${index + 1}: ${cluster.tag}`,
      focusTag: cluster.tag,
      itemCount: cluster.severity === 'critical' ? 28 : cluster.severity === 'high' ? 20 : 14,
      targetEvRecoveryBb100: Number((cluster.averageEvLossBb100 * 0.4).toFixed(1)),
    })),
  };

  analyzeMistakeSummaryCache.set(cacheKey, {
    response,
    expiresAt: Date.now() + ANALYZE_SUMMARY_CACHE_TTL_MS,
  });

  return response;
}

export function buildAnalyzeMistakeOverview(
  requestId: string,
  options: { uploadId?: string },
): AnalyzeMistakeOverviewResponse {
  const rankedByRecent = [...listSourceHands(options.uploadId)].sort((left, right) => right.playedAt.localeCompare(left.playedAt));
  const currentWindow = rankedByRecent.slice(0, 150);
  const previousWindow = rankedByRecent.slice(150, 300);

  const currentAverage =
    currentWindow.length > 0
      ? currentWindow.reduce((sum, hand) => sum + hand.evLossBb100, 0) / currentWindow.length
      : 0;
  const previousAverage =
    previousWindow.length > 0
      ? previousWindow.reduce((sum, hand) => sum + hand.evLossBb100, 0) / previousWindow.length
      : 0;

  const evLossTrendPct = previousAverage > 0
    ? Number((((currentAverage - previousAverage) / previousAverage) * 100).toFixed(1))
    : 0;

  const clusters = buildClusters(currentWindow).slice(0, 5);
  const criticalClusterCount = clusters.filter((cluster) => cluster.severity === 'critical').length;

  return {
    requestId,
    generatedAt: nowIso(),
    currentWindowHands: currentWindow.length,
    previousWindowHands: previousWindow.length,
    averageEvLossBb100: Number(currentAverage.toFixed(1)),
    evLossTrendPct,
    topLeakTag: clusters[0]?.tag ?? null,
    criticalClusterCount,
    recommendedAction: criticalClusterCount >= 2 || evLossTrendPct > 12 ? 'launch_homework_campaign' : 'monitor',
  };
}

export function buildLeakReport(requestId: string, windowDays: 7 | 30 | 90): LeakReportResponse {
  const parsedHands = Array.from(analyzeUploads.values())
    .filter((record) => record.upload.status === 'parsed')
    .flatMap((record) => record.hands);

  const byTag = new Map<string, { count: number; evLossTotal: number }>();
  parsedHands.forEach((hand) => {
    hand.tags.forEach((tag) => {
      const existing = byTag.get(tag) ?? { count: 0, evLossTotal: 0 };
      byTag.set(tag, {
        count: existing.count + 1,
        evLossTotal: existing.evLossTotal + hand.evLossBb100,
      });
    });
  });

  const items: LeakReportItem[] =
    byTag.size === 0
      ? [
          {
            id: newId(),
            title: '数据不足：先完成首批 Analyze 上传',
            sampleSize: 0,
            confidence: 'low',
            impactScore: 0,
            evLossBb100: 0,
            recommendation: '建议先上传至少 1 份 hand history，再生成漏洞报告。',
            relatedTag: 'insufficient_data',
          },
        ]
      : Array.from(byTag.entries())
          .map(([tag, value]) => {
            const averageLoss = value.count === 0 ? 0 : value.evLossTotal / value.count;
            const impactScore = Number((averageLoss * Math.log2(value.count + 1) * 10).toFixed(1));
            return {
              id: newId(),
              title: `Leak: ${tag}`,
              sampleSize: value.count,
              confidence: confidenceBySample(value.count),
              impactScore,
              evLossBb100: Number(averageLoss.toFixed(1)),
              recommendation: buildLeakRecommendation(tag),
              relatedTag: tag,
            } satisfies LeakReportItem;
          })
          .sort((left: LeakReportItem, right: LeakReportItem) => right.impactScore - left.impactScore)
          .slice(0, 8);

  return {
    requestId,
    windowDays,
    generatedAt: nowIso(),
    items,
  };
}

export function coachChat(requestId: string, input: CoachChatRequest): CoachChatResponse {
  return {
    requestId,
    conversationId: input.conversationId,
    provider: 'heuristic',
    sections: buildCoachSections(input),
    actions: buildCoachActions(input),
    createdAt: nowIso(),
  };
}

export function coachCreateDrillAction(
  requestId: string,
  input: { conversationId: string; title: string; itemCount: number; sourceRefId?: string; confirm?: boolean },
): DrillCreateResponse | { code: 'confirmation_required'; message: string } {
  if (input.itemCount > 100 && !input.confirm) {
    return {
      code: 'confirmation_required',
      message: '该动作将生成超过 100 题，需要二次确认。',
    };
  }

  return createDrill(requestId, {
    title: input.title || `Coach Drill ${input.conversationId.slice(0, 6)}`,
    sourceType: 'coach',
    sourceRefId: input.sourceRefId ?? input.conversationId,
    itemCount: clamp(input.itemCount, 1, 500),
  });
}

export function coachCreatePlanAction(
  requestId: string,
  input: CoachCreatePlanRequest,
): CoachCreatePlanResponse | { code: 'confirmation_required'; message: string } {
  if (input.overwrite && !input.confirm) {
    return {
      code: 'confirmation_required',
      message: '覆盖已有计划前需要二次确认。',
    };
  }

  const key = `${input.weekStart}:${input.focus}`;
  const existing = weeklyPlans.get(key);
  const plan = {
    id: existing?.id ?? newId(),
    focus: input.focus,
    weekStart: input.weekStart,
    tasks: [
      '周一：复训 Top 10 EV loss spot',
      '周三：完成 1 次 20 题 Drill 并复盘错题',
      '周五：上传最新 HH 并对照报告修复',
      '周日：回顾本周执行偏差与下周目标',
    ],
    createdAt: nowIso(),
  } satisfies WeeklyPlan;

  weeklyPlans.set(key, plan);

  return {
    requestId,
    plan,
  };
}

export function ingestAnalyticsEvents(requestId: string, payload: AnalyticsIngestRequest): AnalyticsIngestResponse {
  const valid = payload.events.filter((event) => Boolean(event.eventName && event.eventTime && event.sessionId));
  analyticsEvents.push(...valid);
  if (analyticsEvents.length > 3000) {
    analyticsEvents.splice(0, analyticsEvents.length - 3000);
  }

  return {
    requestId,
    accepted: valid.length,
  };
}
