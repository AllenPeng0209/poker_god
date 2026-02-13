#pragma once

#include <array>
#include <vector>

#include "river_game.h"

struct EvalScratch {
    std::vector<double> prefix;
};

class VectorEvaluator {
public:
    explicit VectorEvaluator(const std::array<std::vector<Hand>, 2> &hands);

    void showdown_values(int player,
                         const double *opp_weights,
                         double pot_total,
                         double contrib_player,
                         double *out_values,
                         EvalScratch &scratch) const;

    void fold_values(int player,
                     const double *opp_weights,
                     double value,
                     double *out_values) const;

    void valid_opp_weights(int player, const double *opp_weights, double *out_values) const;

private:
    struct EvalCache {
        std::vector<int> sorted_indices;
        std::vector<Strength> strengths_sorted;
        std::vector<int> range_start;
        std::vector<int> range_end;
        std::vector<std::vector<int>> blocked_less;
        std::vector<std::vector<int>> blocked_equal;
        std::vector<std::vector<int>> blocked_greater;
    };

    static EvalCache build_cache(const std::vector<Hand> &player_hands, const std::vector<Hand> &opp_hands);

    std::array<EvalCache, 2> cache_;
    std::array<int, 2> num_hands_{{0, 0}};
};
