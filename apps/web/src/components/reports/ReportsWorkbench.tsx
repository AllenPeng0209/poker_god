'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { apiClient, type HomeworkRetentionRadarResponse } from '@/lib/apiClient';
import { trackEvent } from '@/lib/analytics';

const WINDOW_OPTIONS: Array<7 | 30 | 90> = [7, 30, 90];
const ADMIN_HOMEWORK_RETENTION_V1 = process.env.NEXT_PUBLIC_ADMIN_HOMEWORK_RETENTION_V1 === '1';

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
  const [retentionRadar, setRetentionRadar] = useState<HomeworkRetentionRadarResponse | null>(null);
  const [retentionLoading, setRetentionLoading] = useState(false);
  const [retentionError, setRetentionError] = useState<string | null>(null);

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
    if (!ADMIN_HOMEWORK_RETENTION_V1) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      setRetentionLoading(true);
      setRetentionError(null);
      try {
        const response = await apiClient.getHomeworkRetentionRadar(windowDays, 24);
        if (cancelled) return;
        setRetentionRadar(response);
        trackEvent('report_opened', {
          module: 'reports',
          requestId: response.requestId,
          payload: {
            windowDays,
            attachRatePct: response.attachRatePct,
            completionRatePct: response.completionRatePct,
            staleRiskRatePct: response.staleRiskRatePct,
            biggestDropStageKey: response.biggestDropStageKey,
          },
        });
      } catch (loadError) {
        if (!cancelled) {
          setRetentionError(loadError instanceof Error ? loadError.message : 'Failed to load homework retention radar.');
        }
      } finally {
        if (!cancelled) {
          setRetentionLoading(false);
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

      {ADMIN_HOMEWORK_RETENTION_V1 ? (
        <article className="mvp-card" data-testid="admin-homework-retention-radar">
          <h2>Admin Homework Retention Radar</h2>
          <p className="mvp-muted">Track attach/completion drop-off and stale homework risk within the selected window.</p>
          {retentionLoading ? <p className="mvp-muted">Loading homework retention radar...</p> : null}
          {!retentionLoading && retentionRadar ? (
            <div className="mvp-stack">
              <p>
                Attach <strong>{retentionRadar.attachRatePct.toFixed(1)}%</strong> · Completion{' '}
                <strong>{retentionRadar.completionRatePct.toFixed(1)}%</strong> · Stale risk{' '}
                <strong>{retentionRadar.staleRiskRatePct.toFixed(1)}%</strong>
              </p>
              <p>
                Sessions: assigned {retentionRadar.assignedSessions} → started {retentionRadar.startedSessions} → completed{' '}
                {retentionRadar.completedSessions}; stale {retentionRadar.staleSessions}
              </p>
              <p>
                Biggest drop stage:{' '}
                <strong>
                  {retentionRadar.biggestDropStageKey === 'assigned_to_started'
                    ? 'Assignment → Start'
                    : retentionRadar.biggestDropStageKey === 'started_to_completed'
                      ? 'Start → Completion'
                      : 'None'}
                </strong>
              </p>
            </div>
          ) : null}
          {retentionError ? <p className="module-error-text">{retentionError}</p> : null}
        </article>
      ) : null}

      {error ? <p className="module-error-text">{error}</p> : null}
    </section>
  );
}
