'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { apiClient } from '@/lib/apiClient';
import { trackEvent } from '@/lib/analytics';

const WINDOW_OPTIONS: Array<7 | 30 | 90> = [7, 30, 90];
const ADMIN_OPS_LATENCY_V1 = process.env.NEXT_PUBLIC_ADMIN_OPS_LATENCY_V1 === '1';

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
  const [latencyLoading, setLatencyLoading] = useState(false);
  const [latencyError, setLatencyError] = useState<string | null>(null);
  const [latencyGeneratedAt, setLatencyGeneratedAt] = useState<string>('');
  const [latencySampleSize, setLatencySampleSize] = useState<number>(0);
  const [latencyRoutes, setLatencyRoutes] = useState<
    Array<{
      route: string;
      count: number;
      avgMs: number;
      p50Ms: number;
      p95Ms: number;
      maxMs: number;
    }>
  >([]);

  const hotRoutes = useMemo(() => latencyRoutes.slice(0, 5), [latencyRoutes]);

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
    if (!ADMIN_OPS_LATENCY_V1) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLatencyLoading(true);
      setLatencyError(null);
      try {
        const response = await apiClient.getAdminLatencyOps();
        if (cancelled) return;
        setLatencyGeneratedAt(response.generatedAt);
        setLatencySampleSize(response.sampleSize);
        setLatencyRoutes(response.routes);
      } catch (loadError) {
        if (!cancelled) {
          setLatencyError(loadError instanceof Error ? loadError.message : t('reports.errors.loadFailed'));
        }
      } finally {
        if (!cancelled) {
          setLatencyLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [t]);

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

      {ADMIN_OPS_LATENCY_V1 ? (
        <article className="mvp-card" data-testid="admin-latency-radar">
          <h2>{t('reports.adminLatency.title')}</h2>
          <p className="mvp-muted">
            {t('reports.adminLatency.summary', {
              generatedAt: latencyGeneratedAt || '-',
              sampleSize: latencySampleSize.toString(),
            })}
          </p>
          {latencyLoading ? <p className="mvp-muted">{t('reports.adminLatency.loading')}</p> : null}
          {!latencyLoading && hotRoutes.length === 0 ? (
            <p className="mvp-muted">{t('reports.adminLatency.empty')}</p>
          ) : null}
          {!latencyLoading && hotRoutes.length > 0 ? (
            <ul className="mvp-report-list">
              {hotRoutes.map((route) => (
                <li key={route.route}>
                  <div className="mvp-report-list__title">
                    <strong>{route.route}</strong>
                    <span>{t('reports.adminLatency.p95', { value: route.p95Ms.toFixed(2) })}</span>
                  </div>
                  <p>
                    {t('reports.adminLatency.detail', {
                      count: route.count.toString(),
                      avg: route.avgMs.toFixed(2),
                      p50: route.p50Ms.toFixed(2),
                      max: route.maxMs.toFixed(2),
                    })}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
          {latencyError ? <p className="module-error-text">{latencyError}</p> : null}
        </article>
      ) : null}

      {error ? <p className="module-error-text">{error}</p> : null}
    </section>
  );
}
