'use client';

import type { PracticeDifficulty, PracticeMode, PracticeSessionSummary } from '@poker-god/contracts';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { apiClient } from '@/lib/apiClient';
import { trackEvent } from '@/lib/analytics';

const MODE_OPTIONS: PracticeMode[] = ['by_spot', 'by_street', 'full_hand'];

const DIFFICULTY_OPTIONS: PracticeDifficulty[] = ['beginner', 'intermediate', 'advanced', 'elite'];

export function PracticeSessionPanel() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const incomingDrillId = searchParams.get('drillId');

  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drillOptions, setDrillOptions] = useState<Array<{ id: string; title: string; itemCount: number }>>([]);
  const [selectedDrillId, setSelectedDrillId] = useState<string>('');
  const [mode, setMode] = useState<PracticeMode>('by_spot');
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>('intermediate');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionProgress, setSessionProgress] = useState<{ answered: number; total: number } | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<{
    itemId: string;
    prompt: string;
    options: string[];
  } | null>(null);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    explanation: string;
    evLossBb100: number;
    frequencyGapPct: number;
    recommendedAction: string;
  } | null>(null);
  const [summary, setSummary] = useState<PracticeSessionSummary | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const questionStartedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.listDrills();
        if (cancelled) return;

        const options = response.drills.map((drill) => ({
          id: drill.id,
          title: drill.title,
          itemCount: drill.itemCount,
        }));
        setDrillOptions(options);
        const defaultDrillId = options.find((drill) => drill.id === incomingDrillId)?.id ?? options[0]?.id ?? '';
        setSelectedDrillId(defaultDrillId);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('practice.errors.loadDrillFailed'));
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
  }, [incomingDrillId, t]);

  const activeDrill = useMemo(
    () => drillOptions.find((drill) => drill.id === selectedDrillId) ?? null,
    [drillOptions, selectedDrillId],
  );

  async function handleStartSession() {
    if (!selectedDrillId || isSubmitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setFeedback(null);
    setSummary(null);
    try {
      const response = await apiClient.startPracticeSession({
        drillId: selectedDrillId,
        mode,
        difficulty,
      });
      setActiveSessionId(response.session.id);
      setCurrentQuestion(response.nextQuestion);
      setSessionProgress({ answered: response.session.answeredItems, total: response.session.totalItems });
      questionStartedAtRef.current = Date.now();

      trackEvent('drill_started', {
        module: 'practice',
        requestId: response.requestId,
        payload: {
          drillId: selectedDrillId,
          mode,
          difficulty,
        },
      });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : t('practice.errors.startFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAnswer(chosenAction: string) {
    if (!activeSessionId || !currentQuestion || isSubmitting) {
      return;
    }

    const decisionTimeMs = Math.max(120, Date.now() - questionStartedAtRef.current);
    setSubmitting(true);
    setError(null);
    try {
      const response = await apiClient.submitPracticeAnswer(activeSessionId, {
        itemId: currentQuestion.itemId,
        chosenAction,
        decisionTimeMs,
      });
      setFeedback(response.feedback);
      setCurrentQuestion(response.nextQuestion);
      setSessionProgress(response.progress);
      questionStartedAtRef.current = Date.now();
    } catch (answerError) {
      setError(answerError instanceof Error ? answerError.message : t('practice.errors.answerFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteSession() {
    if (!activeSessionId || isSubmitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await apiClient.completePracticeSession(activeSessionId);
      setSummary(response.summary);
      setCurrentQuestion(null);
      setActiveSessionId(null);
      trackEvent('drill_completed', {
        module: 'practice',
        requestId: response.requestId,
        payload: {
          scorePct: response.summary.scorePct,
          totalEvLossBb100: response.summary.totalEvLossBb100,
        },
      });
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : t('practice.errors.completeFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mvp-panel" aria-labelledby="practice-title">
      <header className="mvp-panel__header">
        <div>
          <p className="module-eyebrow">{t('practice.eyebrow')}</p>
          <h1 id="practice-title">{t('practice.title')}</h1>
          <p>{t('practice.description')}</p>
        </div>
        <Link className="module-next-link" href="/app/analyze">
          {t('practice.nextAnalyze')}
        </Link>
      </header>

      <div className="mvp-grid">
        <article className="mvp-card">
          <h2>{t('practice.setup.title')}</h2>
          {isLoading ? <p>{t('practice.setup.loadingDrills')}</p> : null}
          {!isLoading ? (
            <div className="mvp-form">
              <label>
                {t('practice.setup.drill')}
                <select
                  value={selectedDrillId}
                  onChange={(event) => setSelectedDrillId(event.target.value)}
                  disabled={Boolean(activeSessionId)}
                >
                  {drillOptions.map((drill) => (
                    <option key={drill.id} value={drill.id}>
                      {drill.title} ({t('practice.units.questions', { count: drill.itemCount.toString() })})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                {t('practice.setup.mode')}
                <select value={mode} onChange={(event) => setMode(event.target.value as PracticeMode)} disabled={Boolean(activeSessionId)}>
                  {MODE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t(`practice.mode.${option}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                {t('practice.setup.difficulty')}
                <select
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value as PracticeDifficulty)}
                  disabled={Boolean(activeSessionId)}
                >
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t(`practice.difficulty.${option}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <div className="mvp-actions">
            <button
              type="button"
              className="module-next-link"
              onClick={handleStartSession}
              disabled={!activeDrill || Boolean(activeSessionId) || isSubmitting}
            >
              {t('practice.actions.start')}
            </button>
            {sessionProgress ? (
              <p className="mvp-muted">
                {t('practice.progress', {
                  answered: sessionProgress.answered.toString(),
                  total: sessionProgress.total.toString(),
                })}
              </p>
            ) : null}
          </div>
        </article>

        <article className="mvp-card">
          <h2>{t('practice.qa.title')}</h2>
          {currentQuestion ? (
            <>
              <p className="mvp-question">{currentQuestion.prompt}</p>
              <div className="mvp-choice-grid">
                {currentQuestion.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="mvp-choice"
                    onClick={() => handleAnswer(option)}
                    disabled={isSubmitting}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="mvp-muted">{t('practice.qa.empty')}</p>
          )}

          {feedback ? (
            <div className={feedback.correct ? 'mvp-feedback mvp-feedback--ok' : 'mvp-feedback mvp-feedback--warn'}>
              <strong>{feedback.correct ? t('practice.qa.correct') : t('practice.qa.offBaseline')}</strong>
              <p>{feedback.explanation}</p>
              <p>
                {t('practice.qa.feedbackLine', {
                  action: feedback.recommendedAction,
                  evLoss: feedback.evLossBb100.toFixed(1),
                  freqGap: feedback.frequencyGapPct.toFixed(1),
                })}
              </p>
            </div>
          ) : null}

          {!currentQuestion && sessionProgress && sessionProgress.answered > 0 ? (
            <button type="button" className="module-next-link" onClick={handleCompleteSession} disabled={isSubmitting}>
              {t('practice.actions.complete')}
            </button>
          ) : null}
        </article>
      </div>

      {summary ? (
        <article className="mvp-card">
          <h2>{t('practice.summary.title')}</h2>
          <div className="mvp-kpi-grid">
            <div>
              <span>{t('practice.summary.score')}</span>
              <strong>{summary.scorePct}%</strong>
            </div>
            <div>
              <span>{t('practice.summary.totalEvLoss')}</span>
              <strong>{summary.totalEvLossBb100.toFixed(1)} bb/100</strong>
            </div>
            <div>
              <span>{t('practice.summary.avgFreqGap')}</span>
              <strong>{summary.averageFrequencyGapPct.toFixed(1)}%</strong>
            </div>
            <div>
              <span>{t('practice.summary.avgDecisionTime')}</span>
              <strong>{summary.averageDecisionTimeMs} ms</strong>
            </div>
          </div>
        </article>
      ) : null}

      {error ? <p className="module-error-text">{error}</p> : null}
    </section>
  );
}
