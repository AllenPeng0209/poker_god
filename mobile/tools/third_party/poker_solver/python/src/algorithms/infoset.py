from __future__ import annotations

from dataclasses import dataclass, field
from math import pow
from typing import List


@dataclass
class InfoSet:
    actions: List[str]
    regret_sum: List[float] = field(init=False)
    strategy_sum: List[float] = field(init=False)
    last_dcfr_iter: int = 0

    def __post_init__(self) -> None:
        self.regret_sum = [0.0 for _ in self.actions]
        self.strategy_sum = [0.0 for _ in self.actions]

    def current_strategy(self) -> List[float]:
        # Regret-matching: normalize only positive regrets.
        positive_regrets = [max(r, 0.0) for r in self.regret_sum]
        normalizing = sum(positive_regrets)
        if normalizing > 0.0:
            return [r / normalizing for r in positive_regrets]
        return [1.0 / len(self.actions) for _ in self.actions]

    def average_strategy(self) -> List[float]:
        # Average strategy uses cumulative reach-weighted strategy sums.
        normalizing = sum(self.strategy_sum)
        if normalizing > 0.0:
            return [s / normalizing for s in self.strategy_sum]
        return [1.0 / len(self.actions) for _ in self.actions]

    def apply_dcfr_discount(self, iteration: int, alpha: float, beta: float, gamma: float) -> None:
        if self.last_dcfr_iter == iteration:
            return
        # Apply DCFR decay from the last applied iteration up to current.
        for t in range(self.last_dcfr_iter + 1, iteration + 1):
            pos_base = pow(float(t), alpha)
            neg_base = pow(float(t), beta)
            pos_scale = pos_base / (pos_base + 1.0)
            neg_scale = neg_base / (neg_base + 1.0)
            strat_scale = pow(float(t) / (float(t) + 1.0), gamma)
            for idx, regret in enumerate(self.regret_sum):
                if regret > 0.0:
                    self.regret_sum[idx] = regret * pos_scale
                elif regret < 0.0:
                    self.regret_sum[idx] = regret * neg_scale
            for idx, value in enumerate(self.strategy_sum):
                self.strategy_sum[idx] = value * strat_scale
        self.last_dcfr_iter = iteration
