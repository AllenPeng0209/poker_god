// @ts-nocheck
import React from 'react';

import { applyHeroAction } from '../../../engine/game';
import { accumulateHeroStats } from '../../../engine/heroStats';
import { applyDecisionResult, applyHandResult } from '../../../engine/progression';
import { saveCompletedHandRecord } from '../../../storage/localDb';
import type { LocalProfile } from '../../../storage/localDb';
import type { ActionType, ProgressState } from '../../../types/poker';

import * as Play from '../index';

type AppLanguage = Play.AppLanguage;
type Phase = Play.Phase;
type Seat = Play.Seat;
type SeatVisual = Play.SeatVisual;
type TableEvent = Play.TableEvent;
type TrainingMode = Play.TrainingMode;
type ZoneTrainingState = Play.ZoneTrainingState;

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

const {
  BIG_BLIND_SIZE,
  HERO_SEAT,
  LOAN_REPAY_RATE,
  STARTING_STACK,
  addXp,
  applyXpMultiplier,
  applyZoneMissionUpdates,
  chipsToBb,
  extractBankrollFromHand,
  l,
  mission,
  missionTitle,
  oppLeakKeys,
  oppLeakLabel,
  resolveXpMultiplier,
  rt,
  syncZoneTrainingState,
  t,
  unlockedZoneByXp,
  zoneMissionsCompleted,
  zoneName,
} = Play;

export type UsePlayDecisionActionsParams = {
  activeProfile: LocalProfile | null;
  activeXpFactor: number;
  appLanguage: AppLanguage;
  battleSeatId: string | null;
  hasPendingEvent: boolean;
  hand: Play.HandState;
  heroAllIn: boolean;
  leakGuess: Play.OppLeakGuess | null;
  localDbReady: boolean;
  phase: Phase;
  politeMode: boolean;
  progress: ProgressState;
  raiseAmount: number;
  seats: Seat[];
  selectedSeat: Seat;
  selectedSeatId: string;
  trainingMode: TrainingMode;
  zone: { id: string };
  zoneIndex: number;
  zoneTrainingById: Record<string, ZoneTrainingState>;
  applyTableEvent: (event: TableEvent) => void;
  buildTransitionEvents: (prevHand: Play.HandState, nextHand: Play.HandState) => TableEvent[];
  enqueueTableEvents: (events: TableEvent[]) => void;
  setBattleSeatId: SetState<string | null>;
  setHand: SetState<Play.HandState>;
  setHandRecordCount: SetState<number>;
  setNote: SetState<string>;
  setPendingReplacementSeatIds: SetState<string[]>;
  setProgress: SetState<ProgressState>;
  setSeatVisual: SetState<Record<string, SeatVisual>>;
  setSeats: SetState<Seat[]>;
  setSelectedSeatId: SetState<string>;
  setZoneTrainingById: SetState<Record<string, ZoneTrainingState>>;
};

export function usePlayDecisionActions(params: UsePlayDecisionActionsParams) {
  const {
    activeProfile,
    activeXpFactor,
    appLanguage,
    battleSeatId,
    hasPendingEvent,
    hand,
    heroAllIn,
    leakGuess,
    localDbReady,
    phase,
    politeMode,
    progress,
    raiseAmount,
    seats,
    selectedSeat,
    selectedSeatId,
    trainingMode,
    zone,
    zoneIndex,
    zoneTrainingById,
    applyTableEvent,
    buildTransitionEvents,
    enqueueTableEvents,
    setBattleSeatId,
    setHand,
    setHandRecordCount,
    setNote,
    setPendingReplacementSeatIds,
    setProgress,
    setSeatVisual,
    setSeats,
    setSelectedSeatId,
    setZoneTrainingById,
  } = params;

function doAction(action: ActionType) {
  if (!seats.find((s) => s.id === battleSeatId && s.role === 'ai')) {
    setNote(l(appLanguage, '先指定一位 AI 當本手對手', '先指定一位 AI 当本手对手', 'Select an AI as the current opponent first.'));
    return;
  }
  if (heroAllIn) {
    setNote(l(appLanguage, '你已全下，牌局會自動推演到攤牌。', '你已全下，牌局会自动推演到摊牌。', 'You are all-in. The hand will auto-run to showdown.'));
    return;
  }
  if (hand.actingPlayerId && hand.actingPlayerId !== HERO_SEAT) {
    const actor = hand.players.find((p) => p.id === hand.actingPlayerId);
    setNote(l(appLanguage, `目前行動權在 ${actor?.name ?? '其他玩家'}，等系統播放到你。`, `当前行动权在 ${actor?.name ?? '其他玩家'}，等系统播放到你。`, `Action is on ${actor?.name ?? 'another player'}. Wait for your turn.`));
    return;
  }
  if (hasPendingEvent) {
    setNote(l(appLanguage, '桌上動作仍在播放中，等到你時再決策。', '桌上动作仍在播放中，等到你时再决策。', 'Table actions are still replaying. Decide when it is your turn.'));
    return;
  }
  if (hand.isOver) {
    setNote(l(appLanguage, '本手已結束，請開下一手', '本手已结束，请开下一手', 'This hand is over. Start the next hand.'));
    return;
  }
  const prevHand = hand;
  const res = applyHeroAction(hand, { action, raiseAmount }, politeMode);
  let missionRewardXp = 0;
  let missionCompleteText = '';
  let missionUnlockText = '';
  let seatUpdateText = '';
  let modeUpdateText = '';
  let missionUnlockTargetIdx: number | null = null;
  let recordedZoneState = syncZoneTrainingState(zone, seats, zoneTrainingById[zone.id]);
  const xpMultiplier = resolveXpMultiplier(trainingMode, recordedZoneState);
  if (res.hand.isOver) {
    const heroWon = res.hand.winner === 'hero';
    const heroTied = res.hand.winner === 'tie';
    let seatsAfterHand = seats;
    let nextZoneStateBase: ZoneTrainingState;

    if (trainingMode === 'career') {
      const handStartHeroStack = recordedZoneState.bankroll[HERO_SEAT] ?? 0;
      const bankrollAfter = extractBankrollFromHand(res.hand, seats, recordedZoneState.bankroll);
      let loanDebtAfter = recordedZoneState.loanDebt;
      if (loanDebtAfter > 0) {
        const heroAfter = bankrollAfter[HERO_SEAT] ?? 0;
        const handProfit = Math.max(0, heroAfter - handStartHeroStack);
        const repay = Math.min(loanDebtAfter, Math.floor(handProfit * LOAN_REPAY_RATE));
        if (repay > 0) {
          bankrollAfter[HERO_SEAT] = Math.max(0, heroAfter - repay);
          loanDebtAfter -= repay;
          seatUpdateText += l(appLanguage, `｜自動還款 ${chipsToBb(repay, Math.max(1, res.hand.bigBlind || BIG_BLIND_SIZE))}bb`, `｜自动还款 ${chipsToBb(repay, Math.max(1, res.hand.bigBlind || BIG_BLIND_SIZE))}bb`, ` | Auto repayment ${chipsToBb(repay, Math.max(1, res.hand.bigBlind || BIG_BLIND_SIZE))}bb`);
          if (loanDebtAfter <= 0) {
            seatUpdateText += l(appLanguage, '（已清償）', '（已清偿）', ' (paid off)');
          }
        }
      }

      const bustedAiSeats = seats.filter(
        (seat): seat is Seat & { role: 'ai' } => seat.role === 'ai' && (bankrollAfter[seat.id] ?? STARTING_STACK) <= 0,
      );
      if (bustedAiSeats.length > 0) {
        const bustedIds = new Set(bustedAiSeats.map((seat) => seat.id));
        seatsAfterHand = seats.map((seat) => (
          bustedIds.has(seat.id)
            ? { ...seat, role: 'empty' as const, ai: undefined }
            : seat
        ));
        setSeats(seatsAfterHand);
        setSeatVisual((prev) => {
          const next = { ...prev };
          bustedAiSeats.forEach((seat) => {
            next[seat.id] = {
              cardsDealt: 0,
              inHand: false,
              folded: true,
              lastAction: l(appLanguage, '點擊新增', '点击新增', 'Tap to add'),
            };
          });
          return next;
        });
        const nextAi = seatsAfterHand.find((seat) => seat.role === 'ai');
        if (bustedIds.has(selectedSeatId)) {
          setSelectedSeatId(nextAi?.id ?? HERO_SEAT);
        }
        if (battleSeatId && bustedIds.has(battleSeatId)) {
          setBattleSeatId(nextAi?.id ?? null);
        }
        setPendingReplacementSeatIds((prev) => Array.from(new Set([...prev, ...bustedAiSeats.map((seat) => seat.id)])));
        seatUpdateText += l(appLanguage, `｜${bustedAiSeats.map((seat) => seat.pos).join('、')} 籌碼歸零已離桌，請選擇是否補位。`, `｜${bustedAiSeats.map((seat) => seat.pos).join('、')} 筹码归零已离桌，请选择是否补位。`, ` | ${bustedAiSeats.map((seat) => seat.pos).join(', ')} busted and left. Choose whether to refill seats.`);
      }

      const missionResolution = applyZoneMissionUpdates(recordedZoneState, res.hand, bankrollAfter);
      missionRewardXp = missionResolution.rewardXp;
      if (missionResolution.completedMissionTitles.length > 0) {
        missionCompleteText = l(
          appLanguage,
          `｜任務完成：${missionResolution.completedMissionTitles.map((title) => missionTitle(title, appLanguage)).join('、')}（+${missionRewardXp} XP）`,
          `｜任务完成：${missionResolution.completedMissionTitles.map((title) => missionTitle(title, appLanguage)).join('、')}（+${missionRewardXp} XP）`,
          ` | Mission complete: ${missionResolution.completedMissionTitles.map((title) => missionTitle(title, appLanguage)).join(', ')} (+${missionRewardXp} XP)`,
        );
      }
      nextZoneStateBase = {
        ...missionResolution.nextState,
        loanDebt: loanDebtAfter,
        heroStats: accumulateHeroStats(missionResolution.nextState.heroStats, res.hand),
        handsPlayed: missionResolution.nextState.handsPlayed + 1,
        handsWon: missionResolution.nextState.handsWon + (heroWon ? 1 : 0),
        handsTied: missionResolution.nextState.handsTied + (heroTied ? 1 : 0),
      };
    } else {
      modeUpdateText = l(appLanguage, '｜練習模式：不消耗資金、不推進任務。', '｜练习模式：不消耗资金、不推进任务。', ' | Practice mode: no bankroll cost and no mission progress.');
      nextZoneStateBase = {
        ...recordedZoneState,
        heroStats: accumulateHeroStats(recordedZoneState.heroStats, res.hand),
        handsPlayed: recordedZoneState.handsPlayed + 1,
        handsWon: recordedZoneState.handsWon + (heroWon ? 1 : 0),
        handsTied: recordedZoneState.handsTied + (heroTied ? 1 : 0),
      };
    }

    const nextZoneState = syncZoneTrainingState(zone, seatsAfterHand, nextZoneStateBase);
    if (trainingMode === 'career') {
      const zoneCompletedBefore = zoneMissionsCompleted(recordedZoneState);
      const zoneCompletedAfter = zoneMissionsCompleted(nextZoneState);
      if (zoneCompletedAfter && !zoneCompletedBefore && zoneIndex < trainingZones.length - 1) {
        missionUnlockTargetIdx = zoneIndex + 1;
        const unlockedZoneDef = trainingZones[missionUnlockTargetIdx];
        missionUnlockText = l(
          appLanguage,
          `｜區域通關：${zoneName(unlockedZoneDef, appLanguage)} 已解鎖`,
          `｜区域通关：${zoneName(unlockedZoneDef, appLanguage)} 已解锁`,
          ` | Zone clear: ${zoneName(unlockedZoneDef, appLanguage)} unlocked`,
        );
      }
    }
    setZoneTrainingById((prev) => ({
      ...prev,
      [zone.id]: nextZoneState,
    }));
    recordedZoneState = nextZoneState;
  }
  setHand(res.hand);
  const transitionEvents = buildTransitionEvents(prevHand, res.hand);
  if (transitionEvents.length > 0) {
    const [first, ...rest] = transitionEvents;
    applyTableEvent(first);
    enqueueTableEvents(rest);
  }
  const xpModeText = xpMultiplier < 0.999
    ? l(appLanguage, `｜XP 係數 ${Math.round(xpMultiplier * 100)}%`, `｜XP 系数 ${Math.round(xpMultiplier * 100)}%`, ` | XP factor ${Math.round(xpMultiplier * 100)}%`)
    : '';
  const localizedBestSummary = rt(res.analysis.best.summary, appLanguage, 'Review the recommended action from the model output.');
  setNote(
    `${res.decisionBest
      ? l(appLanguage, `正確：${localizedBestSummary}`, `正确：${localizedBestSummary}`, `Correct: ${localizedBestSummary}`)
      : l(appLanguage, `可優化：${localizedBestSummary}`, `可优化：${localizedBestSummary}`, `Can improve: ${localizedBestSummary}`)}${missionCompleteText}${missionUnlockText}${seatUpdateText}${modeUpdateText}${xpModeText}`,
  );
  let nextProgress = applyDecisionResult(progress, res.decisionBest, res.leakTag);
  if (res.hand.isOver) nextProgress = applyHandResult(nextProgress, res.hand);
  if (missionRewardXp > 0) nextProgress = addXp(nextProgress, missionRewardXp);
  nextProgress = applyXpMultiplier(progress, nextProgress, xpMultiplier);
  if (missionUnlockTargetIdx !== null && missionUnlockTargetIdx > nextProgress.zoneIndex) {
    nextProgress = { ...nextProgress, zoneIndex: missionUnlockTargetIdx };
  }
  nextProgress = {
    ...nextProgress,
    zoneIndex: Math.max(nextProgress.zoneIndex, progress.zoneIndex, unlockedZoneByXp(nextProgress.xp)),
  };
  setProgress(nextProgress);

  if (res.hand.isOver && localDbReady && activeProfile) {
    void saveCompletedHandRecord({
      profileId: activeProfile.id,
      zoneId: zone.id,
      phase,
      hand: res.hand,
      bankrollSnapshot: recordedZoneState.bankroll,
      heroStatsSnapshot: recordedZoneState.heroStats,
      progressSnapshot: nextProgress,
    })
      .then(() => {
        setHandRecordCount((count) => count + 1);
      })
      .catch((err) => {
        console.warn('Save hand record failed', err);
      });
  }
}

function verifyLeak() {
  if (selectedSeat.role !== 'ai' || !selectedSeat.ai) {
    setNote(l(appLanguage, '先選 AI 座位', '先选 AI 座位', 'Select an AI seat first.'));
    return;
  }
  if (!leakGuess) {
    setNote(l(appLanguage, '先選你判斷的漏洞', '先选你判断的漏洞', 'Choose your leak guess first.'));
    return;
  }
  const ok = selectedSeat.ai.leakProfile[leakGuess];
  const firstActual = oppLeakKeys.find((k) => selectedSeat.ai?.leakProfile[k]);
  const xpGain = Math.max(1, Math.round((ok ? 24 : 6) * activeXpFactor));
  if (ok) {
    setProgress((p) => addXp(p, xpGain));
    setNote(l(appLanguage, `判斷正確：${oppLeakLabel(leakGuess, appLanguage)}（+${xpGain} XP）`, `判断正确：${oppLeakLabel(leakGuess, appLanguage)}（+${xpGain} XP）`, `Correct: ${oppLeakLabel(leakGuess, appLanguage)} (+${xpGain} XP)`));
  } else {
    setProgress((p) => addXp(p, xpGain));
    setNote(l(appLanguage, `這次不準。提示：${firstActual ? oppLeakLabel(firstActual, appLanguage) : t(appLanguage, 'opponent_few_leaks')}（+${xpGain} XP）`, `这次不准。提示：${firstActual ? oppLeakLabel(firstActual, appLanguage) : t(appLanguage, 'opponent_few_leaks')}（+${xpGain} XP）`, `Not this time. Hint: ${firstActual ? oppLeakLabel(firstActual, appLanguage) : t(appLanguage, 'opponent_few_leaks')} (+${xpGain} XP)`));
  }
}

  return {
    doAction,
    verifyLeak,
  };
}
