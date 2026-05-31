#include "pipeline_config.h"

#include <fstream>
#include <algorithm>
#include <sstream>
#include <regex>

#include "include/nlohmann/json.hpp"

namespace smart_gateway {

using json = nlohmann::json;

PipelineConfig& PipelineConfig::Instance() {
    static PipelineConfig instance;
    return instance;
}

bool PipelineConfig::AddPipeline(const Pipeline& pipeline) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (pipelines_.find(pipeline.id) != pipelines_.end()) {
        return false;
    }
    
    pipelines_[pipeline.id] = pipeline;
    return true;
}

bool PipelineConfig::RemovePipeline(const std::string& pipeline_id) {
    std::lock_guard<std::mutex> lock(mutex_);
    return pipelines_.erase(pipeline_id) > 0;
}

bool PipelineConfig::UpdatePipeline(const Pipeline& pipeline) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto it = pipelines_.find(pipeline.id);
    if (it == pipelines_.end()) {
        return false;
    }
    
    it->second = pipeline;
    return true;
}

bool PipelineConfig::HasPipeline(const std::string& pipeline_id) const {
    std::lock_guard<std::mutex> lock(mutex_);
    return pipelines_.find(pipeline_id) != pipelines_.end();
}

std::vector<Pipeline> PipelineConfig::GetPipelines() const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    std::vector<Pipeline> result;
    result.reserve(pipelines_.size());
    
    for (const auto& pair : pipelines_) {
        result.push_back(pair.second);
    }
    
    std::sort(result.begin(), result.end(),
              [](const Pipeline& a, const Pipeline& b) {
                  return a.priority > b.priority;
              });
    
    return result;
}

std::vector<Pipeline> PipelineConfig::GetPipelinesForRequest(const std::string& path,
                                                             const std::string& method) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    std::vector<Pipeline> result;
    
    for (const auto& pair : pipelines_) {
        const Pipeline& pipeline = pair.second;
        
        if (!pipeline.enabled) {
            continue;
        }
        
        if (!pipeline.method.empty() && pipeline.method != "*" && pipeline.method != method) {
            continue;
        }
        
        if (PathMatches(pipeline.path_pattern, path)) {
            result.push_back(pipeline);
        }
    }
    
    std::sort(result.begin(), result.end(),
              [](const Pipeline& a, const Pipeline& b) {
                  return a.priority > b.priority;
              });
    
    return result;
}

Pipeline PipelineConfig::GetPipeline(const std::string& pipeline_id) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto it = pipelines_.find(pipeline_id);
    if (it != pipelines_.end()) {
        return it->second;
    }
    
    return Pipeline{};
}

bool PipelineConfig::PathMatches(const std::string& pattern, const std::string& path) const {
    if (pattern == path) {
        return true;
    }
    
    if (pattern == "/*" || pattern == "/**") {
        return true;
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
        std::regex re(regex_pattern);
        return std::regex_match(path, re);
    } catch (...) {
        return false;
    }
}

void PipelineConfig::LoadFromFile(const std::string& config_path) {
    std::ifstream file(config_path);
    if (!file.is_open()) {
        return;
    }
    
    try {
        json config;
        file >> config;
        
        std::lock_guard<std::mutex> lock(mutex_);
        pipelines_.clear();
        
        if (config.contains("pipelines") && config["pipelines"].is_array()) {
            for (const auto& pipeline_json : config["pipelines"]) {
                Pipeline pipeline;
                pipeline.id = pipeline_json.value("id", "");
                pipeline.name = pipeline_json.value("name", "");
                pipeline.path_pattern = pipeline_json.value("path_pattern", "");
                pipeline.method = pipeline_json.value("method", "POST");
                pipeline.enabled = pipeline_json.value("enabled", true);
                pipeline.priority = pipeline_json.value("priority", 0);
                pipeline.description = pipeline_json.value("description", "");
                
                if (pipeline_json.contains("step_order") && pipeline_json["step_order"].is_array()) {
                    for (const auto& step_id : pipeline_json["step_order"]) {
                        pipeline.step_order.push_back(step_id);
                    }
                }
                
                if (pipeline_json.contains("steps") && pipeline_json["steps"].is_object()) {
                    for (auto it = pipeline_json["steps"].begin(); it != pipeline_json["steps"].end(); ++it) {
                        const auto& step_json = it.value();
                        PipelineStep step;
                        step.id = it.key();
                        
                        std::string type_str = step_json.value("type", "single_model");
                        if (type_str == "parallel") {
                            step.type = StepType::PARALLEL_MODELS;
                        } else if (type_str == "conditional") {
                            step.type = StepType::CONDITIONAL_BRANCH;
                        } else if (type_str == "ab_test") {
                            step.type = StepType::AB_TEST;
                        } else {
                            step.type = StepType::SINGLE_MODEL;
                        }
                        
                        if (step_json.contains("model_names") && step_json["model_names"].is_array()) {
                            for (const auto& model_name : step_json["model_names"]) {
                                step.model_names.push_back(model_name);
                            }
                        }
                        
                        step.input_source = step_json.value("input_source", "body");
                        step.output_mode = step_json.value("output_mode", "header");
                        step.header_name = step_json.value("header_name", "X-Inference-Result");
                        step.enabled = step_json.value("enabled", true);
                        step.timeout_ms = step_json.value("timeout_ms", 5000);
                        step.cache_enabled = step_json.value("cache_enabled", false);
                        step.cache_ttl_seconds = step_json.value("cache_ttl_seconds", 300);
                        
                        if (step.type == StepType::CONDITIONAL_BRANCH) {
                            step.condition.source_step = step_json.value("condition", json::object()).value("source_step", "");
                            step.condition.field = step_json.value("condition", json::object()).value("field", "");
                            step.condition.threshold = step_json.value("condition", json::object()).value("threshold", 0.0);
                            step.condition.value = step_json.value("condition", json::object()).value("value", "");
                            step.true_branch = step_json.value("true_branch", "");
                            step.false_branch = step_json.value("false_branch", "");
                        }
                        
                        if (step.type == StepType::AB_TEST) {
                            step.ab_test_id = step_json.value("ab_test_id", "");
                            step.traffic_split = step_json.value("traffic_split", 0.5);
                        }
                        
                        pipeline.steps[step.id] = step;
                    }
                }
                
                if (!pipeline.id.empty() && !pipeline.path_pattern.empty()) {
                    pipelines_[pipeline.id] = pipeline;
                }
            }
        }
    } catch (...) {
    }
}

void PipelineConfig::SaveToFile(const std::string& config_path) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    json config;
    config["pipelines"] = json::array();
    
    for (const auto& pair : pipelines_) {
        const Pipeline& pipeline = pair.second;
        json pipeline_json = {
            {"id", pipeline.id},
            {"name", pipeline.name},
            {"path_pattern", pipeline.path_pattern},
            {"method", pipeline.method},
            {"enabled", pipeline.enabled},
            {"priority", pipeline.priority},
            {"description", pipeline.description},
            {"step_order", json::array()},
            {"steps", json::object()}
        };
        
        for (const auto& step_id : pipeline.step_order) {
            pipeline_json["step_order"].push_back(step_id);
        }
        
        for (const auto& step_pair : pipeline.steps) {
            const PipelineStep& step = step_pair.second;
            json step_json;
            
            std::string type_str;
            switch (step.type) {
                case StepType::PARALLEL_MODELS: type_str = "parallel"; break;
                case StepType::CONDITIONAL_BRANCH: type_str = "conditional"; break;
                case StepType::AB_TEST: type_str = "ab_test"; break;
                default: type_str = "single_model";
            }
            
            step_json["type"] = type_str;
            step_json["model_names"] = json::array();
            for (const auto& model_name : step.model_names) {
                step_json["model_names"].push_back(model_name);
            }
            step_json["input_source"] = step.input_source;
            step_json["output_mode"] = step.output_mode;
            step_json["header_name"] = step.header_name;
            step_json["enabled"] = step.enabled;
            step_json["timeout_ms"] = step.timeout_ms;
            step_json["cache_enabled"] = step.cache_enabled;
            step_json["cache_ttl_seconds"] = step.cache_ttl_seconds;
            
            if (step.type == StepType::CONDITIONAL_BRANCH) {
                json condition_json = {
                    {"source_step", step.condition.source_step},
                    {"field", step.condition.field},
                    {"threshold", step.condition.threshold},
                    {"value", step.condition.value}
                };
                step_json["condition"] = condition_json;
                step_json["true_branch"] = step.true_branch;
                step_json["false_branch"] = step.false_branch;
            }
            
            if (step.type == StepType::AB_TEST) {
                step_json["ab_test_id"] = step.ab_test_id;
                step_json["traffic_split"] = step.traffic_split;
            }
            
            pipeline_json["steps"][step.id] = step_json;
        }
        
        config["pipelines"].push_back(pipeline_json);
    }
    
    std::ofstream file(config_path);
    if (file.is_open()) {
        file << config.dump(2);
    }
}

}
