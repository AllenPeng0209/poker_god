import { cardToDisplay } from './cards';
import type { SpotInsight } from './insights';
import type { ActionAdvice, AnalysisResult, HandState } from '../types/poker';

export interface CoachAssistInput {
  hand: HandState;
  analysis: AnalysisResult;
  spotInsight: SpotInsight;
  recentActionLines: string[];
}

export interface CoachAssistResult {
  text: string;
  source: 'qwen' | 'fallback';
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

const DEFAULT_QWEN_MODEL = 'qwen3-max';
const DEFAULT_QWEN_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

function getEnv(name: string): string | undefined {
  const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.[name];
}

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
  const apiKey = getEnv('EXPO_PUBLIC_QWEN_API_KEY');
  const endpoint = getEnv('EXPO_PUBLIC_QWEN_ENDPOINT') ?? DEFAULT_QWEN_ENDPOINT;
  const model = getEnv('EXPO_PUBLIC_QWEN_MODEL') ?? DEFAULT_QWEN_MODEL;
  const fallback = buildLocalCoachSummary(input);

  if (!apiKey) {
    return {
      text: fallback,
      source: 'fallback',
      error: 'missing EXPO_PUBLIC_QWEN_API_KEY',
    };
  }

  const prompt = buildPrompt(input);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
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
      }),
      signal,
    });

    const data = (await response.json().catch(() => ({}))) as QwenResponse;
    if (!response.ok) {
      const errMsg = data.error?.message ?? `HTTP ${response.status}`;
      return { text: fallback, source: 'fallback', error: errMsg };
    }

    const content = flattenMessageContent(data.choices?.[0]?.message?.content);
    if (!content) {
      return { text: fallback, source: 'fallback', error: 'empty response content' };
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
