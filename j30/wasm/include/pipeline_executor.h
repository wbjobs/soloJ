#pragma once

#include <string>
#include <vector>
#include <unordered_map>
#include <memory>
#include <functional>
#include <chrono>
#include <random>

#include "pipeline_config.h"
#include "inference_engine.h"
#include "inference_cache.h"

namespace smart_gateway {

struct StepResult {
    std::string step_id;
    std::string model_name;
    bool success;
    bool from_cache;
    std::vector<std::pair<std::string, float>> predictions;
    std::vector<uint8_t> processed_data;
    std::chrono::milliseconds latency;
    std::string error_message;
};

struct PipelineExecutionResult {
    std::string pipeline_id;
    bool success;
    std::vector<StepResult> step_results;
    std::string final_output;
    std::chrono::milliseconds total_latency;
    std::string ab_test_group;
};

struct ABTestResult {
    std::string ab_test_id;
    std::string model_a;
    std::string model_b;
    std::vector<std::pair<std::string, float>> predictions_a;
    std::vector<std::pair<std::string, float>> predictions_b;
    double similarity_score;
    bool consensus;
};

class PipelineExecutor {
public:
    static PipelineExecutor& Instance();
    
    PipelineExecutionResult ExecutePipeline(const Pipeline& pipeline,
                                             const std::vector<uint8_t>& input_data,
                                             const std::unordered_map<std::string, std::string>& headers);
    
    void SetInferenceEngine(InferenceEngine* engine);
    
    std::vector<ABTestResult> GetABTestResults(const std::string& ab_test_id) const;
    void ClearABTestResults(const std::string& ab_test_id);
    
private:
    PipelineExecutor();
    
    StepResult ExecuteStep(const PipelineStep& step,
                           const std::vector<uint8_t>& input_data,
                           const std::unordered_map<std::string, std::string>& headers,
                           const std::unordered_map<std::string, StepResult>& previous_results);
    
    StepResult ExecuteSingleModel(const PipelineStep& step,
                                   const std::vector<uint8_t>& input_data,
                                   const std::string& model_name);
    
    StepResult ExecuteParallelModels(const PipelineStep& step,
                                      const std::vector<uint8_t>& input_data);
    
    StepResult ExecuteConditionalBranch(const PipelineStep& step,
                                         const std::unordered_map<std::string, StepResult>& previous_results);
    
    StepResult ExecuteABTest(const PipelineStep& step,
                              const std::vector<uint8_t>& input_data);
    
    bool EvaluateCondition(const Condition& condition,
                           const StepResult& source_result);
    
    double CalculateSimilarity(const std::vector<std::pair<std::string, float>>& a,
                                const std::vector<std::pair<std::string, float>>& b);
    
    std::string BuildCacheKey(const std::string& model_name,
                               const std::vector<uint8_t>& input_data);
    
    InferenceEngine* inference_engine_;
    InferenceCache& cache_;
    
    mutable std::mutex mutex_;
    std::mt19937 rng_;
    
    std::unordered_map<std::string, std::vector<ABTestResult>> ab_test_results_;
};

}
