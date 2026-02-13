import { ActionLog, HandState, Street } from '@poker-god/contracts';

export interface RatioStat {
  hits: number;
  opportunities: number;
}

export interface HeroStatsSnapshot {
  hands: number;
  vpip: RatioStat;
  pfr: RatioStat;
  threeBetPreflop: RatioStat;
  foldToThreeBet: RatioStat;
  flopCBet: RatioStat;
  foldVsFlopCBet: RatioStat;
  postflopReraise: RatioStat;
}

const POSTFLOP_STREETS: Array<Extract<Street, 'flop' | 'turn' | 'river'>> = ['flop', 'turn', 'river'];

function emptyRatioStat(): RatioStat {
  return { hits: 0, opportunities: 0 };
}

function isVoluntaryPreflopRaise(log: ActionLog): boolean {
  return log.street === 'preflop' && !log.forcedBlind && log.action === 'raise' && log.amount > 0;
}

function isVoluntaryPreflopVpip(log: ActionLog): boolean {
  return log.street === 'preflop' && !log.forcedBlind && log.amount > 0 && (log.action === 'call' || log.action === 'raise');
}

function cloneStat(stat: RatioStat): RatioStat {
  return { hits: stat.hits, opportunities: stat.opportunities };
}

function cloneSnapshot(snapshot: HeroStatsSnapshot): HeroStatsSnapshot {
  return {
    hands: snapshot.hands,
    vpip: cloneStat(snapshot.vpip),
    pfr: cloneStat(snapshot.pfr),
    threeBetPreflop: cloneStat(snapshot.threeBetPreflop),
    foldToThreeBet: cloneStat(snapshot.foldToThreeBet),
    flopCBet: cloneStat(snapshot.flopCBet),
    foldVsFlopCBet: cloneStat(snapshot.foldVsFlopCBet),
    postflopReraise: cloneStat(snapshot.postflopReraise),
  };
}

function playerLogsForStreet(logs: ActionLog[], street: Street): ActionLog[] {
  return logs.filter((log) => log.street === street && !!log.actorId);
}

function increment(stat: RatioStat, hit: boolean, opportunities: number = 1): void {
  stat.opportunities += opportunities;
  if (hit) {
    stat.hits += 1;
  }
}

export function createEmptyHeroStats(): HeroStatsSnapshot {
  return {
    hands: 0,
    vpip: emptyRatioStat(),
    pfr: emptyRatioStat(),
    threeBetPreflop: emptyRatioStat(),
    foldToThreeBet: emptyRatioStat(),
    flopCBet: emptyRatioStat(),
    foldVsFlopCBet: emptyRatioStat(),
    postflopReraise: emptyRatioStat(),
  };
}

export function statRatePercent(stat: RatioStat): number {
  if (stat.opportunities <= 0) {
    return 0;
  }
  return Number(((stat.hits / stat.opportunities) * 100).toFixed(1));
}

export function accumulateHeroStats(current: HeroStatsSnapshot, hand: HandState): HeroStatsSnapshot {
  const heroId = hand.heroPlayerId;
  const next = cloneSnapshot(current);
  next.hands += 1;

  const preflopLogs = playerLogsForStreet(hand.history, 'preflop');
  const heroPreflopLogs = preflopLogs.filter((log) => log.actorId === heroId && !log.forcedBlind);

  increment(next.vpip, heroPreflopLogs.some((log) => isVoluntaryPreflopVpip(log)));
  increment(next.pfr, heroPreflopLogs.some((log) => isVoluntaryPreflopRaise(log)));

  const firstOpponentRaiseIdx = preflopLogs.findIndex((log) => log.actorId !== heroId && isVoluntaryPreflopRaise(log));
  if (firstOpponentRaiseIdx >= 0) {
    const heroResponseToOpen = preflopLogs.find((log, idx) => idx > firstOpponentRaiseIdx && log.actorId === heroId && !log.forcedBlind);
    if (heroResponseToOpen) {
      increment(next.threeBetPreflop, heroResponseToOpen.action === 'raise' && heroResponseToOpen.amount > 0);
    }
  }

  const heroRaiseIdx = preflopLogs.findIndex((log) => log.actorId === heroId && isVoluntaryPreflopRaise(log));
  if (heroRaiseIdx >= 0) {
    const opponentReraiseIdx = preflopLogs.findIndex((log, idx) => idx > heroRaiseIdx && log.actorId !== heroId && isVoluntaryPreflopRaise(log));
    if (opponentReraiseIdx >= 0) {
      const heroResponseToReraise = preflopLogs.find((log, idx) => idx > opponentReraiseIdx && log.actorId === heroId && !log.forcedBlind);
      if (heroResponseToReraise) {
        increment(next.foldToThreeBet, heroResponseToReraise.action === 'fold');
      }
    }
  }

  const preflopAggressorId = [...preflopLogs].reverse().find((log) => isVoluntaryPreflopRaise(log))?.actorId;
  const flopLogs = playerLogsForStreet(hand.history, 'flop');

  if (preflopAggressorId === heroId) {
    const heroFlopAction = flopLogs.find((log) => log.actorId === heroId);
    if (heroFlopAction) {
      increment(next.flopCBet, heroFlopAction.action === 'raise' && heroFlopAction.amount > 0);
    }
  } else if (preflopAggressorId) {
    const firstFlopCbetIdx = flopLogs.findIndex(
      (log) => log.actorId === preflopAggressorId && log.action === 'raise' && log.amount > 0,
    );
    if (firstFlopCbetIdx >= 0) {
      const heroFlopResponse = flopLogs.find((log, idx) => idx > firstFlopCbetIdx && log.actorId === heroId);
      if (heroFlopResponse) {
        increment(next.foldVsFlopCBet, heroFlopResponse.action === 'fold');
      }
    }
  }

  POSTFLOP_STREETS.forEach((street) => {
    const streetLogs = playerLogsForStreet(hand.history, street);
    let opponentHasRaised = false;

    for (let i = 0; i < streetLogs.length; i += 1) {
      const log = streetLogs[i];
      if (log.actorId !== heroId && log.action === 'raise' && log.amount > 0) {
        opponentHasRaised = true;
        continue;
      }
      if (log.actorId === heroId && opponentHasRaised) {
        increment(next.postflopReraise, log.action === 'raise' && log.amount > 0);
        break;
      }
    }
  });

  return next;
}
