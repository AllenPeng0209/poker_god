'use client';

import type { CoachActionSuggestion, CoachMode, CoachModule, ZenChatMessage } from '@poker-god/contracts';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { apiClient } from '@/lib/apiClient';
import { trackEvent } from '@/lib/analytics';

const MODE_OPTIONS: CoachMode[] = ['Explain', 'Fix', 'Drill', 'Plan'];

function moduleFromPath(pathname: string): CoachModule | null {
  if (pathname.startsWith('/app/study')) return 'study';
  if (pathname.startsWith('/app/practice')) return 'practice';
  if (pathname.startsWith('/app/analyze')) return 'analyze';
  if (pathname.startsWith('/app/reports')) return 'reports';
  return null;
}

export function AICoachDrawer({ pathname }: { pathname: string }) {
  const { t } = useI18n();
  const module = useMemo(() => moduleFromPath(pathname), [pathname]);
  const [isOpen, setOpen] = useState(false);
  const [mode, setMode] = useState<CoachMode>('Explain');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<ZenChatMessage[]>([]);
  const [sections, setSections] = useState<Array<{ name: string; content: string }>>([]);
  const [actions, setActions] = useState<CoachActionSuggestion[]>([]);
  const [actionResult, setActionResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [conversationId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!input.trim()) {
      setInput(t('coach.promptPlaceholder'));
    }
  }, [input, t]);

  async function handleAsk() {
    if (!module || !input.trim() || isLoading) {
      return;
    }

    setLoading(true);
    setError(null);
    setActionResult('');
    const trimmed = input.trim();
    try {
      const response = await apiClient.coachChat({
        conversationId,
        module,
        mode,
        message: trimmed,
        history,
        context: {
          route: pathname,
        },
      });

      setSections(response.sections);
      setActions(response.actions);
      setHistory((prev) => [...prev.slice(-10), { role: 'user', content: trimmed }]);
      trackEvent('coach_message_sent', {
        module: 'coach',
        requestId: response.requestId,
        payload: {
          route: pathname,
          coachModule: module,
          mode,
        },
      });
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : t('coach.errors.requestFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: CoachActionSuggestion) {
    if (isLoading) {
      return;
    }

    if (action.requiresConfirmation) {
      const confirmed = window.confirm(t('coach.confirmRisky'));
      if (!confirmed) return;
    }

    setLoading(true);
    setError(null);
    setActionResult('');
    try {
      if (action.type === 'create_drill') {
        const itemCount = Number(action.payload.itemCount ?? 12);
        const response = await apiClient.coachCreateDrill({
          conversationId,
          title: `Coach Drill (${mode})`,
          itemCount: Number.isFinite(itemCount) ? itemCount : 12,
          sourceRefId: String(action.payload.sourceRefId ?? conversationId),
          confirm: true,
        });
        setActionResult(t('coach.createdDrill', { title: response.drill.title, count: response.drill.itemCount.toString() }));
        trackEvent('coach_action_executed', {
          module: 'coach',
          requestId: response.requestId,
          payload: {
            actionType: 'create_drill',
            drillId: response.drill.id,
          },
        });
      } else {
        const weekStart = new Date().toISOString().slice(0, 10);
        const response = await apiClient.coachCreatePlan({
          conversationId,
          focus: String(action.payload.focus ?? `${module}-improvement`),
          weekStart,
          overwrite: Boolean(action.payload.overwrite),
          confirm: true,
        });
        setActionResult(
          t('coach.createdPlan', {
            focus: response.plan.focus,
            weekStart: response.plan.weekStart,
          }),
        );
        trackEvent('coach_action_executed', {
          module: 'coach',
          requestId: response.requestId,
          payload: {
            actionType: 'create_plan',
            planId: response.plan.id,
          },
        });
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t('coach.errors.actionFailed'));
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
        className="wizard-icon-button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t('coach.aria.toggle')}
      >
        {t('coach.button')}
      </button>

      <aside className={isOpen ? 'wizard-coach wizard-coach--open' : 'wizard-coach'} aria-label={t('coach.aria.drawer')}>
        <header className="wizard-coach__header">
          <div>
            <h3>{t('coach.header')}</h3>
            <p>
              {t('coach.moduleMode', { module: t(`coach.module.${module}`), mode: t(`coach.mode.${mode}`) })}
            </p>
          </div>
          <button type="button" className="wizard-icon-button" onClick={() => setOpen(false)} aria-label={t('coach.aria.close')}>
            ×
          </button>
        </header>

        <div className="wizard-coach__modes">
          {MODE_OPTIONS.map((item) => (
            <button
              key={item}
              type="button"
              className={item === mode ? 'wizard-coach__chip wizard-coach__chip--active' : 'wizard-coach__chip'}
              onClick={() => setMode(item)}
            >
              {t(`coach.mode.${item}`)}
            </button>
          ))}
        </div>

        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={4}
          maxLength={2000}
          aria-label={t('coach.aria.input')}
        />

        <button type="button" className="module-next-link" onClick={handleAsk} disabled={isLoading || input.trim().length === 0}>
          {isLoading ? t('coach.processing') : t('coach.send')}
        </button>

        <section className="wizard-coach__feed" aria-live="polite">
          {sections.length === 0 ? <p className="mvp-muted">{t('coach.empty')}</p> : null}
          {sections.map((section) => (
            <article key={section.name}>
              <strong>{section.name}</strong>
              <p>{section.content}</p>
            </article>
          ))}
        </section>

        {actions.length > 0 ? (
          <div className="wizard-coach__actions">
            {actions.map((action) => (
              <button key={action.label} type="button" className="module-next-link" onClick={() => handleAction(action)} disabled={isLoading}>
                {action.label}
              </button>
            ))}
          </div>
        ) : null}

        {actionResult ? <p className="mvp-feedback mvp-feedback--ok">{actionResult}</p> : null}
        {error ? <p className="module-error-text">{error}</p> : null}
      </aside>
    </>
  );
}
