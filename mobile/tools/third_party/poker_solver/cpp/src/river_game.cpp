#include "river_game.h"

#include <algorithm>
#include <cmath>
#include <numeric>
#include <stdexcept>

namespace {
struct State {
    int player = 0;
    int terminal_winner = -1;
    int checks = 0;
    int raises = 0;
    int contrib0 = 0;
    int contrib1 = 0;
};

State initial_state() {
    State state;
    return state;
}

bool is_terminal(const State &state) {
    return state.player == -1;
}

int pot_total(const State &state, int base_pot) {
    return base_pot + state.contrib0 + state.contrib1;
}

std::vector<Action> legal_actions(const State &state,
                                  int base_pot,
                                  int stack,
                                  const std::vector<double> &bet_sizes,
                                  bool include_all_in,
                                  int max_raises) {
    if (is_terminal(state)) {
        return {};
    }

    int player = state.player;
    int contrib_player = (player == 0) ? state.contrib0 : state.contrib1;
    int to_call = std::max(state.contrib0, state.contrib1) - contrib_player;
    int remaining = stack - contrib_player;
    int pot = pot_total(state, base_pot);

    std::vector<Action> actions;
    if (to_call == 0) {
        // No bet to call: check or bet sizing options.
        actions.push_back({'c', 0});
        std::vector<int> amounts;
        amounts.reserve(bet_sizes.size() + 1);
        for (double size : bet_sizes) {
            int bet_amount = static_cast<int>(std::round(pot * size));
            if (bet_amount <= 0) {
                continue;
            }
            bet_amount = std::min(bet_amount, remaining);
            if (bet_amount > 0) {
                amounts.push_back(bet_amount);
            }
        }
        if (include_all_in && remaining > 0) {
            amounts.push_back(remaining);
        }
        std::sort(amounts.begin(), amounts.end());
        amounts.erase(std::unique(amounts.begin(), amounts.end()), amounts.end());
        for (int amount : amounts) {
            actions.push_back({'b', amount});
        }
        return actions;
    }

    actions.push_back({'c', to_call});
    actions.push_back({'f', 0});
    if (state.raises >= max_raises) {
        return actions;
    }

    int pot_after_call = pot + to_call;
    std::vector<int> amounts;
    amounts.reserve(bet_sizes.size() + 1);
    for (double size : bet_sizes) {
        // Raise amount is sized off pot-after-call and is the extra beyond the call.
        int raise_amount = static_cast<int>(std::round(pot_after_call * size));
        if (raise_amount <= 0) {
            continue;
        }
        int total_add = to_call + raise_amount;
        if (total_add > remaining) {
            total_add = remaining;
            raise_amount = total_add - to_call;
        }
        if (raise_amount > 0 && total_add > to_call) {
            amounts.push_back(raise_amount);
        }
    }
    if (include_all_in && remaining > to_call) {
        amounts.push_back(remaining - to_call);
    }
    std::sort(amounts.begin(), amounts.end());
    amounts.erase(std::unique(amounts.begin(), amounts.end()), amounts.end());
    for (int amount : amounts) {
        actions.push_back({'r', amount});
    }
    return actions;
}

State next_state(const State &state, const Action &action) {
    State next = state;
    int player = state.player;
    int to_call = std::max(state.contrib0, state.contrib1) - ((player == 0) ? state.contrib0 : state.contrib1);

    if (action.label == 'f') {
        next.player = -1;
        next.terminal_winner = 1 - player;
        return next;
    }

    if (action.label == 'c') {
        if (to_call == 0) {
            next.checks += 1;
            if (next.checks >= 2) {
                next.player = -1;
                next.terminal_winner = -1;
                return next;
            }
            next.player = 1 - player;
            return next;
        }
        if (player == 0) {
            next.contrib0 += to_call;
        } else {
            next.contrib1 += to_call;
        }
        next.player = -1;
        next.terminal_winner = -1;
        return next;
    }

    int amount = action.amount;
    int add_amount = amount;
    if (action.label == 'r') {
        // Raises add the call plus the extra raise amount.
        add_amount = to_call + amount;
    }
    if (player == 0) {
        next.contrib0 += add_amount;
    } else {
        next.contrib1 += add_amount;
    }
    next.raises += 1;
    next.checks = 0;
    next.player = 1 - player;
    next.terminal_winner = -1;
    return next;
}

std::vector<std::array<int, 2>> all_hole_cards(const std::vector<int> &exclude) {
    std::vector<int> deck;
    deck.reserve(52);
    std::vector<bool> blocked(52, false);
    for (int card : exclude) {
        blocked[card] = true;
    }
    for (int card = 0; card < 52; ++card) {
        if (!blocked[card]) {
            deck.push_back(card);
        }
    }
    std::vector<std::array<int, 2>> hands;
    for (std::size_t i = 0; i < deck.size(); ++i) {
        for (std::size_t j = i + 1; j < deck.size(); ++j) {
            int c1 = deck[i];
            int c2 = deck[j];
            if (c1 < c2) {
                hands.push_back({c1, c2});
            } else {
                hands.push_back({c2, c1});
            }
        }
    }
    return hands;
}
}

RiverGame::RiverGame(const RiverConfig &config) {
    if (config.board_cards.size() != 5) {
        throw std::runtime_error("River game requires 5 board cards");
    }
    base_pot = config.pot;
    stack = config.stack;
    board_cards = config.board_cards;
    bet_sizes = config.bet_sizes;
    include_all_in = config.include_all_in;
    max_raises = config.max_raises;

    for (int player = 0; player < 2; ++player) {
        hands[player] = build_hands(config.ranges[player], config.range_weights[player]);
        double total = 0.0;
        for (const auto &hand : hands[player]) {
            total += hand.weight;
        }
        hand_weights[player].assign(hands[player].size(), 0.0);
        if (total > 0.0) {
            for (std::size_t i = 0; i < hands[player].size(); ++i) {
                hand_weights[player][i] = hands[player][i].weight / total;
            }
        }
    }
}

std::vector<Hand> RiverGame::build_hands(const std::vector<std::array<int, 2>> &hole_cards,
                                        const std::vector<double> &weights) const {
    std::vector<std::array<int, 2>> cards = hole_cards;
    if (cards.empty()) {
        cards = all_hole_cards(board_cards);
    }
    std::vector<double> use_weights = weights;
    if (!use_weights.empty() && use_weights.size() != cards.size()) {
        throw std::runtime_error("Weights must match number of hands");
    }
    if (use_weights.empty()) {
        use_weights.assign(cards.size(), 1.0);
    }

    std::vector<Hand> built;
    built.reserve(cards.size());
    for (std::size_t i = 0; i < cards.size(); ++i) {
        const auto &hand_cards = cards[i];
        bool blocked = false;
        for (int card : board_cards) {
            if (card == hand_cards[0] || card == hand_cards[1]) {
                blocked = true;
                break;
            }
        }
        if (blocked) {
            continue;
        }
        double weight = use_weights[i];
        if (weight <= 0.0) {
            continue;
        }
        std::array<int, 7> full_cards{{hand_cards[0], hand_cards[1], board_cards[0], board_cards[1], board_cards[2],
                                       board_cards[3], board_cards[4]}};
        Strength strength = evaluate_7(full_cards);
        built.push_back(Hand{hand_cards, weight, strength});
    }
    return built;
}

Tree RiverGame::build_tree() const {
    Tree tree;
    tree.nodes.reserve(512);
    std::vector<State> states;
    std::vector<int> depths;
    states.reserve(512);
    depths.reserve(512);

    State root_state = initial_state();
    tree.nodes.push_back(TreeNode{root_state.player, root_state.terminal_winner, root_state.contrib0,
                                  root_state.contrib1, 0, {}});
    states.push_back(root_state);
    depths.push_back(0);

    std::size_t index = 0;
    int max_depth = 0;
    int max_actions = 0;
    while (index < states.size()) {
        State state = states[index];
        tree.nodes[index].player = state.player;
        tree.nodes[index].terminal_winner = state.terminal_winner;
        tree.nodes[index].contrib0 = state.contrib0;
        tree.nodes[index].contrib1 = state.contrib1;

        max_depth = std::max(max_depth, depths[index]);

        if (is_terminal(state)) {
            ++index;
            continue;
        }

        auto actions = legal_actions(state, base_pot, stack, bet_sizes, include_all_in, max_raises);
        tree.nodes[index].action_count = static_cast<int>(actions.size());
        tree.nodes[index].next.assign(actions.size(), -1);
        max_actions = std::max(max_actions, tree.nodes[index].action_count);

        for (std::size_t a_idx = 0; a_idx < actions.size(); ++a_idx) {
            State child_state = next_state(state, actions[a_idx]);
            int child_id = static_cast<int>(tree.nodes.size());
            tree.nodes[index].next[a_idx] = child_id;
            tree.nodes.push_back(TreeNode{child_state.player, child_state.terminal_winner, child_state.contrib0,
                                          child_state.contrib1, 0, {}});
            states.push_back(child_state);
            depths.push_back(depths[index] + 1);
        }
        ++index;
    }

    tree.max_depth = max_depth;
    tree.max_actions = max_actions;
    return tree;
}
