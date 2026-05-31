#pragma once

#include <string>
#include <vector>
#include <memory>
#include <unordered_map>
#include <mutex>
#include <chrono>
#include <functional>

namespace smart_gateway {

enum class StepType {
    SINGLE_MODEL,
    PARALLEL_MODELS,
    CONDITIONAL_BRANCH,
    AB_TEST
};

enum class ConditionOperator {
    EQUALS,
    NOT_EQUALS,
    GREATER_THAN,
    LESS_THAN,
    GREATER_THAN_OR_EQUAL,
    LESS_THAN_OR_EQUAL,
    CONTAINS,
    REGEX_MATCH
};

struct Condition {
    std::string source_step;
    std::string field;
    ConditionOperator op;
    std::string value;
    double threshold = 0.0;
};

struct PipelineStep {
    std::string id;
    StepType type;
    std::vector<std::string> model_names;
    std::string input_source;
    std::string output_mode;
    std::string header_name;
    bool enabled;
    
    Condition condition;
    std::string true_branch;
    std::string false_branch;
    
    std::string ab_test_id;
    double traffic_split = 0.5;
    
    int timeout_ms = 5000;
    bool cache_enabled = false;
    int cache_ttl_seconds = 300;
};

struct Pipeline {
    std::string id;
    std::string name;
    std::string path_pattern;
    std::string method;
    std::vector<std::string> step_order;
    std::unordered_map<std::string, PipelineStep> steps;
    bool enabled;
    int priority;
    std::string description;
};

class PipelineConfig {
public:
    static PipelineConfig& Instance();
    
    bool AddPipeline(const Pipeline& pipeline);
    bool RemovePipeline(const std::string& pipeline_id);
    bool UpdatePipeline(const Pipeline& pipeline);
    bool HasPipeline(const std::string& pipeline_id) const;
    
    std::vector<Pipeline> GetPipelines() const;
    std::vector<Pipeline> GetPipelinesForRequest(const std::string& path,
                                                  const std::string& method) const;
    Pipeline GetPipeline(const std::string& pipeline_id) const;
    
    void LoadFromFile(const std::string& config_path);
    void SaveToFile(const std::string& config_path) const;
    
private:
    PipelineConfig() = default;
    
    std::unordered_map<std::string, Pipeline> pipelines_;
    mutable std::mutex mutex_;
    
    bool PathMatches(const std::string& pattern, const std::string& path) const;
};

}
