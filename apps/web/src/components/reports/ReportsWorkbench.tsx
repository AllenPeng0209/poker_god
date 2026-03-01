'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { apiClient } from '@/lib/apiClient';
import { trackEvent } from '@/lib/analytics';

const WINDOW_OPTIONS: Array<7 | 30 | 90> = [7, 30, 90];
const ADMIN_MISTAKE_CLUSTERS_ENABLED = process.env.NEXT_PUBLIC_ADMIN_MISTAKE_CLUSTERS_V1 === '1';

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
  const [mistakeClusterLoading, setMistakeClusterLoading] = useState(false);
  const [mistakeClusterError, setMistakeClusterError] = useState<string | null>(null);
  const [mistakeClusters, setMistakeClusters] = useState<
    Array<{
      tag: string;
      sampleSize: number;
      avgEvLossBb100: number;
      sharePct: number;
      repeatSessionRatePct: number;
      riskLevel: 'high' | 'medium' | 'low';
      suggestedCampaign: 'quick_drill' | 'homework_recovery' | 'coach_nudge';
    }>
  >([]);
  const [mistakeClusterSummary, setMistakeClusterSummary] = useState<{
    totalHands: number;
    distinctSessions: number;
    biggestClusterTag?: string | null;
    biggestClusterSharePct: number;
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
    if (!ADMIN_MISTAKE_CLUSTERS_ENABLED) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      setMistakeClusterLoading(true);
      setMistakeClusterError(null);
      try {
        const response = await apiClient.getCoachMistakeClusters(windowDays, 5);
        if (cancelled) return;
        setMistakeClusters(response.items);
        setMistakeClusterSummary(response.summary);
        trackEvent('report_opened', {
          module: 'reports',
          requestId: response.requestId,
          payload: {
            windowDays,
            clusterCount: response.items.length,
            panel: 'admin_mistake_clusters',
          },
        });
      } catch (loadError) {
        if (!cancelled) {
          setMistakeClusterError(loadError instanceof Error ? loadError.message : 'Failed to load mistake clusters');
        }
      } finally {
        if (!cancelled) {
          setMistakeClusterLoading(false);
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

      {ADMIN_MISTAKE_CLUSTERS_ENABLED ? (
        <article className="mvp-card">
          <h2>Admin Mistake Clusters Radar</h2>
          <p className="mvp-muted">
            Focus homework launch on repeated high-EV-loss clusters across coaching sessions.
          </p>
          {mistakeClusterSummary ? (
            <p className="mvp-muted">
              Hands: {mistakeClusterSummary.totalHands} · Sessions: {mistakeClusterSummary.distinctSessions} · Top:{' '}
              {mistakeClusterSummary.biggestClusterTag ?? '-'} ({mistakeClusterSummary.biggestClusterSharePct.toFixed(1)}%)
            </p>
          ) : null}
          {mistakeClusterLoading ? <p className="mvp-muted">Loading mistake clusters…</p> : null}
          {!mistakeClusterLoading && mistakeClusters.length === 0 ? (
            <p className="mvp-muted">No tagged mistakes yet for selected window.</p>
          ) : null}
          {!mistakeClusterLoading && mistakeClusters.length > 0 ? (
            <ul className="mvp-report-list">
              {mistakeClusters.map((cluster) => (
                <li key={cluster.tag}>
                  <div className="mvp-report-list__title">
                    <strong>{cluster.tag}</strong>
                    <span>
                      {cluster.riskLevel.toUpperCase()} · {cluster.sharePct.toFixed(1)}%
                    </span>
                  </div>
                  <p>
                    EV loss {cluster.avgEvLossBb100.toFixed(1)} bb/100 · sample {cluster.sampleSize} · repeat session rate{' '}
                    {cluster.repeatSessionRatePct.toFixed(1)}%
                  </p>
                  <p>Suggested campaign: {cluster.suggestedCampaign}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {mistakeClusterError ? <p className="module-error-text">{mistakeClusterError}</p> : null}
        </article>
      ) : null}

      {error ? <p className="module-error-text">{error}</p> : null}
    </section>
  );
}
