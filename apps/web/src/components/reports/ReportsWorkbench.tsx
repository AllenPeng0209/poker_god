'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { apiClient, type CoachCampaignRecommendationsResponse } from '@/lib/apiClient';
import { trackEvent } from '@/lib/analytics';

const WINDOW_OPTIONS: Array<7 | 30 | 90> = [7, 30, 90];
const ADMIN_COACH_CAMPAIGN_RECO_V1 = process.env.NEXT_PUBLIC_ADMIN_COACH_CAMPAIGN_RECO_V1 === '1';

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
  const [campaignReco, setCampaignReco] = useState<CoachCampaignRecommendationsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [response, campaignResponse] = await Promise.all([
          apiClient.getLeakReport(windowDays),
          ADMIN_COACH_CAMPAIGN_RECO_V1 ? apiClient.getCoachCampaignRecommendations(windowDays) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setItems(response.items);
        setGeneratedAt(response.generatedAt);
        setCampaignReco(campaignResponse);
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

      {ADMIN_COACH_CAMPAIGN_RECO_V1 ? (
        <article className="mvp-card">
          <h2>Admin Coach Campaign Recommendations</h2>
          <p className="mvp-muted">
            Baseline attach {campaignReco?.baselineAttachRatePct.toFixed(1) ?? '-'}% → projected{' '}
            {campaignReco?.projectedAttachRatePct.toFixed(1) ?? '-'}% (lift{' '}
            {campaignReco?.projectedAttachLiftPct.toFixed(1) ?? '-'}%).
          </p>
          <p className="mvp-muted">Highest impact stage: {campaignReco?.highestImpactStage ?? '-'}</p>
          {campaignReco?.items?.length ? (
            <ul className="mvp-report-list">
              {campaignReco.items.map((item) => (
                <li key={item.stageKey}>
                  <div className="mvp-report-list__title">
                    <strong>{item.stageLabel}</strong>
                    <span>Blocker {item.blockerRatePct.toFixed(1)}%</span>
                  </div>
                  <p>
                    Recover ≈ {item.expectedRecoveredSessions} sessions (+{item.expectedAttachLiftPct.toFixed(2)}% attach) ·
                    {` ${item.recommendedCampaignType}`}
                  </p>
                  <p>{item.recommendedAction}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mvp-muted">No recommendation data yet.</p>
          )}
        </article>
      ) : null}

      {error ? <p className="module-error-text">{error}</p> : null}
    </section>
  );
}
