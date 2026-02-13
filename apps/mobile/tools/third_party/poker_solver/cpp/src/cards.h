#pragma once

#include <array>
#include <string>
#include <vector>

using Strength = std::array<int, 6>;

int card_id(const std::string &card);
int card_id(char rank, char suit);
std::string card_str(int card);
std::array<int, 2> parse_hand(const std::string &hand);
std::vector<int> parse_board(const std::string &board);

Strength evaluate_5(const std::array<int, 5> &cards);
Strength evaluate_7(const std::array<int, 7> &cards);
