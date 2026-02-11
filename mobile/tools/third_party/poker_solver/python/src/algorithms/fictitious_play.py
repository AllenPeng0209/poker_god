from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

from algorithms.evaluation import best_response_strategy


@dataclass
class FPConfig:
    optimistic: bool = False
    linear_weighting: bool = False
    alternating: bool = False


@dataclass
class FPInfoSet:
    actions: List[str]
    strategy_sum: List[float] = field(init=False)
    last_strategy: List[float] = field(init=False)

    def __post_init__(self) -> None:
        self.strategy_sum = [0.0 for _ in self.actions]
        self.last_strategy = [1.0 / len(self.actions) for _ in self.actions]

    def add_strategy(self, probs: List[float], weight: float) -> None:
        for idx, prob in enumerate(probs):
            self.strategy_sum[idx] += weight * prob
        self.last_strategy = list(probs)


class FictitiousPlayTrainer:
    def __init__(self, game, config: FPConfig | None = None) -> None:
        self.game = game
        self.config = config or FPConfig()
        self.infosets: Dict[int, Dict[str, FPInfoSet]] = {0: {}, 1: {}}
        self.total_weight = {0: 0.0, 1: 0.0}
        self.last_weight = {0: 0.0, 1: 0.0}
        self.iteration = 0

    def _get_infoset(self, player: int, key: str, actions: List[str]) -> FPInfoSet:
        infoset = self.infosets[player].get(key)
        if infoset is None:
            infoset = FPInfoSet(actions)
            self.infosets[player][key] = infoset
        return infoset

    def _profile_for_player(self, player: int, optimistic: bool) -> Dict[str, Dict[str, float]]:
        profile: Dict[str, Dict[str, float]] = {}
        total_weight = self.total_weight[player]
        last_weight = self.last_weight[player] if optimistic else 0.0
        denom = total_weight + last_weight
        for key, infoset in self.infosets[player].items():
            if denom > 0.0:
                base = list(infoset.strategy_sum)
                if optimistic and last_weight > 0.0:
                    # Optimistic FP: add the last iterate one extra time.
                    for idx, prob in enumerate(infoset.last_strategy):
                        base[idx] += last_weight * prob
                probs = [value / denom for value in base]
            else:
                probs = [1.0 / len(infoset.actions) for _ in infoset.actions]
            profile[key] = {action: probs[idx] for idx, action in enumerate(infoset.actions)}
        return profile

    def _best_response(self, player: int):
        opponent_profile = self._profile_for_player(1 - player, optimistic=self.config.optimistic)
        return best_response_strategy(self.game, opponent_profile, br_player=player)

    def _update_player(self, player: int, br_strategy) -> None:
        weight = float(self.iteration) if self.config.linear_weighting else 1.0
        self.last_weight[player] = weight
        self.total_weight[player] += weight

        full_strategy = dict(br_strategy)
        for key, infoset in self.infosets[player].items():
            if key not in full_strategy:
                full_strategy[key] = (infoset.actions, infoset.last_strategy)

        for key, (actions, probs) in full_strategy.items():
            infoset = self._get_infoset(player, key, actions)
            infoset.add_strategy(probs, weight)

    def run(self, iterations: int) -> None:
        for _ in range(iterations):
            self.iteration += 1
            if self.config.alternating:
                br0 = self._best_response(0)
                self._update_player(0, br0)
                br1 = self._best_response(1)
                self._update_player(1, br1)
            else:
                br0 = self._best_response(0)
                br1 = self._best_response(1)
                self._update_player(0, br0)
                self._update_player(1, br1)

    def average_strategy_profile(self) -> Dict[str, Dict[str, float]]:
        profile: Dict[str, Dict[str, float]] = {}
        for player in (0, 1):
            denom = self.total_weight[player]
            for key, infoset in self.infosets[player].items():
                if denom > 0.0:
                    avg = [value / denom for value in infoset.strategy_sum]
                else:
                    avg = [1.0 / len(infoset.actions) for _ in infoset.actions]
                profile[key] = {action: avg[idx] for idx, action in enumerate(infoset.actions)}
        return profile
