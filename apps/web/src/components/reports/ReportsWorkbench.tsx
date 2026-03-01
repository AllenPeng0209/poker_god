'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { apiClient } from '@/lib/apiClient';
import { trackEvent } from '@/lib/analytics';

const WINDOW_OPTIONS: Array<7 | 30 | 90> = [7, 30, 90];
const ADMIN_EV_HOTSPOTS_ENABLED = process.env.NEXT_PUBLIC_ADMIN_EV_HOTSPOTS_V1 === '1';

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
  const [evHotspots, setEvHotspots] = useState<{
    generatedAt: string;
    totalHands: number;
    totalEvLossBb100: number;
    biggestLeakKey: string | null;
    biggestLeakSharePct: number;
    byStreet: Array<{
      key: string;
      label: string;
      sampleSize: number;
      totalEvLossBb100: number;
      sharePct: number;
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

        if (ADMIN_EV_HOTSPOTS_ENABLED) {
          const hotspots = await apiClient.getAdminEvHotspots(windowDays);
          if (!cancelled) {
            setEvHotspots({
              generatedAt: hotspots.generatedAt,
              totalHands: hotspots.summary.totalHands,
              totalEvLossBb100: hotspots.summary.totalEvLossBb100,
              biggestLeakKey: hotspots.summary.biggestLeakKey,
              biggestLeakSharePct: hotspots.summary.biggestLeakSharePct,
              byStreet: hotspots.byStreet,
            });
          }
        } else {
          setEvHotspots(null);
        }

        trackEvent('report_opened', {
          module: 'reports',
          requestId: response.requestId,
          payload: {
            windowDays,
            itemCount: response.items.length,
            evHotspotsEnabled: ADMIN_EV_HOTSPOTS_ENABLED,
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

      {ADMIN_EV_HOTSPOTS_ENABLED && evHotspots ? (
        <article className="mvp-card">
          <h2>Admin EV Leak Hotspots</h2>
          <p className="mvp-muted">
            {`window=${windowDays}d · hands=${evHotspots.totalHands} · totalEVLoss=${evHotspots.totalEvLossBb100.toFixed(1)} · biggest=${evHotspots.biggestLeakKey ?? 'n/a'} (${evHotspots.biggestLeakSharePct.toFixed(1)}%)`}
          </p>
          {evHotspots.byStreet.length === 0 ? <p className="mvp-muted">No hotspots yet.</p> : null}
          {evHotspots.byStreet.length > 0 ? (
            <ul className="mvp-report-list">
              {evHotspots.byStreet.map((item, index) => (
                <li key={`${item.key}-${index}`}>
                  <div className="mvp-report-list__title">
                    <strong>{`#${index + 1} ${item.label}`}</strong>
                    <span>{`${item.sharePct.toFixed(1)}% EV share`}</span>
                  </div>
                  <p>{`sample=${item.sampleSize} · totalEVLoss=${item.totalEvLossBb100.toFixed(1)}`}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ) : null}

      {error ? <p className="module-error-text">{error}</p> : null}
    </section>
  );
}
