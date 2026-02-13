import { trainingZones } from '../data/zones';
import { HandState, HeroLeak, ProgressState } from '@poker-god/contracts';

export const initialProgress: ProgressState = {
  xp: 0,
  zoneIndex: 0,
  handsPlayed: 0,
  handsWon: 0,
  leaks: {
    overFold: 0,
    overCall: 0,
    overBluff: 0,
    missedValue: 0,
    passiveCheck: 0,
  },
};

export function applyDecisionResult(progress: ProgressState, decisionBest: boolean, leak: HeroLeak | null): ProgressState {
  const next: ProgressState = {
    ...progress,
    leaks: { ...progress.leaks },
  };

  next.xp += decisionBest ? 14 : 6;
  if (leak) {
    next.leaks[leak] += 1;
  }

  return withUnlockedZone(next);
}

export function applyHandResult(progress: ProgressState, hand: HandState): ProgressState {
  const next: ProgressState = {
    ...progress,
    leaks: { ...progress.leaks },
    handsPlayed: progress.handsPlayed + 1,
    handsWon: progress.handsWon + (hand.winner === 'hero' ? 1 : 0),
  };

  const accuracy = hand.decisionRecords.length
    ? hand.decisionRecords.filter((item) => item.isBest).length / hand.decisionRecords.length
    : 0;
  const baseXp = 25;
  const winBonus = hand.winner === 'hero' ? 16 : hand.winner === 'tie' ? 8 : 0;
  const qualityBonus = Math.round(accuracy * 18);

  next.xp += baseXp + winBonus + qualityBonus;

  return withUnlockedZone(next);
}

function withUnlockedZone(progress: ProgressState): ProgressState {
  let zoneIndex = progress.zoneIndex;
  for (let i = 0; i < trainingZones.length; i += 1) {
    if (progress.xp >= trainingZones[i].unlockXp) {
      zoneIndex = Math.max(zoneIndex, i);
    }
  }
  return {
    ...progress,
    zoneIndex,
  };
}

export function getTopLeak(progress: ProgressState): HeroLeak {
  const entries = Object.entries(progress.leaks) as Array<[HeroLeak, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export function winRate(progress: ProgressState): number {
  if (progress.handsPlayed === 0) {
    return 0;
  }
  return Math.round((progress.handsWon / progress.handsPlayed) * 100);
}
