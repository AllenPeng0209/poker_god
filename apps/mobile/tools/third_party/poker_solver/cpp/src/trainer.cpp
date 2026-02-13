#include "trainer.h"

#include <algorithm>
#include <cmath>

Trainer::Trainer(const RiverGame &game, const Tree &tree, Algorithm algo, DcfrParams dcfr)
    : game_(game), tree_(tree), evaluator_(game.hands), algo_(algo), dcfr_(dcfr) {
    num_hands_[0] = static_cast<int>(game.hands[0].size());
    num_hands_[1] = static_cast<int>(game.hands[1].size());
    hand_weights_ptr_[0] = game.hand_weights[0].data();
    hand_weights_ptr_[1] = game.hand_weights[1].data();

    infosets_.resize(tree_.nodes.size());
    for (std::size_t i = 0; i < tree_.nodes.size(); ++i) {
        const TreeNode &node = tree_.nodes[i];
        if (node.player < 0) {
            continue;
        }
        InfoSet &info = infosets_[i];
        info.action_count = node.action_count;
        info.hand_count = num_hands_[node.player];
        int total = info.hand_count * info.action_count;
        info.regret.assign(total, CFRScalar(0));
        info.strategy_sum.assign(total, CFRScalar(0));
    }

    int max_hands = std::max(num_hands_[0], num_hands_[1]);
    int max_actions = std::max(1, tree_.max_actions);
    int depth = std::max(1, tree_.max_depth + 2);
    scratch_.resize(depth);
    for (auto &frame : scratch_) {
        frame.values.assign(max_hands, 0.0);
        frame.strategy.assign(max_hands * max_actions, 0.0);
        frame.next_reach.assign(max_hands, 0.0);
        frame.action_values.assign(max_hands * max_actions, 0.0);
    }
}

bool Trainer::has_infoset(int node_id) const {
    if (node_id < 0 || node_id >= static_cast<int>(infosets_.size())) {
        return false;
    }
    const InfoSet &info = infosets_[node_id];
    return info.action_count > 0 && info.hand_count > 0;
}

int Trainer::infoset_action_count(int node_id) const {
    if (!has_infoset(node_id)) {
        return 0;
    }
    return infosets_[node_id].action_count;
}

int Trainer::infoset_hand_count(int node_id) const {
    if (!has_infoset(node_id)) {
        return 0;
    }
    return infosets_[node_id].hand_count;
}

void Trainer::average_strategy(int node_id, std::vector<double> &out) const {
    if (!has_infoset(node_id)) {
        out.clear();
        return;
    }
    const InfoSet &info = infosets_[node_id];
    int total = info.hand_count * info.action_count;
    out.assign(static_cast<std::size_t>(total), 0.0);
    compute_avg_strategy(info, out.data());
}

void Trainer::compute_strategy(const InfoSet &info, double *out_strategy) const {
    // Regret-matching over positive regrets per hand.
    int hand_count = info.hand_count;
    int action_count = info.action_count;
    const CFRScalar *regret = info.regret.data();
    for (int h = 0; h < hand_count; ++h) {
        double normalizing = 0.0;
        int offset = h * action_count;
        for (int a = 0; a < action_count; ++a) {
            double r = static_cast<double>(regret[offset + a]);
            if (r > 0.0) {
                normalizing += r;
            }
        }
        if (normalizing > 0.0) {
            for (int a = 0; a < action_count; ++a) {
                double r = static_cast<double>(regret[offset + a]);
                out_strategy[offset + a] = (r > 0.0 ? r : 0.0) / normalizing;
            }
        } else {
            double prob = 1.0 / static_cast<double>(action_count);
            for (int a = 0; a < action_count; ++a) {
                out_strategy[offset + a] = prob;
            }
        }
    }
}

void Trainer::compute_avg_strategy(const InfoSet &info, double *out_strategy) const {
    // Normalize cumulative strategy sums to get the average strategy.
    int hand_count = info.hand_count;
    int action_count = info.action_count;
    const CFRScalar *strategy_sum = info.strategy_sum.data();
    for (int h = 0; h < hand_count; ++h) {
        double normalizing = 0.0;
        int offset = h * action_count;
        for (int a = 0; a < action_count; ++a) {
            normalizing += static_cast<double>(strategy_sum[offset + a]);
        }
        if (normalizing > 0.0) {
            for (int a = 0; a < action_count; ++a) {
                out_strategy[offset + a] = static_cast<double>(strategy_sum[offset + a]) / normalizing;
            }
        } else {
            double prob = 1.0 / static_cast<double>(action_count);
            for (int a = 0; a < action_count; ++a) {
                out_strategy[offset + a] = prob;
            }
        }
    }
}

void Trainer::apply_dcfr_discount(InfoSet &info, double pos_scale, double neg_scale, double strat_scale) const {
    // Apply DCFR per-iteration decay to keep regrets/averages bounded.
    for (CFRScalar &regret : info.regret) {
        if (regret > CFRScalar(0)) {
            regret = static_cast<CFRScalar>(static_cast<double>(regret) * pos_scale);
        } else if (regret < CFRScalar(0)) {
            regret = static_cast<CFRScalar>(static_cast<double>(regret) * neg_scale);
        }
    }
    for (CFRScalar &value : info.strategy_sum) {
        value = static_cast<CFRScalar>(static_cast<double>(value) * strat_scale);
    }
}

const double *Trainer::traverse(int node_id,
                                int update_player,
                                const double *reach_p,
                                const double *reach_opp,
                                int depth) {
    ScratchFrame &frame = scratch_[depth];
    const TreeNode &node = tree_.nodes[node_id];
    int update_hands = num_hands_[update_player];

    if (node.player == -1) {
        double pot = static_cast<double>(game_.base_pot + node.contrib0 + node.contrib1);
        double contrib = (update_player == 0) ? node.contrib0 : node.contrib1;
        if (node.terminal_winner >= 0) {
            if (node.terminal_winner == update_player) {
                evaluator_.fold_values(update_player, reach_opp, pot - contrib, frame.values.data());
            } else {
                evaluator_.fold_values(update_player, reach_opp, -contrib, frame.values.data());
            }
        } else {
            evaluator_.showdown_values(update_player, reach_opp, pot, contrib, frame.values.data(), eval_scratch_);
        }
        return frame.values.data();
    }

    int player = node.player;
    const InfoSet &info_const = infosets_[node_id];
    int action_count = info_const.action_count;

    if (player != update_player) {
        // Opponent node: propagate their reach via current strategy.
        compute_strategy(info_const, frame.strategy.data());
        std::fill(frame.values.begin(), frame.values.begin() + update_hands, 0.0);
        int opp_hands = info_const.hand_count;
        for (int a = 0; a < action_count; ++a) {
            for (int h = 0; h < opp_hands; ++h) {
                frame.next_reach[h] = reach_opp[h] * frame.strategy[h * action_count + a];
            }
            const double *child_values = traverse(node.next[a], update_player, reach_p, frame.next_reach.data(),
                                                  depth + 1);
            for (int h = 0; h < update_hands; ++h) {
                frame.values[h] += child_values[h];
            }
        }
        return frame.values.data();
    }

    InfoSet &info = infosets_[node_id];
    if (algo_ == Algorithm::DCFR) {
        apply_dcfr_discount(info, dcfr_pos_scale_, dcfr_neg_scale_, dcfr_strat_scale_);
    }
    compute_strategy(info, frame.strategy.data());

    double *action_values = frame.action_values.data();
    for (int a = 0; a < action_count; ++a) {
        for (int h = 0; h < update_hands; ++h) {
            frame.next_reach[h] = reach_p[h] * frame.strategy[h * action_count + a];
        }
        const double *child_values = traverse(node.next[a], update_player, frame.next_reach.data(), reach_opp,
                                              depth + 1);
        std::copy(child_values, child_values + update_hands, action_values + a * update_hands);
    }

    double *node_values = frame.values.data();
    for (int h = 0; h < update_hands; ++h) {
        double value = 0.0;
        int offset = h * action_count;
        for (int a = 0; a < action_count; ++a) {
            value += frame.strategy[offset + a] * action_values[a * update_hands + h];
        }
        node_values[h] = value;
    }

    CFRScalar *regret = info.regret.data();
    for (int h = 0; h < update_hands; ++h) {
        int offset = h * action_count;
        double base = node_values[h];
        for (int a = 0; a < action_count; ++a) {
            // Update per-hand regrets for the updating player.
            double delta = (action_values[a * update_hands + h] - base) * regret_weight_;
            double updated = static_cast<double>(regret[offset + a]) + delta;
            if (algo_ == Algorithm::CFR_PLUS) {
                regret[offset + a] = static_cast<CFRScalar>(updated > 0.0 ? updated : 0.0);
            } else {
                regret[offset + a] = static_cast<CFRScalar>(updated);
            }
        }
    }

    CFRScalar *strategy_sum = info.strategy_sum.data();
    for (int h = 0; h < update_hands; ++h) {
        double weight = reach_p[h] * avg_weight_;
        if (weight == 0.0) {
            continue;
        }
        int offset = h * action_count;
        for (int a = 0; a < action_count; ++a) {
            strategy_sum[offset + a] = static_cast<CFRScalar>(static_cast<double>(strategy_sum[offset + a]) +
                                                             weight * frame.strategy[offset + a]);
        }
    }

    return node_values;
}

const double *Trainer::best_response(int node_id,
                                     int target_player,
                                     const double *reach_opp,
                                     int depth) const {
    ScratchFrame &frame = scratch_[depth];
    const TreeNode &node = tree_.nodes[node_id];
    int target_hands = num_hands_[target_player];

    if (node.player == -1) {
        double pot = static_cast<double>(game_.base_pot + node.contrib0 + node.contrib1);
        double contrib = (target_player == 0) ? node.contrib0 : node.contrib1;
        if (node.terminal_winner >= 0) {
            if (node.terminal_winner == target_player) {
                evaluator_.fold_values(target_player, reach_opp, pot - contrib, frame.values.data());
            } else {
                evaluator_.fold_values(target_player, reach_opp, -contrib, frame.values.data());
            }
        } else {
            evaluator_.showdown_values(target_player, reach_opp, pot, contrib, frame.values.data(), eval_scratch_);
        }
        return frame.values.data();
    }

    int player = node.player;
    const InfoSet &info = infosets_[node_id];
    int action_count = info.action_count;

    if (player != target_player) {
        compute_avg_strategy(info, frame.strategy.data());
        std::fill(frame.values.begin(), frame.values.begin() + target_hands, 0.0);
        int opp_hands = info.hand_count;
        for (int a = 0; a < action_count; ++a) {
            for (int h = 0; h < opp_hands; ++h) {
                frame.next_reach[h] = reach_opp[h] * frame.strategy[h * action_count + a];
            }
            const double *child_values = best_response(node.next[a], target_player, frame.next_reach.data(),
                                                       depth + 1);
            for (int h = 0; h < target_hands; ++h) {
                frame.values[h] += child_values[h];
            }
        }
        return frame.values.data();
    }

    double *action_values = frame.action_values.data();
    for (int a = 0; a < action_count; ++a) {
        const double *child_values = best_response(node.next[a], target_player, reach_opp, depth + 1);
        std::copy(child_values, child_values + target_hands, action_values + a * target_hands);
    }

    double *node_values = frame.values.data();
    for (int h = 0; h < target_hands; ++h) {
        double best_val = action_values[h];
        for (int a = 1; a < action_count; ++a) {
            double value = action_values[a * target_hands + h];
            if (value > best_val) {
                best_val = value;
            }
        }
        node_values[h] = best_val;
    }

    return node_values;
}

double Trainer::best_response_value(int target_player) const {
    int target_hands = num_hands_[target_player];
    int opp = 1 - target_player;
    const double *reach_opp = hand_weights_ptr_[opp];
    const double *values = best_response(tree_.root, target_player, reach_opp, 0);

    std::vector<double> valid(target_hands, 0.0);
    evaluator_.valid_opp_weights(target_player, reach_opp, valid.data());

    std::vector<double> normalized(target_hands, 0.0);
    for (int h = 0; h < target_hands; ++h) {
        if (valid[h] > 0.0) {
            normalized[h] = values[h] / valid[h];
        }
    }

    const double *weights = hand_weights_ptr_[target_player];
    double total = 0.0;
    double total_weight = 0.0;
    for (int h = 0; h < target_hands; ++h) {
        double weight = weights[h] * valid[h];
        total += weight * normalized[h];
        total_weight += weight;
    }
    if (total_weight <= 0.0) {
        return 0.0;
    }
    return total / total_weight;
}

double Trainer::exploitability() const {
    double br0 = best_response_value(0);
    double br1 = best_response_value(1);
    return (br0 + br1 - static_cast<double>(game_.base_pot)) / 2.0;
}

void Trainer::run(int iterations) {
    for (int i = 0; i < iterations; ++i) {
        iteration_ += 1;
        // Each iteration performs alternating updates for both players.
        if (algo_ == Algorithm::LINEAR_CFR) {
            regret_weight_ = static_cast<double>(iteration_);
            avg_weight_ = static_cast<double>(iteration_);
        } else if (algo_ == Algorithm::CFR_PLUS) {
            regret_weight_ = 1.0;
            avg_weight_ = static_cast<double>(iteration_);
        } else if (algo_ == Algorithm::DCFR) {
            regret_weight_ = 1.0;
            avg_weight_ = 1.0;
            double t = static_cast<double>(iteration_);
            double pos_base = std::pow(t, dcfr_.alpha);
            double neg_base = std::pow(t, dcfr_.beta);
            dcfr_pos_scale_ = pos_base / (pos_base + 1.0);
            dcfr_neg_scale_ = neg_base / (neg_base + 1.0);
            dcfr_strat_scale_ = std::pow(t / (t + 1.0), dcfr_.gamma);
        } else {
            regret_weight_ = 1.0;
            avg_weight_ = 1.0;
        }
        for (int player = 0; player < 2; ++player) {
            traverse(tree_.root, player, hand_weights_ptr_[player], hand_weights_ptr_[1 - player], 0);
        }
    }
}
