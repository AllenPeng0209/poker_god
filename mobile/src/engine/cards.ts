import { Card, Rank, Street, Suit } from '../types/poker';

const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const suits: Suit[] = ['s', 'h', 'd', 'c'];

const rankValueMap: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createShuffledDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of ranks) {
    for (const suit of suits) {
      deck.push({ rank, suit, code: `${rank}${suit}` });
    }
  }

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = deck[i];
    deck[i] = deck[j];
    deck[j] = temp;
  }

  return deck;
}

export function drawCards(deck: Card[], count: number): Card[] {
  return deck.splice(0, count);
}

export function rankValue(rank: Rank): number {
  return rankValueMap[rank];
}

function buildRankCounts(cards: Card[]): Map<number, number> {
  const map = new Map<number, number>();
  cards.forEach((card) => {
    const value = rankValue(card.rank);
    map.set(value, (map.get(value) ?? 0) + 1);
  });
  return map;
}

function buildSuitCounts(cards: Card[]): Map<Suit, number> {
  const map = new Map<Suit, number>();
  cards.forEach((card) => {
    map.set(card.suit, (map.get(card.suit) ?? 0) + 1);
  });
  return map;
}

function straightScore(cards: Card[]): number {
  const unique = Array.from(new Set(cards.map((c) => rankValue(c.rank)))).sort((a, b) => a - b);
  if (unique.includes(14)) {
    unique.unshift(1);
  }

  let run = 1;
  let bestRun = 1;
  for (let i = 1; i < unique.length; i += 1) {
    if (unique[i] === unique[i - 1] + 1) {
      run += 1;
      bestRun = Math.max(bestRun, run);
    } else {
      run = 1;
    }
  }

  if (bestRun >= 5) {
    return 22;
  }
  if (bestRun === 4) {
    return 9;
  }
  if (bestRun === 3) {
    return 4;
  }
  return 0;
}

export function evaluateHandStrength(hole: Card[], board: Card[]): number {
  const cards = [...hole, ...board];
  const rankCounts = buildRankCounts(cards);
  const suitCounts = buildSuitCounts(cards);

  const frequencies = Array.from(rankCounts.values()).sort((a, b) => b - a);
  const holeValues = hole.map((card) => rankValue(card.rank)).sort((a, b) => b - a);
  const avgHole = (holeValues[0] + holeValues[1]) / 2;

  let score = 15 + avgHole * 2.2;

  if (holeValues[0] === holeValues[1]) {
    score += 18 + holeValues[0] * 0.8;
  } else if (hole[0].suit === hole[1].suit) {
    score += 4;
  }

  if (frequencies[0] === 4) {
    score += 45;
  } else if (frequencies[0] === 3 && frequencies[1] >= 2) {
    score += 35;
  } else if (frequencies[0] === 3) {
    score += 24;
  } else if (frequencies[0] === 2 && frequencies[1] === 2) {
    score += 18;
  } else if (frequencies[0] === 2) {
    score += 11;
  }

  const highestSuitCount = Math.max(...Array.from(suitCounts.values()), 0);
  if (highestSuitCount >= 5) {
    score += 30;
  } else if (highestSuitCount === 4) {
    score += 9;
  }

  score += straightScore(cards);

  if (board.length >= 3) {
    const topBoard = board.map((card) => rankValue(card.rank)).sort((a, b) => b - a)[0] ?? 0;
    if (holeValues[0] > topBoard) {
      score += 4;
    }
  }

  return clamp(Math.round(score), 5, 99);
}

export type ShowdownCategory =
  | 'high_card'
  | 'one_pair'
  | 'two_pair'
  | 'three_kind'
  | 'straight'
  | 'flush'
  | 'full_house'
  | 'four_kind'
  | 'straight_flush';

export interface ShowdownHandResult {
  category: ShowdownCategory;
  categoryLabel: string;
  cards: Card[];
  cardsText: string;
  scoreVector: number[];
}

type FiveCardEval = {
  category: ShowdownCategory;
  categoryRank: number;
  tiebreakers: number[];
  cards: Card[];
};

const showdownCategoryLabelMap: Record<ShowdownCategory, string> = {
  high_card: '高牌',
  one_pair: '一對',
  two_pair: '兩對',
  three_kind: '三條',
  straight: '順子',
  flush: '同花',
  full_house: '葫蘆',
  four_kind: '四條',
  straight_flush: '同花順',
};

function compareRankVectors(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const delta = (a[i] ?? 0) - (b[i] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

function straightHighValue(valuesDesc: number[]): number {
  const uniqueDesc = Array.from(new Set(valuesDesc)).sort((a, b) => b - a);
  if (uniqueDesc.length !== 5) {
    return 0;
  }
  const regular = uniqueDesc[0] - uniqueDesc[4] === 4;
  if (regular) {
    return uniqueDesc[0];
  }
  const wheel = uniqueDesc[0] === 14 && uniqueDesc[1] === 5 && uniqueDesc[2] === 4 && uniqueDesc[3] === 3 && uniqueDesc[4] === 2;
  if (wheel) {
    return 5;
  }
  return 0;
}

function evaluateFiveCardHand(cards: Card[]): FiveCardEval {
  const valuesDesc = cards.map((card) => rankValue(card.rank)).sort((a, b) => b - a);
  const counts = buildRankCounts(cards);
  const groups = Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  const isFlush = cards.every((card) => card.suit === cards[0].suit);
  const straightHigh = straightHighValue(valuesDesc);
  const isStraight = straightHigh > 0;

  if (isFlush && isStraight) {
    return {
      category: 'straight_flush',
      categoryRank: 8,
      tiebreakers: [straightHigh],
      cards,
    };
  }

  if (groups[0]?.count === 4) {
    const kicker = groups[1]?.value ?? 0;
    return {
      category: 'four_kind',
      categoryRank: 7,
      tiebreakers: [groups[0].value, kicker],
      cards,
    };
  }

  if (groups[0]?.count === 3 && groups[1]?.count === 2) {
    return {
      category: 'full_house',
      categoryRank: 6,
      tiebreakers: [groups[0].value, groups[1].value],
      cards,
    };
  }

  if (isFlush) {
    return {
      category: 'flush',
      categoryRank: 5,
      tiebreakers: valuesDesc,
      cards,
    };
  }

  if (isStraight) {
    return {
      category: 'straight',
      categoryRank: 4,
      tiebreakers: [straightHigh],
      cards,
    };
  }

  if (groups[0]?.count === 3) {
    const kickers = groups.slice(1).map((item) => item.value).sort((a, b) => b - a);
    return {
      category: 'three_kind',
      categoryRank: 3,
      tiebreakers: [groups[0].value, ...kickers],
      cards,
    };
  }

  if (groups[0]?.count === 2 && groups[1]?.count === 2) {
    const highPair = Math.max(groups[0].value, groups[1].value);
    const lowPair = Math.min(groups[0].value, groups[1].value);
    const kicker = groups.find((item) => item.count === 1)?.value ?? 0;
    return {
      category: 'two_pair',
      categoryRank: 2,
      tiebreakers: [highPair, lowPair, kicker],
      cards,
    };
  }

  if (groups[0]?.count === 2) {
    const kickers = groups.slice(1).map((item) => item.value).sort((a, b) => b - a);
    return {
      category: 'one_pair',
      categoryRank: 1,
      tiebreakers: [groups[0].value, ...kickers],
      cards,
    };
  }

  return {
    category: 'high_card',
    categoryRank: 0,
    tiebreakers: valuesDesc,
    cards,
  };
}

function compareFiveCardEval(a: FiveCardEval, b: FiveCardEval): number {
  if (a.categoryRank !== b.categoryRank) {
    return a.categoryRank - b.categoryRank;
  }
  return compareRankVectors(a.tiebreakers, b.tiebreakers);
}

function sortShowdownCards(cards: Card[], category: ShowdownCategory, tiebreakers: number[]): Card[] {
  const values = cards.map((card) => rankValue(card.rank));
  if ((category === 'straight' || category === 'straight_flush') && tiebreakers[0] === 5 && values.includes(14)) {
    return [...cards].sort((a, b) => {
      const av = rankValue(a.rank) === 14 ? 1 : rankValue(a.rank);
      const bv = rankValue(b.rank) === 14 ? 1 : rankValue(b.rank);
      return bv - av;
    });
  }

  const counts = buildRankCounts(cards);
  return [...cards].sort((a, b) => {
    const av = rankValue(a.rank);
    const bv = rankValue(b.rank);
    const ac = counts.get(av) ?? 0;
    const bc = counts.get(bv) ?? 0;
    if (ac !== bc) {
      return bc - ac;
    }
    if (av !== bv) {
      return bv - av;
    }
    return b.suit.localeCompare(a.suit);
  });
}

function fiveCardCombos(cards: Card[]): Card[][] {
  const result: Card[][] = [];
  if (cards.length < 5) {
    return result;
  }

  for (let a = 0; a < cards.length - 4; a += 1) {
    for (let b = a + 1; b < cards.length - 3; b += 1) {
      for (let c = b + 1; c < cards.length - 2; c += 1) {
        for (let d = c + 1; d < cards.length - 1; d += 1) {
          for (let e = d + 1; e < cards.length; e += 1) {
            result.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
          }
        }
      }
    }
  }
  return result;
}

export function evaluateBestShowdownHand(hole: Card[], board: Card[]): ShowdownHandResult {
  const pool = [...hole, ...board];
  const combos = fiveCardCombos(pool);
  if (combos.length === 0) {
    return {
      category: 'high_card',
      categoryLabel: showdownCategoryLabelMap.high_card,
      cards: [],
      cardsText: '',
      scoreVector: [0, 0, 0, 0, 0, 0],
    };
  }

  let best = evaluateFiveCardHand(combos[0]);
  for (let i = 1; i < combos.length; i += 1) {
    const candidate = evaluateFiveCardHand(combos[i]);
    if (compareFiveCardEval(candidate, best) > 0) {
      best = candidate;
    }
  }

  const orderedCards = sortShowdownCards(best.cards, best.category, best.tiebreakers);
  return {
    category: best.category,
    categoryLabel: showdownCategoryLabelMap[best.category],
    cards: orderedCards,
    cardsText: orderedCards.map((card) => cardToDisplay(card)).join(' '),
    scoreVector: [best.categoryRank, ...best.tiebreakers],
  };
}

export function compareShowdownHands(a: ShowdownHandResult, b: ShowdownHandResult): number {
  return compareRankVectors(a.scoreVector, b.scoreVector);
}

export function boardCountForStreet(street: Street): number {
  switch (street) {
    case 'preflop':
      return 0;
    case 'flop':
      return 3;
    case 'turn':
      return 4;
    case 'river':
    case 'showdown':
      return 5;
    default:
      return 0;
  }
}

export function nextStreet(street: Street): Street {
  switch (street) {
    case 'preflop':
      return 'flop';
    case 'flop':
      return 'turn';
    case 'turn':
      return 'river';
    case 'river':
      return 'showdown';
    case 'showdown':
    default:
      return 'showdown';
  }
}

export function cardToDisplay(card: Card): string {
  const suitMap: Record<Suit, string> = {
    s: '♠',
    h: '♥',
    d: '♦',
    c: '♣',
  };
  return `${card.rank}${suitMap[card.suit]}`;
}
