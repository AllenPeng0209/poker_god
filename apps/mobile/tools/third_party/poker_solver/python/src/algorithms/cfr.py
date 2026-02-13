from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

from algorithms.infoset import InfoSet


@dataclass
class CFRConfig:
    use_plus: bool = False
    linear_weighting: bool = False
    alternating: bool = False
    use_dcfr: bool = False
    dcfr_alpha: float = 1.5
    dcfr_beta: float = 0.0
    dcfr_gamma: float = 2.0


class CFRTrainer:
    def __init__(self, game, config: CFRConfig | None = None) -> None:
        self.game = game
        self.config = config or CFRConfig()
        self.infosets: Dict[str, InfoSet] = {}
        self.iteration = 0
        self._pending_regret: Dict[str, List[float]] = {}

    def _get_infoset(self, state, player: int) -> tuple[str, InfoSet]:
        key = self.game.infoset_key(state, player)
        infoset = self.infosets.get(key)
        if infoset is None:
            actions = self.game.legal_actions(state)
            infoset = InfoSet(actions)
            self.infosets[key] = infoset
        return key, infoset

    def _accumulate_regret(self, key: str, infoset: InfoSet, deltas: List[float]) -> None:
        if not self.config.use_plus:
            for idx, delta in enumerate(deltas):
                infoset.regret_sum[idx] += delta
            return

        # CFR+: defer flooring until after the traversal to avoid biasing updates.
        pending = self._pending_regret.get(key)
        if pending is None:
            pending = [0.0 for _ in infoset.actions]
        for idx, delta in enumerate(deltas):
            pending[idx] += delta
        self._pending_regret[key] = pending

    def _apply_regret_updates(self) -> None:
        if not self.config.use_plus:
            return
        for key, deltas in self._pending_regret.items():
            infoset = self.infosets[key]
            for idx, delta in enumerate(deltas):
                infoset.regret_sum[idx] = max(0.0, infoset.regret_sum[idx] + delta)
        self._pending_regret.clear()

    def _cfr(self, state, reach_p0: float, reach_p1: float, update_player: Optional[int]) -> float:
        if self.game.is_terminal(state):
            return self.game.terminal_utility(state, 0)
        if self.game.current_player(state) == -1:
            # Chance node (e.g., dealing); average over outcomes.
            value = 0.0
            for outcome, prob in self.game.chance_outcomes(state):
                value += prob * self._cfr(
                    self.game.next_state(state, outcome),
                    reach_p0,
                    reach_p1,
                    update_player,
                )
            return value

        player = self.game.current_player(state)
        key, infoset = self._get_infoset(state, player)
        if self.config.use_dcfr and (update_player is None or update_player == player):
            infoset.apply_dcfr_discount(
                self.iteration,
                self.config.dcfr_alpha,
                self.config.dcfr_beta,
                self.config.dcfr_gamma,
            )
        strategy = infoset.current_strategy()
        actions = infoset.actions

        util: List[float] = []
        node_util = 0.0
        for idx, action in enumerate(actions):
            if player == 0:
                util_value = self._cfr(
                    self.game.next_state(state, action),
                    reach_p0 * strategy[idx],
                    reach_p1,
                    update_player,
                )
            else:
                util_value = self._cfr(
                    self.game.next_state(state, action),
                    reach_p0,
                    reach_p1 * strategy[idx],
                    update_player,
                )
            util.append(util_value)
            node_util += strategy[idx] * util_value

        if update_player is None or update_player == player:
            if player == 0:
                opponent_reach = reach_p1
                deltas = [opponent_reach * (util_value - node_util) for util_value in util]
            else:
                opponent_reach = reach_p0
                deltas = [opponent_reach * (node_util - util_value) for util_value in util]
            self._accumulate_regret(key, infoset, deltas)

            weight = reach_p0 if player == 0 else reach_p1
            if self.config.use_plus and self.config.linear_weighting and not self.config.use_dcfr:
                weight *= self.iteration
            for idx, _ in enumerate(actions):
                infoset.strategy_sum[idx] += weight * strategy[idx]

        return node_util

    def run(self, iterations: int) -> None:
        for _ in range(iterations):
            self.iteration += 1
            if self.config.alternating:
                # Alternating updates: separate traversals per player per iteration.
                self._pending_regret.clear()
                self._cfr(self.game.initial_state(), 1.0, 1.0, update_player=0)
                self._apply_regret_updates()
                self._pending_regret.clear()
                self._cfr(self.game.initial_state(), 1.0, 1.0, update_player=1)
                self._apply_regret_updates()
            else:
                self._pending_regret.clear()
                self._cfr(self.game.initial_state(), 1.0, 1.0, update_player=None)
                self._apply_regret_updates()

    def average_strategy_profile(self) -> Dict[str, Dict[str, float]]:
        profile: Dict[str, Dict[str, float]] = {}
        for key, infoset in self.infosets.items():
            avg = infoset.average_strategy()
            profile[key] = {action: avg[idx] for idx, action in enumerate(infoset.actions)}
        return profile
