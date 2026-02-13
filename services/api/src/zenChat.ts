import type { ZenChatRequest, ZenChatResponse } from '@poker-god/contracts';

type Provider = ZenChatResponse['provider'];

type ChatModelResponse = {
  text: string;
  provider: Provider;
};

const OPENAI_ENDPOINT = (process.env.ZEN_OPENAI_ENDPOINT || 'https://api.openai.com/v1/chat/completions').trim();
const OPENAI_MODEL = (process.env.ZEN_OPENAI_MODEL || 'gpt-4o-mini').trim();
const OPENAI_API_KEY = (process.env.ZEN_OPENAI_API_KEY || '').trim();

const QWEN_ENDPOINT = (process.env.ZEN_QWEN_ENDPOINT || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions').trim();
const QWEN_MODEL = (process.env.ZEN_QWEN_MODEL || 'qwen-plus').trim();
const QWEN_API_KEY = (process.env.ZEN_QWEN_API_KEY || '').trim();

const PROVIDER_PREFERENCE = (process.env.ZEN_CHAT_PROVIDER || 'heuristic').trim().toLowerCase();

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

function buildHeuristicReply(payload: ZenChatRequest): ChatModelResponse {
  const locale = isValidLocale(payload.locale) ? payload.locale : 'zh-CN';
  const message = payload.message.trim();
  const stackBb = extractStackBb(message);
  const street = extractStreet(message);
  const board = extractBoard(message);

  if (locale === 'en-US') {
    const reply = [
      'Quick read:',
      `- Street: ${street}${stackBb ? `, effective stack around ${stackBb}bb` : ''}${board ? `, board ${board}` : ''}.`,
      '- Prioritize low-variance lines unless you have clear range/nut advantage.',
      '- Avoid forcing high-frequency bluffs in capped-stack spots without fold-equity evidence.',
      '',
      'Action plan:',
      '1) Confirm positions and action sequence up to current street.',
      '2) Compare your hand class versus villain continue range.',
      '3) Choose one default line and one exploit line, then execute consistently.',
      '',
      'If you share full action history, I can output a street-by-street line with bet sizes.',
    ].join('\n');

    return { text: reply, provider: 'heuristic' };
  }

  const reply = [
    '快速结论：',
    `- 当前处于 ${street}${stackBb ? `，有效筹码约 ${stackBb}bb` : ''}${board ? `，牌面 ${board}` : ''}。`,
    '- 优先使用波动更可控的主线，除非你确认自己有明显范围/坚果优势。',
    '- 短码或中码场景下，不建议无依据地提高高频诈唬占比。',
    '',
    '执行步骤：',
    '1. 先补全位置和行动历史（open/3bet/cbet/size）。',
    '2. 判断你这类牌在对手继续范围中的权益区间。',
    '3. 同时保留一条默认线和一条 exploit 线，再二选一执行。',
    '',
    '你如果把完整行动序列发我，我可以直接给你逐街动作和下注尺度。',
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

function buildSuggestions(payload: ZenChatRequest): string[] {
  if (payload.locale === 'en-US') {
    return [
      'Should I split between call and raise here?',
      'How does this change if effective stack is 40bb?',
      'Give me exploit line versus overfolding big blind.',
    ];
  }

  return [
    '这里要不要混合 call 和 raise 频率？',
    '如果有效筹码变成 40bb，策略会怎么变？',
    '针对大盲过度弃牌，给我一条 exploit 线。',
  ];
}

export async function generateZenChat(payload: ZenChatRequest): Promise<ZenChatResponse> {
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
    reply = buildHeuristicReply(payload);
  }

  return {
    sessionId: payload.sessionId,
    reply: reply.text,
    suggestions: buildSuggestions(payload),
    provider: reply.provider,
    createdAt: new Date().toISOString(),
  };
}
