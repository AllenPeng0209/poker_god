from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Sequence, Tuple

from games.river_holdem import Action, Hand, RiverHoldemGame, RiverState


@dataclass
class StrengthSummary:
    hands: List[Hand]
    sorted_indices: List[int]
    strengths_sorted: List[Tuple[int, ...]]
    strength_ranges: Dict[Tuple[int, ...], Tuple[int, int]]
    card_to_indices: Dict[int, List[int]]


def build_strength_summary(hands: List[Hand]) -> StrengthSummary:
    # Precompute ordering and index ranges by hand strength for vector-form eval.
    sorted_indices = sorted(range(len(hands)), key=lambda i: hands[i].strength)
    strengths_sorted = [hands[i].strength for i in sorted_indices]
    strength_ranges: Dict[Tuple[int, ...], Tuple[int, int]] = {}
    start = 0
    while start < len(strengths_sorted):
        strength = strengths_sorted[start]
        end = start + 1
        while end < len(strengths_sorted) and strengths_sorted[end] == strength:
            end += 1
        strength_ranges[strength] = (start, end)
        start = end

    card_to_indices: Dict[int, List[int]] = {}
    for idx, hand in enumerate(hands):
        for card in hand.cards:
            card_to_indices.setdefault(card, []).append(idx)

    return StrengthSummary(
        hands=hands,
        sorted_indices=sorted_indices,
        strengths_sorted=strengths_sorted,
        strength_ranges=strength_ranges,
        card_to_indices=card_to_indices,
    )


def build_blocked_indices(
    player_hands: Sequence[Hand],
    opp_summary: StrengthSummary,
) -> List[List[int]]:
    # For each player hand, list opponent hand indices that share a card.
    blocked_indices = []
    opp_count = len(opp_summary.hands)
    seen = [0 for _ in range(opp_count)]
    stamp = 1
    for hand in player_hands:
        indices: List[int] = []
        for card in hand.cards:
            for idx in opp_summary.card_to_indices.get(card, []):
                if seen[idx] != stamp:
                    seen[idx] = stamp
                    indices.append(idx)
        blocked_indices.append(indices)
        stamp += 1
    return blocked_indices


def valid_opp_weights(
    blocked_indices: Sequence[Sequence[int]],
    opp_weights: Sequence[float],
) -> List[float]:
    total = sum(opp_weights)
    if total <= 0.0:
        return [0.0 for _ in blocked_indices]
    values: List[float] = []
    for blocked in blocked_indices:
        blocked_weight = 0.0
        for idx in blocked:
            blocked_weight += opp_weights[idx]
        values.append(total - blocked_weight)
    return values


def showdown_values(
    player_hands: List[Hand],
    opp_summary: StrengthSummary,
    blocked_indices: Sequence[Sequence[int]],
    opp_weights: Sequence[float],
    pot_total: float,
    contrib_player: float,
) -> List[float]:
    # Compute expected showdown value using sorted opponent strengths + prefix sums.
    total_opp_weight = sum(opp_weights)
    if total_opp_weight <= 0.0:
        return [0.0 for _ in player_hands]

    weights_sorted = [opp_weights[i] for i in opp_summary.sorted_indices]
    prefix = [0.0]
    for weight in weights_sorted:
        prefix.append(prefix[-1] + weight)

    values = []
    for h_idx, hand in enumerate(player_hands):
        start, end = opp_summary.strength_ranges[hand.strength]
        win_weight = prefix[start]
        tie_weight = prefix[end] - prefix[start]
        lose_weight = total_opp_weight - win_weight - tie_weight

        for idx in blocked_indices[h_idx]:
            weight = opp_weights[idx]
            if weight == 0.0:
                continue
            opp_strength = opp_summary.hands[idx].strength
            if opp_strength < hand.strength:
                win_weight -= weight
            elif opp_strength > hand.strength:
                lose_weight -= weight
            else:
                tie_weight -= weight

        value = win_weight * pot_total + tie_weight * (pot_total / 2.0) - contrib_player * (
            win_weight + tie_weight + lose_weight
        )
        values.append(value)
    return values


def fold_values(
    value: float,
    blocked_indices: Sequence[Sequence[int]],
    opp_weights: Sequence[float],
) -> List[float]:
    total = sum(opp_weights)
    if total <= 0.0:
        return [0.0 for _ in blocked_indices]
    values = []
    for blocked in blocked_indices:
        blocked_weight = 0.0
        for idx in blocked:
            blocked_weight += opp_weights[idx]
        values.append(value * (total - blocked_weight))
    return values


def uniform_strategy(num_hands: int, num_actions: int) -> List[List[float]]:
    if num_actions <= 0:
        return []
    prob = 1.0 / num_actions
    return [[prob for _ in range(num_actions)] for _ in range(num_hands)]


def action_tokens(actions: Sequence[Action]) -> List[str]:
    tokens = []
    for action in actions:
        if action.label in ("c", "f"):
            tokens.append(action.label)
        else:
            tokens.append(f"{action.label}{action.amount}")
    return tokens


def profile_strategy(
    game: RiverHoldemGame,
    profile: Dict[str, Tuple[List[str], List[List[float]]]],
    state: RiverState,
    player: int,
    num_hands: int,
) -> List[List[float]]:
    actions = game.legal_actions(state)
    tokens = action_tokens(actions)
    key = game.infoset_key(state, player)
    entry = profile.get(key)
    if entry is None:
        return uniform_strategy(num_hands, len(actions))
    stored_tokens, matrix = entry
    if stored_tokens == tokens:
        return matrix
    # Action sets can differ by betting options; remap to current ordering.
    index_map = {token: idx for idx, token in enumerate(stored_tokens)}
    reordered = []
    for row in matrix:
        reordered.append([row[index_map[token]] for token in tokens])
    return reordered


def best_response(
    game: RiverHoldemGame,
    target_player: int,
    opponent_profile: Dict[str, Tuple[List[str], List[List[float]]]],
    opp_summary: StrengthSummary,
    blocked_indices: Sequence[Sequence[int]] | None = None,
) -> Tuple[List[float], Dict[str, Tuple[List[str], List[List[float]]]]]:
    num_target = len(game.hands[target_player])
    num_opp = len(game.hands[1 - target_player])
    if blocked_indices is None:
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
            return showdown_values(
                game.hands[target_player],
                opp_summary,
                blocked_indices,
                reach_opp,
                pot_total,
                contrib,
            )

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


def best_response_value(
    game: RiverHoldemGame,
    target_player: int,
    opponent_profile: Dict[str, Tuple[List[str], List[List[float]]]],
    opp_summary: StrengthSummary,
    blocked_indices: Sequence[Sequence[int]] | None = None,
) -> float:
    values, _ = best_response(game, target_player, opponent_profile, opp_summary, blocked_indices)
    weights = game.hand_weights[target_player]
    if blocked_indices is None:
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


def exploitability(
    game: RiverHoldemGame,
    profile: Dict[int, Dict[str, Tuple[List[str], List[List[float]]]]],
    summaries: Dict[int, StrengthSummary],
    blocked_indices: Dict[int, List[List[int]]] | None = None,
) -> float:
    if blocked_indices is None:
        blocked_indices = {
            0: build_blocked_indices(game.hands[0], summaries[0]),
            1: build_blocked_indices(game.hands[1], summaries[1]),
        }
    br0 = best_response_value(game, 0, profile[1], summaries[0], blocked_indices[0])
    br1 = best_response_value(game, 1, profile[0], summaries[1], blocked_indices[1])
    return (br0 + br1 - float(game.base_pot)) / 2.0
