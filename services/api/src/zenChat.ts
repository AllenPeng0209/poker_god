import type { ZenChatRequest, ZenChatResponse, ZenCoachHomeworkTask, ZenCoachLeakSignal } from '@poker-god/contracts';

type Provider = ZenChatResponse['provider'];

type ChatModelResponse = {
  text: string;
  provider: Provider;
};

type SessionMemory = {
  updatedAt: string;
  recentMessages: string[];
  moduleHint: string;
  stackBbHint: number | null;
  leakScores: Record<ZenCoachLeakSignal['tag'], number>;
};

const OPENAI_ENDPOINT = (process.env.ZEN_OPENAI_ENDPOINT || 'https://api.openai.com/v1/chat/completions').trim();
const OPENAI_MODEL = (process.env.ZEN_OPENAI_MODEL || 'gpt-4o-mini').trim();
const OPENAI_API_KEY = (process.env.ZEN_OPENAI_API_KEY || '').trim();

const QWEN_ENDPOINT = (process.env.ZEN_QWEN_ENDPOINT || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions').trim();
const QWEN_MODEL = (process.env.ZEN_QWEN_MODEL || 'qwen-plus').trim();
const QWEN_API_KEY = (process.env.ZEN_QWEN_API_KEY || '').trim();

const PROVIDER_PREFERENCE = (process.env.ZEN_CHAT_PROVIDER || 'heuristic').trim().toLowerCase();
const sessionMemories = new Map<string, SessionMemory>();

function isValidLocale(locale: unknown): locale is 'zh-CN' | 'en-US' {
  return locale === 'zh-CN' || locale === 'en-US';
}

function sanitizeHistory(input: ZenChatRequest['history']) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((msg) => msg && (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
    .slice(-12)
    .map((msg) => ({
      role: msg.role,
      content: msg.content.trim().slice(0, 2000),
    }))
    .filter((msg) => msg.content.length > 0);
}

function extractStackBb(message: string): string | null {
  const stackMatch = message.match(/(\d+(?:\.\d+)?)\s*bb/i);
  return stackMatch?.[1] ?? null;
}

function extractStreet(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('river')) return 'river';
  if (lower.includes('turn')) return 'turn';
  if (lower.includes('flop')) return 'flop';
  return 'preflop';
}

function extractBoard(message: string): string | null {
  const boardMatch = message.match(/([2-9TJQKA][shdc]){3,5}/i);
  return boardMatch?.[0] ?? null;
}

function detectLeaks(message: string): ZenCoachLeakSignal[] {
  const lower = message.toLowerCase();
  const signals: ZenCoachLeakSignal[] = [];

  if (/bluff too much|过度诈唬|bluff\s*catch失败|hero call spew/i.test(message)) {
    signals.push({ tag: 'over_bluff', confidence: 'medium', reason: 'bluff/catch 描述集中在高波动线路' });
  }
  if (/too nit|不敢诈唬|过度保守|under\s*bluff/i.test(lower)) {
    signals.push({ tag: 'under_bluff', confidence: 'medium', reason: '进攻频率关键词偏低' });
  }
  if (/missed value|薄价值|没拿到价值|check back river/i.test(lower)) {
    signals.push({ tag: 'missed_value', confidence: 'high', reason: '价值下注机会反复被提及' });
  }
  if (/over\s*fold|弃牌过多|fold太多|被偷盲/i.test(lower)) {
    signals.push({ tag: 'over_fold', confidence: 'high', reason: '防守不足关键词明确' });
  }
  if (/size|下注尺度|bet\s*size|sizing/i.test(lower)) {
    signals.push({ tag: 'size_mismatch', confidence: 'low', reason: '多次提到下注尺度选择困难' });
  }

  return signals;
}

function emptyLeakScores(): SessionMemory['leakScores'] {
  return {
    over_bluff: 0,
    under_bluff: 0,
    missed_value: 0,
    over_fold: 0,
    size_mismatch: 0,
  };
}

function updateSessionMemory(payload: ZenChatRequest): SessionMemory {
  const previous = sessionMemories.get(payload.sessionId);
  const stackValue = Number(extractStackBb(payload.message));
  const detected = detectLeaks(payload.message);
  const route = typeof payload.context?.route === 'string' ? payload.context.route : '';
  const moduleHint = route.includes('/study') ? 'study' : route.includes('/practice') ? 'practice' : route.includes('/analyze') ? 'analyze' : 'coach';

  const next: SessionMemory = {
    updatedAt: new Date().toISOString(),
    recentMessages: [...(previous?.recentMessages ?? []), payload.message.trim()].slice(-6),
    moduleHint,
    stackBbHint: Number.isFinite(stackValue) && stackValue > 0 ? stackValue : previous?.stackBbHint ?? null,
    leakScores: { ...(previous?.leakScores ?? emptyLeakScores()) },
  };

  detected.forEach((item) => {
    next.leakScores[item.tag] += item.confidence === 'high' ? 3 : item.confidence === 'medium' ? 2 : 1;
  });

  sessionMemories.set(payload.sessionId, next);
  return next;
}

function topLeakTags(memory: SessionMemory): ZenCoachLeakSignal['tag'][] {
  return Object.entries(memory.leakScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .filter(([, score]) => score > 0)
    .map(([tag]) => tag as ZenCoachLeakSignal['tag']);
}

function buildHomework(memory: SessionMemory, locale: 'zh-CN' | 'en-US'): ZenCoachHomeworkTask[] {
  const topTags = topLeakTags(memory);
  const stackHint = memory.stackBbHint ?? 100;
  const tasks: ZenCoachHomeworkTask[] = topTags.map((tag, index) => {
    if (tag === 'over_fold') {
      return {
        id: `${tag}-${index}`,
        title: locale === 'en-US' ? 'Defense Expansion Drill' : '防守扩展训练',
        goal: locale === 'en-US' ? `Play 20 spots at ${stackHint}bb and keep fold-to-cbet below 52%.` : `完成 20 题 ${stackHint}bb 场景，fold-to-cbet 控制在 52% 以下。`,
        kpi: 'fold_to_cbet_pct <= 52%',
      };
    }
    if (tag === 'missed_value') {
      return {
        id: `${tag}-${index}`,
        title: locale === 'en-US' ? 'Thin Value Capture' : '薄价值提取',
        goal: locale === 'en-US' ? 'Mark 15 river spots and execute value bet in >= 60% target nodes.' : '标记 15 个 river spot，在目标节点价值下注率达到 60% 以上。',
        kpi: 'river_value_bet_freq >= 60%',
      };
    }
    if (tag === 'over_bluff') {
      return {
        id: `${tag}-${index}`,
        title: locale === 'en-US' ? 'Bluff Quality Filter' : '诈唬质量筛选',
        goal: locale === 'en-US' ? 'Run 25 flop/turn decisions and only bluff with blocker-backed combos.' : '完成 25 个 flop/turn 决策，仅保留有阻断价值组合的诈唬。',
        kpi: 'bluff_without_blocker_pct <= 20%',
      };
    }
    return {
      id: `${tag}-${index}`,
      title: locale === 'en-US' ? 'Sizing Consistency Pack' : '下注尺度一致性训练',
      goal: locale === 'en-US' ? 'Review 3 sessions and keep standard sizing tree deviation below 10%.' : '复盘 3 场 session，标准下注树偏移率低于 10%。',
      kpi: 'sizing_tree_deviation_pct <= 10%',
    };
  });

  if (tasks.length === 0) {
    tasks.push({
      id: 'baseline-0',
      title: locale === 'en-US' ? 'Baseline Stability Pack' : '基线稳定性训练',
      goal: locale === 'en-US' ? `Complete one 20-hand drill at ${stackHint}bb with score >= 80%.` : `完成 1 次 ${stackHint}bb 的 20 题训练，得分达到 80% 以上。`,
      kpi: 'drill_score_pct >= 80%',
    });
  }

  return tasks.slice(0, 3);
}

function buildMemorySummary(memory: SessionMemory, locale: 'zh-CN' | 'en-US'): string {
  const tags = topLeakTags(memory);
  if (locale === 'en-US') {
    const headline = tags.length > 0 ? `Top leaks: ${tags.join(', ')}` : 'No stable leak yet';
    return `${headline} · module=${memory.moduleHint} · stack=${memory.stackBbHint ?? 'N/A'}bb`;
  }

  const headline = tags.length > 0 ? `当前高频问题：${tags.join('、')}` : '当前未形成稳定漏洞标签';
  return `${headline} · 模块=${memory.moduleHint} · 筹码=${memory.stackBbHint ?? '未知'}bb`;
}

function buildHeuristicReply(payload: ZenChatRequest, memorySummary: string, homework: ZenCoachHomeworkTask[]): ChatModelResponse {
  const locale = isValidLocale(payload.locale) ? payload.locale : 'zh-CN';
  const message = payload.message.trim();
  const stackBb = extractStackBb(message);
  const street = extractStreet(message);
  const board = extractBoard(message);

  if (locale === 'en-US') {
    const hwLine = homework.map((task, idx) => `${idx + 1}) ${task.title} (${task.kpi})`).join('\n');
    const reply = [
      'Quick read:',
      `- Street: ${street}${stackBb ? `, effective stack around ${stackBb}bb` : ''}${board ? `, board ${board}` : ''}.`,
      '- Prioritize low-variance lines unless you have clear range/nut advantage.',
      `- Memory snapshot: ${memorySummary}.`,
      '',
      'Action plan:',
      '1) Confirm positions and action sequence up to current street.',
      '2) Compare your hand class versus villain continue range.',
      '3) Execute one baseline line for 20 samples before exploit tweaks.',
      '',
      'Homework queue:',
      hwLine,
    ].join('\n');

    return { text: reply, provider: 'heuristic' };
  }

  const hwLine = homework.map((task, idx) => `${idx + 1}. ${task.title}（${task.kpi}）`).join('\n');
  const reply = [
    '快速结论：',
    `- 当前处于 ${street}${stackBb ? `，有效筹码约 ${stackBb}bb` : ''}${board ? `，牌面 ${board}` : ''}。`,
    '- 优先使用波动更可控的主线，除非你确认自己有明显范围/坚果优势。',
    `- 记忆快照：${memorySummary}。`,
    '',
    '执行步骤：',
    '1. 先补全位置和行动历史（open/3bet/cbet/size）。',
    '2. 判断你这类牌在对手继续范围中的权益区间。',
    '3. 先连续执行 20 手默认线，再决定 exploit 调整。',
    '',
    '本次作业：',
    hwLine,
  ].join('\n');

  return { text: reply, provider: 'heuristic' };
}

function toOpenAiMessages(payload: ZenChatRequest) {
  const history = sanitizeHistory(payload.history);

  return [
    {
      role: 'system',
      content:
        payload.locale === 'en-US'
          ? 'You are ZEN Chat, a world-class Texas Holdem strategy coach. Be concise, structured, and actionable.'
          : '你是 ZEN Chat，一名顶级德州扑克策略教练。回答要简洁、结构化、可执行。',
    },
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: 'user', content: payload.message },
  ];
}

async function tryOpenAi(payload: ZenChatRequest): Promise<ChatModelResponse | null> {
  if (!OPENAI_API_KEY) {
    return null;
  }

  const response = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.35,
      messages: toOpenAiMessages(payload),
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    return null;
  }

  return {
    text,
    provider: 'openai',
  };
}

async function tryQwen(payload: ZenChatRequest): Promise<ChatModelResponse | null> {
  if (!QWEN_API_KEY) {
    return null;
  }

  const response = await fetch(QWEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${QWEN_API_KEY}`,
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      temperature: 0.35,
      messages: toOpenAiMessages(payload),
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    return null;
  }

  return {
    text,
    provider: 'qwen',
  };
}

function buildSuggestions(payload: ZenChatRequest, homework: ZenCoachHomeworkTask[]): string[] {
  if (payload.locale === 'en-US') {
    return [
      'Should I split between call and raise here?',
      'How does this change if effective stack is 40bb?',
      ...homework.slice(0, 1).map((item) => `Convert "${item.title}" into a 20-question drill.`),
    ];
  }

  return [
    '这里要不要混合 call 和 raise 频率？',
    '如果有效筹码变成 40bb，策略会怎么变？',
    ...homework.slice(0, 1).map((item) => `把「${item.title}」转成 20 题训练。`),
  ];
}

export async function generateZenChat(payload: ZenChatRequest): Promise<ZenChatResponse> {
  const locale = isValidLocale(payload.locale) ? payload.locale : 'zh-CN';
  const memory = updateSessionMemory(payload);
  const memorySummary = buildMemorySummary(memory, locale);
  const leakSignals = detectLeaks(payload.message);
  const homework = buildHomework(memory, locale);

  const shouldTryOpenAi = PROVIDER_PREFERENCE === 'openai' || PROVIDER_PREFERENCE === 'auto';
  const shouldTryQwen = PROVIDER_PREFERENCE === 'qwen' || PROVIDER_PREFERENCE === 'auto';

  let reply: ChatModelResponse | null = null;

  if (shouldTryOpenAi) {
    try {
      reply = await tryOpenAi(payload);
    } catch {
      reply = null;
    }
  }

  if (!reply && shouldTryQwen) {
    try {
      reply = await tryQwen(payload);
    } catch {
      reply = null;
    }
  }

  if (!reply) {
    reply = buildHeuristicReply(payload, memorySummary, homework);
  }

  return {
    sessionId: payload.sessionId,
    reply: reply.text,
    suggestions: buildSuggestions(payload, homework),
    provider: reply.provider,
    createdAt: new Date().toISOString(),
    memorySummary,
    leakSignals,
    homework,
  };
}
