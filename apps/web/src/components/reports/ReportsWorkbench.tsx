'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { apiClient, type HomeworkPriorityQueueItem, type HomeworkPriorityQueueSummary } from '@/lib/apiClient';
import { trackEvent } from '@/lib/analytics';

const WINDOW_OPTIONS: Array<7 | 30 | 90> = [7, 30, 90];
const ADMIN_HOMEWORK_PRIORITY_QUEUE_ENABLED = process.env.NEXT_PUBLIC_ADMIN_HOMEWORK_PRIORITY_QUEUE_V1 === '1';

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
  const [isPriorityLoading, setPriorityLoading] = useState(false);
  const [priorityError, setPriorityError] = useState<string | null>(null);
  const [prioritySummary, setPrioritySummary] = useState<HomeworkPriorityQueueSummary | null>(null);
  const [priorityItems, setPriorityItems] = useState<HomeworkPriorityQueueItem[]>([]);

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

  useEffect(() => {
    if (!ADMIN_HOMEWORK_PRIORITY_QUEUE_ENABLED) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      setPriorityLoading(true);
      setPriorityError(null);
      try {
        const response = await apiClient.getHomeworkPriorityQueue(windowDays);
        if (cancelled) return;
        setPrioritySummary(response.summary);
        setPriorityItems(response.items.slice(0, 5));
      } catch (loadError) {
        if (!cancelled) {
          setPriorityError(loadError instanceof Error ? loadError.message : 'Failed to load homework priority queue');
        }
      } finally {
        if (!cancelled) {
          setPriorityLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [windowDays]);

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

      {ADMIN_HOMEWORK_PRIORITY_QUEUE_ENABLED ? (
        <article className="mvp-card" data-testid="admin-homework-priority-queue">
          <h2>Admin Homework Priority Queue</h2>
          <p className="mvp-muted">Operational queue for stale homework sessions at risk of churn.</p>
          {isPriorityLoading ? <p className="mvp-muted">Loading homework priority queue…</p> : null}
          {!isPriorityLoading && prioritySummary ? (
            <p className="mvp-muted">
              queued {prioritySummary.queuedCount} · P0 {prioritySummary.p0Count} · P1 {prioritySummary.p1Count} · P2{' '}
              {prioritySummary.p2Count} · median stale {prioritySummary.medianStaleHours.toFixed(1)}h
            </p>
          ) : null}
          {!isPriorityLoading && priorityItems.length > 0 ? (
            <ul className="mvp-report-list">
              {priorityItems.map((item) => (
                <li key={item.sessionId}>
                  <div className="mvp-report-list__title">
                    <strong>
                      {item.priorityTier} · session {item.sessionId.slice(0, 8)}
                    </strong>
                    <span>risk {item.riskScore.toFixed(1)}</span>
                  </div>
                  <p>
                    stale {item.staleHours.toFixed(1)}h · homework {item.homeworkId ?? 'n/a'}
                  </p>
                  <p>{item.diagnosis}</p>
                  <p>{item.recommendedAction}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {priorityError ? <p className="module-error-text">{priorityError}</p> : null}
        </article>
      ) : null}

      {error ? <p className="module-error-text">{error}</p> : null}
    </section>
  );
}
