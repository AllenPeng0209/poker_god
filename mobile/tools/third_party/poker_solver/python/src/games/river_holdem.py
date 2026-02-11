from __future__ import annotations

from dataclasses import dataclass
from itertools import combinations
from typing import Dict, Iterable, List, Sequence, Tuple

RANKS = "23456789TJQKA"
SUITS = "cdhs"


def card_id(card: str) -> int:
    rank = RANKS.index(card[0])
    suit = SUITS.index(card[1])
    return suit * 13 + rank


def card_str(card: int) -> str:
    rank = card % 13
    suit = card // 13
    return f"{RANKS[rank]}{SUITS[suit]}"


def parse_cards(cards: Sequence[str]) -> List[int]:
    return [card_id(card) for card in cards]


def parse_hand(hand: str) -> Tuple[int, int]:
    if len(hand) != 4:
        raise ValueError(f"Hand must be 4 chars like AsKd, got {hand}")
    c1 = card_id(hand[:2])
    c2 = card_id(hand[2:])
    if c1 == c2:
        raise ValueError(f"Hand has duplicate card: {hand}")
    return tuple(sorted((c1, c2)))


def all_hole_cards(exclude: Iterable[int]) -> List[Tuple[int, int]]:
    exclude_set = set(exclude)
    deck = [c for c in range(52) if c not in exclude_set]
    return [tuple(sorted((a, b))) for a, b in combinations(deck, 2)]


def evaluate_5(cards: Sequence[int]) -> Tuple[int, ...]:
    ranks = [card % 13 + 2 for card in cards]
    suits = [card // 13 for card in cards]
    ranks_sorted = sorted(ranks, reverse=True)
    counts: Dict[int, int] = {}
    for rank in ranks:
        counts[rank] = counts.get(rank, 0) + 1
    count_items = sorted(counts.items(), key=lambda item: (item[1], item[0]), reverse=True)
    counts_sorted = [count for _, count in count_items]
    ranks_by_count = [rank for rank, _ in count_items]

    is_flush = len(set(suits)) == 1
    unique_ranks = sorted(set(ranks), reverse=True)
    is_straight = False
    straight_high = 0
    if len(unique_ranks) == 5 and unique_ranks[0] - unique_ranks[-1] == 4:
        is_straight = True
        straight_high = unique_ranks[0]
    elif unique_ranks == [14, 5, 4, 3, 2]:
        is_straight = True
        straight_high = 5

    if is_straight and is_flush:
        return (8, straight_high)
    if counts_sorted == [4, 1]:
        quad = ranks_by_count[0]
        kicker = ranks_by_count[1]
        return (7, quad, kicker)
    if counts_sorted == [3, 2]:
        trip = ranks_by_count[0]
        pair = ranks_by_count[1]
        return (6, trip, pair)
    if is_flush:
        return (5, *ranks_sorted)
    if is_straight:
        return (4, straight_high)
    if counts_sorted == [3, 1, 1]:
        trip = ranks_by_count[0]
        kickers = sorted(ranks_by_count[1:], reverse=True)
        return (3, trip, *kickers)
    if counts_sorted == [2, 2, 1]:
        high_pair, low_pair = sorted(ranks_by_count[:2], reverse=True)
        kicker = ranks_by_count[2]
        return (2, high_pair, low_pair, kicker)
    if counts_sorted == [2, 1, 1, 1]:
        pair = ranks_by_count[0]
        kickers = sorted(ranks_by_count[1:], reverse=True)
        return (1, pair, *kickers)
    return (0, *ranks_sorted)


def evaluate_7(cards: Sequence[int]) -> Tuple[int, ...]:
    best: Tuple[int, ...] | None = None
    for combo in combinations(cards, 5):
        rank = evaluate_5(combo)
        if best is None or rank > best:
            best = rank
    if best is None:
        raise ValueError("No cards to evaluate")
    return best


@dataclass(frozen=True)
class Hand:
    cards: Tuple[int, int]
    weight: float
    strength: Tuple[int, ...]


@dataclass(frozen=True)
class Action:
    label: str
    amount: int = 0


@dataclass(frozen=True)
class RiverState:
    history: Tuple[str, ...]
    contrib: Tuple[int, int]
    player: int | None
    checks: int
    raises: int
    terminal_winner: int | None


@dataclass
class RiverHoldemConfig:
    board: Sequence[str]
    pot: int = 1000
    stacks: Tuple[int, int] = (9500, 9500)
    bet_sizes: Sequence[float] = (0.5, 1.0)
    oop_first_bets: Sequence[float] | None = None
    ip_first_bets: Sequence[float] | None = None
    oop_first_raises: Sequence[float] | None = None
    ip_first_raises: Sequence[float] | None = None
    oop_next_raises: Sequence[float] | None = None
    ip_next_raises: Sequence[float] | None = None
    include_all_in: bool = True
    max_raises: int = 1000
    ranges: Tuple[Sequence[str] | None, Sequence[str] | None] = (None, None)
    range_weights: Tuple[Sequence[float] | None, Sequence[float] | None] = (None, None)


class RiverHoldemGame:
    def __init__(self, config: RiverHoldemConfig) -> None:
        self.config = config
        self.board = parse_cards(config.board)
        self.base_pot = int(config.pot)
        self.stacks = (int(config.stacks[0]), int(config.stacks[1]))
        self.bet_sizes = list(config.bet_sizes)
        self.oop_first_bets = list(config.oop_first_bets) if config.oop_first_bets else self.bet_sizes
        self.ip_first_bets = list(config.ip_first_bets) if config.ip_first_bets else self.bet_sizes
        self.oop_first_raises = list(config.oop_first_raises) if config.oop_first_raises else self.bet_sizes
        self.ip_first_raises = list(config.ip_first_raises) if config.ip_first_raises else self.bet_sizes
        self.oop_next_raises = list(config.oop_next_raises) if config.oop_next_raises else self.bet_sizes
        self.ip_next_raises = list(config.ip_next_raises) if config.ip_next_raises else self.bet_sizes
        self.include_all_in = config.include_all_in
        self.max_raises = config.max_raises

        self.hands = []
        self.hand_weights = []
        self._legal_cache: Dict[Tuple[str, ...], List[Action]] = {}
        self._next_cache: Dict[Tuple[Tuple[str, ...], Action], RiverState] = {}
        for player in (0, 1):
            hand_list = self._build_hands(config.ranges[player], config.range_weights[player])
            self.hands.append(hand_list)
            weights = [hand.weight for hand in hand_list]
            total = sum(weights)
            if total <= 0:
                raise ValueError("Range weights must sum to > 0")
            self.hand_weights.append([w / total for w in weights])

    def _build_hands(
        self, hand_strings: Sequence[str] | None, weights: Sequence[float] | None
    ) -> List[Hand]:
        if hand_strings is None:
            hole_cards = all_hole_cards(self.board)
        else:
            hole_cards = [parse_hand(hand) for hand in hand_strings]
        if weights is None:
            weights = [1.0 for _ in hole_cards]
        if len(weights) != len(hole_cards):
            raise ValueError("Weights must match number of hands")
        hands = []
        for cards, weight in zip(hole_cards, weights):
            if any(card in self.board for card in cards):
                continue
            strength = evaluate_7(list(cards) + list(self.board))
            hands.append(Hand(cards=cards, weight=float(weight), strength=strength))
        return hands

    def initial_state(self) -> RiverState:
        return RiverState(history=(), contrib=(0, 0), player=0, checks=0, raises=0, terminal_winner=None)

    def is_terminal(self, state: RiverState) -> bool:
        return state.player is None

    def current_player(self, state: RiverState) -> int | None:
        return state.player

    def pot_total(self, state: RiverState) -> int:
        return self.base_pot + state.contrib[0] + state.contrib[1]

    def infoset_key(self, state: RiverState, player: int) -> str:
        if not state.history:
            return "root"
        return "/".join(state.history)

    def legal_actions(self, state: RiverState) -> List[Action]:
        if self.is_terminal(state):
            return []
        cached = self._legal_cache.get(state.history)
        if cached is not None:
            return cached
        player = state.player
        to_call = max(state.contrib) - state.contrib[player]
        remaining = self.stacks[player] - state.contrib[player]
        pot_total = self.pot_total(state)
        sizes = self.bet_sizes

        actions = []
        if to_call == 0:
            # No bet to call: check or bet sizing options.
            actions.append(Action("c", 0))
            if state.checks == 0 and player == 0:
                sizes = self.oop_first_bets
            elif state.checks == 1 and player == 1:
                sizes = self.ip_first_bets
            amounts = []
            for size in sizes:
                bet_amount = int(round(pot_total * size))
                if bet_amount <= 0:
                    continue
                bet_amount = min(bet_amount, remaining)
                if bet_amount > 0:
                    amounts.append(bet_amount)
            if self.include_all_in and remaining > 0:
                amounts.append(remaining)
            for amount in sorted(set(amounts)):
                if amount > 0:
                    actions.append(Action("b", amount))
            self._legal_cache[state.history] = actions
            return actions

        actions.append(Action("c", to_call))
        actions.append(Action("f", 0))
        if state.raises >= self.max_raises:
            self._legal_cache[state.history] = actions
            return actions

        if state.raises == 1:
            sizes = self.oop_first_raises if player == 0 else self.ip_first_raises
        elif state.raises > 1:
            sizes = self.oop_next_raises if player == 0 else self.ip_next_raises
        pot_after_call = pot_total + to_call
        amounts = []
        for size in sizes:
            # Raise size is computed on pot after calling; amount is the extra beyond the call.
            raise_amount = int(round(pot_after_call * size))
            if raise_amount <= 0:
                continue
            total_add = to_call + raise_amount
            if total_add > remaining:
                total_add = remaining
                raise_amount = total_add - to_call
            if raise_amount > 0 and total_add > to_call:
                amounts.append(raise_amount)
        if self.include_all_in and remaining > to_call:
            amounts.append(remaining - to_call)
        for amount in sorted(set(amounts)):
            actions.append(Action("r", amount))
        self._legal_cache[state.history] = actions
        return actions

    def next_state(self, state: RiverState, action: Action) -> RiverState:
        cached = self._next_cache.get((state.history, action))
        if cached is not None:
            return cached
        player = state.player
        contrib = list(state.contrib)
        history = list(state.history)
        checks = state.checks
        raises = state.raises

        if action.label == "f":
            next_state = RiverState(
                history=tuple(history + ["f"]),
                contrib=tuple(contrib),
                player=None,
                checks=checks,
                raises=raises,
                terminal_winner=1 - player,
            )
            self._next_cache[(state.history, action)] = next_state
            return next_state

        if action.label == "c":
            to_call = max(contrib) - contrib[player]
            if to_call == 0:
                history.append("c")
                checks += 1
                if checks >= 2:
                    next_state = RiverState(
                        history=tuple(history),
                        contrib=tuple(contrib),
                        player=None,
                        checks=checks,
                        raises=raises,
                        terminal_winner=None,
                    )
                    self._next_cache[(state.history, action)] = next_state
                    return next_state
                next_state = RiverState(
                    history=tuple(history),
                    contrib=tuple(contrib),
                    player=1 - player,
                    checks=checks,
                    raises=raises,
                    terminal_winner=None,
                )
                self._next_cache[(state.history, action)] = next_state
                return next_state
            contrib[player] += to_call
            history.append("c")
            next_state = RiverState(
                history=tuple(history),
                contrib=tuple(contrib),
                player=None,
                checks=0,
                raises=raises,
                terminal_winner=None,
            )
            self._next_cache[(state.history, action)] = next_state
            return next_state

        to_call = max(contrib) - contrib[player]
        amount = action.amount
        if action.label == "r":
            # Raises add the call plus the extra raise amount.
            contrib[player] += to_call + amount
        else:
            contrib[player] += amount
        if action.label == "b":
            history.append(f"b{amount}")
        else:
            history.append(f"r{amount}")
        raises += 1
        next_state = RiverState(
            history=tuple(history),
            contrib=tuple(contrib),
            player=1 - player,
            checks=0,
            raises=raises,
            terminal_winner=None,
        )
        self._next_cache[(state.history, action)] = next_state
        return next_state

    def terminal_payout(self, state: RiverState, player: int) -> float:
        pot_total = self.pot_total(state)
        if state.terminal_winner is not None:
            if state.terminal_winner == player:
                return float(pot_total - state.contrib[player])
            return float(-state.contrib[player])
        return float(pot_total / 2.0 - state.contrib[player])
