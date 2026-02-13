#include "mccfr.h"

#include <algorithm>

namespace {
constexpr double kUniformEpsilon = 1e-12;
}

MCCFRTrainer::FastRng::FastRng(std::uint64_t seed) : state_(seed ? seed : 0x9e3779b97f4a7c15ULL) {}

double MCCFRTrainer::FastRng::next_double() {
    state_ ^= state_ >> 12U;
    state_ ^= state_ << 25U;
    state_ ^= state_ >> 27U;
    std::uint64_t result = state_ * 2685821657736338717ULL;
    return static_cast<double>(result >> 11) * (1.0 / 9007199254740992.0);
}

MCCFRTrainer::MCCFRTrainer(const RiverGame &game, const Tree &tree, std::uint64_t seed, bool linear_weighting)
    : game_(game), tree_(tree), evaluator_(game.hands), rng_(seed), linear_weighting_(linear_weighting) {
    num_hands_[0] = static_cast<int>(game.hands[0].size());
    num_hands_[1] = static_cast<int>(game.hands[1].size());

    for (int player = 0; player < 2; ++player) {
        node_info_[player].resize(tree_.nodes.size());
        std::size_t total = 0;
        std::size_t hand_total = 0;
        for (std::size_t node_id = 0; node_id < tree_.nodes.size(); ++node_id) {
            if (tree_.nodes[node_id].player != player) {
                continue;
            }
            NodeInfo info;
            info.action_count = tree_.nodes[node_id].action_count;
            info.offset = total;
            info.hand_offset = hand_total;
            info.valid = true;
            node_info_[player][node_id] = info;
            total += static_cast<std::size_t>(info.action_count) * static_cast<std::size_t>(num_hands_[player]);
            hand_total += static_cast<std::size_t>(num_hands_[player]);
        }
        regret_[player].assign(total, 0.0);
        strategy_sum_[player].assign(total, 0.0);
        hand_last_update_[player].assign(hand_total, 0);
    }

    int depth = std::max(1, tree_.max_depth + 2);
    int max_actions = std::max(1, tree_.max_actions);
    train_scratch_.resize(depth);
    for (auto &scratch : train_scratch_) {
        scratch.strategy.assign(max_actions, 0.0);
        scratch.util.assign(max_actions, 0.0);
    }

    int max_hands = std::max(num_hands_[0], num_hands_[1]);
    eval_scratch_.resize(depth);
    for (auto &scratch : eval_scratch_) {
        scratch.values.assign(max_hands, 0.0);
        scratch.next_reach.assign(max_hands, 0.0);
        scratch.action_values.assign(max_hands * max_actions, 0.0);
        scratch.hand_norm.assign(max_hands, 0.0);
    }

    build_sampling_cache();
}

bool MCCFRTrainer::has_infoset(int player, int node_id) const {
    if (player < 0 || player > 1) {
        return false;
    }
    if (node_id < 0 || node_id >= static_cast<int>(node_info_[player].size())) {
        return false;
    }
    return node_info_[player][node_id].valid && node_info_[player][node_id].action_count > 0;
}

int MCCFRTrainer::infoset_action_count(int player, int node_id) const {
    if (!has_infoset(player, node_id)) {
        return 0;
    }
    return node_info_[player][node_id].action_count;
}

int MCCFRTrainer::infoset_hand_count(int player) const {
    if (player < 0 || player > 1) {
        return 0;
    }
    return num_hands_[player];
}

void MCCFRTrainer::average_strategy(int player, int node_id, std::vector<double> &out) const {
    if (!has_infoset(player, node_id)) {
        out.clear();
        return;
    }
    const NodeInfo &info = node_info_[player][node_id];
    int hand_count = num_hands_[player];
    int action_count = info.action_count;
    std::size_t total = static_cast<std::size_t>(hand_count) * static_cast<std::size_t>(action_count);
    out.assign(total, 0.0);
    for (int h = 0; h < hand_count; ++h) {
        std::size_t offset = info.offset + static_cast<std::size_t>(h) * action_count;
        double norm = 0.0;
        for (int a = 0; a < action_count; ++a) {
            norm += strategy_sum_[player][offset + a];
        }
        if (norm > 0.0) {
            for (int a = 0; a < action_count; ++a) {
                out[static_cast<std::size_t>(h) * action_count + a] = strategy_sum_[player][offset + a] / norm;
            }
        } else {
            double prob = 1.0 / static_cast<double>(action_count);
            for (int a = 0; a < action_count; ++a) {
                out[static_cast<std::size_t>(h) * action_count + a] = prob;
            }
        }
    }
}

void MCCFRTrainer::apply_linear_decay(int player, const NodeInfo &info, int hand_index) {
    if (!linear_weighting_) {
        return;
    }
    std::int64_t last = hand_last_update_[player][info.hand_offset + static_cast<std::size_t>(hand_index)];
    if (last == iteration_) {
        return;
    }
    if (last > 0) {
        // Rescale regrets/strategy sums to achieve linear weighting without overflow.
        double last_scale = static_cast<double>(last) * static_cast<double>(last + 1);
        double current_scale = static_cast<double>(iteration_) * static_cast<double>(iteration_ + 1);
        double factor = last_scale / current_scale;
        std::size_t offset = info.offset + static_cast<std::size_t>(hand_index) * info.action_count;
        for (int a = 0; a < info.action_count; ++a) {
            regret_[player][offset + a] *= factor;
            strategy_sum_[player][offset + a] *= factor;
        }
    }
    hand_last_update_[player][info.hand_offset + static_cast<std::size_t>(hand_index)] = iteration_;
}

void MCCFRTrainer::build_sampling_cache() {
    const auto &p0_weights = game_.hand_weights[0];
    const auto &p1_weights = game_.hand_weights[1];

    p1_indices_.assign(num_hands_[0], {});
    p1_prefix_.assign(num_hands_[0], {});
    p1_total_.assign(num_hands_[0], 0.0);

    std::vector<double> p0_weights_adjusted(num_hands_[0], 0.0);
    for (int i = 0; i < num_hands_[0]; ++i) {
        const auto &p0_hand = game_.hands[0][i];
        auto &indices = p1_indices_[i];
        auto &prefix = p1_prefix_[i];
        double total = 0.0;
        indices.reserve(num_hands_[1]);
        prefix.reserve(num_hands_[1]);
        for (int j = 0; j < num_hands_[1]; ++j) {
            const auto &p1_hand = game_.hands[1][j];
            if (p1_hand.cards[0] == p0_hand.cards[0] || p1_hand.cards[0] == p0_hand.cards[1] ||
                p1_hand.cards[1] == p0_hand.cards[0] || p1_hand.cards[1] == p0_hand.cards[1]) {
                continue;
            }
            double w = p1_weights[j];
            if (w <= 0.0) {
                continue;
            }
            total += w;
            indices.push_back(j);
            prefix.push_back(total);
        }
        p1_total_[i] = total;
        // Sample P0 proportional to its weight times valid P1 mass.
        p0_weights_adjusted[i] = p0_weights[i] * total;
    }

    p0_prefix_.assign(num_hands_[0], 0.0);
    double running = 0.0;
    for (int i = 0; i < num_hands_[0]; ++i) {
        running += p0_weights_adjusted[i];
        p0_prefix_[i] = running;
    }
    p0_total_ = running;
}

int MCCFRTrainer::sample_prefix(const std::vector<double> &prefix, double total) {
    if (total <= kUniformEpsilon || prefix.empty()) {
        return 0;
    }
    double r = rng_.next_double() * total;
    auto it = std::lower_bound(prefix.begin(), prefix.end(), r);
    if (it == prefix.end()) {
        return static_cast<int>(prefix.size() - 1);
    }
    return static_cast<int>(it - prefix.begin());
}

std::pair<int, int> MCCFRTrainer::sample_hands() {
    int p0_index = sample_prefix(p0_prefix_, p0_total_);
    double p1_total = p1_total_[p0_index];
    int p1_choice = sample_prefix(p1_prefix_[p0_index], p1_total);
    int p1_index = p1_indices_[p0_index].empty() ? 0 : p1_indices_[p0_index][p1_choice];
    return {p0_index, p1_index};
}

void MCCFRTrainer::strategy_for_hand(int player, int node_id, int hand_index, double *out_probs) const {
    const NodeInfo &info = node_info_[player][node_id];
    int action_count = info.action_count;
    std::size_t offset = info.offset + static_cast<std::size_t>(hand_index) * action_count;
    double normalizing = 0.0;
    for (int a = 0; a < action_count; ++a) {
        double r = regret_[player][offset + a];
        if (r > 0.0) {
            normalizing += r;
        }
    }
    if (normalizing > 0.0) {
        for (int a = 0; a < action_count; ++a) {
            double r = regret_[player][offset + a];
            out_probs[a] = (r > 0.0 ? r : 0.0) / normalizing;
        }
    } else {
        double prob = 1.0 / static_cast<double>(action_count);
        for (int a = 0; a < action_count; ++a) {
            out_probs[a] = prob;
        }
    }
}

double MCCFRTrainer::traverse(int node_id, int target_player, int p0_index, int p1_index, double reach, int depth) {
    const TreeNode &node = tree_.nodes[node_id];
    if (node.player == -1) {
        int pot = game_.base_pot + node.contrib0 + node.contrib1;
        int contrib = (target_player == 0) ? node.contrib0 : node.contrib1;
        if (node.terminal_winner >= 0) {
            if (node.terminal_winner == target_player) {
                return static_cast<double>(pot - contrib);
            }
            return static_cast<double>(-contrib);
        }
        const auto &p0_strength = game_.hands[0][p0_index].strength;
        const auto &p1_strength = game_.hands[1][p1_index].strength;
        if (p0_strength == p1_strength) {
            return static_cast<double>(pot / 2.0 - contrib);
        }
        bool p0_wins = p0_strength > p1_strength;
        if ((target_player == 0 && p0_wins) || (target_player == 1 && !p0_wins)) {
            return static_cast<double>(pot - contrib);
        }
        return static_cast<double>(-contrib);
    }

    int player = node.player;
    int hand_index = (player == 0) ? p0_index : p1_index;
    const NodeInfo &info = node_info_[player][node_id];
    int action_count = info.action_count;
    TrainScratch &scratch = train_scratch_[depth];

    strategy_for_hand(player, node_id, hand_index, scratch.strategy.data());

    if (player == target_player) {
        // Full update on target player, external sampling for opponent.
        apply_linear_decay(player, info, hand_index);
        double update_weight = linear_weighting_ ? (2.0 / (static_cast<double>(iteration_) + 1.0)) : 1.0;
        double node_util = 0.0;
        for (int a = 0; a < action_count; ++a) {
            double util = traverse(node.next[a], target_player, p0_index, p1_index, reach * scratch.strategy[a],
                                   depth + 1);
            scratch.util[a] = util;
            node_util += scratch.strategy[a] * util;
        }
        std::size_t offset = info.offset + static_cast<std::size_t>(hand_index) * action_count;
        for (int a = 0; a < action_count; ++a) {
            double delta = scratch.util[a] - node_util;
            regret_[player][offset + a] += update_weight * delta;
            strategy_sum_[player][offset + a] += update_weight * reach * scratch.strategy[a];
        }
        return node_util;
    }

    double r = rng_.next_double();
    double cumulative = 0.0;
    int chosen = action_count - 1;
    for (int a = 0; a < action_count; ++a) {
        cumulative += scratch.strategy[a];
        if (r <= cumulative) {
            chosen = a;
            break;
        }
    }
    // External sampling: follow one opponent action.
    return traverse(node.next[chosen], target_player, p0_index, p1_index, reach, depth + 1);
}

void MCCFRTrainer::run(std::int64_t iterations) {
    for (std::int64_t i = 0; i < iterations; ++i) {
        iteration_ += 1;
        auto hands = sample_hands();
        traverse(tree_.root, 0, hands.first, hands.second, 1.0, 0);
        traverse(tree_.root, 1, hands.first, hands.second, 1.0, 0);
    }
}

const double *MCCFRTrainer::best_response(int node_id,
                                          int target_player,
                                          const double *reach_opp,
                                          int depth) const {
    EvalScratchFrame &scratch = eval_scratch_[depth];
    const TreeNode &node = tree_.nodes[node_id];
    int target_hands = num_hands_[target_player];

    if (node.player == -1) {
        double pot = static_cast<double>(game_.base_pot + node.contrib0 + node.contrib1);
        double contrib = (target_player == 0) ? node.contrib0 : node.contrib1;
        if (node.terminal_winner >= 0) {
            if (node.terminal_winner == target_player) {
                evaluator_.fold_values(target_player, reach_opp, pot - contrib, scratch.values.data());
            } else {
                evaluator_.fold_values(target_player, reach_opp, -contrib, scratch.values.data());
            }
        } else {
            evaluator_.showdown_values(target_player, reach_opp, pot, contrib, scratch.values.data(),
                                       eval_terminal_scratch_);
        }
        return scratch.values.data();
    }

    int player = node.player;
    const NodeInfo &info = node_info_[player][node_id];
    int action_count = info.action_count;

    if (player != target_player) {
        int opp_hands = num_hands_[player];
        std::fill(scratch.values.begin(), scratch.values.begin() + target_hands, 0.0);
        for (int h = 0; h < opp_hands; ++h) {
            double sum = 0.0;
            std::size_t offset = info.offset + static_cast<std::size_t>(h) * action_count;
            for (int a = 0; a < action_count; ++a) {
                sum += strategy_sum_[player][offset + a];
            }
            scratch.hand_norm[h] = sum;
        }
        for (int a = 0; a < action_count; ++a) {
            for (int h = 0; h < opp_hands; ++h) {
                std::size_t offset = info.offset + static_cast<std::size_t>(h) * action_count;
                double prob = 1.0 / static_cast<double>(action_count);
                double norm = scratch.hand_norm[h];
                if (norm > 0.0) {
                    prob = strategy_sum_[player][offset + a] / norm;
                }
                scratch.next_reach[h] = reach_opp[h] * prob;
            }
            const double *child_values = best_response(node.next[a], target_player, scratch.next_reach.data(),
                                                       depth + 1);
            for (int h = 0; h < target_hands; ++h) {
                scratch.values[h] += child_values[h];
            }
        }
        return scratch.values.data();
    }

    double *action_values = scratch.action_values.data();
    for (int a = 0; a < action_count; ++a) {
        const double *child_values = best_response(node.next[a], target_player, reach_opp, depth + 1);
        std::copy(child_values, child_values + target_hands, action_values + a * target_hands);
    }

    for (int h = 0; h < target_hands; ++h) {
        double best_val = action_values[h];
        for (int a = 1; a < action_count; ++a) {
            double value = action_values[a * target_hands + h];
            if (value > best_val) {
                best_val = value;
            }
        }
        scratch.values[h] = best_val;
    }

    return scratch.values.data();
}

double MCCFRTrainer::best_response_value(int target_player) const {
    int opp = 1 - target_player;
    const double *reach_opp = game_.hand_weights[opp].data();
    const double *values = best_response(tree_.root, target_player, reach_opp, 0);

    std::vector<double> valid(num_hands_[target_player], 0.0);
    evaluator_.valid_opp_weights(target_player, reach_opp, valid.data());

    const double *weights = game_.hand_weights[target_player].data();
    double total = 0.0;
    double total_weight = 0.0;
    for (int h = 0; h < num_hands_[target_player]; ++h) {
        double joint = weights[h] * valid[h];
        if (valid[h] > 0.0) {
            total += joint * (values[h] / valid[h]);
        }
        total_weight += joint;
    }
    if (total_weight <= 0.0) {
        return 0.0;
    }
    return total / total_weight;
}

double MCCFRTrainer::exploitability() const {
    double br0 = best_response_value(0);
    double br1 = best_response_value(1);
    return (br0 + br1 - static_cast<double>(game_.base_pot)) / 2.0;
}
