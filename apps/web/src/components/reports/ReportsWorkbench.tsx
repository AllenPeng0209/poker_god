'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { apiClient } from '@/lib/apiClient';
import { trackEvent } from '@/lib/analytics';

const WINDOW_OPTIONS: Array<7 | 30 | 90> = [7, 30, 90];
const ADMIN_HOMEWORK_CAMPAIGN_ENABLED = process.env.NEXT_PUBLIC_ADMIN_HOMEWORK_CAMPAIGN_V1 === 'true';

export function ReportsWorkbench() {
  const { t } = useI18n();
  const [windowDays, setWindowDays] = useState<7 | 30 | 90>(30);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>('');
  const [adminOverview, setAdminOverview] = useState<{
    generatedAt: string;
    averageEvLossBb100: number;
    evLossTrendPct: number;
    topLeakTag: string | null;
    criticalClusterCount: number;
    recommendedAction: 'monitor' | 'launch_homework_campaign';
  } | null>(null);
  const [campaignDraft, setCampaignDraft] = useState<{
    id: string;
    title: string;
    totalHomeworkItems: number;
    topLeakTag: string | null;
  } | null>(null);
  const [campaignSubmitting, setCampaignSubmitting] = useState(false);
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
        const [response, overview] = await Promise.all([
          apiClient.getLeakReport(windowDays),
          ADMIN_HOMEWORK_CAMPAIGN_ENABLED ? apiClient.getAdminAnalyzeMistakeOverview() : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setItems(response.items);
        setGeneratedAt(response.generatedAt);
        if (overview) {
          setAdminOverview({
            generatedAt: overview.generatedAt,
            averageEvLossBb100: overview.averageEvLossBb100,
            evLossTrendPct: overview.evLossTrendPct,
            topLeakTag: overview.topLeakTag,
            criticalClusterCount: overview.criticalClusterCount,
            recommendedAction: overview.recommendedAction,
          });
        }
        trackEvent('report_opened', {
          module: 'reports',
          requestId: response.requestId,
          payload: {
            windowDays,
            itemCount: response.items.length,
            adminOverviewRecommendedAction: overview?.recommendedAction,
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

  const launchHomeworkCampaign = async () => {
    if (!ADMIN_HOMEWORK_CAMPAIGN_ENABLED || campaignSubmitting) {
      return;
    }

    setCampaignSubmitting(true);
    setError(null);
    try {
      const response = await apiClient.createAdminHomeworkCampaign({ topN: 3 });
      setCampaignDraft({
        id: response.campaign.id,
        title: response.campaign.title,
        totalHomeworkItems: response.campaign.totalHomeworkItems,
        topLeakTag: response.campaign.topLeakTag,
      });
      trackEvent('coach_action_executed', {
        module: 'reports',
        payload: {
          action: 'launch_homework_campaign',
          campaignId: response.campaign.id,
          homeworkItems: response.campaign.totalHomeworkItems,
        },
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('reports.errors.loadFailed'));
    } finally {
      setCampaignSubmitting(false);
    }
  };

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

      {ADMIN_HOMEWORK_CAMPAIGN_ENABLED ? (
        <article className="mvp-card">
          <h2>Admin: Leak Campaign Launcher</h2>
          {adminOverview ? (
            <>
              <p className="mvp-muted">
                Avg EV Loss: {adminOverview.averageEvLossBb100.toFixed(1)} bb/100 · Trend: {adminOverview.evLossTrendPct.toFixed(1)}%
                · Critical Clusters: {adminOverview.criticalClusterCount}
              </p>
              <p>
                Top Leak Tag: <strong>{adminOverview.topLeakTag ?? 'n/a'}</strong> · Recommendation:{' '}
                <strong>{adminOverview.recommendedAction}</strong>
              </p>
              <button
                type="button"
                className="module-next-link"
                disabled={campaignSubmitting || adminOverview.recommendedAction !== 'launch_homework_campaign'}
                onClick={() => {
                  void launchHomeworkCampaign();
                }}
              >
                {campaignSubmitting ? 'Launching...' : 'Launch Homework Campaign'}
              </button>
              {campaignDraft ? (
                <p className="mvp-muted">
                  Draft created: {campaignDraft.title} ({campaignDraft.id.slice(0, 8)}) · {campaignDraft.totalHomeworkItems} items · leak{' '}
                  {campaignDraft.topLeakTag ?? 'n/a'}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mvp-muted">Loading admin overview...</p>
          )}
        </article>
      ) : null}

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
