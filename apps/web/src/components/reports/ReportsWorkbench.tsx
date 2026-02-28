'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { apiClient } from '@/lib/apiClient';
import { trackEvent } from '@/lib/analytics';

const WINDOW_OPTIONS: Array<7 | 30 | 90> = [7, 30, 90];
const ADMIN_COACH_FUNNEL_FLAG = process.env.NEXT_PUBLIC_ADMIN_COACH_FUNNEL_V1 === '1';

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
  const [coachFunnel, setCoachFunnel] = useState<{
    generatedAt: string;
    homeworkAttachRatePct: number;
    homeworkCompletionRatePct: number;
    biggestDropStageKey?: string | null;
    stages: Array<{
      key: 'coach_message_sent' | 'coach_action_executed' | 'drill_started' | 'drill_completed';
      label: string;
      sessions: number;
      conversionPctFromPrev: number;
    }>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [reportResponse, coachFunnelResponse] = await Promise.all([
          apiClient.getLeakReport(windowDays),
          ADMIN_COACH_FUNNEL_FLAG ? apiClient.getCoachFunnelSummary(windowDays) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setItems(reportResponse.items);
        setGeneratedAt(reportResponse.generatedAt);
        setCoachFunnel(
          coachFunnelResponse
            ? {
                generatedAt: coachFunnelResponse.generatedAt,
                homeworkAttachRatePct: coachFunnelResponse.homeworkAttachRatePct,
                homeworkCompletionRatePct: coachFunnelResponse.homeworkCompletionRatePct,
                biggestDropStageKey: coachFunnelResponse.biggestDropStageKey,
                stages: coachFunnelResponse.stages,
              }
            : null,
        );
        trackEvent('report_opened', {
          module: 'reports',
          requestId: reportResponse.requestId,
          payload: {
            windowDays,
            itemCount: reportResponse.items.length,
            coachFunnelEnabled: ADMIN_COACH_FUNNEL_FLAG,
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

      {ADMIN_COACH_FUNNEL_FLAG ? (
        <article className="mvp-card">
          <h2>Admin Coach Funnel Radar</h2>
          {coachFunnel ? (
            <>
              <p className="mvp-muted">
                generatedAt: {coachFunnel.generatedAt} · attach rate: {coachFunnel.homeworkAttachRatePct.toFixed(1)}% ·
                completion rate: {coachFunnel.homeworkCompletionRatePct.toFixed(1)}%
              </p>
              <ul className="mvp-report-list">
                {coachFunnel.stages.map((stage) => (
                  <li key={stage.key}>
                    <div className="mvp-report-list__title">
                      <strong>{stage.label}</strong>
                      <span>{stage.sessions} sessions</span>
                    </div>
                    <p>conversion from previous stage: {stage.conversionPctFromPrev.toFixed(1)}%</p>
                    {coachFunnel.biggestDropStageKey === stage.key ? (
                      <p className="module-error-text">Largest drop-off stage: prioritize intervention here.</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mvp-muted">No coach funnel data loaded.</p>
          )}
        </article>
      ) : null}

      {error ? <p className="module-error-text">{error}</p> : null}
    </section>
  );
}
