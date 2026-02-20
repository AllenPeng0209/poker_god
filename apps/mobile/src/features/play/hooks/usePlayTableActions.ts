// @ts-nocheck
import { Audio } from 'expo-av';
import React, { useEffect } from 'react';
import { Animated, Easing } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';

import { trainingZones } from '../../../data/zones';
import { createNewHand } from '../../../engine/game';
import type { ProgressState } from '../../../types/poker';

import * as Play from '../index';

type Phase = Play.Phase;
type AppLanguage = Play.AppLanguage;
type Seat = Play.Seat;
type SeatVisual = Play.SeatVisual;
type SfxKey = Play.SfxKey;
type TableEvent = Play.TableEvent;
type TableEventKind = Play.TableEventKind;
type TrainingMode = Play.TrainingMode;
type ZoneTrainingState = Play.ZoneTrainingState;

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

const {
  ACTION_FEED_LIMIT,
  BIG_BLIND_SIZE,
  HERO_SEAT,
  LOAN_BB,
  LOAN_REPAY_RATE,
  PRACTICE_XP_MULTIPLIER,
  STARTING_BB,
  STARTING_STACK,
  SUBSIDY_BB,
  actionDisplayText,
  actionSfxKey,
  bbToChips,
  buildHandBankrollForMode,
  buildSeatVisualMap,
  careerXpMultiplier,
  chipsToBb,
  clamp,
  createZoneTrainingState,
  eventDelayMs,
  extractBankrollFromHand,
  l,
  localDateKey,
  makeSeats,
  nextEventId,
  normalizeStackValue,
  pickAi,
  positionRelativeToButton,
  rt,
  seatLayout,
  seatName,
  shortName,
  streetBoardCount,
  syncZoneTrainingState,
  t,
  tableOrder,
  zoneMissionsCompleted,
  zoneName,
  zoneUnlockHint,
} = Play;

export type UsePlayTableActionsParams = {
  appLanguage: AppLanguage;
  autoPlayEvents: boolean;
  autoPlayTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  battleSeatId: string | null;
  buttonSeatId: string;
  canRaise: boolean;
  chipPulse: Animated.Value;
  closeBankruptcyOverlay: () => void;
  eventQueue: TableEvent[];
  eventSeed: number;
  hand: Play.HandState;
  minRaise: number;
  progress: ProgressState;
  raiseAmount: number;
  raiseCap: number;
  raiseRange: number;
  raiseSliderWidth: number;
  seats: Seat[];
  selectedSeatId: string;
  sfxEnabled: boolean;
  sfxReady: boolean;
  soundsRef: React.MutableRefObject<Record<SfxKey, Audio.Sound[]>>;
  seatPulse: Animated.Value;
  trainingMode: TrainingMode;
  unlockedIdx: number;
  unlockedZoneName: string;
  zone: (typeof trainingZones)[number];
  zoneBankroll: Record<string, number>;
  zoneIndex: number;
  zoneTrainingById: Record<string, ZoneTrainingState>;
  setActionFeed: SetState<string[]>;
  setActiveSeatAnimId: SetState<string | null>;
  setBattleSeatId: SetState<string | null>;
  setButtonSeatId: SetState<string>;
  setDisplayedBoardCount: SetState<number>;
  setEventQueue: SetState<TableEvent[]>;
  setEventSeed: SetState<number>;
  setHand: SetState<Play.HandState>;
  setLeakGuess: SetState<Play.OppLeakGuess | null>;
  setLobbyZone: SetState<number>;
  setNote: SetState<string>;
  setPendingReplacementSeatIds: SetState<string[]>;
  setPhase: SetState<Phase>;
  setRaiseAmount: SetState<number>;
  setRaiseSliderWidth: SetState<number>;
  setSeatVisual: SetState<Record<string, SeatVisual>>;
  setSeats: SetState<Seat[]>;
  setSelectedSeatId: SetState<string>;
  setTableFeed: SetState<string[]>;
  setTableViewportWidth: SetState<number>;
  setTrainingMode: SetState<TrainingMode>;
  setZoneIndex: SetState<number>;
  setZoneTrainingById: SetState<Record<string, ZoneTrainingState>>;
};

export function usePlayTableActions(params: UsePlayTableActionsParams) {
  const {
    appLanguage,
    autoPlayEvents,
    autoPlayTimerRef,
    battleSeatId,
    buttonSeatId,
    canRaise,
    chipPulse,
    closeBankruptcyOverlay,
    eventQueue,
    eventSeed,
    hand,
    minRaise,
    progress,
    raiseAmount,
    raiseCap,
    raiseRange,
    raiseSliderWidth,
    seats,
    selectedSeatId,
    sfxEnabled,
    sfxReady,
    soundsRef,
    seatPulse,
    trainingMode,
    unlockedIdx,
    unlockedZoneName,
    zone,
    zoneBankroll,
    zoneIndex,
    zoneTrainingById,
    setActionFeed,
    setActiveSeatAnimId,
    setBattleSeatId,
    setButtonSeatId,
    setDisplayedBoardCount,
    setEventQueue,
    setEventSeed,
    setHand,
    setLeakGuess,
    setLobbyZone,
    setNote,
    setPendingReplacementSeatIds,
    setPhase,
    setRaiseAmount,
    setRaiseSliderWidth,
    setSeatVisual,
    setSeats,
    setSelectedSeatId,
    setTableFeed,
    setTableViewportWidth,
    setTrainingMode,
    setZoneIndex,
    setZoneTrainingById,
  } = params;

function enqueueTableEvents(events: TableEvent[]) {
  if (events.length === 0) return;
  setEventQueue((prev) => [...prev, ...events]);
}

function playSfx(kind: SfxKey) {
  if (!sfxEnabled || !sfxReady) return;
  const pool = soundsRef.current[kind];
  if (!pool || pool.length === 0) return;
  const sound = pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
  void sound.replayAsync().catch((err) => {
    console.warn(`SFX play failed: ${kind}`, err);
  });
}

function seatById(id: string, list: Seat[] = seats): Seat | undefined {
  return list.find((s) => s.id === id);
}

function nextButtonSeatId(list: Seat[], current: string): string {
  const occupiedIds = seatLayout
    .map((anchor) => anchor.id)
    .filter((seatId) => list.some((seat) => seat.id === seatId && seat.role !== 'empty'));
  if (occupiedIds.length === 0) {
    return current;
  }

  const occupiedSet = new Set(occupiedIds);
  const currentInOccupied = occupiedSet.has(current);
  const currentIdx = seatLayout.findIndex((anchor) => anchor.id === current);
  if (currentInOccupied) {
    const idx = occupiedIds.indexOf(current);
    return occupiedIds[(idx + 1) % occupiedIds.length];
  }

  if (currentIdx === -1) {
    return occupiedIds[0];
  }

  for (let step = 1; step <= seatLayout.length; step += 1) {
    const candidate = seatLayout[(currentIdx + step) % seatLayout.length]?.id;
    if (candidate && occupiedSet.has(candidate)) {
      return candidate;
    }
  }

  return occupiedIds[0];
}

function buildTableConfig(list: Seat[]) {
  return list
    .filter((seat) => seat.role !== 'empty')
    .map((seat) => ({
      id: seat.id,
      position: seat.pos,
      role: seat.role === 'hero' ? 'hero' as const : 'ai' as const,
      ai: seat.ai,
      name: seat.role === 'hero' ? 'Hero' : seat.ai?.name ?? 'AI',
    }));
}

function dealOrderFromSmallBlind(smallBlind: TablePosition, players: typeof hand.players): TablePosition[] {
  // Dealing should follow strict clockwise order from SB and include everyone
  // who was actually dealt cards this hand, even if they folded before UI replay.
  const dealtPositions = tableOrder.filter((pos) => {
    const player = players.find((p) => p.position === pos);
    if (!player) return false;
    return player.inHand;
  });

  if (dealtPositions.length === 0) {
    return [];
  }

  const sbIdx = dealtPositions.indexOf(smallBlind);
  const startIdx = sbIdx === -1 ? 0 : sbIdx;
  const order: TablePosition[] = [];
  for (let i = 0; i < dealtPositions.length; i += 1) {
    order.push(dealtPositions[(startIdx + i) % dealtPositions.length]);
  }
  return order;
}

function buildHandOpeningEvents(nextSeats: Seat[], nextHand: typeof hand): TableEvent[] {
  let seed = eventSeed;
  const events: TableEvent[] = [];
  const push = (event: Omit<TableEvent, 'id'>) => {
    events.push({ id: nextEventId(seed), ...event });
    seed += 1;
  };

  const dealOrder = dealOrderFromSmallBlind(nextHand.smallBlindPosition, nextHand.players);
  for (let round = 0; round < 2; round += 1) {
    dealOrder.forEach((pos) => {
      const seat = nextSeats.find((s) => s.pos === pos && s.role !== 'empty');
      if (!seat || seat.role === 'empty') return;
      push({
        kind: 'deal',
        seatId: seat.id,
        text: l(appLanguage, `發牌：${seatName(seat, appLanguage)} 收到第 ${round + 1} 張`, `发牌：${seatName(seat, appLanguage)} 收到第 ${round + 1} 张`, `Deal: ${seatName(seat, appLanguage)} receives card ${round + 1}`),
      });
    });
  }

  let trackedStreet: Street = 'preflop';
  nextHand.history.forEach((log) => {
    if (log.street !== trackedStreet) {
      const revealDelta = streetBoardCount(log.street) - streetBoardCount(trackedStreet);
      if (revealDelta > 0) {
        push({ kind: 'street', text: l(appLanguage, `進入 ${log.street.toUpperCase()}`, `进入 ${log.street.toUpperCase()}`, `Enter ${log.street.toUpperCase()}`) });
        for (let i = 0; i < revealDelta; i += 1) {
          push({ kind: 'reveal', text: l(appLanguage, `發出 ${log.street.toUpperCase()} 公牌 ${i + 1}`, `发出 ${log.street.toUpperCase()} 公牌 ${i + 1}`, `Reveal ${log.street.toUpperCase()} board card ${i + 1}`) });
        }
      }
      trackedStreet = log.street;
    }
    const kind: TableEventKind = log.forcedBlind ? 'blind' : 'action';
    const fallbackText = kind === 'blind'
      ? l(appLanguage, `盲注 ${log.amount ?? ''}`.trim(), `盲注 ${log.amount ?? ''}`.trim(), `Blind ${log.amount ?? ''}`.trim())
      : actionDisplayText(log.action, log.amount, log.allIn, appLanguage);
    push({
      kind,
      seatId: log.actorId,
      action: log.action,
      amount: log.amount,
      allIn: log.allIn,
      text: rt(log.text, appLanguage, fallbackText),
    });
  });

  push({ kind: 'hint', text: nextHand.isOver ? nextHand.resultText : l(appLanguage, '輪到你行動。', '轮到你行动。', 'Your turn.') });
  setEventSeed(seed);
  return events;
}

function buildTransitionEvents(prevHand: typeof hand, nextHand: typeof hand): TableEvent[] {
  let seed = eventSeed;
  const events: TableEvent[] = [];
  const push = (event: Omit<TableEvent, 'id'>) => {
    events.push({ id: nextEventId(seed), ...event });
    seed += 1;
  };

  const newLogs = nextHand.history.slice(prevHand.history.length);
  let trackedStreet = prevHand.street;
  newLogs.forEach((log) => {
    if (log.street !== trackedStreet) {
      const revealDelta = streetBoardCount(log.street) - streetBoardCount(trackedStreet);
      if (revealDelta > 0) {
        push({ kind: 'street', text: l(appLanguage, `進入 ${log.street.toUpperCase()}`, `进入 ${log.street.toUpperCase()}`, `Enter ${log.street.toUpperCase()}`) });
        for (let i = 0; i < revealDelta; i += 1) {
          push({ kind: 'reveal', text: l(appLanguage, `發出 ${log.street.toUpperCase()} 公牌 ${i + 1}`, `发出 ${log.street.toUpperCase()} 公牌 ${i + 1}`, `Reveal ${log.street.toUpperCase()} board card ${i + 1}`) });
        }
      }
      trackedStreet = log.street;
    }
    const kind: TableEventKind = log.forcedBlind ? 'blind' : 'action';
    const fallbackText = kind === 'blind'
      ? l(appLanguage, `盲注 ${log.amount ?? ''}`.trim(), `盲注 ${log.amount ?? ''}`.trim(), `Blind ${log.amount ?? ''}`.trim())
      : actionDisplayText(log.action, log.amount, log.allIn, appLanguage);
    push({
      kind,
      seatId: log.actorId ?? (log.actor === 'hero' ? HERO_SEAT : undefined),
      action: log.action,
      amount: log.amount,
      allIn: log.allIn,
      text: rt(log.text, appLanguage, fallbackText),
    });
  });

  if (nextHand.isOver) {
    push({ kind: 'hint', text: nextHand.resultText || l(appLanguage, '本手結束', '本手结束', 'Hand complete') });
  }

  setEventSeed(seed);
  return events;
}

function animateSeatDeal(seatId: string) {
  setActiveSeatAnimId(seatId);
  seatPulse.setValue(0);
  Animated.sequence([
    Animated.timing(seatPulse, {
      toValue: 1,
      duration: 170,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }),
    Animated.timing(seatPulse, {
      toValue: 0,
      duration: 170,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }),
  ]).start(() => {
    setActiveSeatAnimId((current) => (current === seatId ? null : current));
  });
}

function animateChipPush() {
  chipPulse.setValue(0);
  Animated.timing(chipPulse, {
    toValue: 1,
    duration: 320,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  }).start(() => {
    Animated.timing(chipPulse, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  });
}

function applyTableEvent(event: TableEvent) {
  setTableFeed((prev) => [event.text, ...prev].slice(0, 18));
  if (event.kind === 'action' || event.kind === 'blind') {
    setActionFeed((prev) => [event.text, ...prev].slice(0, ACTION_FEED_LIMIT));
  }

  if (event.kind === 'street') {
    playSfx('reveal');
    return;
  }

  if (event.kind === 'reveal') {
    playSfx('reveal');
    setDisplayedBoardCount((count) => Math.min(hand.revealedBoardCount, count + 1));
    return;
  }

  if (event.kind === 'hint') {
    playSfx('ui');
    return;
  }

  if (!event.seatId) {
    return;
  }
  const seatId = event.seatId;

  setSeatVisual((prev) => {
    const target = prev[seatId];
    if (!target) return prev;
    const next = { ...prev };
    const updated = { ...target };
    if (event.kind === 'deal') {
      playSfx('deal');
      animateSeatDeal(seatId);
      updated.cardsDealt = Math.min(2, updated.cardsDealt + 1);
      updated.lastAction = l(appLanguage, '收牌', '收牌', 'Dealt');
    } else if (event.kind === 'blind') {
      playSfx('blind');
      if ((event.amount ?? 0) > 0) {
        animateChipPush();
      }
      updated.lastAction = l(appLanguage, `盲注 ${event.amount ?? ''}`.trim(), `盲注 ${event.amount ?? ''}`.trim(), `Blind ${event.amount ?? ''}`.trim());
    } else if (event.kind === 'action') {
      const soundKey = actionSfxKey(event.action, event.amount, event.allIn, event.text);
      playSfx(soundKey);
      if (soundKey === 'call' || soundKey === 'raise' || soundKey === 'allIn' || soundKey === 'blind') {
        animateChipPush();
      }
      updated.lastAction = actionDisplayText(event.action, event.amount, event.allIn, appLanguage);
      if (event.action === 'fold') {
        updated.folded = true;
        updated.inHand = false;
      } else if (event.action === 'raise' || event.action === 'call' || event.action === 'check') {
        updated.inHand = true;
        updated.folded = false;
      }
    }
    next[seatId] = updated;
    return next;
  });
}

function runNextEvent() {
  if (autoPlayTimerRef.current) {
    clearTimeout(autoPlayTimerRef.current);
    autoPlayTimerRef.current = null;
  }
  setEventQueue((prev) => {
    if (prev.length === 0) return prev;
    const [head, ...rest] = prev;
    applyTableEvent(head);
    return rest;
  });
}

useEffect(() => {
  if (autoPlayTimerRef.current) {
    clearTimeout(autoPlayTimerRef.current);
    autoPlayTimerRef.current = null;
  }
  if (!autoPlayEvents || eventQueue.length === 0) return;
  autoPlayTimerRef.current = setTimeout(() => {
    runNextEvent();
  }, eventDelayMs(eventQueue[0]));
  return () => {
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  };
}, [autoPlayEvents, eventQueue]);

function setRaiseAmountBySliderLocation(locationX: number) {
  if (!canRaise || raiseSliderWidth <= 0) {
    return;
  }
  const ratio = clamp(locationX / raiseSliderWidth, 0, 1);
  if (raiseRange <= 0) {
    setRaiseAmount(raiseCap);
    return;
  }
  const nextAmount = minRaise + Math.round(raiseRange * ratio);
  setRaiseAmount(clamp(nextAmount, minRaise, raiseCap));
}

function handleRaiseSliderLayout(event: LayoutChangeEvent) {
  setRaiseSliderWidth(event.nativeEvent.layout.width);
}

function handleTableScreenLayout(event: LayoutChangeEvent) {
  const nextWidth = event.nativeEvent.layout.width;
  if (!Number.isFinite(nextWidth) || nextWidth <= 0) {
    return;
  }
  setTableViewportWidth((prev) => (Math.abs(prev - nextWidth) > 1 ? nextWidth : prev));
}

function handleRaiseSliderGesture(event: GestureResponderEvent) {
  setRaiseAmountBySliderLocation(event.nativeEvent.locationX);
}

function stackText(seat: Seat): string {
  if (seat.role === 'empty') return '--';
  const player = hand.players.find((p) => p.id === seat.id);
  if (player) {
    const stack = normalizeStackValue(player.stack);
    if (seat.role === 'ai' && hand.isOver && stack <= 0) {
      return l(appLanguage, '出局', '出局', 'Busted');
    }
    return `${stack}`;
  }
  const persistentStack = zoneBankroll[seat.id];
  if (typeof persistentStack === 'number') {
    if (seat.role === 'ai' && persistentStack <= 0) {
      return l(appLanguage, '出局', '出局', 'Busted');
    }
    return `${normalizeStackValue(persistentStack)}`;
  }
  if (seat.role === 'hero') return `${normalizeStackValue(hand.heroStack)}`;
  return `${STARTING_STACK}`;
}

function startHand(targetSeatId?: string, options?: { zoneStateOverride?: ZoneTrainingState; modeOverride?: TrainingMode }) {
  const mode = options?.modeOverride ?? trainingMode;
  const syncedZoneState = options?.zoneStateOverride ?? syncZoneTrainingState(zone, seats, zoneTrainingById[zone.id]);
  const bankroll = syncedZoneState.bankroll;
  const handBankroll = buildHandBankrollForMode(mode, seats, bankroll);
  if (mode === 'career' && (bankroll[HERO_SEAT] ?? STARTING_STACK) <= 0) {
    setNote(l(appLanguage, '你在本區已無可用籌碼，請到燈泡抽屜點「重置本區 100bb」。', '你在本区已无可用筹码，请到灯泡抽屉点「重置本区 100bb」。', 'No chips left in this zone. Open the bulb drawer and tap "Reset zone to 100bb".'));
    return;
  }

  const aiSeats = seats.filter((s): s is Seat & { role: 'ai' } => s.role === 'ai');
  if (aiSeats.length === 0) {
    setNote(l(appLanguage, '請先新增一位 AI 再開局。', '请先新增一位 AI 再开局。', 'Add at least one AI before starting a hand.'));
    return;
  }

  const preferredSeatId = targetSeatId ?? battleSeatId ?? aiSeats[0]?.id;
  const preferredSeat = aiSeats.find((s) => s.id === preferredSeatId);
  const seat = mode === 'practice'
    ? (preferredSeat ?? aiSeats[0])
    : ((preferredSeat && (handBankroll[preferredSeat.id] ?? STARTING_STACK) > 0)
      ? preferredSeat
      : aiSeats.find((candidate) => (handBankroll[candidate.id] ?? STARTING_STACK) > 0));

  if (!seat) {
    setNote(l(appLanguage, '所有 AI 都已出局，請新增 AI 或重置本區資金。', '所有 AI 都已出局，请新增 AI 或重置本区资金。', 'All AIs are busted. Add AI players or reset this zone bankroll.'));
    return;
  }
  if (!seat.ai) {
    setNote(l(appLanguage, '請先新增或選擇一位 AI 當本手對手', '请先新增或选择一位 AI 当本手对手', 'Add or select an AI opponent first.'));
    return;
  }

  const switchedOpponent = !!preferredSeat && preferredSeat.id !== seat.id;
  const tableConfig = buildTableConfig(seats);
  const nextButtonId = nextButtonSeatId(seats, buttonSeatId);
  const buttonSeat = seatById(nextButtonId, seats);
  const fresh = createNewHand(zone, seat.ai, {
    tablePlayers: tableConfig,
    focusVillainId: seat.id,
    buttonPosition: buttonSeat?.pos ?? 'BTN',
    stackByPlayerId: handBankroll,
    startingStack: STARTING_STACK,
  });
  setZoneTrainingById((prev) => ({
    ...prev,
    [zone.id]: {
      ...syncedZoneState,
      bankroll: { ...bankroll },
    },
  }));
  setBattleSeatId(seat.id);
  setPendingReplacementSeatIds([]);
  setButtonSeatId(nextButtonId);
  setHand(fresh);
  setRaiseAmount(fresh.toCall + fresh.minRaise);
  setDisplayedBoardCount(0);
  setTableFeed([]);
  setActionFeed([]);
  const visual = buildSeatVisualMap(seats, appLanguage);
  setSeatVisual(visual);
  setEventQueue([]);
  enqueueTableEvents(buildHandOpeningEvents(seats, fresh));
  const actor = fresh.players.find((p) => p.id === fresh.actingPlayerId);
  const heroStack = handBankroll[HERO_SEAT] ?? STARTING_STACK;
  const switchHint = switchedOpponent
    ? l(appLanguage, `已切換對手為 ${seatName(seat, appLanguage)}。`, `已切换对手为 ${seatName(seat, appLanguage)}。`, `Switched opponent to ${seatName(seat, appLanguage)}.`)
    : '';
  const modeHint = mode === 'practice'
    ? l(appLanguage, `練習模式（不消耗區域資金，XP ${Math.round(PRACTICE_XP_MULTIPLIER * 100)}%）`, `练习模式（不消耗区域资金，XP ${Math.round(PRACTICE_XP_MULTIPLIER * 100)}%）`, `Practice mode (no zone bankroll cost, XP ${Math.round(PRACTICE_XP_MULTIPLIER * 100)}%)`)
    : l(appLanguage, `生涯模式（XP ${Math.round(careerXpMultiplier(syncedZoneState.aidUses) * 100)}%）`, `生涯模式（XP ${Math.round(careerXpMultiplier(syncedZoneState.aidUses) * 100)}%）`, `Career mode (XP ${Math.round(careerXpMultiplier(syncedZoneState.aidUses) * 100)}%)`);
  setNote(
    l(
      appLanguage,
      `${switchHint}新手牌：${fresh.position.situationLabel}，按鈕 ${buttonSeat?.pos ?? 'BTN'}。資金 ${heroStack}（${Math.floor(heroStack / Math.max(1, fresh.bigBlind))}bb）。${modeHint}。${actor?.name === 'Hero' ? '輪到你行動。' : `目前行動：${actor?.name ?? '等待'}`}`,
      `${switchHint}新手牌：${fresh.position.situationLabel}，按钮 ${buttonSeat?.pos ?? 'BTN'}。资金 ${heroStack}（${Math.floor(heroStack / Math.max(1, fresh.bigBlind))}bb）。${modeHint}。${actor?.name === 'Hero' ? '轮到你行动。' : `当前行动：${actor?.name ?? '等待'}`}`,
      `${switchHint}New hand: ${fresh.position.situationLabel}, button ${buttonSeat?.pos ?? 'BTN'}. Bankroll ${heroStack} (${Math.floor(heroStack / Math.max(1, fresh.bigBlind))}bb). ${modeHint}. ${actor?.name === 'Hero' ? 'Your turn.' : `Acting now: ${actor?.name ?? 'Waiting'}`}`,
    ),
  );
}

function enterTable(z: number) {
  if (z > unlockedIdx) {
    const zoneDef = trainingZones[z] ?? trainingZones[0];
    setNote(l(appLanguage, `目前只解鎖到 ${unlockedZoneName}。${zoneName(zoneDef, appLanguage)} 解鎖條件：${zoneUnlockHint(z, progress, appLanguage)}。`, `目前只解锁到 ${unlockedZoneName}。${zoneName(zoneDef, appLanguage)} 解锁条件：${zoneUnlockHint(z, progress, appLanguage)}。`, `Unlocked up to ${unlockedZoneName}. Requirement for ${zoneName(zoneDef, appLanguage)}: ${zoneUnlockHint(z, progress, appLanguage)}.`));
    return;
  }
  const zoneDef = trainingZones[z];
  const mode = trainingMode;
  const nextSeats = makeSeats(z);
  const syncedZoneState = syncZoneTrainingState(zoneDef, nextSeats, zoneTrainingById[zoneDef.id]);
  const bankroll = syncedZoneState.bankroll;
  const handBankroll = buildHandBankrollForMode(mode, nextSeats, bankroll);
  if (mode === 'career' && (bankroll[HERO_SEAT] ?? STARTING_STACK) <= 0) {
    setNote(l(appLanguage, `${zoneName(zoneDef, appLanguage)} 的 Hero 籌碼已歸零，請先重置本區 100bb。`, `${zoneName(zoneDef, appLanguage)} 的 Hero 筹码已归零，请先重置本区 100bb。`, `Hero stack in ${zoneName(zoneDef, appLanguage)} is zero. Reset this zone to 100bb first.`));
    return;
  }
  const aiSeats = nextSeats.filter((s): s is Seat & { role: 'ai' } => s.role === 'ai');
  const firstAiSeat = mode === 'practice'
    ? aiSeats.find((s) => !!s.ai)
    : aiSeats.find((s) => !!s.ai && (handBankroll[s.id] ?? STARTING_STACK) > 0)
      ?? aiSeats.find((s) => !!s.ai);
  const firstAiId = firstAiSeat?.id ?? null;
  const firstAi = firstAiSeat?.ai ?? pickAi(z);
  const nextButtonId = nextSeats.some((seat) => seat.id === buttonSeatId && seat.role !== 'empty')
    ? buttonSeatId
    : (nextSeats.find((seat) => seat.role !== 'empty')?.id ?? HERO_SEAT);
  const buttonSeat = seatById(nextButtonId, nextSeats);
  const hasPlayableAi = mode === 'practice'
    ? aiSeats.some((s) => !!s.ai)
    : aiSeats.some((s) => !!s.ai && (handBankroll[s.id] ?? STARTING_STACK) > 0);

  setZoneIndex(z);
  setSeats(nextSeats);
  setButtonSeatId(nextButtonId);
  setSelectedSeatId(firstAiId ?? HERO_SEAT);
  setBattleSeatId(firstAiId);
  setPendingReplacementSeatIds([]);
  setLeakGuess(null);
  setZoneTrainingById((prev) => ({
    ...prev,
    [zoneDef.id]: {
      ...syncedZoneState,
      bankroll: { ...bankroll },
    },
  }));

  if (!hasPlayableAi) {
    setDisplayedBoardCount(0);
    setTableFeed([]);
    setActionFeed([]);
    setSeatVisual(buildSeatVisualMap(nextSeats, appLanguage));
    setEventQueue([]);
    setPhase('lobby');
    setNote(l(appLanguage, `無法進桌：${zoneName(zoneDef, appLanguage)} 目前沒有可對戰 AI，請重置本區資金或先補上 AI。`, `无法进桌：${zoneName(zoneDef, appLanguage)} 目前没有可对战 AI，请重置本区资金或先补上 AI。`, `Cannot enter: ${zoneName(zoneDef, appLanguage)} has no playable AI. Reset bankroll or add AI first.`));
    return;
  }

  const fresh = createNewHand(zoneDef, firstAi, {
    tablePlayers: buildTableConfig(nextSeats),
    focusVillainId: firstAiId ?? undefined,
    buttonPosition: buttonSeat?.pos ?? 'BTN',
    stackByPlayerId: handBankroll,
    startingStack: STARTING_STACK,
  });
  setHand(fresh);
  setDisplayedBoardCount(0);
  setTableFeed([]);
  setActionFeed([]);
  const visual = buildSeatVisualMap(nextSeats, appLanguage);
  setSeatVisual(visual);
  setEventQueue([]);
  if (firstAiId) {
    enqueueTableEvents(buildHandOpeningEvents(nextSeats, fresh));
  }
  setPhase('table');
  const heroStack = handBankroll[HERO_SEAT] ?? STARTING_STACK;
  const heroBb = Math.floor(heroStack / Math.max(1, fresh.bigBlind));
  setNote(
    mode === 'practice'
      ? l(appLanguage, `已進入 ${zoneName(zoneDef, appLanguage)}：練習模式起手資金 ${heroStack}（${heroBb}bb），不消耗生涯資金。`, `已进入 ${zoneName(zoneDef, appLanguage)}：练习模式起手资金 ${heroStack}（${heroBb}bb），不消耗生涯资金。`, `Entered ${zoneName(zoneDef, appLanguage)}: practice starting stack ${heroStack} (${heroBb}bb), career bankroll unchanged.`)
      : l(appLanguage, `已進入 ${zoneName(zoneDef, appLanguage)}：起手資金 ${heroStack}（${heroBb}bb），同區域資金會累積不重置。`, `已进入 ${zoneName(zoneDef, appLanguage)}：起手资金 ${heroStack}（${heroBb}bb），同区域资金会累积不重置。`, `Entered ${zoneName(zoneDef, appLanguage)}: starting stack ${heroStack} (${heroBb}bb), zone bankroll persists and accumulates.`),
  );
}

function addAiToSeats(seatIds: string[]): Array<{ seatId: string; ai: AiProfile; pos: TablePosition }> {
  const requested = new Set(seatIds);
  if (requested.size === 0) {
    return [];
  }

  const additions: Array<{ seatId: string; ai: AiProfile; pos: TablePosition }> = [];
  const nextSeats = seats.map((seat) => {
    if (!requested.has(seat.id) || seat.role !== 'empty') {
      return seat;
    }
    const ai = pickAi(zoneIndex);
    additions.push({ seatId: seat.id, ai, pos: seat.pos });
    return { ...seat, role: 'ai' as const, ai };
  });

  if (additions.length === 0) {
    return [];
  }

  const addedIds = new Set(additions.map((item) => item.seatId));
  setSeats(nextSeats);
  const syncedZoneState = syncZoneTrainingState(zone, nextSeats, zoneTrainingById[zone.id]);
  const bankroll = { ...syncedZoneState.bankroll };
  additions.forEach((item) => {
    bankroll[item.seatId] = STARTING_STACK;
  });
  setZoneTrainingById((prev) => ({
    ...prev,
    [zone.id]: {
      ...syncedZoneState,
      bankroll,
    },
  }));
  setSeatVisual((prev) => {
    const next = { ...prev };
    additions.forEach((item) => {
      next[item.seatId] = {
        cardsDealt: 0,
        inHand: true,
        folded: false,
        lastAction: l(appLanguage, '等待中', '等待中', 'Waiting'),
      };
    });
    return next;
  });

  const firstAddedSeatId = additions[0]?.seatId;
  if (firstAddedSeatId) {
    setSelectedSeatId(firstAddedSeatId);
    setBattleSeatId(firstAddedSeatId);
  }
  setPendingReplacementSeatIds((prev) => prev.filter((id) => !addedIds.has(id)));
  return additions;
}

function addAiToSeat(seatId: string): boolean {
  const additions = addAiToSeats([seatId]);
  if (additions.length === 0) {
    return false;
  }
  const added = additions[0];
  setNote(l(appLanguage, `已在 ${added.pos} 新增 ${added.ai.name}。再次點同座位可移除。`, `已在 ${added.pos} 新增 ${added.ai.name}。再次点同座位可移除。`, `Added ${added.ai.name} to ${added.pos}. Tap the same seat again to remove.`));
  return true;
}

function addPendingReplacementPlayers(): void {
  const additions = addAiToSeats(pendingReplacementSeatIds);
  if (additions.length === 0) {
    setPendingReplacementSeatIds([]);
    setNote(l(appLanguage, '目前沒有可補位的空座位。', '目前没有可补位的空座位。', 'No empty seats available for replacement.'));
    return;
  }
  const seatPositions = additions.map((item) => item.pos).join('、');
  setPendingReplacementSeatIds([]);
  setNote(l(appLanguage, `已補進 ${additions.length} 位新玩家（${seatPositions}）。點「下一手」繼續。`, `已补进 ${additions.length} 位新玩家（${seatPositions}）。点「下一手」继续。`, `Added ${additions.length} new player(s) (${seatPositions}). Tap "Next Hand" to continue.`));
}

function skipPendingReplacementPlayers(): void {
  setPendingReplacementSeatIds([]);
  setNote(l(appLanguage, '已保留空位。之後可隨時點空位加入新玩家。', '已保留空位。之后可随时点空位加入新玩家。', 'Empty seats are kept. You can add players later anytime.'));
}

function removeAiFromSeat(seatId: string): boolean {
  const targetSeat = seats.find((s) => s.id === seatId);
  if (!targetSeat || targetSeat.role !== 'ai') {
    return false;
  }

  const nextSeats = seats.map((seat) => (seat.id === seatId ? { ...seat, role: 'empty' as const, ai: undefined } : seat));
  setSeats(nextSeats);
  const syncedZoneState = syncZoneTrainingState(zone, nextSeats, zoneTrainingById[zone.id]);
  setZoneTrainingById((prev) => ({
    ...prev,
    [zone.id]: syncedZoneState,
  }));
  setSeatVisual((prev) => ({
    ...prev,
    [seatId]: {
      cardsDealt: 0,
      inHand: false,
      folded: true,
      lastAction: l(appLanguage, '點擊新增', '点击新增', 'Tap to add'),
    },
  }));

  const nextAi = nextSeats.find((seat) => seat.role === 'ai');
  setSelectedSeatId(nextAi?.id ?? HERO_SEAT);
  if (battleSeatId === seatId) {
    setBattleSeatId(nextAi?.id ?? null);
  }
  setNote(l(appLanguage, `已移除 ${targetSeat.pos} 的 AI。`, `已移除 ${targetSeat.pos} 的 AI。`, `Removed AI from ${targetSeat.pos}.`));
  return true;
}

function handleSeatTap(seat: Seat) {
  const wasSelected = selectedSeatId === seat.id;
  const wasBattleSeat = battleSeatId === seat.id;
  setSelectedSeatId(seat.id);

  if (seat.role === 'hero') {
    setNote(l(appLanguage, '這是 Hero 座位。點空位可新增 AI，點已鎖定 AI 可移除。', '这是 Hero 座位。点空位可新增 AI，点已锁定 AI 可移除。', 'This is the Hero seat. Tap an empty seat to add AI, tap locked AI to remove.'));
    return;
  }

  if (seat.role === 'empty') {
    if (!hand.isOver) {
      setNote(l(appLanguage, '本手進行中，請先打完本手再新增 AI。', '本手进行中，请先打完本手再新增 AI。', 'Hand in progress. Finish this hand before adding AI.'));
      return;
    }
    setLeakGuess(null);
    void addAiToSeat(seat.id);
    return;
  }

  if (!wasSelected || !wasBattleSeat) {
    setBattleSeatId(seat.id);
    setNote(l(appLanguage, `已鎖定 ${seatName(seat, appLanguage)} 為本手對手。再次點同座位可移除。`, `已锁定 ${seatName(seat, appLanguage)} 为本手对手。再次点同座位可移除。`, `Locked ${seatName(seat, appLanguage)} as the current opponent. Tap again to remove.`));
    return;
  }

  if (!hand.isOver) {
    setNote(l(appLanguage, '本手進行中，請先打完本手再移除 AI。', '本手进行中，请先打完本手再移除 AI。', 'Hand in progress. Finish this hand before removing AI.'));
    return;
  }

  setLeakGuess(null);
  void removeAiFromSeat(seat.id);
}

function resetZoneTrainingState() {
  const fresh = createZoneTrainingState(zone, seats);
  setZoneTrainingById((prev) => ({
    ...prev,
    [zone.id]: fresh,
  }));
  setNote(l(appLanguage, `已重置 ${zoneName(zone, appLanguage)}：所有在座玩家回到 ${STARTING_BB}bb 起手。`, `已重置 ${zoneName(zone, appLanguage)}：所有在座玩家回到 ${STARTING_BB}bb 起手。`, `Reset ${zoneName(zone, appLanguage)}: all seated players are back to ${STARTING_BB}bb.`));
}

function applyCareerBankruptcyRescue(kind: 'subsidy' | 'loan') {
  const syncedZoneState = syncZoneTrainingState(zone, seats, zoneTrainingById[zone.id]);
  const today = localDateKey();
  if (kind === 'subsidy' && syncedZoneState.subsidyClaimDate === today) {
    setNote(l(appLanguage, '本區今日補助已領取，請改用教練貸款或切換練習模式。', '本区今日补助已领取，请改用教练贷款或切换练习模式。', 'Today subsidy already claimed in this zone. Use coach loan or switch to practice mode.'));
    return;
  }

  const rescueBb = kind === 'subsidy' ? SUBSIDY_BB : LOAN_BB;
  const rescueChips = bbToChips(rescueBb);
  const heroStack = syncedZoneState.bankroll[HERO_SEAT] ?? 0;
  const nextZoneState: ZoneTrainingState = {
    ...syncedZoneState,
    bankroll: {
      ...syncedZoneState.bankroll,
      [HERO_SEAT]: normalizeStackValue(heroStack + rescueChips),
    },
    aidUses: syncedZoneState.aidUses + 1,
    subsidyClaimDate: kind === 'subsidy' ? today : syncedZoneState.subsidyClaimDate,
    loanDebt: kind === 'loan' ? syncedZoneState.loanDebt + rescueChips : syncedZoneState.loanDebt,
  };

  setZoneTrainingById((prev) => ({
    ...prev,
    [zone.id]: nextZoneState,
  }));

  closeBankruptcyOverlay();
  startHand(battleSeatId ?? selectedSeatId, { zoneStateOverride: nextZoneState, modeOverride: 'career' });
}

function continueInPracticeMode() {
  setTrainingMode('practice');
  closeBankruptcyOverlay();
  startHand(battleSeatId ?? selectedSeatId, { modeOverride: 'practice' });
}


  return {
    addPendingReplacementPlayers,
    applyCareerBankruptcyRescue,
    applyTableEvent,
    buildHandOpeningEvents,
    buildTransitionEvents,
    continueInPracticeMode,
    enqueueTableEvents,
    enterTable,
    handleRaiseSliderGesture,
    handleRaiseSliderLayout,
    handleSeatTap,
    handleTableScreenLayout,
    resetZoneTrainingState,
    runNextEvent,
    skipPendingReplacementPlayers,
    stackText,
    startHand,
  };
}
