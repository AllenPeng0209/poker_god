#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cctype>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <functional>
#include <iomanip>
#include <iostream>
#include <limits>
#include <unordered_map>
#include <sstream>
#include <string>
#include <vector>

#include "mccfr.h"
#include "river_game.h"
#include "subgame_config.h"
#include "trainer.h"

namespace {
struct Options {
    std::string config_path;
    std::string algo = "cfr+";
    std::int64_t iters = 2000;
    int stack = 0;
    bool stack_set = false;
    std::vector<double> bet_sizes{0.5, 1.0};
    bool bet_sizes_set = false;
    bool include_all_in = true;
    int max_raises = 1000;
    bool max_raises_set = false;
    std::vector<std::int64_t> checkpoints;
    DcfrParams dcfr;
    std::uint64_t seed = 7;
    bool mccfr_linear = false;
    bool eval = true;
    int eval_interval = 1;
    bool target_exp_set = false;
    double target_exp = 0.0;
    std::string dump_strategy_path;
    bool dump_strategy_set = false;
};

void print_usage() {
    std::cout << "Usage: river_solver_optimized"
              << " [--config PATH] [--stack N]"
              << " [--algo cfr|cfr+|lcfr|dcfr|mccfr|mccfr-linear|all] [--iters N]"
              << " [--bet-sizes LIST] [--no-all-in] [--max-raises N] [--checkpoints LIST]"
              << " [--target-exp X] [--seed N] [--mccfr-linear] [--no-eval] [--eval-interval N]\n";
    std::cout << "  DCFR params: --dcfr-alpha A --dcfr-beta B --dcfr-gamma G\n";
    std::cout << "  Bet sizes: --bet-sizes 0.5,1 (comma-separated pot fractions)\n";
    std::cout << "  Checkpoints: --checkpoints 1024,2048,4096\n";
    std::cout << "  Strategy dump: --dump-strategy PATH\n";
}

std::vector<double> parse_doubles(const std::string &value) {
    std::vector<double> out;
    std::stringstream ss(value);
    std::string item;
    while (std::getline(ss, item, ',')) {
        if (item.empty()) {
            continue;
        }
        out.push_back(std::stod(item));
    }
    return out;
}

std::vector<std::int64_t> parse_checkpoints(const std::string &value) {
    std::vector<std::int64_t> out;
    std::stringstream ss(value);
    std::string item;
    while (std::getline(ss, item, ',')) {
        if (item.empty()) {
            continue;
        }
        std::int64_t parsed = std::stoll(item);
        if (parsed > 0) {
            out.push_back(parsed);
        }
    }
    return out;
}

std::string normalize_algo(std::string value) {
    for (char &ch : value) {
        ch = static_cast<char>(std::tolower(static_cast<unsigned char>(ch)));
    }
    return value;
}

bool is_mccfr(const std::string &value) {
    return value == "mccfr" || value == "mc" || value == "montecarlo" || value == "monte_carlo";
}

bool is_mccfr_linear(const std::string &value) {
    return value == "mccfr-linear" || value == "mccfr_lin" || value == "mccfrlinear" || value == "mccfr-lin" ||
           value == "mccfr_l";
}

Algorithm parse_algo(const std::string &value) {
    if (value == "cfr") {
        return Algorithm::CFR;
    }
    if (value == "cfr+" || value == "cfrp" || value == "cfrplus") {
        return Algorithm::CFR_PLUS;
    }
    if (value == "lcfr" || value == "linear" || value == "linear_cfr") {
        return Algorithm::LINEAR_CFR;
    }
    return Algorithm::DCFR;
}

std::string algo_label(const std::string &value) {
    if (value == "cfr") {
        return "CFR";
    }
    if (value == "cfr+" || value == "cfrp" || value == "cfrplus") {
        return "CFR+";
    }
    if (value == "lcfr" || value == "linear" || value == "linear_cfr") {
        return "Linear CFR";
    }
    if (is_mccfr(value)) {
        return "Monte Carlo CFR";
    }
    if (is_mccfr_linear(value)) {
        return "Monte Carlo CFR (linear)";
    }
    return "Discounted CFR";
}

using StrategyMatrix = std::vector<std::vector<double>>;
using StrategyProfile = std::unordered_map<std::string, std::pair<std::vector<std::string>, StrategyMatrix>>;

std::string json_escape(const std::string &input) {
    std::string out;
    out.reserve(input.size());
    for (char ch : input) {
        switch (ch) {
            case '"':
                out += "\\\"";
                break;
            case '\\':
                out += "\\\\";
                break;
            case '\b':
                out += "\\b";
                break;
            case '\f':
                out += "\\f";
                break;
            case '\n':
                out += "\\n";
                break;
            case '\r':
                out += "\\r";
                break;
            case '\t':
                out += "\\t";
                break;
            default:
                out += ch;
                break;
        }
    }
    return out;
}

std::string hand_to_string(const Hand &hand) {
    return card_str(hand.cards[0]) + card_str(hand.cards[1]);
}

std::string action_token(const TreeNode &parent, const TreeNode &child, int player) {
    int contrib = (player == 0) ? parent.contrib0 : parent.contrib1;
    int to_call = std::max(parent.contrib0, parent.contrib1) - contrib;
    int child_contrib = (player == 0) ? child.contrib0 : child.contrib1;
    int delta = child_contrib - contrib;
    if (to_call == 0) {
        if (delta == 0) {
            return "c";
        }
        return "b" + std::to_string(delta);
    }
    if (delta == 0 && child.terminal_winner == 1 - player) {
        return "f";
    }
    if (delta == to_call) {
        return "c";
    }
    int raise_amount = delta - to_call;
    return "r" + std::to_string(raise_amount);
}

void build_tree_labels(const Tree &tree,
                       std::vector<std::string> &keys,
                       std::vector<std::vector<std::string>> &tokens) {
    keys.assign(tree.nodes.size(), "");
    tokens.assign(tree.nodes.size(), {});
    std::function<void(int, const std::string &)> visit;
    visit = [&](int node_id, const std::string &path) {
        keys[node_id] = path.empty() ? "root" : path;
        const TreeNode &node = tree.nodes[node_id];
        if (node.player < 0) {
            return;
        }
        tokens[node_id].reserve(node.action_count);
        for (int a = 0; a < node.action_count; ++a) {
            int child_id = node.next[a];
            const TreeNode &child = tree.nodes[child_id];
            std::string tok = action_token(node, child, node.player);
            tokens[node_id].push_back(tok);
            std::string next_path = path.empty() ? tok : path + "/" + tok;
            visit(child_id, next_path);
        }
    };
    visit(tree.root, "");
}

void write_strategy_json(const std::string &path,
                         const RiverGame &game,
                         const std::array<StrategyProfile, 2> &profiles) {
    std::ofstream out(path);
    if (!out) {
        std::cerr << "Failed to write strategy to " << path << "\n";
        return;
    }
    out << std::setprecision(10);
    out << "{\"players\":[";
    for (int player = 0; player < 2; ++player) {
        if (player > 0) {
            out << ",";
        }
        out << "{\"hands\":[";
        for (std::size_t i = 0; i < game.hands[player].size(); ++i) {
            if (i > 0) {
                out << ",";
            }
            out << "\"" << json_escape(hand_to_string(game.hands[player][i])) << "\"";
        }
        out << "],\"weights\":[";
        for (std::size_t i = 0; i < game.hand_weights[player].size(); ++i) {
            if (i > 0) {
                out << ",";
            }
            out << game.hand_weights[player][i];
        }
        out << "],\"profile\":{";
        std::vector<std::string> keys;
        keys.reserve(profiles[player].size());
        for (const auto &entry : profiles[player]) {
            keys.push_back(entry.first);
        }
        std::sort(keys.begin(), keys.end());
        bool first_key = true;
        for (const auto &key : keys) {
            const auto &entry = profiles[player].at(key);
            if (!first_key) {
                out << ",";
            }
            first_key = false;
            out << "\"" << json_escape(key) << "\":{\"actions\":[";
            for (std::size_t i = 0; i < entry.first.size(); ++i) {
                if (i > 0) {
                    out << ",";
                }
                out << "\"" << json_escape(entry.first[i]) << "\"";
            }
            out << "],\"strategy\":[";
            for (std::size_t h = 0; h < entry.second.size(); ++h) {
                if (h > 0) {
                    out << ",";
                }
                out << "[";
                for (std::size_t a = 0; a < entry.second[h].size(); ++a) {
                    if (a > 0) {
                        out << ",";
                    }
                    out << entry.second[h][a];
                }
                out << "]";
            }
            out << "]}";
        }
        out << "}}";
    }
    out << "]}";
}

void build_profile_from_trainer(const Trainer &trainer,
                                const Tree &tree,
                                const std::vector<std::string> &keys,
                                const std::vector<std::vector<std::string>> &tokens,
                                std::array<StrategyProfile, 2> &profiles) {
    for (int player = 0; player < 2; ++player) {
        for (std::size_t node_id = 0; node_id < tree.nodes.size(); ++node_id) {
            if (tree.nodes[node_id].player != player) {
                continue;
            }
            if (!trainer.has_infoset(static_cast<int>(node_id))) {
                continue;
            }
            int hand_count = trainer.infoset_hand_count(static_cast<int>(node_id));
            int action_count = trainer.infoset_action_count(static_cast<int>(node_id));
            if (hand_count <= 0 || action_count <= 0) {
                continue;
            }
            std::vector<double> flat;
            trainer.average_strategy(static_cast<int>(node_id), flat);
            StrategyMatrix matrix;
            matrix.assign(hand_count, std::vector<double>(action_count, 0.0));
            for (int h = 0; h < hand_count; ++h) {
                int offset = h * action_count;
                for (int a = 0; a < action_count; ++a) {
                    matrix[h][a] = flat[offset + a];
                }
            }
            profiles[player][keys[node_id]] = {tokens[node_id], std::move(matrix)};
        }
    }
}

void build_profile_from_mccfr(const MCCFRTrainer &trainer,
                              const Tree &tree,
                              const std::vector<std::string> &keys,
                              const std::vector<std::vector<std::string>> &tokens,
                              std::array<StrategyProfile, 2> &profiles) {
    for (int player = 0; player < 2; ++player) {
        for (std::size_t node_id = 0; node_id < tree.nodes.size(); ++node_id) {
            if (tree.nodes[node_id].player != player) {
                continue;
            }
            if (!trainer.has_infoset(player, static_cast<int>(node_id))) {
                continue;
            }
            int hand_count = trainer.infoset_hand_count(player);
            int action_count = trainer.infoset_action_count(player, static_cast<int>(node_id));
            if (hand_count <= 0 || action_count <= 0) {
                continue;
            }
            std::vector<double> flat;
            trainer.average_strategy(player, static_cast<int>(node_id), flat);
            StrategyMatrix matrix;
            matrix.assign(hand_count, std::vector<double>(action_count, 0.0));
            for (int h = 0; h < hand_count; ++h) {
                int offset = h * action_count;
                for (int a = 0; a < action_count; ++a) {
                    matrix[h][a] = flat[offset + a];
                }
            }
            profiles[player][keys[node_id]] = {tokens[node_id], std::move(matrix)};
        }
    }
}

void run_algo(const std::string &label,
              const RiverGame &game,
              const Tree &tree,
              Algorithm algo,
              int iters,
              const DcfrParams &dcfr,
              const std::vector<std::int64_t> &checkpoints,
              bool eval,
              int eval_interval,
              bool target_exp_set,
              double target_exp,
              const std::string &dump_path,
              const std::vector<std::string> &keys,
              const std::vector<std::vector<std::string>> &tokens) {
    Trainer trainer(game, tree, algo, dcfr);
    auto start = std::chrono::steady_clock::now();
    std::vector<double> values;
    std::vector<std::int64_t> steps;
    std::vector<double> times;
    bool target_active = target_exp_set && eval;
    auto should_eval = [&](std::int64_t step) {
        if (!eval) {
            return false;
        }
        if (target_active) {
            return true;
        }
        return eval_interval <= 1 || (step % eval_interval == 0);
    };
    auto record_eval = [&](std::int64_t step) -> double {
        double exp = trainer.exploitability();
        values.push_back(exp);
        steps.push_back(step);
        auto now = std::chrono::steady_clock::now();
        times.push_back(std::chrono::duration<double>(now - start).count());
        return exp;
    };
    auto reached_target = [&](double exp) {
        return target_active && exp <= target_exp;
    };

    if (target_active && checkpoints.empty()) {
        std::int64_t completed = 0;
        std::int64_t target = 5;
        while (true) {
            trainer.run(static_cast<int>(target - completed));
            completed = target;
            if (should_eval(completed)) {
                double exp = record_eval(completed);
                if (reached_target(exp)) {
                    break;
                }
            }
            if (target > std::numeric_limits<std::int64_t>::max() / 2) {
                break;
            }
            target *= 2;
        }
    } else if (!checkpoints.empty()) {
        std::int64_t completed = 0;
        for (std::int64_t target : checkpoints) {
            if (target <= completed) {
                continue;
            }
            trainer.run(static_cast<int>(target - completed));
            completed = target;
            if (should_eval(completed)) {
                double exp = record_eval(completed);
                if (reached_target(exp)) {
                    break;
                }
            }
        }
    } else {
        trainer.run(iters);
        if (should_eval(iters)) {
            record_eval(iters);
        }
    }
    auto end = std::chrono::steady_clock::now();
    std::chrono::duration<double> elapsed = end - start;
    double pot_base = game.base_pot > 0 ? static_cast<double>(game.base_pot) : 1.0;
    std::cout << label << ":";
    if (!steps.empty()) {
        std::cout << " iters=";
        for (std::size_t i = 0; i < steps.size(); ++i) {
            if (i > 0) {
                std::cout << ",";
            }
            std::cout << steps[i];
        }
    }
    if (!values.empty()) {
        std::cout << " Exploitability (chips):";
        for (double v : values) {
            std::cout << " " << std::fixed << std::setprecision(6) << v;
        }
        std::cout << " | Exploitability (% of pot):";
        for (double v : values) {
            double pct = (v / pot_base) * 100.0;
            std::cout << " " << std::fixed << std::setprecision(6) << pct << "%";
        }
        if (!times.empty()) {
            std::cout << " | Elapsed (sec):";
            for (double t : times) {
                std::cout << " " << std::fixed << std::setprecision(3) << t;
            }
            std::cout << "\n";
        } else {
            std::cout << " (time_sec=" << std::fixed << std::setprecision(3) << elapsed.count() << ")\n";
        }
    } else {
        std::cout << " (time_sec=" << std::fixed << std::setprecision(3) << elapsed.count() << ")\n";
    }

    if (!dump_path.empty()) {
        std::array<StrategyProfile, 2> profiles;
        build_profile_from_trainer(trainer, tree, keys, tokens, profiles);
        write_strategy_json(dump_path, game, profiles);
    }
}

void run_mccfr(const RiverGame &game,
               const Tree &tree,
               std::int64_t iters,
               std::uint64_t seed,
               bool linear_weighting,
               const std::vector<std::int64_t> &checkpoints,
               bool target_exp_set,
               double target_exp,
               const std::string &dump_path,
               const std::vector<std::string> &keys,
               const std::vector<std::vector<std::string>> &tokens) {
    MCCFRTrainer trainer(game, tree, seed, linear_weighting);
    auto start = std::chrono::steady_clock::now();
    std::vector<double> values;
    std::vector<std::int64_t> steps;
    std::vector<double> times;
    auto record_eval = [&](std::int64_t step) -> double {
        double exp = trainer.exploitability();
        values.push_back(exp);
        steps.push_back(step);
        auto now = std::chrono::steady_clock::now();
        times.push_back(std::chrono::duration<double>(now - start).count());
        return exp;
    };
    auto reached_target = [&](double exp) {
        return target_exp_set && exp <= target_exp;
    };
    if (target_exp_set && checkpoints.empty()) {
        std::int64_t completed = 0;
        std::int64_t target = 5;
        while (true) {
            trainer.run(target - completed);
            completed = target;
            double exp = record_eval(completed);
            if (reached_target(exp)) {
                break;
            }
            if (target > std::numeric_limits<std::int64_t>::max() / 2) {
                break;
            }
            target *= 2;
        }
    } else if (!checkpoints.empty()) {
        std::int64_t completed = 0;
        for (std::int64_t target : checkpoints) {
            if (target <= completed) {
                continue;
            }
            trainer.run(target - completed);
            completed = target;
            double exp = record_eval(completed);
            if (reached_target(exp)) {
                break;
            }
        }
    } else {
        trainer.run(iters);
        record_eval(iters);
    }
    auto end = std::chrono::steady_clock::now();
    std::chrono::duration<double> elapsed = end - start;
    double pot_base = game.base_pot > 0 ? static_cast<double>(game.base_pot) : 1.0;
    std::cout << (linear_weighting ? "Monte Carlo CFR (linear):" : "Monte Carlo CFR:");
    if (!steps.empty()) {
        std::cout << " iters=";
        for (std::size_t i = 0; i < steps.size(); ++i) {
            if (i > 0) {
                std::cout << ",";
            }
            std::cout << steps[i];
        }
    }
    std::cout << " Exploitability (chips):";
    for (double v : values) {
        std::cout << " " << std::fixed << std::setprecision(6) << v;
    }
    std::cout << " | Exploitability (% of pot):";
    for (double v : values) {
        double pct = (v / pot_base) * 100.0;
        std::cout << " " << std::fixed << std::setprecision(6) << pct << "%";
    }
    if (!times.empty()) {
        std::cout << " | Elapsed (sec):";
        for (double t : times) {
            std::cout << " " << std::fixed << std::setprecision(3) << t;
        }
        std::cout << "\n";
    } else {
        std::cout << " (time_sec=" << std::fixed << std::setprecision(3) << elapsed.count() << ")\n";
    }

    if (!dump_path.empty()) {
        std::array<StrategyProfile, 2> profiles;
        build_profile_from_mccfr(trainer, tree, keys, tokens, profiles);
        write_strategy_json(dump_path, game, profiles);
    }
}
}

int main(int argc, char **argv) {
    Options opts;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if ((arg == "--config" || arg == "--subgame") && i + 1 < argc) {
            opts.config_path = argv[++i];
        } else if (arg == "--algo" && i + 1 < argc) {
            opts.algo = normalize_algo(argv[++i]);
            if (is_mccfr_linear(opts.algo)) {
                opts.mccfr_linear = true;
                opts.algo = "mccfr";
            }
        } else if (arg == "--iters" && i + 1 < argc) {
            opts.iters = std::stoll(argv[++i]);
        } else if (arg == "--stack" && i + 1 < argc) {
            opts.stack = std::stoi(argv[++i]);
            opts.stack_set = true;
        } else if (arg == "--bet-sizes" && i + 1 < argc) {
            opts.bet_sizes = parse_doubles(argv[++i]);
            opts.bet_sizes_set = true;
        } else if (arg == "--no-all-in") {
            opts.include_all_in = false;
        } else if (arg == "--max-raises" && i + 1 < argc) {
            opts.max_raises = std::stoi(argv[++i]);
            opts.max_raises_set = true;
        } else if (arg == "--checkpoints" && i + 1 < argc) {
            opts.checkpoints = parse_checkpoints(argv[++i]);
        } else if (arg == "--mccfr-linear") {
            opts.mccfr_linear = true;
        } else if (arg == "--no-eval") {
            opts.eval = false;
        } else if (arg == "--eval-interval" && i + 1 < argc) {
            opts.eval_interval = std::max(1, std::stoi(argv[++i]));
        } else if (arg == "--target-exp" && i + 1 < argc) {
            opts.target_exp = std::stod(argv[++i]);
            opts.target_exp_set = true;
        } else if (arg == "--dump-strategy" && i + 1 < argc) {
            opts.dump_strategy_path = argv[++i];
            opts.dump_strategy_set = true;
        } else if (arg == "--dcfr-alpha" && i + 1 < argc) {
            opts.dcfr.alpha = std::stod(argv[++i]);
        } else if (arg == "--dcfr-beta" && i + 1 < argc) {
            opts.dcfr.beta = std::stod(argv[++i]);
        } else if (arg == "--dcfr-gamma" && i + 1 < argc) {
            opts.dcfr.gamma = std::stod(argv[++i]);
        } else if (arg == "--seed" && i + 1 < argc) {
            opts.seed = std::stoull(argv[++i]);
        } else if (arg == "--help") {
            print_usage();
            return 0;
        } else {
            std::cout << "Unknown arg: " << arg << "\n";
            print_usage();
            return 1;
        }
    }

    if (opts.dump_strategy_set && opts.algo == "all") {
        std::cerr << "--dump-strategy requires a single algorithm (not --algo all).\n";
        return 1;
    }

    SubgameConfig subgame;
    if (!opts.config_path.empty()) {
        subgame = load_subgame_config(opts.config_path);
    }
    if (subgame.board_cards.empty()) {
        subgame.board_cards = {card_id("Ks"), card_id("Th"), card_id("7s"), card_id("4d"), card_id("2s")};
    }
    if (opts.stack_set) {
        subgame.stack = opts.stack;
    }
    if (opts.bet_sizes_set) {
        subgame.bet_sizes = opts.bet_sizes;
    }
    if (!opts.include_all_in) {
        subgame.include_all_in = false;
    }
    if (opts.max_raises_set) {
        subgame.max_raises = opts.max_raises;
    }

    RiverConfig config;
    config.board_cards = subgame.board_cards;
    config.pot = subgame.pot;
    config.stack = subgame.stack;
    config.bet_sizes = subgame.bet_sizes;
    config.include_all_in = subgame.include_all_in;
    config.max_raises = subgame.max_raises;
    if (!subgame.players[0].hands.empty()) {
        config.ranges[0] = subgame.players[0].hands;
        config.range_weights[0] = subgame.players[0].weights;
    }
    if (!subgame.players[1].hands.empty()) {
        config.ranges[1] = subgame.players[1].hands;
        config.range_weights[1] = subgame.players[1].weights;
    }

    RiverGame game(config);
    Tree tree = game.build_tree();
    int internal_nodes = 0;
    int terminal_nodes = 0;
    for (const auto &node : tree.nodes) {
        if (node.player == -1) {
            terminal_nodes += 1;
        } else {
            internal_nodes += 1;
        }
    }
    std::cout << "tree_nodes: internal=" << internal_nodes << " terminal=" << terminal_nodes
              << " total=" << tree.nodes.size() << "\n";

    std::vector<std::string> node_keys;
    std::vector<std::vector<std::string>> node_tokens;
    std::string dump_path;
    if (opts.dump_strategy_set) {
        dump_path = opts.dump_strategy_path;
        build_tree_labels(tree, node_keys, node_tokens);
    }

    if (opts.algo == "all") {
        int iters = static_cast<int>(opts.iters);
        run_algo("CFR+", game, tree, Algorithm::CFR_PLUS, iters, opts.dcfr, opts.checkpoints, opts.eval,
                 opts.eval_interval, opts.target_exp_set, opts.target_exp, dump_path, node_keys, node_tokens);
        run_algo("Linear CFR", game, tree, Algorithm::LINEAR_CFR, iters, opts.dcfr, opts.checkpoints, opts.eval,
                 opts.eval_interval, opts.target_exp_set, opts.target_exp, dump_path, node_keys, node_tokens);
        run_algo("Discounted CFR", game, tree, Algorithm::DCFR, iters, opts.dcfr, opts.checkpoints, opts.eval,
                 opts.eval_interval, opts.target_exp_set, opts.target_exp, dump_path, node_keys, node_tokens);
        return 0;
    }

    if (is_mccfr(opts.algo)) {
        run_mccfr(game, tree, opts.iters, opts.seed, opts.mccfr_linear, opts.checkpoints, opts.target_exp_set,
                  opts.target_exp, dump_path, node_keys, node_tokens);
        return 0;
    }

    Algorithm algo = parse_algo(opts.algo);
    std::string label = algo_label(opts.algo);
    run_algo(label, game, tree, algo, static_cast<int>(opts.iters), opts.dcfr, opts.checkpoints, opts.eval,
             opts.eval_interval, opts.target_exp_set, opts.target_exp, dump_path, node_keys, node_tokens);
    return 0;
}
