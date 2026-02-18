'use client';

import type { CoachModule, ZenChatMessage, ZenChatResponse } from '@poker-god/contracts';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { apiClient } from '@/lib/apiClient';
import { trackEvent } from '@/lib/analytics';

type SpotFormat = 'Cash 6-max' | 'Cash Heads-Up' | 'MTT 9-max';
type SpotPosition = 'BTN vs BB' | 'CO vs BTN' | 'SB vs BB' | 'UTG vs BB';
type SpotStack = 20 | 40 | 60 | 100 | 200;

type CoachContextEvent = {
  module?: string;
  snapshot?: Record<string, unknown>;
  updatedAt?: string;
};

type StudyIntent = {
  format?: SpotFormat;
  position?: SpotPosition;
  stackBb?: SpotStack;
  hand?: string;
  board?: string;
  potSb?: number;
  effectiveStackSb?: number;
  ipRange?: string;
  oopRange?: string;
  flopBetSizes?: string;
  flopRaiseSizes?: string;
  sourceMessage: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider?: ZenChatResponse['provider'];
  createdAt: string;
};

const STACK_OPTIONS: SpotStack[] = [20, 40, 60, 100, 200];
const MIN_DRAWER_WIDTH = 320;
const MAX_DRAWER_WIDTH = 760;

function moduleFromPath(pathname: string): CoachModule | null {
  if (pathname.startsWith('/app/study')) return 'study';
  if (pathname.startsWith('/app/practice')) return 'practice';
  if (pathname.startsWith('/app/analyze')) return 'analyze';
  if (pathname.startsWith('/app/reports')) return 'reports';
  return null;
}

function clampWidth(value: number) {
  return Math.max(MIN_DRAWER_WIDTH, Math.min(MAX_DRAWER_WIDTH, value));
}

function nearestStack(value: number): SpotStack {
  let nearest: SpotStack = STACK_OPTIONS[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const option of STACK_OPTIONS) {
    const distance = Math.abs(option - value);
    if (distance < nearestDistance) {
      nearest = option;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function normalizeHand(raw: string): string | undefined {
  const compact = raw.toUpperCase().replace(/\s+/g, '');
  const withSuit = compact.match(/([AKQJT2-9])([AKQJT2-9])(S|O)/);
  if (withSuit) {
    const first = withSuit[1];
    const second = withSuit[2];
    const suffix = withSuit[3].toLowerCase();
    return first === second ? `${first}${second}` : `${first}${second}${suffix}`;
  }

  const zhSuit = compact.match(/([AKQJT2-9])([AKQJT2-9])(同花|非同花)/);
  if (zhSuit) {
    const first = zhSuit[1];
    const second = zhSuit[2];
    const suffix = zhSuit[3] === '同花' ? 's' : 'o';
    return first === second ? `${first}${second}` : `${first}${second}${suffix}`;
  }

  const pair = compact.match(/\b([AKQJT2-9])\1\b/);
  if (pair) {
    return `${pair[1]}${pair[1]}`;
  }

  const plain = compact.match(/\b([AKQJT2-9])([AKQJT2-9])\b/);
  if (!plain) {
    return undefined;
  }

  const first = plain[1];
  const second = plain[2];
  return first === second ? `${first}${second}` : `${first}${second}s`;
}

function inferStudyIntent(message: string): StudyIntent | null {
  const lowered = message.toLowerCase();
  const hasBigBlind = /(bb|big blind|大盲)/i.test(message);
  let position: SpotPosition | undefined;
  let format: SpotFormat | undefined;
  let stackBb: SpotStack | undefined;
  let hand: string | undefined;
  let board: string | undefined;
  let potSb: number | undefined;
  let effectiveStackSb: number | undefined;
  let ipRange: string | undefined;
  let oopRange: string | undefined;
  let flopBetSizes: string | undefined;
  let flopRaiseSizes: string | undefined;

  if ((/\butg\b|枪口|早位/.test(lowered) || /utg/.test(lowered)) && hasBigBlind) {
    position = 'UTG vs BB';
  } else if (/\bco\b|cutoff|cut off|关门/.test(lowered) && /\bbtn\b|button|庄位|按钮/.test(lowered)) {
    position = 'CO vs BTN';
  } else if ((/sb|small blind|小盲/.test(lowered) || /小盲/.test(message)) && hasBigBlind) {
    position = 'SB vs BB';
  } else if (/\bbtn\b|button|bottom|庄位|按钮/.test(lowered) || /button|按钮|庄位|bottom/.test(message)) {
    position = 'BTN vs BB';
  }

  if (/mtt|锦标|比赛/.test(lowered) || /锦标|比赛/.test(message)) {
    format = 'MTT 9-max';
  } else if (/heads?\s*up|hu|单挑/.test(lowered) || /单挑/.test(message)) {
    format = 'Cash Heads-Up';
  } else if (/cash|ring|现金/.test(lowered) || /现金|常规/.test(message)) {
    format = 'Cash 6-max';
  }

  const stackMatch = message.match(/(\d{2,3})\s*(bb|大盲|深度)/i);
  if (stackMatch) {
    const parsed = Number(stackMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      stackBb = nearestStack(parsed);
      effectiveStackSb = Math.round(parsed * 2);
    }
  }

  hand = normalizeHand(message);

  const boardTokens = message.match(/[2-9TJQKA][hdcs]/gi);
  if (boardTokens && boardTokens.length >= 3) {
    board = boardTokens.slice(0, 5).join(',');
  }

  const potMatch = message.match(/(?:pot|底池)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(bb|sb)?/i);
  if (potMatch) {
    const raw = Number(potMatch[1]);
    if (Number.isFinite(raw) && raw > 0) {
      potSb = potMatch[2]?.toLowerCase() === 'bb' ? Math.round(raw * 2) : Math.round(raw);
    }
  }

  if (/ip range|btn range|hero range|我方范围/i.test(lowered)) {
    ipRange = message;
  }
  if (/oop range|villain range|bb range|对手范围/i.test(lowered)) {
    oopRange = message;
  }
  const flopBetMatch = message.match(/flop\s*(?:bet|下注)\s*[:=]?\s*([0-9 ]{1,24})/i);
  if (flopBetMatch) {
    flopBetSizes = flopBetMatch[1].trim();
  }
  const flopRaiseMatch = message.match(/flop\s*(?:raise|加注)\s*[:=]?\s*([0-9 ]{1,24})/i);
  if (flopRaiseMatch) {
    flopRaiseSizes = flopRaiseMatch[1].trim();
  }

  if (!position && !format && !stackBb && !hand && !board && !potSb && !effectiveStackSb && !ipRange && !oopRange && !flopBetSizes && !flopRaiseSizes) {
    return null;
  }

  return {
    format,
    position,
    stackBb,
    hand,
    board,
    potSb,
    effectiveStackSb,
    ipRange,
    oopRange,
    flopBetSizes,
    flopRaiseSizes,
    sourceMessage: message,
  };
}

function intentSummary(intent: StudyIntent) {
  const parts: string[] = [];
  if (intent.format) parts.push(`Format: ${intent.format}`);
  if (intent.position) parts.push(`Position: ${intent.position}`);
  if (intent.stackBb) parts.push(`Stack: ${intent.stackBb}bb`);
  if (intent.hand) parts.push(`Hand: ${intent.hand}`);
  if (intent.board) parts.push(`Board: ${intent.board}`);
  if (intent.potSb) parts.push(`Pot: ${intent.potSb} SB`);
  if (intent.effectiveStackSb) parts.push(`Eff: ${intent.effectiveStackSb} SB`);
  if (intent.flopBetSizes) parts.push(`Flop Bet: ${intent.flopBetSizes}`);
  if (intent.flopRaiseSizes) parts.push(`Flop Raise: ${intent.flopRaiseSizes}`);
  return parts.join(' · ');
}

function toZenHistory(messages: ChatMessage[]): ZenChatMessage[] {
  return messages
    .filter((item): item is ChatMessage & { role: 'user' | 'assistant' } => item.role === 'user' || item.role === 'assistant')
    .slice(-16)
    .map((item) => ({
      role: item.role,
      content: item.content,
      createdAt: item.createdAt,
    }));
}

type AICoachDrawerProps = {
  pathname: string;
  isOpen: boolean;
  width: number;
  onOpenChange: (value: boolean) => void;
  onWidthChange: (value: number) => void;
};

export function AICoachDrawer({ pathname, isOpen, width, onOpenChange, onWidthChange }: AICoachDrawerProps) {
  const { t, locale } = useI18n();
  const module = useMemo(() => moduleFromPath(pathname), [pathname]);
  const panelId = 'ai-coach-panel';
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [provider, setProvider] = useState<ZenChatResponse['provider']>('heuristic');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<StudyIntent | null>(null);
  const [contextEvent, setContextEvent] = useState<CoachContextEvent | null>(null);
  const [conversationId] = useState(() => crypto.randomUUID());
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);
  const feedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleContext = (event: Event) => {
      const payload = (event as CustomEvent<CoachContextEvent>).detail;
      if (!payload || typeof payload !== 'object') {
        return;
      }
      setContextEvent(payload);
    };

    window.addEventListener('coach:context', handleContext as EventListener);
    return () => window.removeEventListener('coach:context', handleContext as EventListener);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    window.dispatchEvent(new CustomEvent('coach:request-context'));
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen || !feedRef.current) {
      return;
    }
    feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [isOpen, messages]);

  function requestLatestContext(timeoutMs = 1000): Promise<CoachContextEvent | null> {
    return new Promise((resolve) => {
      let resolved = false;
      const handleContext = (event: Event) => {
        const payload = (event as CustomEvent<CoachContextEvent>).detail;
        if (!payload || typeof payload !== 'object') {
          return;
        }
        if (!resolved) {
          resolved = true;
          window.removeEventListener('coach:context', handleContext as EventListener);
          clearTimeout(timer);
          resolve(payload);
        }
      };
      const timer = window.setTimeout(() => {
        if (!resolved) {
          resolved = true;
          window.removeEventListener('coach:context', handleContext as EventListener);
          resolve(null);
        }
      }, timeoutMs);

      window.addEventListener('coach:context', handleContext as EventListener);
      window.dispatchEvent(new CustomEvent('coach:request-context'));
    });
  }

  function handleResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (window.matchMedia('(max-width: 860px)').matches) {
      return;
    }

    event.preventDefault();
    resizeStartRef.current = { x: event.clientX, width };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';

    const handleMove = (moveEvent: PointerEvent) => {
      const start = resizeStartRef.current;
      if (!start) {
        return;
      }
      const delta = start.x - moveEvent.clientX;
      onWidthChange(clampWidth(start.width + delta));
    };

    const handleUp = () => {
      resizeStartRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }

  async function applyPendingIntent() {
    if (!pendingIntent || module !== 'study') {
      return;
    }

    const intent = pendingIntent;
    setPendingIntent(null);
    window.dispatchEvent(new CustomEvent('coach:study:apply-intent', { detail: intent }));
    setMessages((prev) => [
      ...prev.slice(-40),
      {
        id: crypto.randomUUID(),
        role: 'system',
        content:
          locale === 'zh-CN'
            ? `已应用参数到 Study：${intentSummary(intent)}`
            : `Applied to Study: ${intentSummary(intent)}`,
        createdAt: new Date().toISOString(),
      },
    ]);
    const refreshed = await requestLatestContext(1200);
    if (refreshed) {
      setContextEvent(refreshed);
    }
  }

  async function handleAsk(overridePrompt?: string) {
    if (!module || isLoading) {
      return;
    }

    const text = (overridePrompt ?? input).trim();
    if (!text) {
      return;
    }

    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: now,
    };
    const inferredIntent = module === 'study' ? inferStudyIntent(text) : null;
    const history = toZenHistory([...messages, userMessage]);
    const latestContext = contextEvent;

    setError(null);
    setLoading(true);
    setInput('');
    setMessages((prev) => {
      const next = [...prev.slice(-40), userMessage];
      if (inferredIntent) {
        next.push({
          id: crypto.randomUUID(),
          role: 'system',
          content:
            locale === 'zh-CN'
              ? `识别到可应用参数：${intentSummary(inferredIntent)}。请点“应用参数”后再看中间牌局变化。`
              : `Detected setup fields: ${intentSummary(inferredIntent)}. Click "Apply" to sync with Study.`,
          createdAt: now,
        });
      }
      return next;
    });
    if (inferredIntent) {
      setPendingIntent(inferredIntent);
    }

    try {
      const response = await apiClient.zenChat({
        sessionId: conversationId,
        message: text,
        history,
        locale,
        context: {
          route: pathname,
          module,
          uiSnapshot: latestContext?.snapshot ?? null,
          uiUpdatedAt: latestContext?.updatedAt ?? null,
          inferredStudyIntent: inferredIntent ?? null,
        },
      });

      setProvider(response.provider);
      setSuggestions(response.suggestions);
      setMessages((prev) => [
        ...prev.slice(-40),
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.reply,
          provider: response.provider,
          createdAt: response.createdAt,
        },
      ]);
      trackEvent('coach_message_sent', {
        module: 'coach',
        payload: {
          route: pathname,
          coachModule: module,
          provider: response.provider,
          autoSyncedStudyScenario: false,
          parsedStudyIntent: Boolean(inferredIntent),
        },
      });
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : t('coach.errors.requestFailed'));
    } finally {
      setLoading(false);
    }
  }

  if (!module) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className={isOpen ? 'wizard-coach-fab wizard-coach-fab--open' : 'wizard-coach-fab'}
        onClick={() => onOpenChange(!isOpen)}
        aria-label={t('coach.aria.toggle')}
        aria-controls={panelId}
        aria-expanded={isOpen}
      >
        <span className="wizard-coach-fab__avatar" aria-hidden="true">
          <span className="wizard-coach-fab__head" />
          <span className="wizard-coach-fab__body" />
        </span>
      </button>

      {isOpen ? <button type="button" className="wizard-coach-overlay" onClick={() => onOpenChange(false)} aria-label={t('coach.aria.close')} /> : null}

      <aside id={panelId} className={isOpen ? 'wizard-coach wizard-coach--open' : 'wizard-coach'} aria-label={t('coach.aria.drawer')}>
        <div className="wizard-coach__resize-handle" onPointerDown={handleResizeStart} aria-hidden="true" />

        <header className="wizard-coach__header">
          <div>
            <h3>{t('coach.header')}</h3>
            <p>
              {t(`coach.module.${module}`)} · {provider.toUpperCase()} · {contextEvent?.updatedAt ? 'Context On' : 'Context Pending'}
            </p>
          </div>
          <button type="button" className="wizard-icon-button" onClick={() => onOpenChange(false)} aria-label={t('coach.aria.close')}>
            ×
          </button>
        </header>

        <section ref={feedRef} className="wizard-coach__feed" aria-live="polite">
          {messages.length === 0 ? <p className="mvp-muted">{t('coach.empty')}</p> : null}
          {messages.map((message) => (
            <article key={message.id} className={`wizard-coach__message wizard-coach__message--${message.role}`}>
              <strong>{message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Coach' : 'System'}</strong>
              <p>{message.content}</p>
            </article>
          ))}
        </section>

        <div className="wizard-coach__composer">
          {pendingIntent ? (
            <div className="wizard-coach__intent">
              <strong>{locale === 'zh-CN' ? '待应用参数' : 'Pending Setup'}</strong>
              <p>{intentSummary(pendingIntent)}</p>
              <div className="wizard-coach__intent-actions">
                <button type="button" className="module-next-link" onClick={() => void applyPendingIntent()} disabled={isLoading}>
                  {locale === 'zh-CN' ? '应用参数' : 'Apply'}
                </button>
                <button type="button" className="wizard-coach__chip" onClick={() => setPendingIntent(null)} disabled={isLoading}>
                  {locale === 'zh-CN' ? '忽略' : 'Dismiss'}
                </button>
              </div>
            </div>
          ) : null}

          {suggestions.length > 0 ? (
            <div className="wizard-coach__suggestions">
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" className="wizard-coach__chip" onClick={() => void handleAsk(suggestion)} disabled={isLoading}>
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          {error ? <p className="module-error-text wizard-coach__error">{error}</p> : null}

          <div className="wizard-coach__input-row">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={t('coach.promptPlaceholder')}
              aria-label={t('coach.aria.input')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleAsk();
                }
              }}
            />

            <button
              type="button"
              className="module-next-link wizard-coach__send"
              onClick={() => void handleAsk()}
              disabled={isLoading || input.trim().length === 0}
            >
              {isLoading ? t('coach.processing') : t('coach.send')}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
