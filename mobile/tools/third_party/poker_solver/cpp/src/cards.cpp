#include "cards.h"

#include <algorithm>
#include <array>
#include <stdexcept>

namespace {
constexpr std::array<char, 13> kRanks{{'2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'}};
constexpr std::array<char, 4> kSuits{{'c', 'd', 'h', 's'}};
}

int card_id(const std::string &card) {
    if (card.size() != 2) {
        throw std::invalid_argument("Card must be 2 chars like As");
    }
    return card_id(card[0], card[1]);
}

int card_id(char rank, char suit) {
    auto rank_it = std::find(kRanks.begin(), kRanks.end(), rank);
    auto suit_it = std::find(kSuits.begin(), kSuits.end(), suit);
    if (rank_it == kRanks.end() || suit_it == kSuits.end()) {
        throw std::invalid_argument("Invalid card rank/suit");
    }
    int r = static_cast<int>(rank_it - kRanks.begin());
    int s = static_cast<int>(suit_it - kSuits.begin());
    return s * 13 + r;
}

std::string card_str(int card) {
    int rank = card % 13;
    int suit = card / 13;
    std::string out;
    out.push_back(kRanks[static_cast<std::size_t>(rank)]);
    out.push_back(kSuits[static_cast<std::size_t>(suit)]);
    return out;
}

std::array<int, 2> parse_hand(const std::string &hand) {
    if (hand.size() != 4) {
        throw std::invalid_argument("Hand must be 4 chars like AsKd");
    }
    int c1 = card_id(hand.substr(0, 2));
    int c2 = card_id(hand.substr(2, 2));
    if (c1 == c2) {
        throw std::invalid_argument("Hand has duplicate card");
    }
    if (c1 < c2) {
        return {c1, c2};
    }
    return {c2, c1};
}

std::vector<int> parse_board(const std::string &board) {
    if (board.size() % 2 != 0) {
        throw std::invalid_argument("Board string must have even length");
    }
    std::vector<int> cards;
    cards.reserve(board.size() / 2);
    for (std::size_t i = 0; i < board.size(); i += 2) {
        cards.push_back(card_id(board.substr(i, 2)));
    }
    return cards;
}

Strength evaluate_5(const std::array<int, 5> &cards) {
    std::array<int, 5> ranks{};
    std::array<int, 5> suits{};
    for (std::size_t i = 0; i < 5; ++i) {
        ranks[i] = cards[i] % 13 + 2;
        suits[i] = cards[i] / 13;
    }

    std::array<int, 15> counts{};
    counts.fill(0);
    for (int rank : ranks) {
        counts[rank] += 1;
    }

    std::vector<std::pair<int, int>> count_items;
    count_items.reserve(5);
    for (int rank = 2; rank <= 14; ++rank) {
        if (counts[rank] > 0) {
            count_items.push_back({rank, counts[rank]});
        }
    }
    std::sort(count_items.begin(), count_items.end(), [](const auto &a, const auto &b) {
        if (a.second != b.second) {
            return a.second > b.second;
        }
        return a.first > b.first;
    });

    std::vector<int> ranks_sorted = {ranks.begin(), ranks.end()};
    std::sort(ranks_sorted.begin(), ranks_sorted.end(), std::greater<int>());

    bool is_flush = std::all_of(suits.begin(), suits.end(), [&](int suit) { return suit == suits[0]; });

    std::vector<int> unique_ranks = ranks_sorted;
    unique_ranks.erase(std::unique(unique_ranks.begin(), unique_ranks.end()), unique_ranks.end());
    bool is_straight = false;
    int straight_high = 0;
    if (unique_ranks.size() == 5 && unique_ranks[0] - unique_ranks[4] == 4) {
        is_straight = true;
        straight_high = unique_ranks[0];
    } else if (unique_ranks == std::vector<int>({14, 5, 4, 3, 2})) {
        is_straight = true;
        straight_high = 5;
    }

    Strength result{};
    result.fill(0);

    if (is_straight && is_flush) {
        result = {8, straight_high, 0, 0, 0, 0};
        return result;
    }
    if (count_items[0].second == 4) {
        int quad = count_items[0].first;
        int kicker = count_items[1].first;
        result = {7, quad, kicker, 0, 0, 0};
        return result;
    }
    if (count_items[0].second == 3 && count_items[1].second == 2) {
        result = {6, count_items[0].first, count_items[1].first, 0, 0, 0};
        return result;
    }
    if (is_flush) {
        result = {5, ranks_sorted[0], ranks_sorted[1], ranks_sorted[2], ranks_sorted[3], ranks_sorted[4]};
        return result;
    }
    if (is_straight) {
        result = {4, straight_high, 0, 0, 0, 0};
        return result;
    }
    if (count_items[0].second == 3) {
        int trip = count_items[0].first;
        std::vector<int> kickers;
        for (std::size_t i = 1; i < count_items.size(); ++i) {
            kickers.push_back(count_items[i].first);
        }
        std::sort(kickers.begin(), kickers.end(), std::greater<int>());
        result = {3, trip, kickers[0], kickers[1], 0, 0};
        return result;
    }
    if (count_items[0].second == 2 && count_items[1].second == 2) {
        int high_pair = std::max(count_items[0].first, count_items[1].first);
        int low_pair = std::min(count_items[0].first, count_items[1].first);
        int kicker = count_items[2].first;
        result = {2, high_pair, low_pair, kicker, 0, 0};
        return result;
    }
    if (count_items[0].second == 2) {
        int pair = count_items[0].first;
        std::vector<int> kickers;
        for (std::size_t i = 1; i < count_items.size(); ++i) {
            kickers.push_back(count_items[i].first);
        }
        std::sort(kickers.begin(), kickers.end(), std::greater<int>());
        result = {1, pair, kickers[0], kickers[1], kickers[2], 0};
        return result;
    }

    result = {0, ranks_sorted[0], ranks_sorted[1], ranks_sorted[2], ranks_sorted[3], ranks_sorted[4]};
    return result;
}

Strength evaluate_7(const std::array<int, 7> &cards) {
    Strength best{};
    best.fill(-1);
    for (int a = 0; a < 7; ++a) {
        for (int b = a + 1; b < 7; ++b) {
            for (int c = b + 1; c < 7; ++c) {
                for (int d = c + 1; d < 7; ++d) {
                    for (int e = d + 1; e < 7; ++e) {
                        std::array<int, 5> combo{{cards[a], cards[b], cards[c], cards[d], cards[e]}};
                        Strength rank = evaluate_5(combo);
                        if (rank > best) {
                            best = rank;
                        }
                    }
                }
            }
        }
    }
    return best;
}
