from __future__ import annotations

from dataclasses import dataclass
from math import pow
from typing import Dict, List, Tuple

from algorithms.naive_eval import showdown_values_naive
from algorithms.vector_eval import (
    StrengthSummary,
    action_tokens,
    build_blocked_indices,
    build_strength_summary,
    fold_values,
    showdown_values,
)
from games.river_holdem import Action, RiverHoldemGame, RiverState


@dataclass
class VectorCFRConfig:
    use_plus: bool = False
    linear_weighting: bool = False
    alternating: bool = True
    use_naive_eval: bool = False
    use_dcfr: bool = False
    dcfr_alpha: float = 1.5
    dcfr_beta: float = 0.0
    dcfr_gamma: float = 2.0


class VectorInfoSet:
    def __init__(self, num_hands: int, actions: List[Action]) -> None:
        self.actions = actions
        self.action_tokens = action_tokens(actions)
        self.regret_sum = [[0.0 for _ in actions] for _ in range(num_hands)]
        self.strategy_sum = [[0.0 for _ in actions] for _ in range(num_hands)]
        self._strategy_cache: List[List[float]] | None = None
        self.last_dcfr_iter = 0

    def current_strategy(self) -> List[List[float]]:
        # Cache current strategy because it is reused within a traversal.
        if self._strategy_cache is not None:
            return self._strategy_cache
        strategy = []
        for regrets in self.regret_sum:
            positives = [max(r, 0.0) for r in regrets]
            normalizing = sum(positives)
            if normalizing > 0.0:
                strategy.append([r / normalizing for r in positives])
            else:
                num_actions = len(regrets)
                strategy.append([1.0 / num_actions for _ in range(num_actions)])
        self._strategy_cache = strategy
        return strategy

    def average_strategy(self) -> List[List[float]]:
        strategy = []
        for totals in self.strategy_sum:
            normalizing = sum(totals)
            if normalizing > 0.0:
                strategy.append([s / normalizing for s in totals])
            else:
                num_actions = len(totals)
                strategy.append([1.0 / num_actions for _ in range(num_actions)])
        return strategy

    def mark_dirty(self) -> None:
        self._strategy_cache = None

    def apply_dcfr_discount(self, iteration: int, alpha: float, beta: float, gamma: float) -> None:
        if self.last_dcfr_iter == iteration:
            return
        # Apply DCFR decay per iteration; keeps regrets/averages from growing unbounded.
        for t in range(self.last_dcfr_iter + 1, iteration + 1):
            pos_base = pow(float(t), alpha)
            neg_base = pow(float(t), beta)
            pos_scale = pos_base / (pos_base + 1.0)
            neg_scale = neg_base / (neg_base + 1.0)
            strat_scale = pow(float(t) / (float(t) + 1.0), gamma)
            for h_idx, row in enumerate(self.regret_sum):
                for a_idx, regret in enumerate(row):
                    if regret > 0.0:
                        row[a_idx] = regret * pos_scale
                    elif regret < 0.0:
                        row[a_idx] = regret * neg_scale
            for h_idx, row in enumerate(self.strategy_sum):
                for a_idx, value in enumerate(row):
                    row[a_idx] = value * strat_scale
        self.last_dcfr_iter = iteration
        self.mark_dirty()


class VectorCFRTrainer:
    def __init__(self, game: RiverHoldemGame, config: VectorCFRConfig | None = None) -> None:
        self.game = game
        self.config = config or VectorCFRConfig()
        self.iteration = 0
        self.num_hands = [len(game.hands[0]), len(game.hands[1])]
        self.hand_weights = game.hand_weights
        self.infosets: Dict[int, Dict[str, VectorInfoSet]] = {0: {}, 1: {}}
        self.opp_summary: Dict[int, StrengthSummary] = {
            0: build_strength_summary(game.hands[1]),
            1: build_strength_summary(game.hands[0]),
        }
        self.blocked_indices = {
            0: build_blocked_indices(game.hands[0], self.opp_summary[0]),
            1: build_blocked_indices(game.hands[1], self.opp_summary[1]),
        }
        self._pending_regret: Dict[int, Dict[str, List[List[float]]]] = {0: {}, 1: {}}

    def _get_infoset(self, player: int, state: RiverState) -> Tuple[str, VectorInfoSet]:
        key = self.game.infoset_key(state, player)
        infoset = self.infosets[player].get(key)
        if infoset is None:
            actions = self.game.legal_actions(state)
            infoset = VectorInfoSet(self.num_hands[player], actions)
            self.infosets[player][key] = infoset
        return key, infoset

    def _accumulate_regret(self, player: int, key: str, infoset: VectorInfoSet, deltas: List[List[float]]) -> None:
        if not self.config.use_plus:
            for h_idx in range(self.num_hands[player]):
                row = infoset.regret_sum[h_idx]
                delta_row = deltas[h_idx]
                for a_idx, delta in enumerate(delta_row):
                    row[a_idx] += delta
            infoset.mark_dirty()
            return

        pending = self._pending_regret[player].get(key)
        if pending is None:
            pending = [[0.0 for _ in infoset.actions] for _ in range(self.num_hands[player])]
        for h_idx in range(self.num_hands[player]):
            row = pending[h_idx]
            delta_row = deltas[h_idx]
            for a_idx, delta in enumerate(delta_row):
                row[a_idx] += delta
        self._pending_regret[player][key] = pending

    def _apply_regret_updates(self, player: int) -> None:
        if not self.config.use_plus:
            return
        for key, deltas in self._pending_regret[player].items():
            infoset = self.infosets[player][key]
            for h_idx in range(self.num_hands[player]):
                row = infoset.regret_sum[h_idx]
                delta_row = deltas[h_idx]
                for a_idx, delta in enumerate(delta_row):
                    row[a_idx] = max(0.0, row[a_idx] + delta)
            infoset.mark_dirty()
        self._pending_regret[player].clear()

    def _terminal_values(
        self,
        state: RiverState,
        update_player: int,
        opp_weights: List[float],
    ) -> List[float]:
        summary = self.opp_summary[update_player]
        pot_total = self.game.pot_total(state)
        contrib_player = state.contrib[update_player]
        if state.terminal_winner is not None:
            if state.terminal_winner == update_player:
                return fold_values(pot_total - contrib_player, self.blocked_indices[update_player], opp_weights)
            return fold_values(-contrib_player, self.blocked_indices[update_player], opp_weights)

        if self.config.use_naive_eval:
            # O(N^2) fallback for debugging.
            return showdown_values_naive(
                self.game.hands[update_player],
                self.game.hands[1 - update_player],
                opp_weights,
                pot_total,
                contrib_player,
            )
        # Vector-form showdown eval uses sorted strengths and prefix sums.
        return showdown_values(
            self.game.hands[update_player],
            summary,
            self.blocked_indices[update_player],
            opp_weights,
            pot_total,
            contrib_player,
        )

    def _traverse(
        self,
        state: RiverState,
        update_player: int,
        reach_p: List[float],
        reach_opp: List[float],
    ) -> List[float]:
        if self.game.is_terminal(state):
            return self._terminal_values(state, update_player, reach_opp)

        player = self.game.current_player(state)
        if player != update_player:
            key, infoset = self._get_infoset(player, state)
            strategy = infoset.current_strategy()
            actions = infoset.actions
            values = [0.0 for _ in range(self.num_hands[update_player])]
            for a_idx, action in enumerate(actions):
                # Opponent branch: propagate their reach through their strategy.
                next_reach_opp = [reach_opp[h] * strategy[h][a_idx] for h in range(self.num_hands[player])]
                child_values = self._traverse(
                    self.game.next_state(state, action),
                    update_player,
                    reach_p,
                    next_reach_opp,
                )
                for h_idx, value in enumerate(child_values):
                    values[h_idx] += value
            return values

        key, infoset = self._get_infoset(player, state)
        if self.config.use_dcfr:
            infoset.apply_dcfr_discount(
                self.iteration,
                self.config.dcfr_alpha,
                self.config.dcfr_beta,
                self.config.dcfr_gamma,
            )
        strategy = infoset.current_strategy()
        actions = infoset.actions
        action_values: List[List[float]] = []
        for a_idx, action in enumerate(actions):
            next_reach_p = [reach_p[h] * strategy[h][a_idx] for h in range(self.num_hands[player])]
            child_values = self._traverse(
                self.game.next_state(state, action),
                update_player,
                next_reach_p,
                reach_opp,
            )
            action_values.append(child_values)

        node_values = [0.0 for _ in range(self.num_hands[player])]
        for h_idx in range(self.num_hands[player]):
            value = 0.0
            for a_idx in range(len(actions)):
                value += strategy[h_idx][a_idx] * action_values[a_idx][h_idx]
            node_values[h_idx] = value

        deltas = []
        # Regret deltas are computed per hand/action for the updating player.
        regret_weight = (
            float(self.iteration)
            if self.config.linear_weighting and not self.config.use_plus and not self.config.use_dcfr
            else 1.0
        )
        for h_idx in range(self.num_hands[player]):
            row = []
            for a_idx in range(len(actions)):
                row.append((action_values[a_idx][h_idx] - node_values[h_idx]) * regret_weight)
            deltas.append(row)
        self._accumulate_regret(player, key, infoset, deltas)

        weight_scale = (
            float(self.iteration) if self.config.linear_weighting and not self.config.use_dcfr else 1.0
        )
        for h_idx in range(self.num_hands[player]):
            weight = reach_p[h_idx] * weight_scale
            if weight == 0.0:
                continue
            row = infoset.strategy_sum[h_idx]
            strat_row = strategy[h_idx]
            for a_idx in range(len(actions)):
                row[a_idx] += weight * strat_row[a_idx]

        return node_values

    def run(self, iterations: int) -> None:
        for _ in range(iterations):
            self.iteration += 1
            root = self.game.initial_state()
            if self.config.alternating:
                for player in (0, 1):
                    self._pending_regret[player].clear()
                    reach_p = list(self.hand_weights[player])
                    reach_opp = list(self.hand_weights[1 - player])
                    self._traverse(root, player, reach_p, reach_opp)
                    self._apply_regret_updates(player)
            else:
                for player in (0, 1):
                    self._pending_regret[player].clear()
                for player in (0, 1):
                    reach_p = list(self.hand_weights[player])
                    reach_opp = list(self.hand_weights[1 - player])
                    self._traverse(root, player, reach_p, reach_opp)
                for player in (0, 1):
                    self._apply_regret_updates(player)

    def average_strategy_profile(self) -> Dict[int, Dict[str, Tuple[List[str], List[List[float]]]]]:
        profile: Dict[int, Dict[str, Tuple[List[str], List[List[float]]]]] = {0: {}, 1: {}}
        for player in (0, 1):
            for key, infoset in self.infosets[player].items():
                avg = infoset.average_strategy()
                profile[player][key] = (infoset.action_tokens, avg)
        return profile
