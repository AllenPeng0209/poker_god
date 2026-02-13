#pragma once

#include <array>
#include <string>
#include <vector>

struct SubgamePlayerConfig {
    std::vector<std::array<int, 2>> hands;
    std::vector<double> weights;
};

struct SubgameConfig {
    std::vector<int> board_cards;
    int pot = 1000;
    int stack = 9500;
    std::vector<double> bet_sizes{0.5, 1.0};
    bool include_all_in = true;
    int max_raises = 1000;
    std::array<SubgamePlayerConfig, 2> players;
};

SubgameConfig load_subgame_config(const std::string &path);
