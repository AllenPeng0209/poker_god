'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { apiClient } from '@/lib/apiClient';
import { trackEvent } from '@/lib/analytics';

const WINDOW_OPTIONS: Array<7 | 30 | 90> = [7, 30, 90];
const ENABLE_HOMEWORK_PERSONALIZATION = process.env.NEXT_PUBLIC_ADMIN_HOMEWORK_PERSONALIZATION_V1 === '1';

export function ReportsWorkbench() {
  const { t } = useI18n();
  const [windowDays, setWindowDays] = useState<7 | 30 | 90>(30);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>('');
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
  const [homeworkReco, setHomeworkReco] = useState<{
    summary: {
      coachSessions: number;
      baseAttachRatePct: number;
      baseCompletionRatePct: number;
      recommendedHomeworkCount: number;
    };
    items: Array<{
      relatedTag: string;
      title: string;
      recommendedHomeworkType: 'quick_drill' | 'line_review' | 'session_recap';
      riskLevel: 'high' | 'medium' | 'low';
      priorityScore: number;
      expectedAttachLiftPct: number;
      expectedCompletionLiftPct: number;
      rationale: string;
    }>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.getLeakReport(windowDays);
        if (cancelled) return;
        setItems(response.items);
        setGeneratedAt(response.generatedAt);
        if (ENABLE_HOMEWORK_PERSONALIZATION) {
          const personalization = await apiClient.getHomeworkPersonalization(windowDays);
          if (!cancelled) {
            setHomeworkReco({
              summary: personalization.summary,
              items: personalization.items,
            });
          }
        }
        trackEvent('report_opened', {
          module: 'reports',
          requestId: response.requestId,
          payload: {
            windowDays,
            itemCount: response.items.length,
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

      {ENABLE_HOMEWORK_PERSONALIZATION && homeworkReco ? (
        <article className="mvp-card" data-testid="admin-homework-personalization-card">
          <h2>Admin Homework Personalization Radar</h2>
          <p className="mvp-muted">
            sessions {homeworkReco.summary.coachSessions} · attach {homeworkReco.summary.baseAttachRatePct.toFixed(1)}% · completion{' '}
            {homeworkReco.summary.baseCompletionRatePct.toFixed(1)}%
          </p>
          <ul className="mvp-report-list">
            {homeworkReco.items.slice(0, 3).map((item) => (
              <li key={`${item.relatedTag}-${item.title}`}>
                <div className="mvp-report-list__title">
                  <strong>{item.title}</strong>
                  <span>{item.riskLevel.toUpperCase()} · {item.priorityScore.toFixed(1)}</span>
                </div>
                <p>
                  {item.recommendedHomeworkType} · +{item.expectedAttachLiftPct.toFixed(2)}% attach · +
                  {item.expectedCompletionLiftPct.toFixed(2)}% completion
                </p>
                <p>{item.rationale}</p>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {error ? <p className="module-error-text">{error}</p> : null}
    </section>
  );
}
