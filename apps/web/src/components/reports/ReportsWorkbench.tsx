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
  const [coachBlockers, setCoachBlockers] = useState<{
    generatedAt: string;
    biggestBlockerStage: string;
    attachRatePct: number;
    completionRatePct: number;
    blockers: Array<{
      stage: string;
      sessions: number;
      dropoffPct: number;
      impactScore: number;
      recommendedAction: string;
    }>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [response, blockersResponse] = await Promise.all([
          apiClient.getLeakReport(windowDays),
          apiClient.getCoachConversionBlockers(windowDays),
        ]);
        if (cancelled) return;
        setItems(response.items);
        setGeneratedAt(response.generatedAt);
        setCoachBlockers({
          generatedAt: blockersResponse.generatedAt,
          biggestBlockerStage: blockersResponse.biggestBlockerStage,
          attachRatePct: blockersResponse.attachRatePct,
          completionRatePct: blockersResponse.completionRatePct,
          blockers: blockersResponse.blockers,
        });
        trackEvent('report_opened', {
          module: 'reports',
          requestId: response.requestId,
          payload: {
            windowDays,
            itemCount: response.items.length,
            blockerCount: blockersResponse.blockers.length,
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

      {process.env.NEXT_PUBLIC_ADMIN_COACH_CONVERSION_BLOCKERS_V1 === '1' ? (
        <article className="mvp-card" data-testid="admin-coach-conversion-blockers-radar">
          <h2>Admin Coach Conversion Blockers Radar</h2>
          {isLoading ? <p className="mvp-muted">Loading conversion blockers...</p> : null}
          {!isLoading && coachBlockers ? (
            <>
              <p className="mvp-muted">
                Generated: {coachBlockers.generatedAt || '-'} · Biggest blocker: {coachBlockers.biggestBlockerStage}
              </p>
              <p>
                Attach rate: {coachBlockers.attachRatePct.toFixed(1)}% · Completion rate:{' '}
                {coachBlockers.completionRatePct.toFixed(1)}%
              </p>
              <ul className="mvp-report-list">
                {coachBlockers.blockers.slice(0, 3).map((item, index) => (
                  <li key={`${item.stage}-${index}`}>
                    <div className="mvp-report-list__title">
                      <strong>
                        #{index + 1} {item.stage}
                      </strong>
                      <span>Impact {item.impactScore.toFixed(1)}</span>
                    </div>
                    <p>
                      Sessions {item.sessions} · Dropoff {item.dropoffPct.toFixed(1)}%
                    </p>
                    <p>{item.recommendedAction}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </article>
      ) : null}

      {error ? <p className="module-error-text">{error}</p> : null}
    </section>
  );
}
