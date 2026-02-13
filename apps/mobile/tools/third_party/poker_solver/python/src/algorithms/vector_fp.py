from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

from algorithms.vector_eval import action_tokens, best_response, build_blocked_indices
from games.river_holdem import Action, RiverHoldemGame, RiverState


@dataclass
class VectorFPConfig:
    optimistic: bool = False
    linear_weighting: bool = False
    alternating: bool = True


class VectorFPInfoSet:
    def __init__(self, num_hands: int, actions: List[Action]) -> None:
        self.actions = actions
        self.action_tokens = action_tokens(actions)
        self.strategy_sum = [[0.0 for _ in actions] for _ in range(num_hands)]
        self.last_strategy = [[1.0 / len(actions) for _ in actions] for _ in range(num_hands)]

    def add_strategy(self, matrix: List[List[float]], weight: float) -> None:
        for h_idx, row in enumerate(matrix):
            sum_row = self.strategy_sum[h_idx]
            for a_idx, prob in enumerate(row):
                sum_row[a_idx] += weight * prob
            self.last_strategy[h_idx] = list(row)


class VectorFictitiousPlayTrainer:
    def __init__(self, game: RiverHoldemGame, config: VectorFPConfig | None = None) -> None:
        self.game = game
        self.config = config or VectorFPConfig()
        self.iteration = 0
        self.num_hands = [len(game.hands[0]), len(game.hands[1])]
        self.infosets: Dict[int, Dict[str, VectorFPInfoSet]] = {0: {}, 1: {}}
        self.total_weight = {0: 0.0, 1: 0.0}
        self.last_weight = {0: 0.0, 1: 0.0}
        from algorithms.vector_eval import build_strength_summary

        self.summary = {
            0: build_strength_summary(self.game.hands[1]),
            1: build_strength_summary(self.game.hands[0]),
        }
        self.blocked_indices = {
            0: build_blocked_indices(self.game.hands[0], self.summary[0]),
            1: build_blocked_indices(self.game.hands[1], self.summary[1]),
        }

    def _get_infoset(self, player: int, state: RiverState) -> VectorFPInfoSet:
        key = self.game.infoset_key(state, player)
        infoset = self.infosets[player].get(key)
        if infoset is None:
            infoset = VectorFPInfoSet(self.num_hands[player], self.game.legal_actions(state))
            self.infosets[player][key] = infoset
        return infoset

    def _player_profile(self, player: int, optimistic: bool) -> Dict[str, Tuple[List[str], List[List[float]]]]:
        profile: Dict[str, Tuple[List[str], List[List[float]]]] = {}
        total_weight = self.total_weight[player]
        last_weight = self.last_weight[player] if optimistic else 0.0
        denom = total_weight + last_weight
        for key, infoset in self.infosets[player].items():
            if denom <= 0.0:
                matrix = [list(row) for row in infoset.last_strategy]
            else:
                matrix = []
                for h_idx in range(self.num_hands[player]):
                    row = list(infoset.strategy_sum[h_idx])
                    if optimistic and last_weight > 0.0:
                        # Optimistic FP: count the last iterate twice.
                        for a_idx, prob in enumerate(infoset.last_strategy[h_idx]):
                            row[a_idx] += last_weight * prob
                    matrix.append([value / denom for value in row])
            profile[key] = (infoset.action_tokens, matrix)
        return profile

    def _update_player(self, player: int, br_policy: Dict[str, Tuple[List[str], List[List[float]]]]) -> None:
        weight = float(self.iteration) if self.config.linear_weighting else 1.0
        self.last_weight[player] = weight
        self.total_weight[player] += weight

        for key, (tokens, matrix) in br_policy.items():
            infoset = self.infosets[player].get(key)
            if infoset is None:
                actions = self.game.legal_actions(self._state_from_key(key))
                infoset = VectorFPInfoSet(self.num_hands[player], actions)
                self.infosets[player][key] = infoset
            infoset.add_strategy(matrix, weight)

    def _state_from_key(self, key: str) -> RiverState:
        if key == "root":
            return self.game.initial_state()
        # Reconstruct a minimal state by replaying history tokens.
        state = self.game.initial_state()
        for token in key.split("/"):
            actions = self.game.legal_actions(state)
            selected = None
            for action in actions:
                if action.label in ("c", "f") and action.label == token:
                    selected = action
                    break
                if action.label not in ("c", "f") and token == f"{action.label}{action.amount}":
                    selected = action
                    break
            if selected is None:
                raise ValueError(f"Cannot reconstruct state for token {token}")
            state = self.game.next_state(state, selected)
        return state

    def run(self, iterations: int) -> None:
        for _ in range(iterations):
            self.iteration += 1
            if self.config.alternating:
                for player in (0, 1):
                    opponent_profile = self._player_profile(1 - player, optimistic=self.config.optimistic)
                    values, br_policy = best_response(
                        self.game,
                        player,
                        opponent_profile,
                        opp_summary=self.summary[player],
                        blocked_indices=self.blocked_indices[player],
                    )
                    del values
                    self._update_player(player, br_policy)
            else:
                profiles = {
                    0: self._player_profile(0, optimistic=self.config.optimistic),
                    1: self._player_profile(1, optimistic=self.config.optimistic),
                }
                for player in (0, 1):
                    opponent_profile = profiles[1 - player]
                    values, br_policy = best_response(
                        self.game,
                        player,
                        opponent_profile,
                        opp_summary=self.summary[player],
                        blocked_indices=self.blocked_indices[player],
                    )
                    del values
                    self._update_player(player, br_policy)

    def average_strategy_profile(self) -> Dict[int, Dict[str, Tuple[List[str], List[List[float]]]]]:
        profile: Dict[int, Dict[str, Tuple[List[str], List[List[float]]]]] = {0: {}, 1: {}}
        for player in (0, 1):
            denom = self.total_weight[player]
            for key, infoset in self.infosets[player].items():
                if denom <= 0.0:
                    matrix = [list(row) for row in infoset.last_strategy]
                else:
                    matrix = []
                    for h_idx in range(self.num_hands[player]):
                        row = [value / denom for value in infoset.strategy_sum[h_idx]]
                        matrix.append(row)
                profile[player][key] = (infoset.action_tokens, matrix)
        return profile
