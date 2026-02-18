'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { StudySpot as ApiStudySpot, StudySpotMatrixResponse as ApiStudySpotMatrixResponse } from '@poker-god/contracts';
import { useI18n } from '@/components/i18n/I18nProvider';
import { apiClient } from '@/lib/apiClient';
import { trackEvent } from '@/lib/analytics';
import { STUDY_SPOTS as FALLBACK_STUDY_SPOTS, type StudySpot as LocalStudySpot } from './studySpots';

type StudySpot = LocalStudySpot;

type SpotFormatFilter = StudySpot['format'] | 'all';
type SpotPositionFilter = StudySpot['position'] | 'all';
type SpotStackFilter = StudySpot['stack_bb'] | 'all';
type StudyNodeTab = 'strategy' | 'ranges' | 'breakdown';
type SolverActionSlot = 'raise' | 'allin' | 'fold';
type ReportStreet = 'flop' | 'turn' | 'river';
type SuitCode = 's' | 'h' | 'd' | 'c';
type BoardPickerState = {
  street: ReportStreet;
  required: number;
  selected: string[];
};
type SuitMeta = {
  code: SuitCode;
  icon: string;
  rowLabel: string;
};
type CoachStudyIntent = {
  format?: StudySpot['format'];
  position?: StudySpot['position'];
  stackBb?: StudySpot['stack_bb'];
  hand?: string;
  board?: string;
  potSb?: number;
  effectiveStackSb?: number;
  ipRange?: string;
  oopRange?: string;
  flopBetSizes?: string;
  flopRaiseSizes?: string;
  sourceMessage?: string;
};

type SolverBuildConfig = {
  ipRange: string;
  oopRange: string;
  board: string;
  potSb: string;
  effectiveStackSb: string;
  flopBetSizes: string;
  flopRaiseSizes: string;
  raiseLimit: string;
  allinThreshold: string;
};

type SolverAction = {
  id: SolverActionSlot;
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

type PreflopSeat = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

type WizardSeatCard = {
  seat: PreflopSeat;
  orderIndex: number;
  stackBb: number;
  relatedSpot: StudySpot | null;
  actions: string[];
  selectedAction: string | null;
  isSelectedSpot: boolean;
  isHeroSeat: boolean;
  isUnlocked: boolean;
  isVisible: boolean;
  isCurrentTurn: boolean;
};

const FORMAT_OPTIONS: SpotFormatFilter[] = ['all', 'Cash 6-max', 'Cash Heads-Up', 'MTT 9-max'];
const POSITION_OPTIONS: SpotPositionFilter[] = ['all', 'BTN vs BB', 'CO vs BTN', 'SB vs BB', 'UTG vs BB'];
const STACK_OPTIONS: SpotStackFilter[] = ['all', 20, 40, 60, 100, 200];
const DEFAULT_SOLVER_CONFIG: SolverBuildConfig = {
  ipRange: '',
  oopRange: '',
  board: '',
  potSb: '',
  effectiveStackSb: '',
  flopBetSizes: '33 50 75',
  flopRaiseSizes: '60',
  raiseLimit: '3',
  allinThreshold: '0.67',
};

const MATRIX_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
const REPORT_STREET_ORDER: ReportStreet[] = ['flop', 'turn', 'river'];
const REPORT_PICKER_SUITS: SuitMeta[] = [
  { code: 's', icon: '♠', rowLabel: 'Spades' },
  { code: 'h', icon: '♥', rowLabel: 'Hearts' },
  { code: 'd', icon: '♦', rowLabel: 'Diamonds' },
  { code: 'c', icon: '♣', rowLabel: 'Clubs' },
];
const PREFLOP_SEAT_ORDER: PreflopSeat[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const PREFLOP_SEAT_ORDER_BY_FORMAT: Record<StudySpot['format'], PreflopSeat[]> = {
  'Cash 6-max': ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  'Cash Heads-Up': ['BTN', 'BB'],
  'MTT 9-max': ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};
const PREFLOP_DEFAULT_ACTIONS: Record<PreflopSeat, string[]> = {
  UTG: ['Fold', 'Raise 2', 'Raise 2.5'],
  HJ: ['Fold', 'Call', 'Raise 2.5'],
  CO: ['Fold', 'Call', 'Raise 3'],
  BTN: ['Fold', 'Call', 'Raise 2.5'],
  SB: ['Fold', 'Call', 'Raise 3'],
  BB: ['Fold', 'Check', 'Call', 'Raise 9'],
};
const WIZARD_SIDE_TOOLS = ['N', 'R', 'T', 'S'];

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

function normalizeBoardCsv(rawBoard: string) {
  return rawBoard
    .replace(/\|/g, ',')
    .replace(/\s+/g, '')
    .replace(/,+/g, ',')
    .replace(/^,|,$/g, '');
}

function isBoardCsvValid(rawBoard: string) {
  const board = normalizeBoardCsv(rawBoard).toUpperCase();
  if (!board) return false;
  const cards = board.split(',').filter(Boolean);
  if (cards.length < 3 || cards.length > 5) return false;
  if (!cards.every((card) => /^[2-9TJQKA][HDCS]$/.test(card))) return false;
  return new Set(cards).size === cards.length;
}

function parseBoardCodes(rawBoard: string) {
  const matched = rawBoard.match(/[2-9TJQKA][CDHS]/gi) ?? [];
  const normalized = matched.map((raw) => `${raw.slice(0, 1).toUpperCase()}${raw.slice(1, 2).toLowerCase()}`);
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const card of normalized) {
    if (seen.has(card)) {
      continue;
    }
    seen.add(card);
    deduped.push(card);
  }
  return deduped.slice(0, 5);
}

function boardCodesToCsv(cards: string[]) {
  return cards.map((card) => `${card.slice(0, 1).toUpperCase()}${card.slice(1, 2).toUpperCase()}`).join(',');
}

function sampleCards(cards: string[], count: number) {
  const pool = [...cards];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = pool[i];
    pool[i] = pool[j];
    pool[j] = temp;
  }
  return pool.slice(0, count);
}

function reportStreetLabel(street: ReportStreet) {
  if (street === 'flop') return 'FLOPS';
  if (street === 'turn') return 'TURNS';
  return 'RIVERS';
}

function formatCardCode(code: string) {
  const rank = code.slice(0, 1).toUpperCase();
  const suit = code.slice(1, 2).toLowerCase() as SuitCode;
  return `${rank}${suitSymbol(suit)}`;
}

function resolveBoardCodes(fallback: string[], selectedByStreet: Record<ReportStreet, string[]>) {
  const flop = selectedByStreet.flop.length === 3 ? selectedByStreet.flop : fallback.slice(0, 3);
  const turn = selectedByStreet.turn.length === 1 ? selectedByStreet.turn : fallback.slice(3, 4);
  const river = selectedByStreet.river.length === 1 ? selectedByStreet.river : fallback.slice(4, 5);
  return [...flop, ...turn, ...river].slice(0, 5);
}

function computeBoardTextureBias(cards: string[]) {
  if (cards.length === 0) {
    return 0;
  }

  const ranks = cards.map((card) => RANK_VALUES[card.slice(0, 1).toUpperCase()] ?? 2);
  const suits = cards.map((card) => card.slice(1, 2).toLowerCase() as SuitCode);
  const highCardCount = ranks.filter((rank) => rank >= 11).length;
  const duplicateCount = cards.length - new Set(ranks).size;
  const maxSuitCount = Math.max(...REPORT_PICKER_SUITS.map((suit) => suits.filter((item) => item === suit.code).length));

  const sorted = [...new Set(ranks)].sort((a, b) => a - b);
  let gaps = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    gaps += Math.max(0, sorted[i] - sorted[i - 1] - 1);
  }

  let bias = 0;
  bias += highCardCount * 0.055;
  bias += maxSuitCount >= 3 ? 0.08 : maxSuitCount >= 2 ? 0.02 : 0;
  bias -= duplicateCount * 0.07;
  bias -= gaps <= 1 ? 0.03 : 0;
  return clamp(bias, -0.22, 0.22);
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

function normalizeMatrixHand(raw: string): string | null {
  const compact = raw.toUpperCase().replace(/\s+/g, '');
  const matched = compact.match(/([AKQJT2-9])([AKQJT2-9])(S|O)?/);
  if (!matched) {
    return null;
  }

  const first = matched[1];
  const second = matched[2];
  const suffix = matched[3]?.toLowerCase();
  if (first === second) {
    return `${first}${second}`;
  }
  if (suffix === 'o') {
    return `${first}${second}o`;
  }
  return `${first}${second}s`;
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

function isFoldAction(action: string) {
  return /^fold$/i.test(action.trim());
}

function isPassiveAction(action: string) {
  return /^call$|^check$/i.test(action.trim());
}

function normalizeActionLabel(action: string) {
  return action.trim().toLowerCase().replace(/\s+/g, ' ');
}

function actionTone(action: string): 'aggressive' | 'passive' | 'fold' {
  if (isFoldAction(action)) {
    return 'fold';
  }
  if (isPassiveAction(action)) {
    return 'passive';
  }
  return 'aggressive';
}

function buildSeatActions(seat: PreflopSeat, mixedActions: string[]) {
  const merged = [...mixedActions, ...PREFLOP_DEFAULT_ACTIONS[seat]];
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const action of merged) {
    const normalized = normalizeActionLabel(action);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(action);
  }
  return deduped.slice(0, 4);
}

function computeLinePressure(actions: string[]) {
  if (actions.length === 0) {
    return 0;
  }

  const score = actions.reduce((sum, action) => {
    const tone = actionTone(action);
    if (tone === 'aggressive') return sum + 1;
    if (tone === 'fold') return sum - 1;
    return sum - 0.25;
  }, 0);

  return clamp(score / actions.length, -1, 1);
}

function deriveSpotFromLine(
  spot: StudySpot | null,
  selectedAction: string | null,
  linePressure: number,
  boardTextureBias: number,
): StudySpot | null {
  if (!spot || spot.node.strategy.action_mix.length === 0) {
    return spot;
  }

  const mix = spot.node.strategy.action_mix;
  const weights = mix.map((item) => Math.max(0.01, item.frequency_pct));

  for (let i = 0; i < mix.length; i += 1) {
    const tone = actionTone(mix[i].action);
    if (tone === 'aggressive') {
      weights[i] *= 1 + linePressure * 0.24 + boardTextureBias * 0.52;
    } else if (tone === 'passive') {
      weights[i] *= 1 - linePressure * 0.08 + boardTextureBias * 0.06;
    } else {
      weights[i] *= 1 - linePressure * 0.26 - boardTextureBias * 0.66;
    }
  }

  let selectedIndex = -1;
  if (selectedAction) {
    const normalizedSelected = normalizeActionLabel(selectedAction);
    selectedIndex = mix.findIndex((item) => normalizeActionLabel(item.action) === normalizedSelected);
    if (selectedIndex >= 0) {
      weights[selectedIndex] *= 1.9;
    }
  }

  const weightSum = weights.reduce((sum, value) => sum + value, 0) || 1;
  const adjustedMix = mix.map((item, index) => ({
    ...item,
    frequency_pct: Number(((weights[index] / weightSum) * 100).toFixed(1)),
  }));

  const bestIndex = mix.reduce((best, current, index, arr) => (current.ev_bb > arr[best].ev_bb ? index : best), 0);
  let aggregateShift = linePressure * 0.08;
  aggregateShift += boardTextureBias * 0.48;
  if (selectedIndex >= 0) {
    aggregateShift += selectedIndex === bestIndex ? 0.15 : -0.15;
  }

  return {
    ...spot,
    node: {
      ...spot.node,
      strategy: {
        ...spot.node.strategy,
        action_mix: adjustedMix,
        aggregate_ev_bb: Number((spot.node.strategy.aggregate_ev_bb + aggregateShift).toFixed(2)),
      },
    },
  };
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

function normalizeSeatCode(rawSeat: string): PreflopSeat | null {
  const normalized = rawSeat.trim().toUpperCase();
  if (normalized === 'UTG') return 'UTG';
  if (normalized === 'HJ') return 'HJ';
  if (normalized === 'CO') return 'CO';
  if (normalized === 'BTN') return 'BTN';
  if (normalized === 'SB') return 'SB';
  if (normalized === 'BB') return 'BB';
  return null;
}

export function StudySpotBrowser() {
  const { t, locale } = useI18n();
  const [spots, setSpots] = useState<StudySpot[]>(FALLBACK_STUDY_SPOTS);
  const [isLoadingSpots, setLoadingSpots] = useState(false);
  const [spotsError, setSpotsError] = useState<string | null>(null);
  const [spotMatrixById, setSpotMatrixById] = useState<Record<string, ApiStudySpotMatrixResponse | null>>({});
  const [formatFilter, setFormatFilter] = useState<SpotFormatFilter>('Cash 6-max');
  const [positionFilter, setPositionFilter] = useState<SpotPositionFilter>('all');
  const [stackFilter, setStackFilter] = useState<SpotStackFilter>(200);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(FALLBACK_STUDY_SPOTS[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<StudyNodeTab>('strategy');
  const [selectedHand, setSelectedHand] = useState<string | null>(null);
  const [solverConfig, setSolverConfig] = useState<SolverBuildConfig>(DEFAULT_SOLVER_CONFIG);
  const [isCreatingDrill, setCreatingDrill] = useState(false);
  const [createdDrillId, setCreatedDrillId] = useState<string | null>(null);
  const [drillError, setDrillError] = useState<string | null>(null);
  const [solverRefreshTick, setSolverRefreshTick] = useState(0);
  const [lastAppliedIntent, setLastAppliedIntent] = useState<string | null>(null);
  const [lineActionBySeat, setLineActionBySeat] = useState<Partial<Record<PreflopSeat, string>>>({});
  const [heroSeat, setHeroSeat] = useState<PreflopSeat>('BTN');
  const [reportBoardByStreet, setReportBoardByStreet] = useState<Record<ReportStreet, string[]>>({
    flop: [],
    turn: [],
    river: [],
  });
  const [reportPicker, setReportPicker] = useState<BoardPickerState | null>(null);
  const [autoPromptedReportStreet, setAutoPromptedReportStreet] = useState<Record<ReportStreet, boolean>>({
    flop: false,
    turn: false,
    river: false,
  });

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
        if (fallbackFiltered.length === 0) {
          setSpotsError(error instanceof Error && error.message ? `${t('study.errors.loadSpotsFailed')} (${error.message})` : t('study.errors.loadSpotsFailed'));
        } else {
          setSpotsError(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSpots(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [formatFilter, positionFilter, solverRefreshTick, stackFilter, t]);

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

  const preflopFormat = useMemo<StudySpot['format']>(
    () => (formatFilter === 'all' ? 'Cash 6-max' : formatFilter),
    [formatFilter],
  );

  const preflopStackBb = useMemo(
    () => (stackFilter === 'all' ? 200 : stackFilter),
    [stackFilter],
  );

  const preflopSeats = useMemo<PreflopSeat[]>(
    () => PREFLOP_SEAT_ORDER_BY_FORMAT[preflopFormat] ?? PREFLOP_SEAT_ORDER,
    [preflopFormat],
  );

  const selectedSpotSeat = useMemo<PreflopSeat | null>(
    () => normalizeSeatCode(selectedSpot?.node.hero ?? ''),
    [selectedSpot?.node.hero],
  );

  useEffect(() => {
    setLineActionBySeat({});
  }, [positionFilter, preflopFormat, preflopStackBb]);

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
    if (Object.prototype.hasOwnProperty.call(spotMatrixById, selectedSpot.id)) {
      return;
    }

    let cancelled = false;
    void apiClient
      .getStudySpotMatrix(selectedSpot.id)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setSpotMatrixById((prev) => ({
          ...prev,
          [selectedSpot.id]: response,
        }));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setSpotMatrixById((prev) => ({
          ...prev,
          [selectedSpot.id]: null,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSpot, spotMatrixById]);

  useEffect(() => {
    if (!preflopSeats.includes(heroSeat)) {
      setHeroSeat(preflopSeats.includes('BTN') ? 'BTN' : preflopSeats[0]);
    }
  }, [heroSeat, preflopSeats]);

  useEffect(() => {
    setLineActionBySeat((prev) => {
      const validSeats = new Set(preflopSeats);
      let changed = false;
      const next: Partial<Record<PreflopSeat, string>> = {};
      for (const [seat, action] of Object.entries(prev)) {
        if (validSeats.has(seat as PreflopSeat)) {
          next[seat as PreflopSeat] = action;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [preflopSeats]);

  const seatSpotMap = useMemo(() => {
    const mapped: Partial<Record<PreflopSeat, StudySpot | null>> = {};
    for (const seat of PREFLOP_SEAT_ORDER) {
      mapped[seat] = null;
    }

    for (const seat of preflopSeats) {
      const heroSpot = filteredSpots.find((spot) => normalizeSeatCode(spot.node.hero) === seat) ?? null;
      const positionSpot = filteredSpots.find((spot) => spot.position.includes(seat)) ?? null;
      mapped[seat] = heroSpot ?? positionSpot ?? null;
    }

    return mapped as Record<PreflopSeat, StudySpot | null>;
  }, [filteredSpots, preflopSeats]);

  const activeSeatIndex = useMemo(() => {
    if (preflopSeats.length === 0) {
      return -1;
    }
    return preflopSeats.findIndex((seat) => !lineActionBySeat[seat]);
  }, [lineActionBySeat, preflopSeats]);

  const preflopSequenceCompleted = useMemo(
    () => preflopSeats.length > 0 && preflopSeats.every((seat) => Boolean(lineActionBySeat[seat])),
    [lineActionBySeat, preflopSeats],
  );

  const wizardSeatCards = useMemo<WizardSeatCard[]>(
    () =>
      preflopSeats.map((seat, index) => {
        const relatedSpot = seatSpotMap[seat] ?? null;
        const selectedAction = lineActionBySeat[seat] ?? null;
        const isUnlocked = index === 0 || preflopSeats.slice(0, index).every((priorSeat) => Boolean(lineActionBySeat[priorSeat]));
        const isVisible = index === 0 || isUnlocked || Boolean(selectedAction);
        const actions = buildSeatActions(seat, relatedSpot ? relatedSpot.node.strategy.action_mix.map((item) => item.action) : []);
        return {
          seat,
          orderIndex: index,
          stackBb: preflopStackBb,
          relatedSpot,
          actions,
          selectedAction,
          isSelectedSpot: selectedSpotSeat === seat,
          isHeroSeat: heroSeat === seat,
          isUnlocked,
          isVisible,
          isCurrentTurn: activeSeatIndex >= 0 && index === activeSeatIndex && !selectedAction,
        };
      }),
    [activeSeatIndex, heroSeat, lineActionBySeat, preflopSeats, preflopStackBb, seatSpotMap, selectedSpotSeat],
  );

  const visibleWizardSeatCards = useMemo(() => wizardSeatCards.filter((card) => card.isVisible), [wizardSeatCards]);

  const selectedLineActions = useMemo(
    () =>
      preflopSeats
        .map((seat) => lineActionBySeat[seat])
        .filter((action): action is string => Boolean(action)),
    [lineActionBySeat, preflopSeats],
  );

  const activeWizardSeat = useMemo(
    () => wizardSeatCards.find((card) => card.isCurrentTurn) ?? wizardSeatCards.find((card) => card.isHeroSeat) ?? null,
    [wizardSeatCards],
  );

  const isHeroTurn = useMemo(
    () => Boolean(activeWizardSeat && !preflopSequenceCompleted && activeWizardSeat.seat === heroSeat),
    [activeWizardSeat, heroSeat, preflopSequenceCompleted],
  );

  const canOpenFlopPicker = useMemo(
    () => preflopSequenceCompleted,
    [preflopSequenceCompleted],
  );

  const linePressure = useMemo(() => computeLinePressure(selectedLineActions), [selectedLineActions]);

  const fallbackBoardCodes = useMemo(() => parseBoardCodes(selectedSpot?.node.board ?? ''), [selectedSpot?.node.board]);

  const resolvedBoardCodes = useMemo(
    () => resolveBoardCodes(fallbackBoardCodes, reportBoardByStreet),
    [fallbackBoardCodes, reportBoardByStreet],
  );

  const boardTextureBias = useMemo(() => computeBoardTextureBias(resolvedBoardCodes), [resolvedBoardCodes]);

  const effectiveSpot = useMemo(() => {
    if (!selectedSpot) {
      return null;
    }
    const selectedAction = selectedSpotSeat ? lineActionBySeat[selectedSpotSeat] ?? null : null;
    return deriveSpotFromLine(selectedSpot, selectedAction, linePressure, boardTextureBias);
  }, [boardTextureBias, lineActionBySeat, linePressure, selectedSpot, selectedSpotSeat]);

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

  useEffect(() => {
    const handleApplyIntent = (event: Event) => {
      const detail = (event as CustomEvent<CoachStudyIntent>).detail;
      if (!detail || typeof detail !== 'object') {
        return;
      }

      if (detail.format) {
        setFormatFilter(detail.format);
      }
      if (detail.position) {
        setPositionFilter(detail.position);
      }
      if (detail.stackBb) {
        setStackFilter(detail.stackBb);
      }
      if (detail.hand) {
        const normalized = normalizeMatrixHand(detail.hand);
        if (normalized) {
          setSelectedHand(normalized);
        }
      }
      if (detail.board || detail.potSb || detail.effectiveStackSb || detail.ipRange || detail.oopRange || detail.flopBetSizes || detail.flopRaiseSizes) {
        setSolverConfig((prev) => ({
          ...prev,
          board: detail.board ? normalizeBoardCsv(detail.board) : prev.board,
          potSb: typeof detail.potSb === 'number' && Number.isFinite(detail.potSb) ? String(Math.max(1, Math.round(detail.potSb))) : prev.potSb,
          effectiveStackSb:
            typeof detail.effectiveStackSb === 'number' && Number.isFinite(detail.effectiveStackSb)
              ? String(Math.max(2, Math.round(detail.effectiveStackSb)))
              : prev.effectiveStackSb,
          ipRange: detail.ipRange?.trim() ? detail.ipRange : prev.ipRange,
          oopRange: detail.oopRange?.trim() ? detail.oopRange : prev.oopRange,
          flopBetSizes: detail.flopBetSizes?.trim() ? detail.flopBetSizes : prev.flopBetSizes,
          flopRaiseSizes: detail.flopRaiseSizes?.trim() ? detail.flopRaiseSizes : prev.flopRaiseSizes,
        }));
      }

      setActiveTab('strategy');
      setCreatedDrillId(null);
      setDrillError(null);
      setSolverRefreshTick((prev) => prev + 1);
      setLastAppliedIntent(detail.sourceMessage ?? 'AI intent applied');
    };

    window.addEventListener('coach:study:apply-intent', handleApplyIntent as EventListener);
    return () => window.removeEventListener('coach:study:apply-intent', handleApplyIntent as EventListener);
  }, []);

  const solverSpot = effectiveSpot ?? selectedSpot;
  const selectedSpotMatrix = useMemo(
    () => (selectedSpot ? spotMatrixById[selectedSpot.id] ?? null : null),
    [selectedSpot, spotMatrixById],
  );

  const actionBuckets = useMemo<SolverAction[]>(() => {
    if (!solverSpot) {
      return [];
    }

    const mix = solverSpot.node.strategy.action_mix;
    const buckets = solverSpot.node.ranges.buckets;
    const totalCombos = buckets.reduce((sum, b) => sum + b.combos, 0) || 1326;

    const foldItem = mix.find((m) => isFoldAction(m.action));
    const passiveItems = mix.filter((m) => isPassiveAction(m.action));
    const aggressiveItems = mix.filter((m) => !isFoldAction(m.action) && !isPassiveAction(m.action));

    const slot0Pct = aggressiveItems.reduce((s, m) => s + m.frequency_pct, 0);
    const slot1Pct = passiveItems.reduce((s, m) => s + m.frequency_pct, 0);
    const slot2Pct = foldItem?.frequency_pct ?? 0;

    const totalPct = slot0Pct + slot1Pct + slot2Pct || 100;
    const norm0 = (slot0Pct / totalPct) * 100;
    const norm1 = (slot1Pct / totalPct) * 100;
    const norm2 = (slot2Pct / totalPct) * 100;

    const label0 = aggressiveItems[0]?.action ?? 'Raise';
    const label1 = passiveItems[0]?.action ?? (aggressiveItems[1]?.action ?? 'Call');
    const label2 = foldItem?.action ?? 'Fold';

    return [
      { id: 'raise', label: label0, frequency: norm0, combos: Math.round((totalCombos * norm0) / 100) },
      { id: 'allin', label: label1, frequency: norm1, combos: Math.round((totalCombos * norm1) / 100) },
      { id: 'fold', label: label2, frequency: norm2, combos: Math.round((totalCombos * norm2) / 100) },
    ];
  }, [solverSpot]);

  const matrixCells = useMemo<MatrixCell[]>(() => {
    if (selectedSpotMatrix && selectedSpotMatrix.hands.length > 0) {
      return selectedSpotMatrix.hands.map((handEntry) => {
        let aggressive = 0;
        let passive = 0;
        let fold = 0;
        for (const frequency of handEntry.frequencies) {
          const value = Math.max(0, frequency.frequencyPct);
          const tone = actionTone(frequency.action);
          if (tone === 'aggressive') {
            aggressive += value;
          } else if (tone === 'passive') {
            passive += value;
          } else {
            fold += value;
          }
        }

        const total = aggressive + passive + fold;
        const raisePct = total > 0 ? (aggressive / total) * 100 : 0;
        const allinPct = total > 0 ? (passive / total) * 100 : 0;
        const foldPct = total > 0 ? (fold / total) * 100 : 100;
        return {
          hand: handEntry.hand,
          raisePct: Number(raisePct.toFixed(1)),
          allinPct: Number(allinPct.toFixed(1)),
          foldPct: Number(foldPct.toFixed(1)),
          aggressionPct: Number((raisePct + allinPct).toFixed(1)),
          strength: handStrength(handEntry.hand),
        };
      });
    }

    if (!solverSpot || actionBuckets.length !== 3) {
      return [];
    }

    const baseRaise = actionBuckets[0].frequency;
    const basePassive = actionBuckets[1].frequency;
    const baseFold = actionBuckets[2].frequency;

    const normalizeMix = (raise: number, passive: number, fold: number) => {
      const safeRaise = Math.max(0, raise);
      const safePassive = Math.max(0, passive);
      const safeFold = Math.max(0, fold);
      const total = safeRaise + safePassive + safeFold;
      if (total <= 0) {
        return { raise: 0, passive: 0, fold: 100 };
      }
      return {
        raise: (safeRaise / total) * 100,
        passive: (safePassive / total) * 100,
        fold: (safeFold / total) * 100,
      };
    };

    const drafted = MATRIX_RANKS.flatMap((_, rowIndex) =>
      MATRIX_RANKS.map((__, colIndex) => {
        const hand = buildHandLabel(rowIndex, colIndex);
        const strength = handStrength(hand);
        const centered = (strength - 0.5) * 2;
        const raiseFactor = clamp(1 + centered * 0.55, 0.15, 1.85);
        const passiveFactor = clamp(1 - Math.abs(centered) * 0.36 + (centered < 0 ? 0.14 : 0), 0.2, 1.45);
        const foldFactor = clamp(1 - centered * 0.62, 0.12, 1.95);
        const mix = normalizeMix(baseRaise * raiseFactor, basePassive * passiveFactor, baseFold * foldFactor);
        return {
          hand,
          strength,
          raisePct: mix.raise,
          allinPct: mix.passive,
          foldPct: mix.fold,
        };
      })
    );

    const average = drafted.reduce(
      (acc, cell) => ({
        raise: acc.raise + cell.raisePct,
        passive: acc.passive + cell.allinPct,
        fold: acc.fold + cell.foldPct,
      }),
      { raise: 0, passive: 0, fold: 0 }
    );

    const count = drafted.length || 1;
    const avgRaise = average.raise / count;
    const avgPassive = average.passive / count;
    const avgFold = average.fold / count;
    const scaleRaise = avgRaise > 0 ? baseRaise / avgRaise : 1;
    const scalePassive = avgPassive > 0 ? basePassive / avgPassive : 1;
    const scaleFold = avgFold > 0 ? baseFold / avgFold : 1;

    return drafted.map((cell) => {
      const scaled = normalizeMix(cell.raisePct * scaleRaise, cell.allinPct * scalePassive, cell.foldPct * scaleFold);
      return {
        hand: cell.hand,
        raisePct: Number(scaled.raise.toFixed(1)),
        allinPct: Number(scaled.passive.toFixed(1)),
        foldPct: Number(scaled.fold.toFixed(1)),
        aggressionPct: Number((scaled.raise + scaled.passive).toFixed(1)),
        strength: cell.strength,
      };
    });
  }, [actionBuckets, selectedSpotMatrix, solverSpot]);

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
    return resolvedBoardCodes.map((cardCode) => {
      const rank = cardCode.slice(0, 1).toUpperCase();
      const suit = cardCode.slice(1, 2).toLowerCase();

      return {
        raw: cardCode,
        rank,
        suit,
      };
    });
  }, [resolvedBoardCodes]);

  const reportTabLabel = useMemo(() => {
    if (reportBoardByStreet.flop.length !== 3) {
      return 'Reports: Flops';
    }
    if (reportBoardByStreet.turn.length !== 1) {
      return 'Reports: Turns';
    }
    if (reportBoardByStreet.river.length !== 1) {
      return 'Reports: Rivers';
    }
    return 'Reports: Ready';
  }, [reportBoardByStreet]);

  const solverMissingFields = useMemo(() => {
    const missing: string[] = [];
    if (!solverConfig.ipRange.trim()) missing.push('IP Range');
    if (!solverConfig.oopRange.trim()) missing.push('OOP Range');
    if (!solverConfig.board.trim()) missing.push('Board');
    if (!solverConfig.potSb.trim()) missing.push('Pot (SB)');
    if (!solverConfig.effectiveStackSb.trim()) missing.push('Effective Stack (SB)');
    if (!solverConfig.flopBetSizes.trim()) missing.push('Flop Bet Sizes');
    if (!solverConfig.flopRaiseSizes.trim()) missing.push('Flop Raise Sizes');
    return missing;
  }, [solverConfig]);

  const solverBoardValid = useMemo(() => isBoardCsvValid(solverConfig.board), [solverConfig.board]);

  const solverConfigPreview = useMemo(() => {
    return [
      `board=${normalizeBoardCsv(solverConfig.board) || '<required>'}`,
      `pot=${solverConfig.potSb || '<required>'}`,
      `effective_stack=${solverConfig.effectiveStackSb || '<required>'}`,
      `ip_range=${solverConfig.ipRange || '<required>'}`,
      `oop_range=${solverConfig.oopRange || '<required>'}`,
      `flop_bet_sizes=${solverConfig.flopBetSizes || '<required>'}`,
      `flop_raise_sizes=${solverConfig.flopRaiseSizes || '<required>'}`,
      `raise_limit=${solverConfig.raiseLimit || '3'}`,
      `allin_threshold=${solverConfig.allinThreshold || '0.67'}`,
    ].join('\n');
  }, [solverConfig]);

  const reportStreetState = useMemo(
    () => ({
      flop: {
        label: 'FLOPS',
        required: 3,
        cards: reportBoardByStreet.flop,
        canOpen: true,
      },
      turn: {
        label: 'TURNS',
        required: 1,
        cards: reportBoardByStreet.turn,
        canOpen: reportBoardByStreet.flop.length === 3,
      },
      river: {
        label: 'RIVERS',
        required: 1,
        cards: reportBoardByStreet.river,
        canOpen: reportBoardByStreet.flop.length === 3 && reportBoardByStreet.turn.length === 1,
      },
    }),
    [reportBoardByStreet],
  );

  const allPickerCards = useMemo(
    () => REPORT_PICKER_SUITS.flatMap((suit) => MATRIX_RANKS.map((rank) => `${rank}${suit.code}`)),
    [],
  );

  const reportBoardPreview = useMemo(() => {
    const cards = resolvedBoardCodes.map((card) => formatCardCode(card));
    return cards.length > 0 ? cards.join(' ') : '-';
  }, [resolvedBoardCodes]);

  const lineSummary = useMemo(() => {
    if (preflopSeats.length === 0) {
      return '行动线：-';
    }
    const fragments = preflopSeats.map((seat) => `${seat} ${lineActionBySeat[seat] ?? '-'}`);
    const currentTurn = preflopSequenceCompleted ? 'FLOP' : activeWizardSeat ? activeWizardSeat.seat : '-';
    const heroHint = isHeroTurn ? ' ｜ 轮到你决策' : '';
    return `当前行动位：${currentTurn}${heroHint} ｜ 已选择 ${selectedLineActions.length}/${preflopSeats.length} ｜ 行动线：${fragments.join(' > ')} ｜ 报告牌：${reportBoardPreview}`;
  }, [activeWizardSeat, isHeroTurn, lineActionBySeat, preflopSeats, preflopSequenceCompleted, reportBoardPreview, selectedLineActions.length]);

  const reportProgressLabel = useMemo(() => {
    const flopReady = reportStreetState.flop.cards.length;
    const turnReady = reportStreetState.turn.cards.length;
    const riverReady = reportStreetState.river.cards.length;
    return `Flop ${flopReady}/3 · Turn ${turnReady}/1 · River ${riverReady}/1`;
  }, [reportStreetState]);

  function handleLineActionPick(seat: PreflopSeat, action: string, seatIndex: number) {
    setLineActionBySeat((prev) => {
      const next = {
        ...prev,
        [seat]: action,
      };
      for (let index = seatIndex + 1; index < preflopSeats.length; index += 1) {
        const downstreamSeat = preflopSeats[index];
        delete next[downstreamSeat];
      }
      return next;
    });

    const nextSeat = preflopSeats[seatIndex + 1];
    const nextSpot = nextSeat ? seatSpotMap[nextSeat] : null;
    if (nextSpot) {
      setSelectedSpotId(nextSpot.id);
      return;
    }
    const currentSeatSpot = seatSpotMap[seat];
    if (currentSeatSpot) {
      setSelectedSpotId(currentSeatSpot.id);
    }
  }

  function resetLineActions() {
    setLineActionBySeat({});
    const firstSpot = seatSpotMap[preflopSeats[0]];
    if (firstSpot) {
      setSelectedSpotId(firstSpot.id);
    }
  }

  function openReportPicker(street: ReportStreet) {
    const required = street === 'flop' ? 3 : 1;
    setReportPicker({
      street,
      required,
      selected: [...reportBoardByStreet[street]],
    });
    setAutoPromptedReportStreet((prev) => ({
      ...prev,
      [street]: true,
    }));
  }

  function closeReportPicker() {
    setReportPicker(null);
  }

  function handlePickReportCard(code: string) {
    if (!reportPicker) {
      return;
    }

    const usedByOtherStreet = REPORT_STREET_ORDER.some(
      (street) => street !== reportPicker.street && reportBoardByStreet[street].includes(code),
    );
    if (usedByOtherStreet) {
      return;
    }

    setReportPicker((prev) => {
      if (!prev) return prev;
      if (prev.selected.includes(code)) {
        return {
          ...prev,
          selected: prev.selected.filter((card) => card !== code),
        };
      }
      if (prev.selected.length >= prev.required) {
        return prev;
      }
      return {
        ...prev,
        selected: [...prev.selected, code],
      };
    });
  }

  function handleAutoPickReportCards() {
    if (!reportPicker) {
      return;
    }
    const blocked = new Set(
      REPORT_STREET_ORDER.flatMap((street) => (street === reportPicker.street ? [] : reportBoardByStreet[street])),
    );
    const available = allPickerCards.filter((card) => !blocked.has(card));
    const sampled = sampleCards(available, reportPicker.required);
    setReportPicker((prev) => (prev ? { ...prev, selected: sampled } : prev));
  }

  function handleConfirmReportCards() {
    if (!reportPicker || reportPicker.selected.length !== reportPicker.required) {
      return;
    }
    setReportBoardByStreet((prev) => ({
      ...prev,
      [reportPicker.street]: [...reportPicker.selected],
    }));
    setReportPicker(null);
  }

  function clearAllReportCards() {
    setReportBoardByStreet({
      flop: [],
      turn: [],
      river: [],
    });
    setAutoPromptedReportStreet({
      flop: false,
      turn: false,
      river: false,
    });
    setReportPicker(null);
  }

  useEffect(() => {
    let nextStreet: ReportStreet | null = null;
    if (reportBoardByStreet.flop.length !== 3) {
      nextStreet = 'flop';
    } else if (reportBoardByStreet.turn.length !== 1) {
      nextStreet = 'turn';
    } else if (reportBoardByStreet.river.length !== 1) {
      nextStreet = 'river';
    }

    if (!nextStreet || reportPicker || autoPromptedReportStreet[nextStreet]) {
      return;
    }

    const actionThreshold = nextStreet === 'flop' ? preflopSeats.length : preflopSeats.length + 1;
    if (selectedLineActions.length < actionThreshold) {
      return;
    }

    setReportPicker({
      street: nextStreet,
      required: nextStreet === 'flop' ? 3 : 1,
      selected: [...reportBoardByStreet[nextStreet]],
    });
    setAutoPromptedReportStreet((prev) => ({
      ...prev,
      [nextStreet as ReportStreet]: true,
    }));
  }, [autoPromptedReportStreet, preflopSeats.length, reportBoardByStreet, reportPicker, selectedLineActions.length]);

  const hasManualReportBoardSelection =
    reportBoardByStreet.flop.length === 3 || reportBoardByStreet.turn.length === 1 || reportBoardByStreet.river.length === 1;

  useEffect(() => {
    if (!hasManualReportBoardSelection) {
      return;
    }
    const boardCsv = boardCodesToCsv(resolvedBoardCodes);
    if (!boardCsv) {
      return;
    }
    setSolverConfig((prev) => {
      if (normalizeBoardCsv(prev.board).toUpperCase() === normalizeBoardCsv(boardCsv).toUpperCase()) {
        return prev;
      }
      return {
        ...prev,
        board: boardCsv,
      };
    });
  }, [hasManualReportBoardSelection, resolvedBoardCodes]);

  function applySpotToSolverConfig(target: StudySpot) {
    clearAllReportCards();
    setSolverConfig((prev) => ({
      ...prev,
      board: normalizeBoardCsv(target.node.board),
      potSb: String(Math.max(1, Math.round(target.node.pot_bb * 2))),
      effectiveStackSb: String(Math.max(2, Math.round(target.stack_bb * 2))),
    }));
  }

  useEffect(() => {
    if (!selectedSpot) {
      return;
    }
    setSolverConfig((prev) => {
      if (prev.board.trim() || prev.potSb.trim() || prev.effectiveStackSb.trim()) {
        return prev;
      }
      return {
        ...prev,
        board: normalizeBoardCsv(selectedSpot.node.board),
        potSb: String(Math.max(1, Math.round(selectedSpot.node.pot_bb * 2))),
        effectiveStackSb: String(Math.max(2, Math.round(selectedSpot.stack_bb * 2))),
      };
    });
  }, [selectedSpot]);

  const publishCoachContext = useCallback(() => {
    const snapshot = {
      route: '/app/study',
      filters: {
        format: formatFilter,
        position: positionFilter,
        stackBb: stackFilter,
      },
      preflopConfig: {
        format: preflopFormat,
        stackBb: preflopStackBb,
        heroSeat,
        seats: preflopSeats,
      },
      loading: isLoadingSpots,
      refreshTick: solverRefreshTick,
      error: spotsError,
      texasSolverConfig: {
        ...solverConfig,
        boardValid: solverBoardValid,
        missingRequired: solverMissingFields,
      },
      lastAppliedIntent,
      actionLine: preflopSeats.map((seat) => ({
        seat,
        spotId: seatSpotMap[seat]?.id ?? null,
        hero: seat,
        street: 'Preflop',
        selectedAction: lineActionBySeat[seat] ?? null,
        isHeroSeat: seat === heroSeat,
      })),
      linePressure,
      boardTextureBias,
      reportBoard: {
        flop: reportBoardByStreet.flop,
        turn: reportBoardByStreet.turn,
        river: reportBoardByStreet.river,
        resolved: resolvedBoardCodes,
      },
      selectedSpot: selectedSpot
        ? {
            id: selectedSpot.id,
            title: selectedSpot.title,
            format: selectedSpot.format,
            position: selectedSpot.position,
            stackBb: selectedSpot.stack_bb,
            street: selectedSpot.street,
            nodeCode: selectedSpot.node.node_code,
            board: boardCodesToCsv(resolvedBoardCodes) || selectedSpot.node.board,
            hero: selectedSpot.node.hero,
            villain: selectedSpot.node.villain,
            potBb: selectedSpot.node.pot_bb,
            actionMix: (solverSpot ?? selectedSpot).node.strategy.action_mix,
            aggregateEvBb: (solverSpot ?? selectedSpot).node.strategy.aggregate_ev_bb,
            selectedLineAction: selectedSpotSeat ? lineActionBySeat[selectedSpotSeat] ?? null : null,
          }
        : null,
      selectedHand,
      actionBuckets,
      featuredHands: featuredHands.map((item) => ({
        hand: item.hand,
        raisePct: item.raisePct,
        allinPct: item.allinPct,
        foldPct: item.foldPct,
      })),
      boardCards: boardCards.map((item) => item.raw),
    };

    window.dispatchEvent(
      new CustomEvent('coach:context', {
        detail: {
          module: 'study',
          snapshot,
          updatedAt: new Date().toISOString(),
        },
      }),
    );
  }, [
    actionBuckets,
    boardCards,
    boardTextureBias,
    featuredHands,
    formatFilter,
    heroSeat,
    isLoadingSpots,
    lastAppliedIntent,
    lineActionBySeat,
    linePressure,
    preflopFormat,
    preflopSeats,
    preflopStackBb,
    positionFilter,
    reportBoardByStreet,
    resolvedBoardCodes,
    seatSpotMap,
    solverRefreshTick,
    solverBoardValid,
    solverConfig,
    solverMissingFields,
    solverSpot,
    selectedHand,
    selectedSpotSeat,
    selectedSpot,
    spotsError,
    stackFilter,
  ]);

  useEffect(() => {
    publishCoachContext();
  }, [publishCoachContext]);

  useEffect(() => {
    const handleContextRequest = () => {
      publishCoachContext();
    };

    window.addEventListener('coach:request-context', handleContextRequest);
    return () => window.removeEventListener('coach:request-context', handleContextRequest);
  }, [publishCoachContext]);

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

        <div className="study-filter">
          <label htmlFor="study-filter-hero">Hero Seat</label>
          <select
            id="study-filter-hero"
            value={heroSeat}
            onChange={(event) => {
              setHeroSeat(event.target.value as PreflopSeat);
            }}
          >
            {preflopSeats.map((seat) => (
              <option key={seat} value={seat}>
                {seat}
              </option>
            ))}
          </select>
        </div>
      </section>

      <details className="study-build-shell">
        <summary>TexasSolver Builder</summary>
        <section className="study-build-panel" aria-label="TexasSolver setup panel">
        <header className="study-build-panel__header">
          <h2>TexasSolver Builder</h2>
          <p>AI 只会在你点击“应用参数”后修改这里。先补齐必填，再去 Build Tree / Start solving。</p>
        </header>

        <div className="study-build-grid">
          <label>
            IP Range（必填）
            <textarea
              value={solverConfig.ipRange}
              onChange={(event) => setSolverConfig((prev) => ({ ...prev, ipRange: event.target.value }))}
              placeholder="AKs,AQs,JJ+,A5s..."
              rows={2}
            />
          </label>
          <label>
            OOP Range（必填）
            <textarea
              value={solverConfig.oopRange}
              onChange={(event) => setSolverConfig((prev) => ({ ...prev, oopRange: event.target.value }))}
              placeholder="QQ-TT,AKo,AQs..."
              rows={2}
            />
          </label>
          <label>
            Board（必填，例：Qs,Jh,2h）
            <input
              value={solverConfig.board}
              onChange={(event) => setSolverConfig((prev) => ({ ...prev, board: event.target.value }))}
              placeholder="Qs,Jh,2h"
            />
          </label>
          <label>
            Pot（SB，必填）
            <input
              value={solverConfig.potSb}
              onChange={(event) => setSolverConfig((prev) => ({ ...prev, potSb: event.target.value.replace(/[^\d.]/g, '') }))}
              placeholder="10"
            />
          </label>
          <label>
            Effective Stack（SB，必填）
            <input
              value={solverConfig.effectiveStackSb}
              onChange={(event) => setSolverConfig((prev) => ({ ...prev, effectiveStackSb: event.target.value.replace(/[^\d.]/g, '') }))}
              placeholder="190"
            />
          </label>
          <label>
            Flop Bet Sizes（% pot，必填）
            <input
              value={solverConfig.flopBetSizes}
              onChange={(event) => setSolverConfig((prev) => ({ ...prev, flopBetSizes: event.target.value }))}
              placeholder="33 50 75"
            />
          </label>
          <label>
            Flop Raise Sizes（% pot，必填）
            <input
              value={solverConfig.flopRaiseSizes}
              onChange={(event) => setSolverConfig((prev) => ({ ...prev, flopRaiseSizes: event.target.value }))}
              placeholder="60 100"
            />
          </label>
          <label>
            Raise Limit（选填）
            <input
              value={solverConfig.raiseLimit}
              onChange={(event) => setSolverConfig((prev) => ({ ...prev, raiseLimit: event.target.value.replace(/[^\d]/g, '') }))}
              placeholder="3"
            />
          </label>
          <label>
            Allin Threshold（选填）
            <input
              value={solverConfig.allinThreshold}
              onChange={(event) => setSolverConfig((prev) => ({ ...prev, allinThreshold: event.target.value.replace(/[^\d.]/g, '') }))}
              placeholder="0.67"
            />
          </label>
        </div>

        <div className="study-build-panel__actions">
          <button
            type="button"
            className="module-next-link"
            onClick={() => {
              if (selectedSpot) {
                applySpotToSolverConfig(selectedSpot);
              }
            }}
          >
            从当前 Spot 回填 Board/Pot/Stack
          </button>
          <button
            type="button"
            className="study-view-tab"
            onClick={() => {
              clearAllReportCards();
              setSolverConfig(DEFAULT_SOLVER_CONFIG);
              setLastAppliedIntent(null);
            }}
          >
            清空参数
          </button>
        </div>

        <p className={solverMissingFields.length === 0 && solverBoardValid ? 'mvp-feedback mvp-feedback--ok' : 'mvp-feedback mvp-feedback--warn'}>
          {solverMissingFields.length > 0
            ? `还缺必填：${solverMissingFields.join(' / ')}`
            : solverBoardValid
              ? '必填项已齐，可以去 TexasSolver Build Tree。'
              : 'Board 格式不合法，请用类似 Qs,Jh,2h（3~5 张）。'}
        </p>
        {lastAppliedIntent ? <p className="study-ev-caption">最近 AI 应用：{lastAppliedIntent}</p> : null}

        <details className="study-build-panel__preview">
          <summary>TexasSolver 参数预览</summary>
          <pre>{solverConfigPreview}</pre>
        </details>
        </section>
      </details>

      {isLoadingSpots ? <p className="study-ev-caption">{t('study.loading')}</p> : null}
      {spotsError ? <p className="module-error-text">{spotsError}</p> : null}

      {filteredSpots.length === 0 ? (
        <article className="study-empty-state">
          <h2>{t('study.empty.title')}</h2>
          <p>{t('study.empty.desc')}</p>
        </article>
      ) : selectedSpot ? (
        <div className="study-solver">
          <section className="study-wizard-strip" aria-label="Solver node strip">
            <aside className="study-wizard-rail" aria-label="Study toolbar">
              {WIZARD_SIDE_TOOLS.map((tool, index) => (
                <button
                  key={`${tool}-${index}`}
                  type="button"
                  className={index === 1 ? 'study-wizard-rail__button study-wizard-rail__button--active' : 'study-wizard-rail__button'}
                >
                  {tool}
                </button>
              ))}
            </aside>

            <div className="study-wizard-track">
              <article className="study-wizard-card study-wizard-card--scenario">
                <header>
                  <strong>{formatLabel(preflopFormat)}</strong>
                  <span>{preflopStackBb}bb</span>
                </header>
                <ul>
                  <li>• Hero Seat: {heroSeat}</li>
                  <li>• Seats: {preflopSeats.join(' → ')}</li>
                  <li>• Spot Anchor: {selectedSpot.node.node_code}</li>
                </ul>
                <button
                  type="button"
                  className="study-wizard-card__change"
                  onClick={() => {
                    applySpotToSolverConfig(selectedSpot);
                  }}
                >
                  Change
                </button>
                <button type="button" className="study-wizard-card__change" onClick={resetLineActions}>
                  Reset line
                </button>
              </article>

              {visibleWizardSeatCards.map((card) => {
                const isLineSelected = Boolean(card.selectedAction);
                return (
                  <article
                    key={card.seat}
                    className={[
                      'study-wizard-card',
                      card.isSelectedSpot ? 'study-wizard-card--active' : '',
                      card.isHeroSeat ? 'study-wizard-card--hero' : '',
                      card.isCurrentTurn ? 'study-wizard-card--turn' : '',
                      isLineSelected ? 'study-wizard-card--line-selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <button
                      type="button"
                      className="study-wizard-card__seat"
                      onClick={() => {
                        if (card.relatedSpot) {
                          setSelectedSpotId(card.relatedSpot.id);
                        }
                      }}
                      disabled={!card.relatedSpot || !card.isUnlocked}
                      aria-pressed={card.isSelectedSpot}
                    >
                      <strong>{card.seat}</strong>
                      <span>{card.stackBb}</span>
                    </button>

                    <div className="study-wizard-card__actions">
                      {card.actions.slice(0, 4).map((action) => {
                        const isChosen = card.selectedAction
                          ? normalizeActionLabel(card.selectedAction) === normalizeActionLabel(action)
                          : false;
                        const tone = actionTone(action);
                        return (
                          <button
                            key={`${card.seat}-${action}`}
                            type="button"
                            className={[
                              'study-wizard-action',
                              `study-wizard-action--${tone}`,
                              isChosen ? 'study-wizard-action--active' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() => {
                              handleLineActionPick(card.seat, action, card.orderIndex);
                            }}
                            disabled={!card.isUnlocked}
                            aria-pressed={isChosen}
                          >
                            {action}
                          </button>
                        );
                      })}
                    </div>
                    {card.relatedSpot ? <small className="study-wizard-card__anchor">Node {card.relatedSpot.node.node_code}</small> : null}
                  </article>
                );
              })}

              <article className="study-wizard-card study-wizard-card--board">
                <header>
                  <strong>FLOP</strong>
                  <span>{canOpenFlopPicker ? reportProgressLabel : isHeroTurn ? '轮到你动作' : '等待前位动作'}</span>
                </header>
                <button
                  type="button"
                  className="study-wizard-board"
                  onClick={() => {
                    if (canOpenFlopPicker) {
                      openReportPicker('flop');
                    }
                  }}
                  disabled={!canOpenFlopPicker}
                >
                  {canOpenFlopPicker
                    ? reportStreetState.flop.cards.length === 3
                      ? reportStreetState.flop.cards.map((card) => formatCardCode(card)).join(' ')
                      : 'W W W'
                    : '...'}
                </button>
                <button
                  type="button"
                  className="study-wizard-board__solve"
                  onClick={() => {
                    if (canOpenFlopPicker) {
                      openReportPicker('flop');
                    }
                  }}
                  disabled={!canOpenFlopPicker}
                >
                  AI solve
                </button>
              </article>
            </div>
          </section>

          <p className="study-line-summary">{lineSummary}</p>

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
                    board: boardCodesToCsv(resolvedBoardCodes) || selectedSpot.node.board,
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
                        <strong>{handCell.raisePct.toFixed(0)}</strong>
                      </p>
                      <p>
                        <span>{actionBuckets[1]?.label}</span>
                        <strong>{handCell.allinPct.toFixed(0)}</strong>
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
              <p className="study-ev-caption">{formatSignedBb((solverSpot ?? selectedSpot).node.strategy.aggregate_ev_bb)}</p>
              <p className="study-ev-caption">
                Matrix: {selectedSpotMatrix ? selectedSpotMatrix.source : 'heuristic-fallback'}
              </p>
            </aside>
          </div>
        </div>
      ) : null}

      {reportPicker ? (
        <div className="study-picker-overlay" role="dialog" aria-modal="true" aria-label="study-report-board-picker">
          <div className="study-picker-dialog">
            <header className="study-picker-header">
              <div>
                <p>CHOOSE REPORT BOARD</p>
                <h3>
                  {reportStreetLabel(reportPicker.street)} · 需要 {reportPicker.required} 张
                </h3>
              </div>
              <button type="button" className="study-picker-close" onClick={closeReportPicker} aria-label="Close board picker">
                ×
              </button>
            </header>

            <div className="study-picker-tabs">
              {REPORT_STREET_ORDER.map((street) => (
                <span
                  key={street}
                  className={reportPicker.street === street ? 'study-picker-tab study-picker-tab--active' : 'study-picker-tab'}
                >
                  {reportStreetLabel(street)}
                </span>
              ))}
            </div>

            <div className="study-picker-selected">
              {reportPicker.selected.length === 0 ? (
                <em>未选择</em>
              ) : (
                reportPicker.selected.map((card) => <b key={card}>{formatCardCode(card)}</b>)
              )}
            </div>

            <div className="study-picker-rank-header">
              <span />
              {MATRIX_RANKS.map((rank) => (
                <strong key={rank}>{rank}</strong>
              ))}
            </div>

            <div className="study-picker-grid">
              {REPORT_PICKER_SUITS.map((suit) => (
                <div key={suit.code} className="study-picker-suit-row">
                  <span className="study-picker-suit-tag" aria-label={suit.rowLabel}>
                    {suit.icon}
                  </span>
                  {MATRIX_RANKS.map((rank) => {
                    const code = `${rank}${suit.code}`;
                    const usedByOtherStreet = REPORT_STREET_ORDER.some(
                      (street) => street !== reportPicker.street && reportBoardByStreet[street].includes(code),
                    );
                    const selected = reportPicker.selected.includes(code);
                    const noRoom = !selected && reportPicker.selected.length >= reportPicker.required;
                    const disabled = usedByOtherStreet || noRoom;
                    return (
                      <button
                        key={code}
                        type="button"
                        className={[
                          'study-picker-card',
                          `study-picker-card--${suit.code}`,
                          selected ? 'study-picker-card--selected' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => handlePickReportCard(code)}
                        disabled={disabled}
                        aria-pressed={selected}
                      >
                        {suit.icon}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <footer className="study-picker-footer">
              <button type="button" onClick={handleAutoPickReportCards}>
                随机抽牌
              </button>
              <button
                type="button"
                className="study-picker-confirm"
                onClick={handleConfirmReportCards}
                disabled={reportPicker.selected.length !== reportPicker.required}
              >
                Confirm
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}
