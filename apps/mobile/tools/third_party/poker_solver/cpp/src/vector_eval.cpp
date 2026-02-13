#include "vector_eval.h"

#include <algorithm>
#include <numeric>

VectorEvaluator::EvalCache VectorEvaluator::build_cache(const std::vector<Hand> &player_hands,
                                                        const std::vector<Hand> &opp_hands) {
    EvalCache cache;
    int opp_count = static_cast<int>(opp_hands.size());
    // Sort opponent hand strengths to enable prefix-sum evaluation.
    cache.sorted_indices.resize(opp_count);
    std::iota(cache.sorted_indices.begin(), cache.sorted_indices.end(), 0);
    std::sort(cache.sorted_indices.begin(), cache.sorted_indices.end(), [&](int a, int b) {
        return opp_hands[a].strength < opp_hands[b].strength;
    });

    cache.strengths_sorted.reserve(opp_count);
    for (int idx : cache.sorted_indices) {
        cache.strengths_sorted.push_back(opp_hands[idx].strength);
    }

    cache.range_start.resize(player_hands.size());
    cache.range_end.resize(player_hands.size());
    for (std::size_t h = 0; h < player_hands.size(); ++h) {
        const Strength &strength = player_hands[h].strength;
        auto lower = std::lower_bound(cache.strengths_sorted.begin(), cache.strengths_sorted.end(), strength);
        auto upper = std::upper_bound(cache.strengths_sorted.begin(), cache.strengths_sorted.end(), strength);
        cache.range_start[h] = static_cast<int>(lower - cache.strengths_sorted.begin());
        cache.range_end[h] = static_cast<int>(upper - cache.strengths_sorted.begin());
    }

    std::vector<std::vector<int>> card_to_indices(52);
    for (int idx = 0; idx < opp_count; ++idx) {
        const auto &hand = opp_hands[idx];
        card_to_indices[hand.cards[0]].push_back(idx);
        card_to_indices[hand.cards[1]].push_back(idx);
    }

    cache.blocked_less.resize(player_hands.size());
    cache.blocked_equal.resize(player_hands.size());
    cache.blocked_greater.resize(player_hands.size());

    std::vector<int> seen(opp_count, 0);
    int stamp = 1;
    for (std::size_t h = 0; h < player_hands.size(); ++h) {
        const auto &hand = player_hands[h];
        std::vector<int> blocked;
        blocked.reserve(128);
        auto add_indices = [&](int card) {
            for (int idx : card_to_indices[card]) {
                if (seen[idx] != stamp) {
                    seen[idx] = stamp;
                    blocked.push_back(idx);
                }
            }
        };
        add_indices(hand.cards[0]);
        add_indices(hand.cards[1]);
        ++stamp;

        auto &less = cache.blocked_less[h];
        auto &equal = cache.blocked_equal[h];
        auto &greater = cache.blocked_greater[h];
        less.reserve(blocked.size());
        equal.reserve(blocked.size());
        greater.reserve(blocked.size());
        // Partition blocked opponent hands by relative strength.
        for (int idx : blocked) {
            const Strength &opp_strength = opp_hands[idx].strength;
            if (opp_strength < hand.strength) {
                less.push_back(idx);
            } else if (opp_strength > hand.strength) {
                greater.push_back(idx);
            } else {
                equal.push_back(idx);
            }
        }
    }

    return cache;
}

VectorEvaluator::VectorEvaluator(const std::array<std::vector<Hand>, 2> &hands) {
    num_hands_[0] = static_cast<int>(hands[0].size());
    num_hands_[1] = static_cast<int>(hands[1].size());
    cache_[0] = build_cache(hands[0], hands[1]);
    cache_[1] = build_cache(hands[1], hands[0]);
}

void VectorEvaluator::showdown_values(int player,
                                      const double *opp_weights,
                                      double pot_total,
                                      double contrib_player,
                                      double *out_values,
                                      EvalScratch &scratch) const {
    const EvalCache &cache = cache_[player];
    int opp_count = num_hands_[1 - player];
    scratch.prefix.resize(static_cast<std::size_t>(opp_count) + 1);
    scratch.prefix[0] = 0.0;
    for (int i = 0; i < opp_count; ++i) {
        scratch.prefix[i + 1] = scratch.prefix[i] + opp_weights[cache.sorted_indices[i]];
    }
    // Prefix sums give total weight below each strength bucket.
    double total = scratch.prefix[opp_count];
    int player_count = num_hands_[player];
    if (total <= 0.0) {
        std::fill(out_values, out_values + player_count, 0.0);
        return;
    }

    for (int h = 0; h < player_count; ++h) {
        int start = cache.range_start[h];
        int end = cache.range_end[h];
        double win_weight = scratch.prefix[start];
        double tie_weight = scratch.prefix[end] - scratch.prefix[start];
        double lose_weight = total - win_weight - tie_weight;

        for (int idx : cache.blocked_less[h]) {
            win_weight -= opp_weights[idx];
        }
        for (int idx : cache.blocked_equal[h]) {
            tie_weight -= opp_weights[idx];
        }
        for (int idx : cache.blocked_greater[h]) {
            lose_weight -= opp_weights[idx];
        }

        double active_weight = win_weight + tie_weight + lose_weight;
        out_values[h] = win_weight * pot_total + tie_weight * (pot_total * 0.5) - contrib_player * active_weight;
    }
}

void VectorEvaluator::fold_values(int player,
                                  const double *opp_weights,
                                  double value,
                                  double *out_values) const {
    const EvalCache &cache = cache_[player];
    int opp_count = num_hands_[1 - player];
    double total = 0.0;
    for (int i = 0; i < opp_count; ++i) {
        total += opp_weights[i];
    }
    int player_count = num_hands_[player];
    if (total <= 0.0) {
        std::fill(out_values, out_values + player_count, 0.0);
        return;
    }

    for (int h = 0; h < player_count; ++h) {
        double blocked_weight = 0.0;
        for (int idx : cache.blocked_less[h]) {
            blocked_weight += opp_weights[idx];
        }
        for (int idx : cache.blocked_equal[h]) {
            blocked_weight += opp_weights[idx];
        }
        for (int idx : cache.blocked_greater[h]) {
            blocked_weight += opp_weights[idx];
        }
        out_values[h] = value * (total - blocked_weight);
    }
}

void VectorEvaluator::valid_opp_weights(int player, const double *opp_weights, double *out_values) const {
    const EvalCache &cache = cache_[player];
    int opp_count = num_hands_[1 - player];
    double total = 0.0;
    for (int i = 0; i < opp_count; ++i) {
        total += opp_weights[i];
    }
    int player_count = num_hands_[player];
    if (total <= 0.0) {
        std::fill(out_values, out_values + player_count, 0.0);
        return;
    }
    for (int h = 0; h < player_count; ++h) {
        double blocked_weight = 0.0;
        for (int idx : cache.blocked_less[h]) {
            blocked_weight += opp_weights[idx];
        }
        for (int idx : cache.blocked_equal[h]) {
            blocked_weight += opp_weights[idx];
        }
        for (int idx : cache.blocked_greater[h]) {
            blocked_weight += opp_weights[idx];
        }
        out_values[h] = total - blocked_weight;
    }
}
