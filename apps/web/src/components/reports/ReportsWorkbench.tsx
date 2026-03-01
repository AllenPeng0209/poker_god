'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { apiClient } from '@/lib/apiClient';
import { trackEvent } from '@/lib/analytics';

const WINDOW_OPTIONS: Array<7 | 30 | 90> = [7, 30, 90];
const ADMIN_COACH_SESSION_MEMORY_V1 = process.env.NEXT_PUBLIC_ADMIN_COACH_SESSION_MEMORY_V1 === '1';

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
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [memorySummary, setMemorySummary] = useState<{
    sessions: number;
    highRiskSessions: number;
    averageAttachRatePct: number;
    staleRiskRatePct: number;
  } | null>(null);
  const [memorySessions, setMemorySessions] = useState<
    Array<{
      sessionId: string;
      attachRatePct: number;
      staleHours: number;
      riskLevel: 'low' | 'medium' | 'high';
      recommendedAction: string;
    }>
  >([]);

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
    if (!ADMIN_COACH_SESSION_MEMORY_V1) return;
    let cancelled = false;
    const run = async () => {
      setMemoryLoading(true);
      setMemoryError(null);
      try {
        const response = await apiClient.getCoachSessionMemory(windowDays, 5);
        if (cancelled) return;
        setMemorySummary(response.summary);
        setMemorySessions(
          response.sessions.map((session) => ({
            sessionId: session.sessionId,
            attachRatePct: session.attachRatePct,
            staleHours: session.staleHours,
            riskLevel: session.riskLevel,
            recommendedAction: session.recommendedAction,
          })),
        );
      } catch (loadError) {
        if (!cancelled) {
          setMemoryError(loadError instanceof Error ? loadError.message : 'Failed to load coach session memory radar.');
        }
      } finally {
        if (!cancelled) {
          setMemoryLoading(false);
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

      {ADMIN_COACH_SESSION_MEMORY_V1 ? (
        <article className="mvp-card">
          <h2>Admin Coach Session Memory Radar</h2>
          {memoryLoading ? <p className="mvp-muted">Loading coach memory risk...</p> : null}
          {!memoryLoading && memorySummary ? (
            <p className="mvp-muted">
              Sessions {memorySummary.sessions} · High risk {memorySummary.highRiskSessions} · Avg attach{' '}
              {memorySummary.averageAttachRatePct.toFixed(1)}% · Stale risk {memorySummary.staleRiskRatePct.toFixed(1)}%
            </p>
          ) : null}
          {!memoryLoading && memorySessions.length > 0 ? (
            <ul className="mvp-report-list">
              {memorySessions.map((session, index) => (
                <li key={session.sessionId}>
                  <div className="mvp-report-list__title">
                    <strong>
                      #{index + 1} {session.sessionId}
                    </strong>
                    <span>{session.riskLevel.toUpperCase()}</span>
                  </div>
                  <p>
                    attach {session.attachRatePct.toFixed(1)}% · stale {session.staleHours.toFixed(1)}h
                  </p>
                  <p>{session.recommendedAction}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {memoryError ? <p className="module-error-text">{memoryError}</p> : null}
        </article>
      ) : null}

      {error ? <p className="module-error-text">{error}</p> : null}
    </section>
  );
}
