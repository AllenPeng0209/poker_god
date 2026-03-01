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
  const campaignLaunchEnabled = process.env.NEXT_PUBLIC_ADMIN_COACH_CAMPAIGN_LAUNCH_V1 === '1';
  const [campaignName, setCampaignName] = useState('');
  const [targetCluster, setTargetCluster] = useState('over_fold');
  const [campaignStatus, setCampaignStatus] = useState<string>('');
  const [launchingCampaign, setLaunchingCampaign] = useState(false);

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

  const handleLaunchCampaign = async () => {
    if (!campaignName.trim()) {
      setCampaignStatus('Campaign name is required.');
      return;
    }
    setLaunchingCampaign(true);
    setCampaignStatus('');
    try {
      const response = await apiClient.createCoachCampaign({
        campaignName: campaignName.trim(),
        targetCluster,
        channel: 'in_app',
        sourceWindowDays: windowDays,
        expectedAttachLiftPct: 4,
        createdBy: 'admin-web',
        launchNow: true,
      });
      setCampaignStatus(`Launched ${response.campaign.campaignName} (${response.campaign.id.slice(0, 8)})`);
      trackEvent('coach_action_executed', {
        module: 'reports',
        requestId: response.requestId,
        payload: {
          campaignId: response.campaign.id,
          targetCluster: response.campaign.targetCluster,
          channel: response.campaign.channel,
        },
      });
      setCampaignName('');
    } catch (submitError) {
      setCampaignStatus(submitError instanceof Error ? submitError.message : 'Campaign launch failed.');
    } finally {
      setLaunchingCampaign(false);
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

      {campaignLaunchEnabled ? (
        <article className="mvp-card">
          <h2>Admin Coach Campaign Launch (Flagged)</h2>
          <p className="mvp-muted">Feature flag: NEXT_PUBLIC_ADMIN_COACH_CAMPAIGN_LAUNCH_V1</p>
          <div className="mvp-inline">
            <input
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              placeholder="Campaign name"
              aria-label="Campaign name"
            />
            <select value={targetCluster} onChange={(event) => setTargetCluster(event.target.value)}>
              <option value="over_fold">over_fold</option>
              <option value="over_bluff">over_bluff</option>
              <option value="missed_value">missed_value</option>
            </select>
            <button type="button" onClick={() => void handleLaunchCampaign()} disabled={launchingCampaign}>
              {launchingCampaign ? 'Launching...' : 'Launch now'}
            </button>
          </div>
          {campaignStatus ? <p className="mvp-muted">{campaignStatus}</p> : null}
        </article>
      ) : null}

      {error ? <p className="module-error-text">{error}</p> : null}
    </section>
  );
}
