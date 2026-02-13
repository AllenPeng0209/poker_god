from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple


RANKS = [0, 1, 2]
RANK_TO_STR = {0: "J", 1: "Q", 2: "K"}
DECK = [(rank, copy) for rank in RANKS for copy in (0, 1)]
MAX_BETS_PER_ROUND = 2


@dataclass(frozen=True)
class LeducState:
    cards: Tuple[Tuple[int, int], Tuple[int, int]] | None
    board: Tuple[int, int] | None
    history: str
    round_index: int
    round_actions: str
    round_contrib: Tuple[int, int]
    contrib: Tuple[int, int]
    player: int | None
    terminal_winner: int | None


class LeducPoker:
    def initial_state(self) -> LeducState:
        return LeducState(
            cards=None,
            board=None,
            history="",
            round_index=0,
            round_actions="",
            round_contrib=(0, 0),
            contrib=(1, 1),
            player=-1,
            terminal_winner=None,
        )

    def is_terminal(self, state: LeducState) -> bool:
        return state.player is None

    def current_player(self, state: LeducState) -> int | None:
        return state.player

    def chance_outcomes(self, state: LeducState):
        if state.player != -1:
            return []
        if state.cards is None:
            # Deal private cards uniformly from the deck (order matters).
            outcomes = []
            deck = list(DECK)
            total = len(deck) * (len(deck) - 1)
            for i, card0 in enumerate(deck):
                for j, card1 in enumerate(deck):
                    if i == j:
                        continue
                    outcomes.append(((card0, card1), 1.0 / total))
            return outcomes
        if state.board is None and state.round_index == 1:
            # Reveal one public board card from remaining deck.
            remaining = [card for card in DECK if card not in state.cards]
            prob = 1.0 / len(remaining)
            return [(card, prob) for card in remaining]
        return []

    def legal_actions(self, state: LeducState) -> List[str]:
        if self.is_terminal(state) or state.player == -1:
            return []
        player = state.player
        bet_size = 1 if state.round_index == 0 else 2
        max_contrib = max(state.round_contrib)
        to_call = max_contrib - state.round_contrib[player]
        round_raises = max_contrib // bet_size

        if to_call > 0:
            actions = ["c", "f"]
            if round_raises < MAX_BETS_PER_ROUND:
                actions.append("b")
            return actions
        return ["c", "b"]

    def next_state(self, state: LeducState, action) -> LeducState:
        if state.player == -1:
            if state.cards is None:
                return LeducState(
                    cards=action,
                    board=None,
                    history=state.history,
                    round_index=0,
                    round_actions=state.round_actions,
                    round_contrib=state.round_contrib,
                    contrib=state.contrib,
                    player=0,
                    terminal_winner=None,
                )
            return LeducState(
                cards=state.cards,
                board=action,
                history=state.history,
                round_index=1,
                round_actions="",
                round_contrib=(0, 0),
                contrib=state.contrib,
                player=0,
                terminal_winner=None,
            )

        player = state.player
        bet_size = 1 if state.round_index == 0 else 2
        max_contrib = max(state.round_contrib)
        to_call = max_contrib - state.round_contrib[player]
        round_contrib = list(state.round_contrib)
        contrib = list(state.contrib)
        history = state.history + action
        round_actions = state.round_actions + action

        if action == "f":
            winner = 1 - player
            return LeducState(
                cards=state.cards,
                board=state.board,
                history=history,
                round_index=state.round_index,
                round_actions=round_actions,
                round_contrib=tuple(round_contrib),
                contrib=tuple(contrib),
                player=None,
                terminal_winner=winner,
            )

        if action == "c" and to_call == 0:
            if state.round_actions.endswith("c"):
                return self._end_round(state, history, round_actions, round_contrib, contrib)
            return LeducState(
                cards=state.cards,
                board=state.board,
                history=history,
                round_index=state.round_index,
                round_actions=round_actions,
                round_contrib=tuple(round_contrib),
                contrib=tuple(contrib),
                player=1 - player,
                terminal_winner=None,
            )

        if action == "c" and to_call > 0:
            round_contrib[player] += to_call
            contrib[player] += to_call
            return self._end_round(state, history, round_actions, round_contrib, contrib)

        if action == "b" and to_call == 0:
            round_contrib[player] += bet_size
            contrib[player] += bet_size
        elif action == "b" and to_call > 0:
            increment = to_call + bet_size
            round_contrib[player] += increment
            contrib[player] += increment

        return LeducState(
            cards=state.cards,
            board=state.board,
            history=history,
            round_index=state.round_index,
            round_actions=round_actions,
            round_contrib=tuple(round_contrib),
            contrib=tuple(contrib),
            player=1 - player,
            terminal_winner=None,
        )

    def _end_round(
        self,
        state: LeducState,
        history: str,
        round_actions: str,
        round_contrib: List[int],
        contrib: List[int],
    ) -> LeducState:
        if state.round_index == 0:
            # Move to round 2 by emitting a chance node for the board card.
            return LeducState(
                cards=state.cards,
                board=None,
                history=history + "|",
                round_index=1,
                round_actions="",
                round_contrib=(0, 0),
                contrib=tuple(contrib),
                player=-1,
                terminal_winner=None,
            )
        return LeducState(
            cards=state.cards,
            board=state.board,
            history=history,
            round_index=state.round_index,
            round_actions=round_actions,
            round_contrib=tuple(round_contrib),
            contrib=tuple(contrib),
            player=None,
            terminal_winner=None,
        )

    def infoset_key(self, state: LeducState, player: int) -> str:
        card_rank = state.cards[player][0]
        board_rank = state.board[0] if state.board is not None else -1
        board_str = RANK_TO_STR[board_rank] if board_rank >= 0 else "-"
        return f"{RANK_TO_STR[card_rank]}{board_str}|{state.history}"

    def terminal_utility(self, state: LeducState, player: int) -> float:
        pot = sum(state.contrib)
        if state.terminal_winner is not None:
            if state.terminal_winner == player:
                return float(pot - state.contrib[player])
            return float(-state.contrib[player])

        winner = self._showdown_winner(state)
        if winner is None:
            return float(pot / 2.0 - state.contrib[player])
        if winner == player:
            return float(pot - state.contrib[player])
        return float(-state.contrib[player])

    def _showdown_winner(self, state: LeducState) -> int | None:
        board_rank = state.board[0]
        p0_rank = state.cards[0][0]
        p1_rank = state.cards[1][0]

        p0_pair = p0_rank == board_rank
        p1_pair = p1_rank == board_rank

        if p0_pair and not p1_pair:
            return 0
        if p1_pair and not p0_pair:
            return 1
        if p0_pair and p1_pair:
            return None
        if p0_rank > p1_rank:
            return 0
        if p1_rank > p0_rank:
            return 1
        return None
