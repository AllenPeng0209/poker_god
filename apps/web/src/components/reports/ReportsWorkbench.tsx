'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { apiClient } from '@/lib/apiClient';
import { trackEvent } from '@/lib/analytics';

const WINDOW_OPTIONS: Array<7 | 30 | 90> = [7, 30, 90];

export function ReportsWorkbench() {
  const { t } = useI18n();
  const [windowDays, setWindowDays] = useState<7 | 30 | 90>(30);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>('');
  const [coachFunnel, setCoachFunnel] = useState<{
    conversations: number;
    totalMessages: number;
    activeConversations24h: number;
    homeworkReadyConversations: number;
    homeworkCoveragePct: number;
    topThemes: Array<{ key: string; mentions: number; conversationCount: number }>;
    updatedAt: string;
  } | null>(null);
  const [items, setItems] = useState<
    Array<{
      id: string;
      title: string;
      sampleSize: number;
      confidence: 'high' | 'medium' | 'low';
      impactScore: number;
      evLossBb100: number;
      recommendation: string;
      relatedTag: string;
    }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [response, funnel] = await Promise.all([
          apiClient.getLeakReport(windowDays),
          apiClient.getAdminCoachMemoryFunnel(2),
        ]);
        if (cancelled) return;
        setItems(response.items);
        setGeneratedAt(response.generatedAt);
        setCoachFunnel({
          conversations: funnel.conversations,
          totalMessages: funnel.totalMessages,
          activeConversations24h: funnel.activeConversations24h,
          homeworkReadyConversations: funnel.homeworkReadyConversations,
          homeworkCoveragePct: funnel.homeworkCoveragePct,
          topThemes: funnel.topThemes,
          updatedAt: funnel.updatedAt,
        });
        trackEvent('report_opened', {
          module: 'reports',
          requestId: response.requestId,
          payload: {
            windowDays,
            itemCount: response.items.length,
            coachConversations: funnel.conversations,
            coachHomeworkCoveragePct: funnel.homeworkCoveragePct,
          },
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('reports.errors.loadFailed'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [windowDays, t]);

  return (
    <section className="mvp-panel" aria-labelledby="reports-title">
      <header className="mvp-panel__header">
        <div>
          <p className="module-eyebrow">{t('reports.eyebrow')}</p>
          <h1 id="reports-title">{t('reports.title')}</h1>
          <p>{t('reports.summary')}</p>
        </div>
        <Link className="module-next-link" href="/app/ai-coach/history">
          {t('reports.nextCoachHistory')}
        </Link>
      </header>

      <article className="mvp-card">
        <div className="mvp-inline">
          <label className="mvp-inline__label">
            {t('reports.window')}
            <select value={windowDays} onChange={(event) => setWindowDays(Number(event.target.value) as 7 | 30 | 90)}>
              {WINDOW_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t('reports.days', { count: option.toString() })}
                </option>
              ))}
            </select>
          </label>
          <span className="mvp-muted">{t('reports.generatedAt', { value: generatedAt || '-' })}</span>
        </div>
      </article>

      <article className="mvp-card">
        <h2>Coach Memory Funnel (Admin)</h2>
        {isLoading ? <p className="mvp-muted">Loading coach funnel...</p> : null}
        {!isLoading && coachFunnel ? (
          <>
            <div className="stats-kpis stats-kpis--compact">
              <div>
                <span>Conversations</span>
                <strong>{coachFunnel.conversations}</strong>
              </div>
              <div>
                <span>Messages</span>
                <strong>{coachFunnel.totalMessages}</strong>
              </div>
              <div>
                <span>Active (24h)</span>
                <strong>{coachFunnel.activeConversations24h}</strong>
              </div>
              <div>
                <span>Homework coverage</span>
                <strong>{coachFunnel.homeworkCoveragePct.toFixed(1)}%</strong>
              </div>
            </div>
            <p className="mvp-muted">Updated at {coachFunnel.updatedAt}</p>
            <ul className="mvp-report-list">
              {coachFunnel.topThemes.map((theme) => (
                <li key={theme.key}>
                  <div className="mvp-report-list__title">
                    <strong>{theme.key}</strong>
                    <span>{theme.mentions} mentions</span>
                  </div>
                  <p>{theme.conversationCount} conversations contributed to this theme.</p>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </article>

      <article className="mvp-card">
        <h2>{t('reports.items.title')}</h2>
        {isLoading ? <p className="mvp-muted">{t('reports.items.loading')}</p> : null}
        {!isLoading && items.length === 0 ? <p className="mvp-muted">{t('reports.items.empty')}</p> : null}
        {!isLoading && items.length > 0 ? (
          <ul className="mvp-report-list">
            {items.map((item, index) => (
              <li key={item.id}>
                <div className="mvp-report-list__title">
                  <strong>
                    #{index + 1} {item.title}
                  </strong>
                  <span>{t('reports.items.impact', { value: item.impactScore.toFixed(1) })}</span>
                </div>
                <p>
                  {t('reports.items.line', {
                    evLoss: item.evLossBb100.toFixed(1),
                    sample: item.sampleSize.toString(),
                    confidence: item.confidence,
                  })}
                </p>
                <p>{item.recommendation}</p>
                <Link className="module-next-link" href={`/app/analyze?tag=${encodeURIComponent(item.relatedTag)}`}>
                  {t('reports.items.jumpAnalyze', { tag: item.relatedTag })}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </article>

      {error ? <p className="module-error-text">{error}</p> : null}
    </section>
  );
}
