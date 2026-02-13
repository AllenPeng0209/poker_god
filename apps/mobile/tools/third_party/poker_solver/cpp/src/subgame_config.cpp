#include "subgame_config.h"

#include <cctype>
#include <cstring>
#include <fstream>
#include <stdexcept>
#include <unordered_map>

#include "cards.h"

namespace {
struct JsonValue {
    enum class Type { Null, Bool, Number, String, Array, Object };
    Type type = Type::Null;
    bool bool_value = false;
    double number_value = 0.0;
    std::string string_value;
    std::vector<JsonValue> array_value;
    std::unordered_map<std::string, JsonValue> object_value;

    const JsonValue *get(const std::string &key) const {
        auto it = object_value.find(key);
        if (it == object_value.end()) {
            return nullptr;
        }
        return &it->second;
    }
};

class JsonParser {
public:
    explicit JsonParser(const std::string &input) : input_(input) {}

    JsonValue parse() {
        skip_ws();
        JsonValue value = parse_value();
        skip_ws();
        if (pos_ != input_.size()) {
            throw std::runtime_error("Unexpected trailing JSON input");
        }
        return value;
    }

private:
    const std::string &input_;
    std::size_t pos_ = 0;

    void skip_ws() {
        while (pos_ < input_.size() && std::isspace(static_cast<unsigned char>(input_[pos_]))) {
            ++pos_;
        }
    }

    char peek() const {
        if (pos_ >= input_.size()) {
            return '\0';
        }
        return input_[pos_];
    }

    char get() {
        if (pos_ >= input_.size()) {
            throw std::runtime_error("Unexpected end of JSON input");
        }
        return input_[pos_++];
    }

    bool consume(char expected) {
        if (peek() != expected) {
            return false;
        }
        ++pos_;
        return true;
    }

    JsonValue parse_value() {
        skip_ws();
        char ch = peek();
        if (ch == '{') {
            return parse_object();
        }
        if (ch == '[') {
            return parse_array();
        }
        if (ch == '"') {
            JsonValue value;
            value.type = JsonValue::Type::String;
            value.string_value = parse_string();
            return value;
        }
        if (ch == '-' || std::isdigit(static_cast<unsigned char>(ch))) {
            JsonValue value;
            value.type = JsonValue::Type::Number;
            value.number_value = parse_number();
            return value;
        }
        if (match_literal("true")) {
            JsonValue value;
            value.type = JsonValue::Type::Bool;
            value.bool_value = true;
            return value;
        }
        if (match_literal("false")) {
            JsonValue value;
            value.type = JsonValue::Type::Bool;
            value.bool_value = false;
            return value;
        }
        if (match_literal("null")) {
            JsonValue value;
            value.type = JsonValue::Type::Null;
            return value;
        }
        throw std::runtime_error("Invalid JSON value");
    }

    bool match_literal(const char *literal) {
        std::size_t start = pos_;
        for (std::size_t i = 0; literal[i] != '\0'; ++i) {
            if (start + i >= input_.size() || input_[start + i] != literal[i]) {
                return false;
            }
        }
        pos_ = start + std::strlen(literal);
        return true;
    }

    JsonValue parse_object() {
        JsonValue value;
        value.type = JsonValue::Type::Object;
        consume('{');
        skip_ws();
        if (consume('}')) {
            return value;
        }
        while (true) {
            skip_ws();
            if (peek() != '"') {
                throw std::runtime_error("Expected string key in JSON object");
            }
            std::string key = parse_string();
            skip_ws();
            if (!consume(':')) {
                throw std::runtime_error("Expected ':' after object key");
            }
            JsonValue child = parse_value();
            value.object_value.emplace(std::move(key), std::move(child));
            skip_ws();
            if (consume('}')) {
                break;
            }
            if (!consume(',')) {
                throw std::runtime_error("Expected ',' between object entries");
            }
        }
        return value;
    }

    JsonValue parse_array() {
        JsonValue value;
        value.type = JsonValue::Type::Array;
        consume('[');
        skip_ws();
        if (consume(']')) {
            return value;
        }
        while (true) {
            JsonValue child = parse_value();
            value.array_value.push_back(std::move(child));
            skip_ws();
            if (consume(']')) {
                break;
            }
            if (!consume(',')) {
                throw std::runtime_error("Expected ',' between array entries");
            }
        }
        return value;
    }

    std::string parse_string() {
        if (!consume('\"')) {
            throw std::runtime_error("Expected '\"' for JSON string");
        }
        std::string out;
        while (pos_ < input_.size()) {
            char ch = get();
            if (ch == '"') {
                break;
            }
            if (ch == '\\') {
                if (pos_ >= input_.size()) {
                    throw std::runtime_error("Invalid escape in JSON string");
                }
                char esc = get();
                switch (esc) {
                    case '"':
                        out.push_back('"');
                        break;
                    case '\\':
                        out.push_back('\\');
                        break;
                    case '/':
                        out.push_back('/');
                        break;
                    case 'b':
                        out.push_back('\b');
                        break;
                    case 'f':
                        out.push_back('\f');
                        break;
                    case 'n':
                        out.push_back('\n');
                        break;
                    case 'r':
                        out.push_back('\r');
                        break;
                    case 't':
                        out.push_back('\t');
                        break;
                    default:
                        throw std::runtime_error("Unsupported escape in JSON string");
                }
            } else {
                out.push_back(ch);
            }
        }
        return out;
    }

    double parse_number() {
        std::size_t start = pos_;
        if (peek() == '-') {
            ++pos_;
        }
        while (std::isdigit(static_cast<unsigned char>(peek()))) {
            ++pos_;
        }
        if (peek() == '.') {
            ++pos_;
            while (std::isdigit(static_cast<unsigned char>(peek()))) {
                ++pos_;
            }
        }
        if (peek() == 'e' || peek() == 'E') {
            ++pos_;
            if (peek() == '+' || peek() == '-') {
                ++pos_;
            }
            while (std::isdigit(static_cast<unsigned char>(peek()))) {
                ++pos_;
            }
        }
        double value = std::stod(input_.substr(start, pos_ - start));
        return value;
    }
};

std::vector<std::string> read_string_array(const JsonValue &value, const std::string &label) {
    if (value.type != JsonValue::Type::Array) {
        throw std::runtime_error(label + " must be an array");
    }
    std::vector<std::string> out;
    out.reserve(value.array_value.size());
    for (const auto &entry : value.array_value) {
        if (entry.type != JsonValue::Type::String) {
            throw std::runtime_error(label + " entries must be strings");
        }
        out.push_back(entry.string_value);
    }
    return out;
}

std::vector<double> read_number_array(const JsonValue &value, const std::string &label) {
    if (value.type != JsonValue::Type::Array) {
        throw std::runtime_error(label + " must be an array");
    }
    std::vector<double> out;
    out.reserve(value.array_value.size());
    for (const auto &entry : value.array_value) {
        if (entry.type != JsonValue::Type::Number) {
            throw std::runtime_error(label + " entries must be numbers");
        }
        out.push_back(entry.number_value);
    }
    return out;
}

std::vector<int> parse_board_cards(const JsonValue &root) {
    const JsonValue *board = root.get("board");
    if (!board) {
        return {};
    }
    std::vector<std::string> board_cards = read_string_array(*board, "board");
    std::vector<int> parsed;
    parsed.reserve(board_cards.size());
    for (const auto &card : board_cards) {
        parsed.push_back(card_id(card));
    }
    return parsed;
}

void parse_players(const JsonValue &root, SubgameConfig &config) {
    const JsonValue *players = root.get("players");
    if (!players || players->type != JsonValue::Type::Array) {
        return;
    }
    if (players->array_value.size() != 2) {
        throw std::runtime_error("players must have length 2");
    }
    for (std::size_t idx = 0; idx < 2; ++idx) {
        const JsonValue &entry = players->array_value[idx];
        if (entry.type != JsonValue::Type::Object) {
            throw std::runtime_error("players entries must be objects");
        }
        const JsonValue *hands_value = entry.get("hands");
        const JsonValue *weights_value = entry.get("weights");
        if (!hands_value || !weights_value) {
            continue;
        }
        std::vector<std::string> hands = read_string_array(*hands_value, "hands");
        std::vector<double> weights = read_number_array(*weights_value, "weights");
        if (hands.size() != weights.size()) {
            throw std::runtime_error("hands and weights length mismatch");
        }
        config.players[idx].hands.reserve(hands.size());
        for (const auto &hand : hands) {
            config.players[idx].hands.push_back(parse_hand(hand));
        }
        config.players[idx].weights = std::move(weights);
    }
}

int read_int_field(const JsonValue &root, const std::string &key, int fallback) {
    const JsonValue *value = root.get(key);
    if (!value) {
        return fallback;
    }
    if (value->type != JsonValue::Type::Number) {
        throw std::runtime_error(key + " must be a number");
    }
    return static_cast<int>(value->number_value);
}

bool read_bool_field(const JsonValue &root, const std::string &key, bool fallback) {
    const JsonValue *value = root.get(key);
    if (!value) {
        return fallback;
    }
    if (value->type != JsonValue::Type::Bool) {
        throw std::runtime_error(key + " must be a boolean");
    }
    return value->bool_value;
}

std::vector<double> read_optional_number_array(const JsonValue &root, const std::string &key) {
    const JsonValue *value = root.get(key);
    if (!value) {
        return {};
    }
    return read_number_array(*value, key);
}
}  // namespace

SubgameConfig load_subgame_config(const std::string &path) {
    std::ifstream in(path);
    if (!in) {
        throw std::runtime_error("Failed to open config: " + path);
    }
    std::string content((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
    JsonParser parser(content);
    JsonValue root = parser.parse();
    if (root.type != JsonValue::Type::Object) {
        throw std::runtime_error("Config root must be an object");
    }

    SubgameConfig config;
    config.board_cards = parse_board_cards(root);
    config.pot = read_int_field(root, "pot", config.pot);
    config.stack = read_int_field(root, "stack", config.stack);
    config.bet_sizes = read_optional_number_array(root, "bet_sizes");
    if (config.bet_sizes.empty()) {
        config.bet_sizes = {0.5, 1.0};
    }
    config.include_all_in = read_bool_field(root, "include_all_in", config.include_all_in);
    config.max_raises = read_int_field(root, "max_raises", config.max_raises);
    parse_players(root, config);
    return config;
}
