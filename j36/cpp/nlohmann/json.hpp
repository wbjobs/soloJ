#ifndef NLOHMANN_JSON_HPP
#define NLOHMANN_JSON_HPP

#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <vector>
#include <sstream>
#include <cctype>

namespace nlohmann {

class json {
public:
    enum class value_t {
        null,
        object,
        array,
        string,
        boolean,
        number_integer,
        number_float
    };

private:
    value_t type_;
    std::string string_value_;
    std::map<std::string, json> object_value_;
    std::vector<json> array_value_;
    int64_t int_value_;
    double float_value_;
    bool bool_value_;

public:
    json() : type_(null) {}

    static json parse(const std::string& s) {
        json j;
        size_t pos = 0;
        j.parse_internal(s, pos);
        return j;
    }

    bool is_array() const { return type_ == array; }
    bool is_string() const { return type_ == string; }
    bool is_object() const { return type_ == object; }

    std::string get_string() const { return string_value_; }

    const std::vector<json>& get_array() const { return array_value_; }

    const json& operator[](const char* key) const {
        auto it = object_value_.find(key);
        if (it != object_value_.end()) {
            return it->second;
        }
        static json null_json;
        return null_json;
    }

    const json& operator[](size_t index) const {
        if (index < array_value_.size()) {
            return array_value_[index];
        }
        static json null_json;
        return null_json;
    }

    bool contains(const char* key) const {
        return object_value_.find(key) != object_value_.end();
    }

    std::string get() const { return string_value_; }

    int64_t get_int() const { return int_value_; }

    uint32_t get() const { return static_cast<uint32_t>(int_value_); }

    std::map<std::string, std::string> get_map() const {
        std::map<std::string, std::string> result;
        for (const auto& [key, value] : object_value_) {
            result[key] = value.string_value_;
        }
        return result;
    }

    std::string dump() const {
        std::ostringstream oss;
        dump_internal(oss, 0);
        return oss.str();
    }

    json& operator=(const std::string& s) {
        type_ = string;
        string_value_ = s;
        return *this;
    }

    json& operator=(const char* s) {
        type_ = string;
        string_value_ = s;
        return *this;
    }

    void push_back(const json& j) {
        type_ = array;
        array_value_.push_back(j);
    }

    json& operator[](const std::string& key) {
        type_ = object;
        return object_value_[key];
    }

    static json array() {
        json j;
        j.type_ = array;
        return j;
    }

private:
    void skip_whitespace(const std::string& s, size_t& pos) {
        while (pos < s.size() && std::isspace(static_cast<unsigned char>(s[pos]))) {
            pos++;
        }
    }

    void parse_internal(const std::string& s, size_t& pos) {
        skip_whitespace(s, pos);

        if (pos >= s.size()) return;

        char c = s[pos];

        if (c == '"') {
            type_ = string;
            pos++;
            std::string value;
            while (pos < s.size() && s[pos] != '"') {
                if (s[pos] == '\\' && pos + 1 < s.size()) {
                    pos++;
                    char esc = s[pos];
                    switch (esc) {
                        case 'n': value += '\n'; break;
                        case 't': value += '\t'; break;
                        case 'r': value += '\r'; break;
                        case '"': value += '"'; break;
                        case '\\': value += '\\'; break;
                        default: value += esc; break;
                    }
                } else {
                    value += s[pos];
                }
                pos++;
            }
            pos++;
            string_value_ = value;
        }
        else if (c == '{') {
            type_ = object;
            pos++;
            skip_whitespace(s, pos);
            while (pos < s.size() && s[pos] != '}') {
                skip_whitespace(s, pos);
                std::string key;
                if (s[pos] == '"') {
                    pos++;
                    while (pos < s.size() && s[pos] != '"') {
                        key += s[pos];
                        pos++;
                    }
                    pos++;
                }
                skip_whitespace(s, pos);
                if (s[pos] == ':') {
                    pos++;
                }
                json value;
                value.parse_internal(s, pos);
                object_value_[key] = value;
                skip_whitespace(s, pos);
                if (s[pos] == ',') {
                    pos++;
                }
                skip_whitespace(s, pos);
            }
            pos++;
        }
        else if (c == '[') {
            type_ = array;
            pos++;
            skip_whitespace(s, pos);
            while (pos < s.size() && s[pos] != ']') {
                json elem;
                elem.parse_internal(s, pos);
                array_value_.push_back(elem);
                skip_whitespace(s, pos);
                if (s[pos] == ',') {
                    pos++;
                }
                skip_whitespace(s, pos);
            }
            pos++;
        }
        else if (c == 't' || c == 'f') {
            type_ = boolean;
            bool_value_ = (c == 't');
            pos += (c == 't') ? 4 : 5;
        }
        else if (c == 'n') {
            type_ = null;
            pos += 4;
        }
        else if (c == '-' || std::isdigit(static_cast<unsigned char>(c))) {
            size_t start = pos;
            bool is_float = false;
            while (pos < s.size() && (std::isdigit(static_cast<unsigned char>(s[pos])) || s[pos] == '.' || s[pos] == 'e' || s[pos] == 'E' || s[pos] == '-' || s[pos] == '+')) {
                if (s[pos] == '.' || s[pos] == 'e' || s[pos] == 'E') {
                    is_float = true;
                }
                pos++;
            }
            std::string num_str = s.substr(start, pos - start);
            if (is_float) {
                type_ = number_float;
                float_value_ = std::stod(num_str);
            } else {
                type_ = number_integer;
                int_value_ = std::stoll(num_str);
            }
        }
    }

    void dump_internal(std::ostringstream& oss, int indent) const {
        switch (type_) {
            case null:
                oss << "null";
                break;
            case string:
                oss << '"';
                for (char c : string_value_) {
                    switch (c) {
                        case '"': oss << "\\\""; break;
                        case '\\': oss << "\\\\"; break;
                        case '\n': oss << "\\n"; break;
                        case '\r': oss << "\\r"; break;
                        case '\t': oss << "\\t"; break;
                        default: oss << c; break;
                    }
                }
                oss << '"';
                break;
            case boolean:
                oss << (bool_value_ ? "true" : "false");
                break;
            case number_integer:
                oss << int_value_;
                break;
            case number_float:
                oss << float_value_;
                break;
            case array:
                oss << "[";
                for (size_t i = 0; i < array_value_.size(); i++) {
                    if (i > 0) oss << ",";
                    array_value_[i].dump_internal(oss, indent + 1);
                }
                oss << "]";
                break;
            case object:
                oss << "{";
                bool first = true;
                for (const auto& [key, value] : object_value_) {
                    if (!first) oss << ",";
                    first = false;
                    oss << "\"" << key << "\":";
                    value.dump_internal(oss, indent + 1);
                }
                oss << "}";
                break;
        }
    }
};

}

#endif
