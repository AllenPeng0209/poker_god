import { useCallback } from 'react';

import { trainingZones } from '../../../data/zones';
import { getHandRecordDetail } from '../../../storage/localDb';

import { HERO_SEAT, buildSeatVisualMap, l, restoreSeatsFromRecordedHand } from '../index';

export function useReplayFromReview(ctx: any) {
  const {
    activeProfile,
    appLanguage,
    buildHandOpeningEvents,
    closeTransientPanels,
    enqueueTableEvents,
    localDbReady,
    reviewSelectedDetail,
    setActionFeed,
    setAutoPlayEvents,
    setBattleSeatId,
    setButtonSeatId,
    setDisplayedBoardCount,
    setEventQueue,
    setHand,
    setLeakGuess,
    setLobbyZone,
    setNote,
    setPendingReplacementSeatIds,
    setPhase,
    setRaiseAmount,
    setReviewLoading,
    setReviewSelectedDetail,
    setReviewSelectedId,
    setRootTab,
    setSeatVisual,
    setSeats,
    setSelectedSeatId,
    setTableFeed,
    setZoneIndex,
    zoneIndex,
  } = ctx;

  const handleReplayFromReview = useCallback(
    async (recordId: number) => {
      if (!localDbReady || !activeProfile) {
        setRootTab('play');
        return;
      }

      setReviewLoading(true);
      try {
        const detail = reviewSelectedDetail?.id === recordId
          ? reviewSelectedDetail
          : await getHandRecordDetail(activeProfile.id, recordId);

        if (!detail) {
          setNote(l(appLanguage, '找不到這手牌的復盤資料。', '找不到这手牌的复盘资料。', 'Replay data for this hand was not found.'));
          return;
        }

        const targetZoneIdx = trainingZones.findIndex((zoneItem) => zoneItem.id === detail.zoneId);
        const nextZoneIdx = targetZoneIdx >= 0 ? targetZoneIdx : zoneIndex;
        const replaySeats = restoreSeatsFromRecordedHand(detail.hand, nextZoneIdx);
        const replayBattleSeatId = replaySeats.some((seat) => seat.id === detail.focusVillainId && seat.role === 'ai')
          ? detail.focusVillainId
          : (replaySeats.find((seat) => seat.role === 'ai')?.id ?? null);
        const replayButtonSeatId = replaySeats.find((seat) => seat.pos === detail.hand.buttonPosition && seat.role !== 'empty')?.id
          ?? HERO_SEAT;

        closeTransientPanels();
        setRootTab('play');
        setPhase('table');
        setZoneIndex(nextZoneIdx);
        setLobbyZone(nextZoneIdx);
        setReviewSelectedId(detail.id);
        setReviewSelectedDetail(detail);
        setSeats(replaySeats);
        setButtonSeatId(replayButtonSeatId);
        setSelectedSeatId(replayBattleSeatId ?? HERO_SEAT);
        setBattleSeatId(replayBattleSeatId);
        setPendingReplacementSeatIds([]);
        setLeakGuess(null);
        setDisplayedBoardCount(0);
        setTableFeed([]);
        setActionFeed([]);
        setSeatVisual(buildSeatVisualMap(replaySeats, appLanguage));
        setEventQueue([]);
        setAutoPlayEvents(true);
        setHand(detail.hand);
        setRaiseAmount(detail.hand.toCall + detail.hand.minRaise);
        enqueueTableEvents(buildHandOpeningEvents(replaySeats, detail.hand));
        setNote(
          l(
            appLanguage,
            `已載入復盤 #${detail.id}，正在按原始行動線回放。`,
            `已载入复盘 #${detail.id}，正在按原始行动线回放。`,
            `Loaded replay #${detail.id}. Replaying the original action line now.`,
          ),
        );
      } catch (err) {
        console.warn('Replay from review failed', err);
        setNote(l(appLanguage, '復盤回放失敗，請重試。', '复盘回放失败，请重试。', 'Replay failed. Please try again.'));
      } finally {
        setReviewLoading(false);
      }
    },
    [
      activeProfile,
      appLanguage,
      buildHandOpeningEvents,
      closeTransientPanels,
      enqueueTableEvents,
      localDbReady,
      reviewSelectedDetail,
      setActionFeed,
      setAutoPlayEvents,
      setBattleSeatId,
      setButtonSeatId,
      setDisplayedBoardCount,
      setEventQueue,
      setHand,
      setLeakGuess,
      setLobbyZone,
      setNote,
      setPendingReplacementSeatIds,
      setPhase,
      setRaiseAmount,
      setReviewLoading,
      setReviewSelectedDetail,
      setReviewSelectedId,
      setRootTab,
      setSeatVisual,
      setSeats,
      setSelectedSeatId,
      setTableFeed,
      setZoneIndex,
      zoneIndex,
    ],
  );

  return {
    handleReplayFromReview,
  };
}
