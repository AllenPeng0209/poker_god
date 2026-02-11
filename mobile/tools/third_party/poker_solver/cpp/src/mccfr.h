#pragma once

#include <array>
#include <cstdint>
#include <utility>
#include <vector>

#include "river_game.h"
#include "vector_eval.h"

class MCCFRTrainer {
public:
    MCCFRTrainer(const RiverGame &game, const Tree &tree, std::uint64_t seed = 7, bool linear_weighting = false);

    void run(std::int64_t iterations);
    double exploitability() const;
    bool has_infoset(int player, int node_id) const;
    int infoset_action_count(int player, int node_id) const;
    int infoset_hand_count(int player) const;
    void average_strategy(int player, int node_id, std::vector<double> &out) const;

private:
    struct NodeInfo {
        int action_count = 0;
        std::size_t offset = 0;
        std::size_t hand_offset = 0;
        bool valid = false;
    };

    struct TrainScratch {
        std::vector<double> strategy;
        std::vector<double> util;
    };

    struct EvalScratchFrame {
        std::vector<double> values;
        std::vector<double> next_reach;
        std::vector<double> action_values;
        std::vector<double> hand_norm;
    };

    class FastRng {
    public:
        explicit FastRng(std::uint64_t seed);
        double next_double();

    private:
        std::uint64_t state_;
    };

    void build_sampling_cache();
    std::pair<int, int> sample_hands();
    int sample_prefix(const std::vector<double> &prefix, double total);

    double traverse(int node_id, int target_player, int p0_index, int p1_index, double reach, int depth);
    void apply_linear_decay(int player, const NodeInfo &info, int hand_index);

    const double *best_response(int node_id,
                                int target_player,
                                const double *reach_opp,
                                int depth) const;
    double best_response_value(int target_player) const;

    void strategy_for_hand(int player, int node_id, int hand_index, double *out_probs) const;

    const RiverGame &game_;
    const Tree &tree_;
    VectorEvaluator evaluator_;
    std::array<int, 2> num_hands_{{0, 0}};

    std::array<std::vector<NodeInfo>, 2> node_info_;
    std::array<std::vector<double>, 2> regret_;
    std::array<std::vector<double>, 2> strategy_sum_;
    std::array<std::vector<std::int64_t>, 2> hand_last_update_;
    bool linear_weighting_ = false;

    std::vector<double> p0_prefix_;
    double p0_total_ = 0.0;
    std::vector<std::vector<int>> p1_indices_;
    std::vector<std::vector<double>> p1_prefix_;
    std::vector<double> p1_total_;

    FastRng rng_;
    std::int64_t iteration_ = 0;

    std::vector<TrainScratch> train_scratch_;
    mutable std::vector<EvalScratchFrame> eval_scratch_;
    mutable EvalScratch eval_terminal_scratch_;
};
