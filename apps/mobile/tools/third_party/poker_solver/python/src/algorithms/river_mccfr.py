from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Dict, List, Tuple

from algorithms.infoset import InfoSet
from algorithms.vector_eval import uniform_strategy
from games.river_holdem import Action, RiverHoldemGame, RiverState, card_str


@dataclass
class RiverMCCFRConfig:
    seed: int = 7


class ExternalSamplingMCCFRTrainer:
    def __init__(self, game: RiverHoldemGame, config: RiverMCCFRConfig | None = None) -> None:
        self.game = game
        self.config = config or RiverMCCFRConfig()
        self.rng = random.Random(self.config.seed)
        self.infosets: Dict[str, InfoSet] = {}
        self.hand_index: Dict[int, Dict[str, int]] = {0: {}, 1: {}}
        self._p0_sampling_weights: List[float] = []
        for player in (0, 1):
            for idx, hand in enumerate(game.hands[player]):
                key = self._hand_key(hand.cards)
                self.hand_index[player][key] = idx
        self._build_p0_sampling_weights()

    def _build_p0_sampling_weights(self) -> None:
        p0_weights = self.game.hand_weights[0]
        p1_weights = self.game.hand_weights[1]
        self._p0_sampling_weights = [0.0 for _ in self.game.hands[0]]
        for i, p0_hand in enumerate(self.game.hands[0]):
            blocked = set(p0_hand.cards)
            valid_sum = 0.0
            for hand, weight in zip(self.game.hands[1], p1_weights):
                if blocked.intersection(hand.cards):
                    continue
                valid_sum += weight
            # Sample P0 proportional to its weight times valid P1 mass.
            self._p0_sampling_weights[i] = p0_weights[i] * valid_sum

    def _get_infoset(self, key: str, actions: List[Action]) -> InfoSet:
        infoset = self.infosets.get(key)
        if infoset is None:
            infoset = InfoSet([self._action_token(a) for a in actions])
            self.infosets[key] = infoset
        return infoset

    def _action_token(self, action: Action) -> str:
        if action.label in ("c", "f"):
            return action.label
        return f"{action.label}{action.amount}"

    def _hand_key(self, cards: Tuple[int, int]) -> str:
        return f"{card_str(cards[0])}{card_str(cards[1])}"

    def _sample_hand_index(self, weights: List[float]) -> int:
        total = sum(weights)
        if total <= 0.0:
            raise ValueError("No weight to sample from")
        threshold = self.rng.random() * total
        cumulative = 0.0
        for idx, weight in enumerate(weights):
            cumulative += weight
            if threshold <= cumulative:
                return idx
        return len(weights) - 1

    def _sample_hands(self) -> Tuple[int, int]:
        p1_weights = self.game.hand_weights[1]
        p0_index = self._sample_hand_index(self._p0_sampling_weights)
        p0_hand = self.game.hands[0][p0_index]
        blocked = set(p0_hand.cards)
        filtered_weights = []
        for hand, weight in zip(self.game.hands[1], p1_weights):
            if blocked.intersection(hand.cards):
                filtered_weights.append(0.0)
            else:
                filtered_weights.append(weight)
        p1_index = self._sample_hand_index(filtered_weights)
        return p0_index, p1_index

    def _utility(self, state: RiverState, p0_index: int, p1_index: int, player: int) -> float:
        pot_total = self.game.pot_total(state)
        contrib = state.contrib[player]
        if state.terminal_winner is not None:
            if state.terminal_winner == player:
                return float(pot_total - contrib)
            return float(-contrib)

        p0_strength = self.game.hands[0][p0_index].strength
        p1_strength = self.game.hands[1][p1_index].strength
        if p0_strength == p1_strength:
            return float(pot_total / 2.0 - contrib)
        if (p0_strength > p1_strength) == (player == 0):
            return float(pot_total - contrib)
        return float(-contrib)

    def _traverse(
        self,
        state: RiverState,
        target_player: int,
        p0_index: int,
        p1_index: int,
        reach: float,
    ) -> float:
        if self.game.is_terminal(state):
            return self._utility(state, p0_index, p1_index, target_player)

        player = self.game.current_player(state)
        actions = self.game.legal_actions(state)
        if player == target_player:
            # Full update on the sampled trajectory for the target player.
            hand_index = p0_index if target_player == 0 else p1_index
            hand_key = self._hand_key(self.game.hands[player][hand_index].cards)
            key = f"p{player}:{hand_key}|{self.game.infoset_key(state, player)}"
            infoset = self._get_infoset(key, actions)
            strategy = infoset.current_strategy()
            util = []
            node_util = 0.0
            for a_idx, action in enumerate(actions):
                util_value = self._traverse(
                    self.game.next_state(state, action),
                    target_player,
                    p0_index,
                    p1_index,
                    reach * strategy[a_idx],
                )
                util.append(util_value)
                node_util += strategy[a_idx] * util_value
            for a_idx, util_value in enumerate(util):
                infoset.regret_sum[a_idx] += util_value - node_util
            for a_idx in range(len(actions)):
                infoset.strategy_sum[a_idx] += reach * strategy[a_idx]
            return node_util

        hand_index = p0_index if player == 0 else p1_index
        hand_key = self._hand_key(self.game.hands[player][hand_index].cards)
        key = f"p{player}:{hand_key}|{self.game.infoset_key(state, player)}"
        infoset = self._get_infoset(key, actions)
        strategy = infoset.current_strategy()
        # External sampling: sample one action for the non-updating player.
        action = self._sample_action(actions, strategy)
        return self._traverse(self.game.next_state(state, action), target_player, p0_index, p1_index, reach)

    def _sample_action(self, actions: List[Action], strategy: List[float]) -> Action:
        threshold = self.rng.random()
        cumulative = 0.0
        for action, prob in zip(actions, strategy):
            cumulative += prob
            if threshold <= cumulative:
                return action
        return actions[-1]

    def run(self, iterations: int) -> None:
        for _ in range(iterations):
            p0_index, p1_index = self._sample_hands()
            root = self.game.initial_state()
            self._traverse(root, 0, p0_index, p1_index, 1.0)
            self._traverse(root, 1, p0_index, p1_index, 1.0)

    def average_strategy_profile(self) -> Dict[int, Dict[str, Tuple[List[str], List[List[float]]]]]:
        profile: Dict[int, Dict[str, Tuple[List[str], List[List[float]]]]] = {0: {}, 1: {}}
        for key, infoset in self.infosets.items():
            player_str, history = key.split("|", 1)
            player = int(player_str[1])
            hand_key = player_str.split(":", 1)[1]
            hand_index = self.hand_index[player][hand_key]

            entry = profile[player].get(history)
            if entry is None:
                actions = list(infoset.actions)
                matrix = uniform_strategy(len(self.game.hands[player]), len(actions))
                profile[player][history] = (actions, matrix)
                entry = profile[player][history]
            actions, matrix = entry
            matrix[hand_index] = infoset.average_strategy()

        return profile
