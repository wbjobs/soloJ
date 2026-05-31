#include "pipeline_executor.h"

#include <sstream>
#include <algorithm>
#include <cmath>

#include "memory_pool.h"

namespace smart_gateway {

PipelineExecutor& PipelineExecutor::Instance() {
    static PipelineExecutor instance;
    return instance;
}

PipelineExecutor::PipelineExecutor()
    : inference_engine_(nullptr),
      cache_(InferenceCache::Instance()),
      rng_(std::random_device{}()) {
}

void PipelineExecutor::SetInferenceEngine(InferenceEngine* engine) {
    std::lock_guard<std::mutex> lock(mutex_);
    inference_engine_ = engine;
}

PipelineExecutionResult PipelineExecutor::ExecutePipeline(
    const Pipeline& pipeline,
    const std::vector<uint8_t>& input_data,
    const std::unordered_map<std::string, std::string>& headers) {
    
    auto start_time = std::chrono::steady_clock::now();
    
    PipelineExecutionResult result;
    result.pipeline_id = pipeline.id;
    result.success = true;
    
    std::unordered_map<std::string, StepResult> step_results_map;
    std::vector<uint8_t> current_input = input_data;
    
    size_t step_index = 0;
    while (step_index < pipeline.step_order.size()) {
        const std::string& step_id = pipeline.step_order[step_index];
        auto step_it = pipeline.steps.find(step_id);
        
        if (step_it == pipeline.steps.end()) {
            step_index++;
            continue;
        }
        
        const PipelineStep& step = step_it->second;
        
        if (!step.enabled) {
            step_index++;
            continue;
        }
        
        StepResult step_result = ExecuteStep(step, current_input, headers, step_results_map);
        result.step_results.push_back(step_result);
        step_results_map[step_id] = step_result;
        
        if (!step_result.success) {
            result.success = false;
            break;
        }
        
        if (step.type == StepType::CONDITIONAL_BRANCH) {
            std::string next_step;
            if (step_result.predictions.size() > 0 && step_result.predictions[0].first == "true") {
                next_step = step.true_branch;
            } else {
                next_step = step.false_branch;
            }
            
            if (!next_step.empty()) {
                for (size_t i = 0; i < pipeline.step_order.size(); i++) {
                    if (pipeline.step_order[i] == next_step) {
                        step_index = i;
                        goto next_step_found;
                    }
                }
            }
            break;
        }
        
        if (!step_result.processed_data.empty()) {
            current_input = step_result.processed_data;
        }
        
        step_index++;
    next_step_found:;
    }
    
    if (!result.step_results.empty()) {
        const StepResult& last_step = result.step_results.back();
        std::ostringstream oss;
        oss << "{";
        oss << "\"step_id\":\"" << last_step.step_id << "\",";
        oss << "\"predictions\":[";
        for (size_t i = 0; i < last_step.predictions.size(); i++) {
            if (i > 0) oss << ",";
            oss << "{\"label\":\"" << last_step.predictions[i].first << "\",";
            oss << "\"confidence\":" << last_step.predictions[i].second << "}";
        }
        oss << "]}";
        result.final_output = oss.str();
    }
    
    auto end_time = std::chrono::steady_clock::now();
    result.total_latency = std::chrono::duration_cast<std::chrono::milliseconds>(
        end_time - start_time);
    
    return result;
}

StepResult PipelineExecutor::ExecuteStep(
    const PipelineStep& step,
    const std::vector<uint8_t>& input_data,
    const std::unordered_map<std::string, std::string>& headers,
    const std::unordered_map<std::string, StepResult>& previous_results) {
    
    switch (step.type) {
        case StepType::SINGLE_MODEL:
            if (!step.model_names.empty()) {
                return ExecuteSingleModel(step, input_data, step.model_names[0]);
            }
            break;
            
        case StepType::PARALLEL_MODELS:
            return ExecuteParallelModels(step, input_data);
            
        case StepType::CONDITIONAL_BRANCH:
            return ExecuteConditionalBranch(step, previous_results);
            
        case StepType::AB_TEST:
            return ExecuteABTest(step, input_data);
    }
    
    StepResult result;
    result.step_id = step.id;
    result.success = false;
    result.error_message = "Invalid step type";
    return result;
}

StepResult PipelineExecutor::ExecuteSingleModel(
    const PipelineStep& step,
    const std::vector<uint8_t>& input_data,
    const std::string& model_name) {
    
    auto start_time = std::chrono::steady_clock::now();
    
    StepResult result;
    result.step_id = step.id;
    result.model_name = model_name;
    result.from_cache = false;
    
    std::vector<std::pair<std::string, float>> predictions;
    
    if (step.cache_enabled) {
        if (cache_.Get(model_name, input_data, predictions)) {
            result.from_cache = true;
            result.predictions = predictions;
            result.success = true;
            
            auto end_time = std::chrono::steady_clock::now();
            result.latency = std::chrono::duration_cast<std::chrono::milliseconds>(
                end_time - start_time);
            
            return result;
        }
    }
    
    if (!inference_engine_) {
        result.success = false;
        result.error_message = "Inference engine not initialized";
        return result;
    }
    
    InferenceResult ir = inference_engine_->RunInference(model_name, input_data);
    
    if (!ir.success) {
        result.success = false;
        result.error_message = ir.error_message;
        return result;
    }
    
    result.predictions = std::move(ir.predictions);
    result.success = true;
    
    if (step.cache_enabled) {
        cache_.Put(model_name, input_data, result.predictions, step.cache_ttl_seconds);
    }
    
    auto end_time = std::chrono::steady_clock::now();
    result.latency = std::chrono::duration_cast<std::chrono::milliseconds>(
        end_time - start_time);
    
    return result;
}

StepResult PipelineExecutor::ExecuteParallelModels(
    const PipelineStep& step,
    const std::vector<uint8_t>& input_data) {
    
    auto start_time = std::chrono::steady_clock::now();
    
    StepResult result;
    result.step_id = step.id;
    result.success = true;
    
    for (const auto& model_name : step.model_names) {
        StepResult model_result = ExecuteSingleModel(step, input_data, model_name);
        
        for (const auto& pred : model_result.predictions) {
            result.predictions.emplace_back(
                model_name + ":" + pred.first,
                pred.second
            );
        }
        
        if (!model_result.success) {
            result.success = false;
            result.error_message = model_result.error_message;
        }
    }
    
    auto end_time = std::chrono::steady_clock::now();
    result.latency = std::chrono::duration_cast<std::chrono::milliseconds>(
        end_time - start_time);
    
    return result;
}

StepResult PipelineExecutor::ExecuteConditionalBranch(
    const PipelineStep& step,
    const std::unordered_map<std::string, StepResult>& previous_results) {
    
    auto start_time = std::chrono::steady_clock::now();
    
    StepResult result;
    result.step_id = step.id;
    result.success = true;
    
    auto source_it = previous_results.find(step.condition.source_step);
    if (source_it == previous_results.end()) {
        result.predictions.emplace_back("false", 1.0f);
    } else {
        bool condition_met = EvaluateCondition(step.condition, source_it->second);
        result.predictions.emplace_back(condition_met ? "true" : "false", 1.0f);
    }
    
    auto end_time = std::chrono::steady_clock::now();
    result.latency = std::chrono::duration_cast<std::chrono::milliseconds>(
        end_time - start_time);
    
    return result;
}

StepResult PipelineExecutor::ExecuteABTest(
    const PipelineStep& step,
    const std::vector<uint8_t>& input_data) {
    
    if (step.model_names.size() < 2) {
        StepResult result;
        result.step_id = step.id;
        result.success = false;
        result.error_message = "AB test requires at least 2 models";
        return result;
    }
    
    const std::string& model_a = step.model_names[0];
    const std::string& model_b = step.model_names[1];
    
    StepResult result_a = ExecuteSingleModel(step, input_data, model_a);
    StepResult result_b = ExecuteSingleModel(step, input_data, model_b);
    
    ABTestResult ab_result;
    ab_result.ab_test_id = step.ab_test_id;
    ab_result.model_a = model_a;
    ab_result.model_b = model_b;
    ab_result.predictions_a = result_a.predictions;
    ab_result.predictions_b = result_b.predictions;
    ab_result.similarity_score = CalculateSimilarity(result_a.predictions, result_b.predictions);
    ab_result.consensus = ab_result.similarity_score > 0.8;
    
    {
        std::lock_guard<std::mutex> lock(mutex_);
        ab_test_results_[step.ab_test_id].push_back(ab_result);
    }
    
    std::uniform_real_distribution<double> dist(0.0, 1.0);
    bool use_a = dist(rng_) < step.traffic_split;
    
    StepResult result;
    result.step_id = step.id;
    
    if (use_a) {
        result = result_a;
        result.model_name = model_a;
    } else {
        result = result_b;
        result.model_name = model_b;
    }
    
    return result;
}

bool PipelineExecutor::EvaluateCondition(
    const Condition& condition,
    const StepResult& source_result) {
    
    if (source_result.predictions.empty()) {
        return false;
    }
    
    for (const auto& pred : source_result.predictions) {
        if (pred.first == condition.field) {
            float value = pred.second;
            float threshold = static_cast<float>(condition.threshold);
            
            switch (condition.op) {
                case ConditionOperator::GREATER_THAN:
                    return value > threshold;
                case ConditionOperator::LESS_THAN:
                    return value < threshold;
                case ConditionOperator::GREATER_THAN_OR_EQUAL:
                    return value >= threshold;
                case ConditionOperator::LESS_THAN_OR_EQUAL:
                    return value <= threshold;
                default:
                    break;
            }
        }
    }
    
    return false;
}

double PipelineExecutor::CalculateSimilarity(
    const std::vector<std::pair<std::string, float>>& a,
    const std::vector<std::pair<std::string, float>>& b) {
    
    if (a.empty() || b.empty()) {
        return 0.0;
    }
    
    std::unordered_map<std::string, float> map_a, map_b;
    for (const auto& p : a) map_a[p.first] = p.second;
    for (const auto& p : b) map_b[p.first] = p.second;
    
    double dot_product = 0.0;
    double norm_a = 0.0;
    double norm_b = 0.0;
    
    for (const auto& p : map_a) {
        norm_a += p.second * p.second;
        auto it = map_b.find(p.first);
        if (it != map_b.end()) {
            dot_product += p.second * it->second;
        }
    }
    
    for (const auto& p : map_b) {
        norm_b += p.second * p.second;
    }
    
    if (norm_a == 0.0 || norm_b == 0.0) {
        return 0.0;
    }
    
    return dot_product / (std::sqrt(norm_a) * std::sqrt(norm_b));
}

std::vector<ABTestResult> PipelineExecutor::GetABTestResults(
    const std::string& ab_test_id) const {
    
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto it = ab_test_results_.find(ab_test_id);
    if (it != ab_test_results_.end()) {
        return it->second;
    }
    
    return {};
}

void PipelineExecutor::ClearABTestResults(const std::string& ab_test_id) {
    std::lock_guard<std::mutex> lock(mutex_);
    ab_test_results_.erase(ab_test_id);
}

}
