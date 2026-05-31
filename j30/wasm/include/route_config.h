#pragma once

#include <string>
#include <vector>
#include <unordered_map>
#include <mutex>
#include <regex>
#include <memory>

namespace smart_gateway {

struct RouteRule {
    std::string id;
    std::string path_pattern;
    std::string method;
    std::string model_name;
    std::string input_source;
    std::string output_mode;
    std::string header_name;
    bool enabled;
    int priority;
};

class RouteConfig {
public:
    static RouteConfig& Instance();
    
    bool AddRule(const RouteRule& rule);
    bool RemoveRule(const std::string& rule_id);
    bool UpdateRule(const RouteRule& rule);
    bool HasRule(const std::string& rule_id) const;
    
    std::vector<RouteRule> GetRules() const;
    std::vector<RouteRule> GetRulesForRequest(const std::string& path, 
                                             const std::string& method) const;
    
    void LoadFromFile(const std::string& config_path);
    void SaveToFile(const std::string& config_path) const;
    
private:
    RouteConfig() = default;
    
    struct CompiledRule {
        RouteRule rule;
        std::shared_ptr<std::regex> regex;
    };
    
    std::unordered_map<std::string, CompiledRule> rules_;
    mutable std::unordered_map<std::string, std::shared_ptr<std::regex>> regex_cache_;
    mutable std::mutex mutex_;
    
    bool PathMatches(const std::string& pattern, const std::string& path,
                     const std::shared_ptr<std::regex>& compiled) const;
    std::shared_ptr<std::regex> CompilePattern(const std::string& pattern) const;
    void InvalidateRegexCache();
};

}
