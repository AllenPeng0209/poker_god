import { cardToDisplay } from './cards';
import type { SpotInsight } from './insights';
import type { ActionAdvice, AnalysisResult, HandState } from '@poker-god/contracts';

export interface CoachAssistInput {
  hand: HandState;
  analysis: AnalysisResult;
  spotInsight: SpotInsight;
  recentActionLines: string[];
}

export interface CoachAssistResult {
  text: string;
  source: 'openai_omni' | 'qwen' | 'fallback';
  audioUrl?: string;
  audioBase64?: string;
  audioMimeType?: string;
  audioFormat?: string;
  error?: string;
}

type QwenChoiceMessage = {
  content?: string | Array<{ text?: string } | string>;
};

type QwenResponse = {
  choices?: Array<{
    message?: QwenChoiceMessage;
  }>;
  error?: {
    message?: string;
  };
};

type QwenTtsResponse = {
  output?: {
    audio_url?: string;
    duration_ms?: number;
    request_id?: string;
    audio?: {
      url?: string;
      duration_ms?: number;
      format?: string;
      data?: string;
    };
    audio_base64?: string;
    audio_content?: string;
  };
  audio_url?: string;
  duration_ms?: number;
  request_id?: string;
  audio?: {
    url?: string;
    duration_ms?: number;
    format?: string;
    data?: string;
  };
  error?: {
    message?: string;
  };
};

type OpenAiMessageContentPart = {
  type?: string;
  text?: string;
  content?: string;
};

type OpenAiResponse = {
  choices?: Array<{
    message?: {
      content?: string | OpenAiMessageContentPart[];
      audio?: {
        data?: string;
        transcript?: string;
        format?: string;
      };
    };
  }>;
  error?: {
    message?: string;
  };
};

type CoachVoiceProvider = 'auto' | 'openai_omni' | 'qwen';

const DEFAULT_QWEN_MODEL = 'qwen3-max';
const DEFAULT_QWEN_ENDPOINT = '/compatible-mode/v1/chat/completions';
const DEFAULT_QWEN_TTS_MODEL = 'qwen3-tts-flash';
const DEFAULT_QWEN_TTS_FORMAT = 'mp3';
const DEFAULT_QWEN_TTS_SAMPLE_RATE = 24000;

const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-audio-preview';
const DEFAULT_OPENAI_VOICE = 'alloy';
const DEFAULT_OPENAI_AUDIO_FORMAT = 'mp3';

const BAILIAN_ENDPOINT_RAW = (process.env.EXPO_PUBLIC_BAILIAN_ENDPOINT || 'https://dashscope.aliyuncs.com')
  .trim()
  .replace(/\/+$/, '');

const QWEN_API_KEY = (process.env.EXPO_PUBLIC_QWEN_API_KEY || process.env.EXPO_PUBLIC_BAILIAN_API_KEY || '').trim();
const QWEN_MODEL = (process.env.EXPO_PUBLIC_QWEN_MODEL || DEFAULT_QWEN_MODEL).trim();
const QWEN_ENDPOINT = (
  process.env.EXPO_PUBLIC_QWEN_ENDPOINT || `${BAILIAN_ENDPOINT_RAW}${DEFAULT_QWEN_ENDPOINT}`
)
  .trim()
  .replace(/\/+$/, '');

const BAILIAN_WORKSPACE_ID = (process.env.EXPO_PUBLIC_BAILIAN_WORKSPACE_ID || '').trim();
const BAILIAN_USE_WORKSPACE = ['1', 'true', 'yes'].includes(
  (process.env.EXPO_PUBLIC_BAILIAN_USE_WORKSPACE || '').trim().toLowerCase(),
);

const QWEN_TTS_ENDPOINT_OVERRIDE = (process.env.EXPO_PUBLIC_QWEN_TTS_ENDPOINT || '').trim();
const QWEN_TTS_MODEL = (process.env.EXPO_PUBLIC_QWEN_TTS_MODEL || DEFAULT_QWEN_TTS_MODEL).trim();
const QWEN_TTS_VOICE = (process.env.EXPO_PUBLIC_QWEN_TTS_VOICE || '').trim();
const QWEN_TTS_FORMAT = (process.env.EXPO_PUBLIC_QWEN_TTS_FORMAT || DEFAULT_QWEN_TTS_FORMAT).trim().toLowerCase();
const QWEN_TTS_SAMPLE_RATE = Number.parseInt(
  (process.env.EXPO_PUBLIC_QWEN_TTS_SAMPLE_RATE || `${DEFAULT_QWEN_TTS_SAMPLE_RATE}`).trim(),
  10,
);

const OPENAI_API_KEY = (process.env.EXPO_PUBLIC_OPENAI_API_KEY || '').trim();
const OPENAI_ENDPOINT = (process.env.EXPO_PUBLIC_OPENAI_ENDPOINT || DEFAULT_OPENAI_ENDPOINT).trim();
const OPENAI_OMNI_MODEL = (process.env.EXPO_PUBLIC_OPENAI_OMNI_MODEL || DEFAULT_OPENAI_MODEL).trim();
const OPENAI_VOICE = (process.env.EXPO_PUBLIC_OPENAI_VOICE || DEFAULT_OPENAI_VOICE).trim();
const OPENAI_AUDIO_FORMAT = (process.env.EXPO_PUBLIC_OPENAI_AUDIO_FORMAT || DEFAULT_OPENAI_AUDIO_FORMAT).trim().toLowerCase();

function parseCoachVoiceProvider(): CoachVoiceProvider {
  const raw = (process.env.EXPO_PUBLIC_COACH_VOICE_PROVIDER || 'auto').trim().toLowerCase();
  if (raw === 'openai_omni' || raw === 'openai') return 'openai_omni';
  if (raw === 'qwen') return 'qwen';
  return 'auto';
}

const COACH_VOICE_PROVIDER = parseCoachVoiceProvider();

function getQwenBaseUrl() {
  const raw = (process.env.EXPO_PUBLIC_QWEN_TTS_BASE_URL || BAILIAN_ENDPOINT_RAW || 'https://dashscope.aliyuncs.com')
    .trim()
    .replace(/\/+$/, '');
  if (/\/api\/v\d+$/i.test(raw)) {
    return raw;
  }
  return `${raw}/api/v1`;
}

const QWEN_TTS_BASE_URL = getQwenBaseUrl();

function safePercent(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return value.toFixed(1);
}

function flattenMessageContent(content: QwenChoiceMessage['content']): string {
  if (typeof content === 'string') {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((item) => (typeof item === 'string' ? item : item.text ?? ''))
    .join('\n')
    .trim();
}

function flattenOpenAiMessageContent(content: string | OpenAiMessageContentPart[] | undefined): string {
  if (typeof content === 'string') {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((item) => {
      if (typeof item !== 'object' || !item) return '';
      if (typeof item.text === 'string') return item.text;
      if (typeof item.content === 'string') return item.content;
      return '';
    })
    .join('\n')
    .trim();
}

function formatAdvice(name: string, advice: ActionAdvice): string {
  const action = advice.action === 'raise' ? `raise${advice.amount ? ` ${advice.amount}` : ''}` : advice.action;
  return `${name}: action=${action}, confidence=${Math.round(advice.confidence * 100)}%, summary=${advice.summary}`;
}

function formatCards(cards: HandState['heroCards']): string {
  if (cards.length === 0) return '-';
  return cards.map((card) => cardToDisplay(card)).join(' ');
}

function formatBoard(hand: HandState): string {
  const board = hand.board.slice(0, hand.revealedBoardCount);
  if (board.length === 0) return '-';
  return board.map((card) => cardToDisplay(card)).join(' ');
}

function normalizeSpeechText(raw: string): string {
  return raw
    .replace(/\*\*/g, '')
    .replace(/[`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function bestActionLine(analysis: AnalysisResult): string {
  if (analysis.best.action !== 'raise') {
    return analysis.best.action;
  }
  return `raise ${analysis.best.amount ?? ''}`.trim();
}

function maybeParseJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isInvalidWorkspaceHeader(text = ''): boolean {
  return /invalid header\s+"x-dashscope-?workspace"/i.test(text) || /Invalid header "X-DashScope-WorkSpace"/i.test(text);
}

function getQwenHeaders(includeWorkspace: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${QWEN_API_KEY}`,
  };
  if (includeWorkspace && BAILIAN_USE_WORKSPACE && BAILIAN_WORKSPACE_ID) {
    headers['X-DashScope-Workspace'] = BAILIAN_WORKSPACE_ID;
  }
  return headers;
}

export function buildLocalCoachSummary(input: CoachAssistInput): string {
  const { hand, analysis, spotInsight } = input;
  const edge = spotInsight.equity.heroWin + spotInsight.equity.tie * 0.5 - spotInsight.potOddsNeed;
  const line = analysis.bestMode === 'exploit' ? 'exploit line' : 'GTO line';

  if (analysis.best.action === 'fold') {
    return `Use ${line}: fold now. Edge is ${edge >= 0 ? '+' : ''}${safePercent(edge)}%, so calling is not profitable.`;
  }
  if (analysis.best.action === 'call' || analysis.best.action === 'check') {
    return `Use ${line}: ${analysis.best.action}. Edge is ${edge >= 0 ? '+' : ''}${safePercent(edge)}%, so pot control is preferred.`;
  }
  return `Use ${line}: raise ${analysis.best.amount ?? hand.minRaise}. Edge is ${edge >= 0 ? '+' : ''}${safePercent(edge)}%, so pressure can realize fold equity and value.`;
}

function buildPrompt(input: CoachAssistInput): string {
  const { hand, analysis, spotInsight, recentActionLines } = input;
  const historyLines = hand.history.map((log, idx) => `${idx + 1}. [${log.street}] ${log.text}`);
  const feedLines = recentActionLines.map((line, idx) => `${idx + 1}. ${line}`);
  const rangeLines = spotInsight.rangeBuckets
    .map((bucket) => `${bucket.label}:${safePercent(bucket.ratio)}%(${bucket.combos})`)
    .join(' | ');
  const outsLines = spotInsight.outsGroups
    .slice(0, 4)
    .map((group) => `${group.label}:${group.count}`)
    .join(' | ');

  return [
    'You are a Texas Holdem decision coach.',
    'Task: give the best action for Hero in this exact spot.',
    'Output rules:',
    '1) Reply in Traditional Chinese.',
    '2) Keep it short in 2-4 sentences.',
    '3) Last line must be: 建議動作：<fold/check/call/raise amount>.',
    '',
    '[Spot]',
    `street=${hand.street}, pot=${hand.pot}, toCall=${hand.toCall}, minRaise=${hand.minRaise}`,
    `heroCards=${formatCards(hand.heroCards)}, board=${formatBoard(hand)}`,
    `heroStack=${hand.heroStack}, villainStack=${hand.villainStack}`,
    `actingPlayerId=${hand.actingPlayerId ?? '-'}, heroPlayerId=${hand.heroPlayerId}`,
    `position=${hand.position.situationLabel}, preflopHint=${hand.position.preflopOrderHint}`,
    `button=${hand.buttonPosition}, SB=${hand.smallBlindPosition}, BB=${hand.bigBlindPosition}`,
    '',
    '[Engine outputs]',
    `bestMode=${analysis.bestMode}, targetLeak=${analysis.targetLeak}, bestAction=${bestActionLine(analysis)}`,
    formatAdvice('gto', analysis.gto),
    formatAdvice('exploit', analysis.exploit),
    formatAdvice('best', analysis.best),
    '',
    '[Equity and range]',
    `equity hero=${safePercent(spotInsight.equity.heroWin)} tie=${safePercent(spotInsight.equity.tie)} villain=${safePercent(spotInsight.equity.villainWin)}`,
    `potOddsNeed=${safePercent(spotInsight.potOddsNeed)}%`,
    `rangeBuckets=${rangeLines || '-'}`,
    `outs=${spotInsight.outsCount}, outsGroups=${outsLines || '-'}`,
    `rangeSamples=${spotInsight.rangeSamples.map((sample) => `${sample.text}:${safePercent(sample.ratio)}%`).join(', ') || '-'}`,
    '',
    '[Full action line: hand.history]',
    historyLines.length > 0 ? historyLines.join('\n') : '-',
    '',
    '[Recent action feed]',
    feedLines.length > 0 ? feedLines.join('\n') : '-',
  ].join('\n');
}

export async function requestQwenCoachAdvice(
  input: CoachAssistInput,
  signal?: AbortSignal,
): Promise<CoachAssistResult> {
  const fallback = buildLocalCoachSummary(input);

  if (!QWEN_API_KEY) {
    return {
      text: fallback,
      source: 'fallback',
      error: 'missing EXPO_PUBLIC_QWEN_API_KEY / EXPO_PUBLIC_BAILIAN_API_KEY',
    };
  }

  const prompt = buildPrompt(input);
  const payload = {
    model: QWEN_MODEL,
    temperature: 0.2,
    max_tokens: 180,
    messages: [
      {
        role: 'system',
        content: 'You are a high win-rate Texas Holdem coach. Be precise and actionable.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  const doRequest = (includeWorkspace: boolean) =>
    fetch(QWEN_ENDPOINT, {
      method: 'POST',
      headers: getQwenHeaders(includeWorkspace),
      body: JSON.stringify(payload),
      signal,
    });

  try {
    let response = await doRequest(true);
    let rawText = await response.text().catch(() => '');

    if (!response.ok && response.status === 400 && isInvalidWorkspaceHeader(rawText)) {
      response = await doRequest(false);
      rawText = await response.text().catch(() => '');
    }

    const data = (maybeParseJson(rawText) ?? {}) as QwenResponse;
    if (!response.ok) {
      const errMsg = data.error?.message ?? `HTTP ${response.status}`;
      return { text: fallback, source: 'fallback', error: errMsg };
    }

    const content = flattenMessageContent(data.choices?.[0]?.message?.content);
    if (!content) {
      return { text: fallback, source: 'fallback', error: 'empty qwen response content' };
    }

    return {
      text: normalizeSpeechText(content),
      source: 'qwen',
    };
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    const errMsg = error instanceof Error ? error.message : 'unknown qwen request error';
    return { text: fallback, source: 'fallback', error: errMsg };
  }
}

async function requestOpenAiOmniCoachAdvice(
  input: CoachAssistInput,
  signal?: AbortSignal,
): Promise<CoachAssistResult | null> {
  if (!OPENAI_API_KEY) {
    return null;
  }

  const prompt = buildPrompt(input);

  try {
    const response = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_OMNI_MODEL,
        temperature: 0.2,
        max_tokens: 180,
        modalities: ['text', 'audio'],
        audio: {
          voice: OPENAI_VOICE,
          format: OPENAI_AUDIO_FORMAT,
        },
        messages: [
          {
            role: 'system',
            content: 'You are a high win-rate Texas Holdem coach. Be precise and actionable.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
      signal,
    });

    const rawText = await response.text().catch(() => '');
    const data = (maybeParseJson(rawText) ?? {}) as OpenAiResponse;
    if (!response.ok) {
      return null;
    }

    const message = data.choices?.[0]?.message;
    const transcript = message?.audio?.transcript?.trim() || '';
    const content = flattenOpenAiMessageContent(message?.content);
    const text = normalizeSpeechText(transcript || content);
    const audioBase64 = message?.audio?.data?.trim() || '';

    if (!text && !audioBase64) {
      return null;
    }

    const finalFormat = (message?.audio?.format || OPENAI_AUDIO_FORMAT || DEFAULT_OPENAI_AUDIO_FORMAT).toLowerCase();

    return {
      text,
      source: 'openai_omni',
      audioBase64: audioBase64 || undefined,
      audioFormat: finalFormat,
      audioMimeType: finalFormat ? `audio/${finalFormat}` : undefined,
    };
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    return null;
  }
}

async function requestQwenTtsAudio(
  text: string,
  signal?: AbortSignal,
): Promise<Pick<CoachAssistResult, 'audioUrl' | 'audioBase64' | 'audioMimeType' | 'audioFormat'> | null> {
  if (!QWEN_API_KEY || !text.trim()) {
    return null;
  }

  const finalFormat = QWEN_TTS_FORMAT || DEFAULT_QWEN_TTS_FORMAT;
  const finalSampleRate = Number.isFinite(QWEN_TTS_SAMPLE_RATE) && QWEN_TTS_SAMPLE_RATE > 0
    ? QWEN_TTS_SAMPLE_RATE
    : DEFAULT_QWEN_TTS_SAMPLE_RATE;

  const payload = {
    model: QWEN_TTS_MODEL,
    input: {
      text: text.trim(),
      ...(QWEN_TTS_VOICE ? { voice: QWEN_TTS_VOICE } : {}),
      language_type: 'Chinese',
    },
    parameters: {
      audio_config: {
        format: finalFormat,
        sample_rate: finalSampleRate,
      },
    },
  };

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${QWEN_API_KEY}`,
  };

  const primaryEndpoint = QWEN_TTS_ENDPOINT_OVERRIDE || `${BAILIAN_ENDPOINT_RAW}/api/v1/services/aigc/multimodal-generation/generation`;

  const endpointCandidates = [
    primaryEndpoint,
    `${QWEN_TTS_BASE_URL}/tts/speech`,
    `${BAILIAN_ENDPOINT_RAW}/compatible-mode/v1/audio/speech`,
  ];

  for (let idx = 0; idx < endpointCandidates.length; idx += 1) {
    const endpoint = endpointCandidates[idx];
    const isLegacyEndpoint = endpoint.endsWith('/tts/speech');
    const isCompatEndpoint = endpoint.includes('/compatible-mode/v1/audio/speech');

    const body = isLegacyEndpoint
      ? {
          model: 'qwen-tts-realtime',
          input: {
            text: text.trim(),
            format: finalFormat,
            sample_rate: finalSampleRate,
          },
        }
      : isCompatEndpoint
        ? {
            model: QWEN_TTS_MODEL,
            input: {
              text: text.trim(),
            },
            audio_format: finalFormat,
            sample_rate: finalSampleRate,
          }
        : payload;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });

      const rawText = await response.text().catch(() => '');
      const data = (maybeParseJson(rawText) ?? {}) as QwenTtsResponse;

      if (!response.ok) {
        if (response.status === 404 && idx < endpointCandidates.length - 1) {
          continue;
        }
        break;
      }

      const output = data.output || {};
      const audioUrl = output.audio_url || output.audio?.url || data.audio_url || data.audio?.url || undefined;
      const audioBase64 = output.audio_base64 || output.audio_content || output.audio?.data || data.audio?.data || undefined;
      const responseFormat = output.audio?.format || data.audio?.format || finalFormat;
      if (!audioUrl && !audioBase64) {
        continue;
      }

      return {
        audioUrl,
        audioBase64,
        audioFormat: responseFormat,
        audioMimeType: responseFormat ? `audio/${responseFormat}` : undefined,
      };
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      if (idx === endpointCandidates.length - 1) {
        return null;
      }
    }
  }

  return null;
}

export async function requestCoachVoiceAdvice(
  input: CoachAssistInput,
  signal?: AbortSignal,
): Promise<CoachAssistResult> {
  const fallback = buildLocalCoachSummary(input);

  if (COACH_VOICE_PROVIDER !== 'qwen') {
    const omni = await requestOpenAiOmniCoachAdvice(input, signal);
    if (omni) {
      if (!omni.text) {
        return {
          ...omni,
          text: fallback,
        };
      }
      return omni;
    }
  }

  const qwen = await requestQwenCoachAdvice(input, signal);
  if (qwen.source === 'qwen') {
    const tts = await requestQwenTtsAudio(qwen.text, signal);
    if (tts) {
      return {
        ...qwen,
        ...tts,
      };
    }
  }

  return qwen.text
    ? qwen
    : {
        ...qwen,
        text: fallback,
      };
}
