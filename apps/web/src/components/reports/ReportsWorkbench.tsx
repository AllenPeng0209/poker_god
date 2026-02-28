'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import {
  apiClient,
  type CoachHomework,
  type CoachHomeworkStatus,
} from '@/lib/apiClient';
import { trackEvent } from '@/lib/analytics';

const WINDOW_OPTIONS: Array<7 | 30 | 90> = [7, 30, 90];
const HOMEWORK_QA_FLAG = process.env.NEXT_PUBLIC_ADMIN_HOMEWORK_QA_V1 === '1';

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
  const [qaHomework, setQaHomework] = useState<CoachHomework | null>(null);
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

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

  const runHomeworkLifecycleQA = async () => {
    setQaError(null);
    setQaLoading(true);
    try {
      const created = await apiClient.createCoachHomework({
        userId: 'qa-admin',
        title: `QA Homework ${new Date().toISOString()}`,
        sourceLeakCluster: 'river-overbluff-call',
        metadata: { source: 'reports_workbench_ui_qa' },
        createdBy: 'admin-ui-qa',
      });

      const promoted = await apiClient.updateCoachHomeworkStatus(created.homework.id, 'in_progress', 'admin-ui-qa');
      const finished = await apiClient.updateCoachHomeworkStatus(promoted.homework.id, 'completed', 'admin-ui-qa');
      const fetched = await apiClient.getCoachHomework(finished.homework.id);
      setQaHomework(fetched);
      trackEvent('coach_action_executed', {
        module: 'reports',
        payload: {
          action: 'homework_lifecycle_qa',
          homeworkId: fetched.id,
          status: fetched.status,
        },
      });
    } catch (err) {
      setQaError(err instanceof Error ? err.message : 'Homework lifecycle QA failed');
    } finally {
      setQaLoading(false);
    }
  };

  const statusChipLabel = (status: CoachHomeworkStatus) => {
    if (status === 'pending') return 'Pending';
    if (status === 'in_progress') return 'In Progress';
    if (status === 'completed') return 'Completed';
    return 'Archived';
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

      {HOMEWORK_QA_FLAG ? (
        <article className="mvp-card" data-testid="homework-lifecycle-qa-panel">
          <h2>Homework lifecycle QA (Admin)</h2>
          <p className="mvp-muted">Create → In Progress → Completed end-to-end check for coach homework persistence APIs.</p>
          <button type="button" className="module-next-link" onClick={() => void runHomeworkLifecycleQA()} disabled={qaLoading}>
            {qaLoading ? 'Running QA...' : 'Run lifecycle QA'}
          </button>
          {qaHomework ? (
            <div className="mvp-inline" style={{ marginTop: 12 }}>
              <span className="mvp-muted">Homework ID: {qaHomework.id}</span>
              <strong>{statusChipLabel(qaHomework.status)}</strong>
              <span className="mvp-muted">Cluster: {qaHomework.sourceLeakCluster}</span>
            </div>
          ) : null}
          {qaError ? <p className="module-error-text">{qaError}</p> : null}
        </article>
      ) : null}

      {error ? <p className="module-error-text">{error}</p> : null}
    </section>
  );
}
