import { PositionContext, PositionTier, TablePosition } from '@poker-god/contracts';

const PREFLOP_ORDER: TablePosition[] = ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const POSTFLOP_ORDER: TablePosition[] = ['SB', 'BB', 'UTG', 'LJ', 'HJ', 'CO', 'BTN'];

const tierMap: Record<TablePosition, PositionTier> = {
  UTG: 'early',
  LJ: 'early',
  HJ: 'middle',
  CO: 'late',
  BTN: 'late',
  SB: 'blind',
  BB: 'blind',
};

const displayMap: Record<TablePosition, string> = {
  UTG: 'UTG(+1)',
  LJ: 'LJ(+2)',
  HJ: 'HJ(+3)',
  CO: 'CO(+4)',
  BTN: 'BTN(Dealer)',
  SB: 'SB',
  BB: 'BB',
};

function findOrderPath(order: TablePosition[], from: TablePosition, to: TablePosition): string {
  const fromIdx = order.indexOf(from);
  const toIdx = order.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) {
    return `${from} → ${to}`;
  }

  const route: TablePosition[] = [];
  let idx = fromIdx;
  while (idx !== toIdx) {
    route.push(order[idx]);
    idx = (idx + 1) % order.length;
  }
  route.push(order[toIdx]);
  return route.join(' → ');
}

export function positionLabel(position: TablePosition): string {
  return displayMap[position];
}

export function buildPositionContext(hero: TablePosition, villain: TablePosition): PositionContext {
  const heroPostflopIdx = POSTFLOP_ORDER.indexOf(hero);
  const villainPostflopIdx = POSTFLOP_ORDER.indexOf(villain);
  const heroInPositionPostflop = heroPostflopIdx > villainPostflopIdx;

  return {
    hero,
    villain,
    heroLabel: positionLabel(hero),
    villainLabel: positionLabel(villain),
    heroTier: tierMap[hero],
    villainTier: tierMap[villain],
    heroInPositionPostflop,
    preflopOrderHint: findOrderPath(PREFLOP_ORDER, villain, hero),
    situationLabel: `${positionLabel(hero)} vs ${positionLabel(villain)}`,
  };
}
