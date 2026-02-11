from __future__ import annotations

from typing import Dict, List


def _strategy_for_state(game, profile: Dict[str, Dict[str, float]], state, player: int) -> List[float]:
    key = game.infoset_key(state, player)
    actions = game.legal_actions(state)
    if key not in profile:
        return [1.0 / len(actions) for _ in actions]
    action_probs = profile[key]
    return [action_probs[action] for action in actions]


def expected_value(game, profile: Dict[str, Dict[str, float]]) -> float:
    def _ev(state) -> float:
        if game.is_terminal(state):
            return game.terminal_utility(state, 0)
        if game.current_player(state) == -1:
            # Chance node: average over outcomes.
            value = 0.0
            for outcome, prob in game.chance_outcomes(state):
                value += prob * _ev(game.next_state(state, outcome))
            return value
        player = game.current_player(state)
        actions = game.legal_actions(state)
        probs = _strategy_for_state(game, profile, state, player)
        value = 0.0
        for action, prob in zip(actions, probs):
            value += prob * _ev(game.next_state(state, action))
        return value

    return _ev(game.initial_state())


def _compute_best_response(game, profile: Dict[str, Dict[str, float]], br_player: int):
    state_reach = {}
    infoset_states: Dict[str, List] = {}
    infoset_actions: Dict[str, List[str]] = {}

    def collect(state, reach_opp: float) -> None:
        state_reach[state] = reach_opp
        if game.is_terminal(state):
            return
        if game.current_player(state) == -1:
            for outcome, prob in game.chance_outcomes(state):
                collect(game.next_state(state, outcome), reach_opp * prob)
            return
        player = game.current_player(state)
        actions = game.legal_actions(state)
        if player == br_player:
            # Group states by infoset to compute a single best action per infoset.
            key = game.infoset_key(state, player)
            infoset_states.setdefault(key, []).append(state)
            infoset_actions.setdefault(key, actions)
            for action in actions:
                collect(game.next_state(state, action), reach_opp)
        else:
            probs = _strategy_for_state(game, profile, state, player)
            for action, prob in zip(actions, probs):
                collect(game.next_state(state, action), reach_opp * prob)

    collect(game.initial_state(), 1.0)

    value_cache = {}
    action_cache: Dict[str, str] = {}

    def best_action(key: str) -> str:
        if key in action_cache:
            return action_cache[key]
        actions = infoset_actions[key]
        totals = [0.0 for _ in actions]
        for state in infoset_states[key]:
            for idx, action in enumerate(actions):
                next_state = game.next_state(state, action)
                # Weight by opponent reach to the state.
                totals[idx] += state_reach[state] * state_value(next_state)
        best_idx = max(range(len(actions)), key=lambda i: totals[i])
        action_cache[key] = actions[best_idx]
        return action_cache[key]

    def state_value(state) -> float:
        cached = value_cache.get(state)
        if cached is not None:
            return cached
        if game.is_terminal(state):
            value = game.terminal_utility(state, br_player)
        elif game.current_player(state) == -1:
            value = 0.0
            for outcome, prob in game.chance_outcomes(state):
                value += prob * state_value(game.next_state(state, outcome))
        else:
            player = game.current_player(state)
            actions = game.legal_actions(state)
            if player == br_player:
                key = game.infoset_key(state, player)
                action = best_action(key)
                value = state_value(game.next_state(state, action))
            else:
                probs = _strategy_for_state(game, profile, state, player)
                value = 0.0
                for action, prob in zip(actions, probs):
                    value += prob * state_value(game.next_state(state, action))
        value_cache[state] = value
        return value

    value = state_value(game.initial_state())
    return value, action_cache, infoset_actions


def best_response_value(game, profile: Dict[str, Dict[str, float]], br_player: int) -> float:
    value, _, _ = _compute_best_response(game, profile, br_player)
    return value


def best_response_strategy(game, profile: Dict[str, Dict[str, float]], br_player: int):
    _, action_cache, infoset_actions = _compute_best_response(game, profile, br_player)
    strategy = {}
    for key, actions in infoset_actions.items():
        chosen = action_cache.get(key, actions[0])
        probs = [1.0 if action == chosen else 0.0 for action in actions]
        strategy[key] = (actions, probs)
    return strategy


def exploitability(game, profile: Dict[str, Dict[str, float]]) -> float:
    br0 = best_response_value(game, profile, 0)
    br1 = best_response_value(game, profile, 1)
    return 0.5 * (br0 + br1)
