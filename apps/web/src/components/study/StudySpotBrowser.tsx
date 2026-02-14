'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { StudySpot as ApiStudySpot } from '@poker-god/contracts';
import { useI18n } from '@/components/i18n/I18nProvider';
import { apiClient } from '@/lib/apiClient';
import { trackEvent } from '@/lib/analytics';
import { STUDY_SPOTS as FALLBACK_STUDY_SPOTS, type StudySpot as LocalStudySpot } from './studySpots';

type StudySpot = LocalStudySpot;

type SpotFormatFilter = StudySpot['format'] | 'all';
type SpotPositionFilter = StudySpot['position'] | 'all';
type SpotStackFilter = StudySpot['stack_bb'] | 'all';
type StudyNodeTab = 'strategy' | 'ranges' | 'breakdown';
type SolverActionId = 'allin' | 'raise' | 'fold';

type SolverAction = {
  id: SolverActionId;
  label: string;
  frequency: number;
  combos: number;
};

type MatrixCell = {
  hand: string;
  raisePct: number;
  allinPct: number;
  foldPct: number;
  aggressionPct: number;
  strength: number;
};

const FORMAT_OPTIONS: SpotFormatFilter[] = ['all', 'Cash 6-max', 'Cash Heads-Up', 'MTT 9-max'];
const POSITION_OPTIONS: SpotPositionFilter[] = ['all', 'BTN vs BB', 'CO vs BTN', 'SB vs BB', 'UTG vs BB'];
const STACK_OPTIONS: SpotStackFilter[] = ['all', 20, 40, 60, 100];

const MATRIX_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

const RANK_VALUES: Record<string, number> = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  T: 10,
  '9': 9,
  '8': 8,
  '7': 7,
  '6': 6,
  '5': 5,
  '4': 4,
  '3': 3,
  '2': 2,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildHandLabel(rowIndex: number, colIndex: number) {
  const rowRank = MATRIX_RANKS[rowIndex];
  const colRank = MATRIX_RANKS[colIndex];

  if (rowIndex === colIndex) {
    return `${rowRank}${colRank}`;
  }

  if (rowIndex < colIndex) {
    return `${rowRank}${colRank}s`;
  }

  return `${colRank}${rowRank}o`;
}

function handStrength(hand: string) {
  const first = hand[0];
  const second = hand[1];
  const firstValue = RANK_VALUES[first] ?? 2;
  const secondValue = RANK_VALUES[second] ?? 2;
  const suited = hand.endsWith('s');
  const pair = first === second;
  const high = Math.max(firstValue, secondValue);
  const low = Math.min(firstValue, secondValue);
  const gap = high - low;

  if (pair) {
    return clamp(0.58 + ((high - 2) / 12) * 0.42, 0, 1);
  }

  const connectedBonus = clamp(0.1 - gap * 0.016, 0, 0.1);
  const suitedBonus = suited ? 0.085 : 0;
  const base = (high / 14) * 0.52 + (low / 14) * 0.31 + connectedBonus + suitedBonus;

  return clamp(base, 0, 0.98);
}

function normalizeMix(raise: number, allin: number) {
  const safeRaise = clamp(raise, 0, 100);
  const safeAllin = clamp(allin, 0, 100 - safeRaise);
  const safeFold = clamp(100 - safeRaise - safeAllin, 0, 100);
  const total = safeRaise + safeAllin + safeFold || 100;

  return {
    raisePct: (safeRaise / total) * 100,
    allinPct: (safeAllin / total) * 100,
    foldPct: (safeFold / total) * 100,
  };
}

function isAggressiveAction(action: string) {
  return /bet|raise|jam|allin|probe|stab/i.test(action);
}

function isAllinAction(action: string) {
  return /jam|allin/i.test(action);
}

function suitsClass(suit: string) {
  if (suit === 'h' || suit === 'd') {
    return 'study-board-card--red';
  }
  return 'study-board-card--black';
}

function suitSymbol(suit: string) {
  if (suit === 'h') {
    return '♥';
  }
  if (suit === 'd') {
    return '♦';
  }
  if (suit === 'c') {
    return '♣';
  }
  return '♠';
}

function mapApiSpot(spot: ApiStudySpot): StudySpot {
  return {
    id: spot.id,
    title: spot.title,
    format: spot.format,
    position: spot.position,
    stack_bb: spot.stackBb,
    street: spot.street,
    node: {
      node_code: spot.node.nodeCode,
      board: spot.node.board,
      hero: spot.node.hero,
      villain: spot.node.villain,
      pot_bb: spot.node.potBb,
      strategy: {
        recommended_line: spot.node.strategy.recommendedLine,
        aggregate_ev_bb: spot.node.strategy.aggregateEvBb,
        action_mix: spot.node.strategy.actionMix.map((item) => ({
          action: item.action,
          frequency_pct: item.frequencyPct,
          ev_bb: item.evBb,
        })),
      },
      ranges: {
        defense_freq_pct: spot.node.ranges.defenseFreqPct,
        buckets: spot.node.ranges.buckets.map((bucket) => ({
          bucket: bucket.bucket,
          combos: bucket.combos,
          frequency_pct: bucket.frequencyPct,
        })),
      },
      breakdown: {
        sample_size: spot.node.breakdown.sampleSize,
        avg_ev_loss_bb100: spot.node.breakdown.avgEvLossBb100,
        confidence: spot.node.breakdown.confidence,
        leaks: spot.node.breakdown.leaks.map((leak) => ({
          label: leak.label,
          frequency_gap_pct: leak.frequencyGapPct,
          ev_loss_bb100: leak.evLossBb100,
        })),
      },
    },
  };
}

export function StudySpotBrowser() {
  const { t, locale } = useI18n();
  const [spots, setSpots] = useState<StudySpot[]>(FALLBACK_STUDY_SPOTS);
  const [isLoadingSpots, setLoadingSpots] = useState(false);
  const [spotsError, setSpotsError] = useState<string | null>(null);
  const [formatFilter, setFormatFilter] = useState<SpotFormatFilter>('all');
  const [positionFilter, setPositionFilter] = useState<SpotPositionFilter>('all');
  const [stackFilter, setStackFilter] = useState<SpotStackFilter>('all');
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(FALLBACK_STUDY_SPOTS[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<StudyNodeTab>('strategy');
  const [selectedHand, setSelectedHand] = useState<string | null>(null);
  const [isCreatingDrill, setCreatingDrill] = useState(false);
  const [createdDrillId, setCreatedDrillId] = useState<string | null>(null);
  const [drillError, setDrillError] = useState<string | null>(null);

  const NODE_TAB_ITEMS: { id: StudyNodeTab; label: string }[] = useMemo(
    () => [
      { id: 'strategy', label: t('study.node.tabs.strategy') },
      { id: 'ranges', label: t('study.node.tabs.ranges') },
      { id: 'breakdown', label: t('study.node.tabs.breakdown') }
    ],
    [t],
  );

  const formatSignedBb = (value: number) =>
    t('study.metric.signedBb', { value: `${value > 0 ? '+' : ''}${value.toFixed(2)}` });

  const formatLabel = (value: StudySpot['format']) => t(`study.format.${value}`);
  const positionLabel = (value: StudySpot['position']) => t(`study.position.${value}`);
  const streetLabel = (value: StudySpot['street']) => t(`study.street.${value}`);

  useEffect(() => {
    let cancelled = false;
    setLoadingSpots(true);
    setSpotsError(null);

    const fallbackFiltered = FALLBACK_STUDY_SPOTS.filter((spot) => {
      const matchFormat = formatFilter === 'all' || spot.format === formatFilter;
      const matchPosition = positionFilter === 'all' || spot.position === positionFilter;
      const matchStack = stackFilter === 'all' || spot.stack_bb === stackFilter;
      return matchFormat && matchPosition && matchStack;
    });

    void apiClient
      .listStudySpots({
        format: formatFilter === 'all' ? undefined : formatFilter,
        position: positionFilter === 'all' ? undefined : positionFilter,
        stackBb: stackFilter === 'all' ? undefined : stackFilter,
        limit: 200,
        offset: 0,
      })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setSpots(response.spots.map(mapApiSpot));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setSpots(fallbackFiltered);
        setSpotsError(error instanceof Error && error.message ? `${t('study.errors.loadSpotsFailed')} (${error.message})` : t('study.errors.loadSpotsFailed'));
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSpots(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [formatFilter, positionFilter, stackFilter, t]);

  const filteredSpots = useMemo(() => spots, [spots]);

  const selectedSpot = useMemo(() => {
    if (filteredSpots.length === 0) {
      return null;
    }

    if (!selectedSpotId) {
      return filteredSpots[0];
    }

    return filteredSpots.find((spot) => spot.id === selectedSpotId) ?? filteredSpots[0];
  }, [filteredSpots, selectedSpotId]);

  useEffect(() => {
    if (filteredSpots.length === 0) {
      if (selectedSpotId !== null) {
        setSelectedSpotId(null);
      }
      return;
    }

    const hasSelection = selectedSpotId ? filteredSpots.some((spot) => spot.id === selectedSpotId) : false;
    if (!hasSelection) {
      setSelectedSpotId(filteredSpots[0].id);
    }
  }, [filteredSpots, selectedSpotId]);

  useEffect(() => {
    if (!selectedSpot) {
      return;
    }

    trackEvent('study_node_opened', {
      module: 'study',
      payload: {
        spotId: selectedSpot.id,
        nodeId: selectedSpot.node.node_code,
        street: selectedSpot.street,
        stackBb: selectedSpot.stack_bb,
      },
    });
  }, [selectedSpot?.id, selectedSpot?.node.node_code, selectedSpot?.stack_bb, selectedSpot?.street]);

  const actionBuckets = useMemo<SolverAction[]>(() => {
    if (!selectedSpot) {
      return [];
    }

    const aggressiveRaw = selectedSpot.node.strategy.action_mix
      .filter((item) => isAggressiveAction(item.action))
      .reduce((sum, item) => sum + item.frequency_pct, 0);

    const allinRaw = selectedSpot.node.strategy.action_mix
      .filter((item) => isAllinAction(item.action))
      .reduce((sum, item) => sum + item.frequency_pct, 0);

    const hasNativeAllin = allinRaw > 0;
    let allin = hasNativeAllin ? Math.round(allinRaw * 0.9) : selectedSpot.stack_bb <= 20 ? 12 : selectedSpot.stack_bb <= 40 ? 4 : 0;
    let raise = Math.round((aggressiveRaw || 52) * 0.34);

    if (selectedSpot.position === 'BTN vs BB' || selectedSpot.position === 'CO vs BTN') {
      raise += 2;
    }

    if (activeTab === 'ranges') {
      raise -= 4;
    } else if (activeTab === 'breakdown') {
      raise += 3;
      allin += 1;
    }

    raise = clamp(raise, 8, 64);
    allin = clamp(allin, 0, 40);

    if (raise + allin > 92) {
      raise = 92 - allin;
    }

    const fold = clamp(100 - raise - allin, 4, 94);
    const total = raise + allin + fold;

    const normalizedRaise = (raise / total) * 100;
    const normalizedAllin = (allin / total) * 100;
    const normalizedFold = (fold / total) * 100;

    const totalCombos = 1326;
    const openSize = selectedSpot.position === 'SB vs BB' ? 3 : selectedSpot.position === 'UTG vs BB' ? 2.3 : 2.5;

    return [
      {
        id: 'allin',
        label: `Allin ${selectedSpot.stack_bb * 2}`,
        frequency: normalizedAllin,
        combos: Math.round((totalCombos * normalizedAllin) / 100),
      },
      {
        id: 'raise',
        label: `Raise ${openSize}`,
        frequency: normalizedRaise,
        combos: Math.round((totalCombos * normalizedRaise) / 100),
      },
      {
        id: 'fold',
        label: 'Fold',
        frequency: normalizedFold,
        combos: Math.round((totalCombos * normalizedFold) / 100),
      },
    ];
  }, [activeTab, selectedSpot]);

  const matrixCells = useMemo<MatrixCell[]>(() => {
    if (!selectedSpot || actionBuckets.length !== 3) {
      return [];
    }

    const baseRaise = actionBuckets.find((item) => item.id === 'raise')?.frequency ?? 18;
    const baseAllin = actionBuckets.find((item) => item.id === 'allin')?.frequency ?? 0;
    const baseAggression = baseRaise + baseAllin;

    return MATRIX_RANKS.flatMap((_, rowIndex) =>
      MATRIX_RANKS.map((__, colIndex) => {
        const hand = buildHandLabel(rowIndex, colIndex);
        const strength = handStrength(hand);
        const seed = hashString(`${selectedSpot.id}:${activeTab}:${hand}`);
        const drift = ((seed % 21) - 10) * 1.1;
        const allinDrift = (((seed >> 4) % 13) - 6) * 0.65;
        const targetAggression = clamp((strength - 0.36) * 120, 0, 99);

        const aggression = clamp(baseAggression * 0.27 + targetAggression * 0.73 + drift, 0, 99.8);
        const projectedAllin = baseAllin > 0 ? baseAllin * (0.14 + strength * 1.2) + allinDrift : strength > 0.96 ? 2.3 + allinDrift : 0;
        const mix = normalizeMix(aggression - projectedAllin, projectedAllin);

        return {
          hand,
          raisePct: mix.raisePct,
          allinPct: mix.allinPct,
          foldPct: mix.foldPct,
          aggressionPct: mix.raisePct + mix.allinPct,
          strength,
        };
      })
    );
  }, [actionBuckets, activeTab, selectedSpot]);

  const matrixMap = useMemo(() => new Map(matrixCells.map((cell) => [cell.hand, cell])), [matrixCells]);

  useEffect(() => {
    if (matrixCells.length === 0) {
      setSelectedHand(null);
      return;
    }

    if (!selectedHand || !matrixMap.has(selectedHand)) {
      setSelectedHand('A7s');
    }
  }, [matrixCells, matrixMap, selectedHand]);

  const featuredHands = useMemo(() => {
    if (matrixCells.length === 0) {
      return [];
    }

    const byAggression = [...matrixCells].sort((a, b) => b.aggressionPct - a.aggressionPct);
    const byStrength = [...matrixCells].sort((a, b) => b.strength - a.strength);
    const selected = selectedHand ? matrixMap.get(selectedHand) ?? null : null;

    const collected = [selected, byAggression[7], byAggression[19], byStrength[13]]
      .filter((item): item is MatrixCell => Boolean(item));

    const deduped: MatrixCell[] = [];
    const seen = new Set<string>();
    for (const cell of collected) {
      if (seen.has(cell.hand)) {
        continue;
      }
      seen.add(cell.hand);
      deduped.push(cell);
    }

    return deduped.slice(0, 4);
  }, [matrixCells, matrixMap, selectedHand]);

  const boardCards = useMemo(() => {
    if (!selectedSpot) {
      return [];
    }

    return selectedSpot.node.board
      .split('|')
      .join(' ')
      .split(/\s+/)
      .filter(Boolean)
      .map((rawCard) => {
        const rank = rawCard.slice(0, 1).toUpperCase();
        const suit = rawCard.slice(1, 2).toLowerCase();

        return {
          raw: rawCard,
          rank,
          suit,
        };
      });
  }, [selectedSpot]);

  const reportTabLabel = useMemo(() => {
    if (!selectedSpot) {
      return 'Reports';
    }

    if (selectedSpot.street === 'Flop') {
      return 'Reports: Flops';
    }
    if (selectedSpot.street === 'Turn') {
      return 'Reports: Turns';
    }
    return 'Reports: Rivers';
  }, [selectedSpot]);

  async function handleCreateDrill() {
    if (!selectedSpot || isCreatingDrill) {
      return;
    }

    setCreatingDrill(true);
    setDrillError(null);
    try {
      const response = await apiClient.createDrill({
        title: `${selectedSpot.title} Drill`,
        sourceType: 'study',
        sourceRefId: selectedSpot.node.node_code,
        tags: [selectedSpot.format, selectedSpot.position, selectedSpot.street],
        itemCount: 12,
      });
      setCreatedDrillId(response.drill.id);
    } catch (error) {
      setDrillError(error instanceof Error ? error.message : t('study.errors.createDrillFailed'));
    } finally {
      setCreatingDrill(false);
    }
  }

  return (
    <section className="study-panel study-panel--solver" aria-labelledby="study-spot-browser-title">
      <header className="study-panel__header study-panel__header--solver">
        <div>
          <p className="module-eyebrow">{t('study.eyebrow')}</p>
          <h1 id="study-spot-browser-title">{t('study.title')}</h1>
          <p className="study-panel__summary">{t('study.summary')}</p>
        </div>
        <div className="study-panel__meta">
          <strong>{filteredSpots.length}</strong>
          <span>{t('study.matchingSpots')}</span>
        </div>
      </header>

      <section className="study-filter-row study-filter-row--solver" aria-label={t('study.filtersAria')}>
        <div className="study-filter">
          <label htmlFor="study-filter-format">{t('study.filter.format')}</label>
          <select
            id="study-filter-format"
            value={formatFilter}
            onChange={(event) => {
              setFormatFilter(event.target.value as SpotFormatFilter);
            }}
          >
            {FORMAT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? t('study.option.allFormats') : formatLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <div className="study-filter">
          <label htmlFor="study-filter-position">{t('study.filter.position')}</label>
          <select
            id="study-filter-position"
            value={positionFilter}
            onChange={(event) => {
              setPositionFilter(event.target.value as SpotPositionFilter);
            }}
          >
            {POSITION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? t('study.option.allPositions') : positionLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <div className="study-filter">
          <label htmlFor="study-filter-stack">{t('study.filter.stack')}</label>
          <select
            id="study-filter-stack"
            value={stackFilter}
            onChange={(event) => {
              setStackFilter(
                event.target.value === 'all' ? 'all' : (Number(event.target.value) as StudySpot['stack_bb'])
              );
            }}
          >
            {STACK_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? t('study.option.allStacks') : `${option} BB`}
              </option>
            ))}
          </select>
        </div>
      </section>

      {isLoadingSpots ? <p className="study-ev-caption">{t('study.loading')}</p> : null}
      {spotsError ? <p className="module-error-text">{spotsError}</p> : null}

      {filteredSpots.length === 0 ? (
        <article className="study-empty-state">
          <h2>{t('study.empty.title')}</h2>
          <p>{t('study.empty.desc')}</p>
        </article>
      ) : selectedSpot ? (
        <div className="study-solver">
          <section className="study-node-strip" aria-label="Solver node strip">
            <article className="study-strip-card study-strip-card--scenario">
              <p>{formatLabel(selectedSpot.format)}</p>
              <ul>
                <li>• {selectedSpot.stack_bb}bb Effective</li>
                <li>• {positionLabel(selectedSpot.position)}</li>
                <li>• Node: {selectedSpot.node.node_code}</li>
              </ul>
            </article>

            <div className="study-strip-spot-list">
              {filteredSpots.slice(0, 5).map((spot) => {
                const isActive = spot.id === selectedSpot.id;
                const majorAction = spot.node.strategy.action_mix[0];
                const minorAction = spot.node.strategy.action_mix[1];

                return (
                  <button
                    key={spot.id}
                    type="button"
                    className={isActive ? 'study-strip-card study-strip-card--active' : 'study-strip-card'}
                    onClick={() => {
                      setSelectedSpotId(spot.id);
                    }}
                    aria-pressed={isActive}
                  >
                    <header>
                      <strong>{spot.node.hero}</strong>
                      <span>{spot.stack_bb * 2}</span>
                    </header>
                    <p>{majorAction?.action ?? 'Raise 2.5'}</p>
                    <p>{minorAction?.action ?? 'Fold'}</p>
                    <small>{streetLabel(spot.street)}</small>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="study-view-tabs" role="tablist" aria-label={t('study.node.detail')}>
            {NODE_TAB_ITEMS.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={isActive ? 'study-view-tab study-view-tab--active' : 'study-view-tab'}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
            <button type="button" className="study-view-tab study-view-tab--passive" disabled>
              {reportTabLabel}
            </button>
          </section>

          <div className="study-solver-layout">
            <section className="study-range-panel">
              <header className="study-range-panel__header">
                <h2>{selectedSpot.title}</h2>
                <p>
                  {t('study.node.boardPot', {
                    hero: selectedSpot.node.hero,
                    villain: selectedSpot.node.villain,
                    board: selectedSpot.node.board,
                    pot: selectedSpot.node.pot_bb.toString(),
                  })}
                </p>
              </header>

              <div className="study-range-grid" role="grid" aria-label={`${selectedSpot.title} preflop range matrix`}>
                {matrixCells.map((cell) => {
                  const isActive = cell.hand === selectedHand;
                  const cellStyle = {
                    '--cell-raise': `${cell.raisePct}%`,
                    '--cell-allin': `${cell.allinPct}%`,
                    '--cell-fold': `${cell.foldPct}%`,
                  } as CSSProperties;

                  return (
                    <button
                      key={cell.hand}
                      type="button"
                      role="gridcell"
                      className={isActive ? 'study-range-cell study-range-cell--active' : 'study-range-cell'}
                      style={cellStyle}
                      onClick={() => setSelectedHand(cell.hand)}
                      aria-pressed={isActive}
                    >
                      {cell.hand}
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="study-action-panel">
              <header className="study-action-panel__header">
                <nav className="study-action-panel__tabs" aria-label="Action detail tabs">
                  <button type="button" className="study-action-panel__tab study-action-panel__tab--active">
                    Overview
                  </button>
                  <button type="button" className="study-action-panel__tab">
                    Table
                  </button>
                  <button type="button" className="study-action-panel__tab">
                    Equity chart
                  </button>
                </nav>

                <div className="study-overview-strip">
                  <span>{selectedSpot.node.hero}</span>
                  <span>{selectedSpot.node.villain}</span>
                  <span>{selectedSpot.stack_bb * 2}</span>
                  <span>{streetLabel(selectedSpot.street)}</span>
                  <span>{selectedSpot.node.pot_bb.toFixed(1)} BB pot</span>
                </div>

                <div className="study-board-row">
                  {boardCards.map((card) => (
                    <span key={card.raw} className={`study-board-card ${suitsClass(card.suit)}`}>
                      <strong>{card.rank}</strong>
                      <small>{suitSymbol(card.suit)}</small>
                    </span>
                  ))}
                </div>
              </header>

              <section className="study-action-cards" aria-label="Action frequencies">
                {actionBuckets.map((action) => (
                  <article key={action.id} className={`study-action-card study-action-card--${action.id}`}>
                    <h3>{action.label}</h3>
                    <div className="study-action-card__metrics">
                      <strong>{action.frequency.toFixed(1)}%</strong>
                      <span>{action.combos.toLocaleString(locale)} combos</span>
                    </div>
                  </article>
                ))}
              </section>

              <div className="study-action-distribution" aria-hidden>
                {actionBuckets.map((action) => (
                  <span
                    key={action.id}
                    className={`study-action-distribution__segment study-action-distribution__segment--${action.id}`}
                    style={{ width: `${action.frequency}%` }}
                  />
                ))}
              </div>

              <section className="study-hand-panel" aria-label="Hand details">
                <nav className="study-hand-panel__tabs" aria-label="Hand tabs">
                  <button type="button" className="study-hand-panel__tab study-hand-panel__tab--active">
                    Hands
                  </button>
                  <button type="button" className="study-hand-panel__tab">
                    Summary
                  </button>
                  <button type="button" className="study-hand-panel__tab">
                    Filters
                  </button>
                  <button type="button" className="study-hand-panel__tab">
                    Blockers
                  </button>
                </nav>

                <div className="study-hand-grid">
                  {featuredHands.map((handCell) => (
                    <article key={handCell.hand} className="study-hand-card">
                      <header>
                        <strong>{handCell.hand}</strong>
                        <span>{handCell.hand === selectedHand ? 'Selected' : 'Mix'}</span>
                      </header>
                      <p>
                        <span>{actionBuckets[0]?.label}</span>
                        <strong>{handCell.allinPct.toFixed(0)}</strong>
                      </p>
                      <p>
                        <span>{actionBuckets[1]?.label}</span>
                        <strong>{handCell.raisePct.toFixed(0)}</strong>
                      </p>
                      <p>
                        <span>{actionBuckets[2]?.label}</span>
                        <strong>{handCell.foldPct.toFixed(0)}</strong>
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              <div className="study-drill-cta">
                <button type="button" className="module-next-link" onClick={handleCreateDrill} disabled={isCreatingDrill}>
                  {isCreatingDrill ? t('study.actions.creating') : t('study.actions.createDrill')}
                </button>
                {createdDrillId ? (
                  <Link className="module-next-link" href={`/app/practice?drillId=${createdDrillId}`}>
                    {t('study.actions.drillCreated')}
                  </Link>
                ) : (
                  <Link className="module-next-link" href="/app/practice">
                    {t('study.actions.goPractice')}
                  </Link>
                )}
              </div>
              {drillError ? <p className="module-error-text">{drillError}</p> : null}
              <p className="study-ev-caption">{formatSignedBb(selectedSpot.node.strategy.aggregate_ev_bb)}</p>
            </aside>
          </div>
        </div>
      ) : null}
    </section>
  );
}
