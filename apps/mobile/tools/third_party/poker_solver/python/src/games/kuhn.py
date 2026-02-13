from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple


CARD_RANKS = [0, 1, 2]
RANK_TO_STR = {0: "J", 1: "Q", 2: "K"}


@dataclass(frozen=True)
class KuhnState:
    cards: Tuple[int, int] | None
    history: str


class KuhnPoker:
    terminal_histories = {"cc", "bc", "bf", "cbc", "cbf"}

    def initial_state(self) -> KuhnState:
        return KuhnState(cards=None, history="")

    def is_terminal(self, state: KuhnState) -> bool:
        return state.history in self.terminal_histories

    def current_player(self, state: KuhnState) -> int | None:
        if state.cards is None:
            return -1
        if self.is_terminal(state):
            return None
        return len(state.history) % 2

    def legal_actions(self, state: KuhnState) -> List[str]:
        if self.is_terminal(state):
            return []
        history = state.history
        if history in ("", "c"):
            return ["c", "b"]
        if history in ("b", "cb"):
            return ["c", "f"]
        return []

    def chance_outcomes(self, state: KuhnState):
        if state.cards is not None:
            return []
        # Deal two distinct cards uniformly.
        outcomes = []
        deck = CARD_RANKS
        for i in range(len(deck)):
            for j in range(len(deck)):
                if i == j:
                    continue
                cards = (deck[i], deck[j])
                outcomes.append((cards, 1.0 / 6.0))
        return outcomes

    def next_state(self, state: KuhnState, action) -> KuhnState:
        if state.cards is None:
            return KuhnState(cards=action, history="")
        return KuhnState(cards=state.cards, history=state.history + action)

    def infoset_key(self, state: KuhnState, player: int) -> str:
        card = state.cards[player]
        # Public history plus private card for the acting player.
        return f"{RANK_TO_STR[card]}|{state.history}"

    def terminal_utility(self, state: KuhnState, player: int) -> float:
        history = state.history
        # Pots and contributions are fixed per terminal history.
        if history == "bf":
            winner = 0
            pot = 3
            contrib = (2, 1)
        elif history == "cbf":
            winner = 1
            pot = 3
            contrib = (1, 2)
        elif history == "cc":
            pot = 2
            contrib = (1, 1)
            winner = 0 if state.cards[0] > state.cards[1] else 1
        elif history in ("bc", "cbc"):
            pot = 4
            contrib = (2, 2)
            winner = 0 if state.cards[0] > state.cards[1] else 1
        else:
            raise ValueError(f"Non-terminal history: {history}")

        if state.cards[0] == state.cards[1]:
            return 0.0

        if winner == player:
            return float(pot - contrib[player])
        return float(-contrib[player])
