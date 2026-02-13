from __future__ import annotations

from typing import Dict, List, Sequence, Tuple

from algorithms.vector_eval import (
    action_tokens,
    build_blocked_indices,
    build_strength_summary,
    fold_values,
    profile_strategy,
    valid_opp_weights,
)
from games.river_holdem import Action, Hand, RiverHoldemGame, RiverState


def showdown_values_naive(
    player_hands: Sequence[Hand],
    opp_hands: Sequence[Hand],
    opp_weights: Sequence[float],
    pot_total: float,
    contrib_player: float,
) -> List[float]:
    # O(N^2) evaluator over all opponent hands; used for debugging.
    values: List[float] = []
    for hand in player_hands:
        c1, c2 = hand.cards
        value = 0.0
        for opp_hand, weight in zip(opp_hands, opp_weights):
            if weight == 0.0:
                continue
            o1, o2 = opp_hand.cards
            if c1 == o1 or c1 == o2 or c2 == o1 or c2 == o2:
                continue
            if hand.strength > opp_hand.strength:
                payoff = pot_total - contrib_player
            elif hand.strength < opp_hand.strength:
                payoff = -contrib_player
            else:
                payoff = pot_total / 2.0 - contrib_player
            value += weight * payoff
        values.append(value)
    return values


def best_response_naive(
    game: RiverHoldemGame,
    target_player: int,
    opponent_profile: Dict[str, Tuple[List[str], List[List[float]]]],
) -> Tuple[List[float], Dict[str, Tuple[List[str], List[List[float]]]]]:
    num_target = len(game.hands[target_player])
    num_opp = len(game.hands[1 - target_player])
    opp_hands = game.hands[1 - target_player]
    opp_summary = build_strength_summary(opp_hands)
    blocked_indices = build_blocked_indices(game.hands[target_player], opp_summary)
    valid_weights = valid_opp_weights(blocked_indices, game.hand_weights[1 - target_player])

    br_policy: Dict[str, Tuple[List[str], List[List[float]]]] = {}

    def traverse(state: RiverState, reach_opp: List[float]) -> List[float]:
        if game.is_terminal(state):
            pot_total = game.pot_total(state)
            contrib = state.contrib[target_player]
            if state.terminal_winner is not None:
                if state.terminal_winner == target_player:
                    return fold_values(pot_total - contrib, blocked_indices, reach_opp)
                return fold_values(-contrib, blocked_indices, reach_opp)
            return showdown_values_naive(game.hands[target_player], opp_hands, reach_opp, pot_total, contrib)

        player = game.current_player(state)
        if player != target_player:
            strategy = profile_strategy(game, opponent_profile, state, player, num_opp)
            actions = game.legal_actions(state)
            values = [0.0 for _ in range(num_target)]
            for a_idx, action in enumerate(actions):
                next_reach_opp = [reach_opp[h] * strategy[h][a_idx] for h in range(num_opp)]
                child_values = traverse(game.next_state(state, action), next_reach_opp)
                for h_idx, value in enumerate(child_values):
                    values[h_idx] += value
            return values

        actions = game.legal_actions(state)
        action_vals = []
        for action in actions:
            action_vals.append(traverse(game.next_state(state, action), reach_opp))

        best_values = [0.0 for _ in range(num_target)]
        br_matrix = []
        for h_idx in range(num_target):
            # Pure best-response per hand.
            best_idx = 0
            best_val = action_vals[0][h_idx]
            for a_idx in range(1, len(actions)):
                value = action_vals[a_idx][h_idx]
                if value > best_val:
                    best_val = value
                    best_idx = a_idx
            row = [0.0 for _ in range(len(actions))]
            row[best_idx] = 1.0
            br_matrix.append(row)
            best_values[h_idx] = best_val
        br_policy[game.infoset_key(state, target_player)] = (action_tokens(actions), br_matrix)
        return best_values

    root = game.initial_state()
    values = traverse(root, list(game.hand_weights[1 - target_player]))
    for h_idx, denom in enumerate(valid_weights):
        if denom > 0.0:
            values[h_idx] /= denom
        else:
            values[h_idx] = 0.0
    return values, br_policy


def best_response_value_naive(
    game: RiverHoldemGame,
    target_player: int,
    opponent_profile: Dict[str, Tuple[List[str], List[List[float]]]],
) -> float:
    values, _ = best_response_naive(game, target_player, opponent_profile)
    weights = game.hand_weights[target_player]
    opp_summary = build_strength_summary(game.hands[1 - target_player])
    blocked_indices = build_blocked_indices(game.hands[target_player], opp_summary)
    valid_weights = valid_opp_weights(blocked_indices, game.hand_weights[1 - target_player])
    total = 0.0
    total_weight = 0.0
    for weight, valid_weight, value in zip(weights, valid_weights, values):
        joint = weight * valid_weight
        total += joint * value
        total_weight += joint
    if total_weight <= 0.0:
        return 0.0
    return total / total_weight


def exploitability_naive(
    game: RiverHoldemGame,
    profile: Dict[int, Dict[str, Tuple[List[str], List[List[float]]]]],
) -> float:
    br0 = best_response_value_naive(game, 0, profile[1])
    br1 = best_response_value_naive(game, 1, profile[0])
    return (br0 + br1 - float(game.base_pot)) / 2.0
