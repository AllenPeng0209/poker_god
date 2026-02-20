import { useCallback } from 'react';

import { getHandRecordDetail, listHandRecordSummaries } from '../../../storage/localDb';

export function useReviewRecords(ctx: any) {
  const {
    activeProfile,
    localDbReady,
    reviewSelectedId,
    setReviewLoading,
    setReviewRecords,
    setReviewSelectedDetail,
    setReviewSelectedId,
  } = ctx;

  const loadReviewRecords = useCallback(
    async (preferredRecordId?: number | null) => {
      if (!localDbReady || !activeProfile) {
        setReviewRecords([]);
        setReviewSelectedId(null);
        setReviewSelectedDetail(null);
        return;
      }
      setReviewLoading(true);
      try {
        const rows = await listHandRecordSummaries(activeProfile.id, 80, 0);
        setReviewRecords(rows);
        const target = preferredRecordId ?? reviewSelectedId;
        const hasTarget = target !== null && rows.some((row) => row.id === target);
        const nextId = hasTarget ? target : (rows[0]?.id ?? null);
        setReviewSelectedId(nextId);
        if (nextId === null) {
          setReviewSelectedDetail(null);
        } else {
          const detail = await getHandRecordDetail(activeProfile.id, nextId);
          setReviewSelectedDetail(detail);
        }
      } catch (err) {
        console.warn('Load review records failed', err);
      } finally {
        setReviewLoading(false);
      }
    },
    [
      activeProfile,
      localDbReady,
      reviewSelectedId,
      setReviewLoading,
      setReviewRecords,
      setReviewSelectedDetail,
      setReviewSelectedId,
    ],
  );

  const handleReviewSelect = useCallback(
    async (recordId: number) => {
      setReviewSelectedId(recordId);
      if (!localDbReady || !activeProfile) {
        setReviewSelectedDetail(null);
        return;
      }
      setReviewLoading(true);
      try {
        const detail = await getHandRecordDetail(activeProfile.id, recordId);
        setReviewSelectedDetail(detail);
      } catch (err) {
        console.warn('Load review detail failed', err);
      } finally {
        setReviewLoading(false);
      }
    },
    [activeProfile, localDbReady, setReviewLoading, setReviewSelectedDetail, setReviewSelectedId],
  );

  return {
    loadReviewRecords,
    handleReviewSelect,
  };
}
