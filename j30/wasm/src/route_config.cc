#include "route_config.h"

#include <fstream>
#include <algorithm>
#include <sstream>

#include "include/nlohmann/json.hpp"

namespace smart_gateway {

using json = nlohmann::json;

RouteConfig& RouteConfig::Instance() {
    static RouteConfig instance;
    return instance;
}

bool RouteConfig::AddRule(const RouteRule& rule) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (rules_.find(rule.id) != rules_.end()) {
        return false;
    }
    
    CompiledRule compiled;
    compiled.rule = rule;
    compiled.regex = CompilePattern(rule.path_pattern);
    
    rules_[rule.id] = std::move(compiled);
    return true;
}

bool RouteConfig::RemoveRule(const std::string& rule_id) {
    std::lock_guard<std::mutex> lock(mutex_);
    return rules_.erase(rule_id) > 0;
}

bool RouteConfig::UpdateRule(const RouteRule& rule) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto it = rules_.find(rule.id);
    if (it == rules_.end()) {
        return false;
    }
    
    CompiledRule compiled;
    compiled.rule = rule;
    compiled.regex = CompilePattern(rule.path_pattern);
    
    it->second = std::move(compiled);
    return true;
}

bool RouteConfig::HasRule(const std::string& rule_id) const {
    std::lock_guard<std::mutex> lock(mutex_);
    return rules_.find(rule_id) != rules_.end();
}

std::vector<RouteRule> RouteConfig::GetRules() const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    std::vector<RouteRule> result;
    result.reserve(rules_.size());
    
    for (const auto& pair : rules_) {
        result.push_back(pair.second.rule);
    }
    
    std::sort(result.begin(), result.end(),
              [](const RouteRule& a, const RouteRule& b) {
                  return a.priority > b.priority;
              });
    
    return result;
}

std::vector<RouteRule> RouteConfig::GetRulesForRequest(const std::string& path,
                                                        const std::string& method) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    std::vector<RouteRule> result;
    result.reserve(rules_.size());
    
    for (const auto& pair : rules_) {
        const CompiledRule& compiled = pair.second;
        const RouteRule& rule = compiled.rule;
        
        if (!rule.enabled) {
            continue;
        }
        
        if (!rule.method.empty() && rule.method != "*" && rule.method != method) {
            continue;
        }
        
        if (PathMatches(rule.path_pattern, path, compiled.regex)) {
            result.push_back(rule);
        }
    }
    
    std::sort(result.begin(), result.end(),
              [](const RouteRule& a, const RouteRule& b) {
                  return a.priority > b.priority;
              });
    
    return result;
}

std::shared_ptr<std::regex> RouteConfig::CompilePattern(const std::string& pattern) const {
    auto it = regex_cache_.find(pattern);
    if (it != regex_cache_.end()) {
        return it->second;
    }
    
    if (pattern == "/*" || pattern == "/**") {
        auto regex = std::make_shared<std::regex>(".*");
        regex_cache_[pattern] = regex;
        return regex;
    }
    
    std::string regex_pattern;
    regex_pattern.reserve(pattern.size() * 2);
    
    for (size_t i = 0; i < pattern.size(); ++i) {
        char c = pattern[i];
        switch (c) {
            case '*':
                if (i + 1 < pattern.size() && pattern[i + 1] == '*') {
                    regex_pattern += ".*";
                    ++i;
                } else {
                    regex_pattern += "[^/]*";
                }
                break;
            case '.':
                regex_pattern += "\\.";
                break;
            case '/':
                regex_pattern += "/";
                break;
            default:
                regex_pattern += c;
        }
    }
    
    try {
        auto regex = std::make_shared<std::regex>(regex_pattern);
        regex_cache_[pattern] = regex;
        return regex;
    } catch (...) {
        return nullptr;
    }
}

bool RouteConfig::PathMatches(const std::string& pattern, const std::string& path,
                              const std::shared_ptr<std::regex>& compiled) const {
    if (pattern == path) {
        return true;
    }
    
    if (!compiled) {
        return false;
    }
    
    try {
        return std::regex_match(path, *compiled);
    } catch (...) {
        return false;
    }
}

void RouteConfig::InvalidateRegexCache() {
    std::lock_guard<std::mutex> lock(mutex_);
    regex_cache_.clear();
}

void RouteConfig::LoadFromFile(const std::string& config_path) {
    std::ifstream file(config_path);
    if (!file.is_open()) {
        return;
    }
    
    try {
        json config;
        file >> config;
        
        std::lock_guard<std::mutex> lock(mutex_);
        rules_.clear();
        regex_cache_.clear();
        
        if (config.contains("rules") && config["rules"].is_array()) {
            for (const auto& rule_json : config["rules"]) {
                RouteRule rule;
                rule.id = rule_json.value("id", "");
                rule.path_pattern = rule_json.value("path_pattern", "");
                rule.method = rule_json.value("method", "GET");
                rule.model_name = rule_json.value("model_name", "");
                rule.input_source = rule_json.value("input_source", "body");
                rule.output_mode = rule_json.value("output_mode", "header");
                rule.header_name = rule_json.value("header_name", "X-Inference-Result");
                rule.enabled = rule_json.value("enabled", true);
                rule.priority = rule_json.value("priority", 0);
                
                if (!rule.id.empty() && !rule.path_pattern.empty()) {
                    CompiledRule compiled;
                    compiled.rule = rule;
                    compiled.regex = CompilePattern(rule.path_pattern);
                    rules_[rule.id] = std::move(compiled);
                }
            }
        }
    } catch (...) {
    }
}

void RouteConfig::SaveToFile(const std::string& config_path) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    json config;
    config["rules"] = json::array();
    
    for (const auto& pair : rules_) {
        const RouteRule& rule = pair.second.rule;
        json rule_json = {
            {"id", rule.id},
            {"path_pattern", rule.path_pattern},
            {"method", rule.method},
            {"model_name", rule.model_name},
            {"input_source", rule.input_source},
            {"output_mode", rule.output_mode},
            {"header_name", rule.header_name},
            {"enabled", rule.enabled},
            {"priority", rule.priority}
        };
        config["rules"].push_back(rule_json);
    }
    
    std::ofstream file(config_path);
    if (file.is_open()) {
        file << config.dump(2);
    }
}

}
