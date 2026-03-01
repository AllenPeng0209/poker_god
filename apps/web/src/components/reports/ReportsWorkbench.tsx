'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { apiClient, type CoachCampaignAttributionItem } from '@/lib/apiClient';
import { trackEvent } from '@/lib/analytics';

const WINDOW_OPTIONS: Array<7 | 30 | 90> = [7, 30, 90];
const ADMIN_CAMPAIGN_ATTRIBUTION_ENABLED = process.env.NEXT_PUBLIC_ADMIN_CAMPAIGN_ATTRIBUTION_V1 === '1';

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
  const [attributionLoading, setAttributionLoading] = useState(false);
  const [attributionError, setAttributionError] = useState<string | null>(null);
  const [attributionItems, setAttributionItems] = useState<CoachCampaignAttributionItem[]>([]);
  const [attributionSummary, setAttributionSummary] = useState<{
    totalLaunches: number;
    attributedAttaches: number;
    attributedCompletions: number;
    attachRatePct: number;
    completionRatePct: number;
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
    if (!ADMIN_CAMPAIGN_ATTRIBUTION_ENABLED) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      setAttributionLoading(true);
      setAttributionError(null);
      try {
        const response = await apiClient.getCoachCampaignAttribution(windowDays, 5);
        if (cancelled) return;
        setAttributionItems(response.items);
        setAttributionSummary(response.summary);
      } catch (loadError) {
        if (!cancelled) {
          setAttributionError(loadError instanceof Error ? loadError.message : 'Failed to load campaign attribution');
        }
      } finally {
        if (!cancelled) {
          setAttributionLoading(false);
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

      {ADMIN_CAMPAIGN_ATTRIBUTION_ENABLED ? (
        <article className="mvp-card">
          <h2>Admin + Mobile Campaign Attribution Loop</h2>
          {attributionLoading ? <p className="mvp-muted">Loading attribution…</p> : null}
          {attributionError ? <p className="module-error-text">{attributionError}</p> : null}
          {!attributionLoading && !attributionError && attributionSummary ? (
            <p className="mvp-muted">
              Launches {attributionSummary.totalLaunches} · Attaches {attributionSummary.attributedAttaches} ({attributionSummary.attachRatePct.toFixed(1)}%) · Completions {attributionSummary.attributedCompletions} ({attributionSummary.completionRatePct.toFixed(1)}%)
            </p>
          ) : null}
          {!attributionLoading && !attributionError && attributionItems.length > 0 ? (
            <ul className="mvp-report-list">
              {attributionItems.map((item) => (
                <li key={item.campaignId}>
                  <div className="mvp-report-list__title">
                    <strong>{item.campaignId}</strong>
                    <span>{item.source}</span>
                  </div>
                  <p>
                    Launches {item.launches} · Attach {item.attachRatePct.toFixed(1)}% · Completion {item.completionRatePct.toFixed(1)}%
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
          {!attributionLoading && !attributionError && attributionItems.length === 0 ? (
            <p className="mvp-muted">No campaign launch events in selected window.</p>
          ) : null}
        </article>
      ) : null}

      {error ? <p className="module-error-text">{error}</p> : null}
    </section>
  );
}
