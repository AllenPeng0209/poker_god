from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Dict, List

from algorithms.infoset import InfoSet


@dataclass
class MCCFRConfig:
    seed: int = 7


class ExternalSamplingMCCFRTrainer:
    def __init__(self, game, config: MCCFRConfig | None = None) -> None:
        self.game = game
        self.config = config or MCCFRConfig()
        self.infosets: Dict[str, InfoSet] = {}
        self.rng = random.Random(self.config.seed)
        self.iteration = 0

    def _get_infoset(self, state, player: int) -> InfoSet:
        key = self.game.infoset_key(state, player)
        infoset = self.infosets.get(key)
        if infoset is None:
            actions = self.game.legal_actions(state)
            infoset = InfoSet(actions)
            self.infosets[key] = infoset
        return infoset

    def _sample_action(self, actions: List[str], probs: List[float]) -> str:
        threshold = self.rng.random()
        cumulative = 0.0
        for action, prob in zip(actions, probs):
            cumulative += prob
            if threshold <= cumulative:
                return action
        return actions[-1]

    def _traverse(self, state, target_player: int, player_reach: float) -> float:
        if self.game.is_terminal(state):
            return self.game.terminal_utility(state, target_player)
        if self.game.current_player(state) == -1:
            # External sampling of chance outcomes.
            outcomes = self.game.chance_outcomes(state)
            actions = [outcome for outcome, _ in outcomes]
            probs = [prob for _, prob in outcomes]
            action = self._sample_action(actions, probs)
            return self._traverse(self.game.next_state(state, action), target_player, player_reach)

        player = self.game.current_player(state)
        infoset = self._get_infoset(state, player)
        strategy = infoset.current_strategy()
        actions = infoset.actions

        if player == target_player:
            util: List[float] = []
            node_util = 0.0
            for idx, action in enumerate(actions):
                util_value = self._traverse(
                    self.game.next_state(state, action),
                    target_player,
                    player_reach * strategy[idx],
                )
                util.append(util_value)
                node_util += strategy[idx] * util_value

            for idx, util_value in enumerate(util):
                infoset.regret_sum[idx] += util_value - node_util
            for idx, _ in enumerate(actions):
                infoset.strategy_sum[idx] += player_reach * strategy[idx]
            return node_util

        # Non-target player is sampled, not fully enumerated (external sampling).
        action = self._sample_action(actions, strategy)
        return self._traverse(self.game.next_state(state, action), target_player, player_reach)

    def run(self, iterations: int) -> None:
        for _ in range(iterations):
            self.iteration += 1
            self._traverse(self.game.initial_state(), target_player=0, player_reach=1.0)
            self._traverse(self.game.initial_state(), target_player=1, player_reach=1.0)

    def average_strategy_profile(self) -> Dict[str, Dict[str, float]]:
        profile: Dict[str, Dict[str, float]] = {}
        for key, infoset in self.infosets.items():
            avg = infoset.average_strategy()
            profile[key] = {action: avg[idx] for idx, action in enumerate(infoset.actions)}
        return profile
