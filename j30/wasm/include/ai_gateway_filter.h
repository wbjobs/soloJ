#pragma once

#include <string>
#include <vector>
#include <memory>
#include <unordered_map>

#include "proxy_wasm_intrinsics.h"
#include "inference_engine.h"
#include "route_config.h"
#include "pipeline_config.h"
#include "pipeline_executor.h"

namespace smart_gateway {

class AIGatewayFilter : public Context, public HttpContext {
public:
    explicit AIGatewayFilter(uint32_t id) : Context(id), HttpContext(id) {}
    ~AIGatewayFilter() override = default;
    
    FilterHeadersStatus onRequestHeaders(uint32_t headers, bool end_of_stream) override;
    FilterDataStatus onRequestBody(size_t body_buffer_length, bool end_of_stream) override;
    
    void onLog() override;
    void onDone() override;
    
private:
    std::string request_path_;
    std::string request_method_;
    std::vector<uint8_t> request_body_;
    bool body_complete_ = false;
    bool inference_performed_ = false;
    std::unordered_map<std::string, std::string> request_headers_;
    
    struct PendingInference {
        RouteRule rule;
        InferenceResult result;
    };
    std::vector<PendingInference> pending_inferences_;
    
    struct PendingPipeline {
        Pipeline pipeline;
        PipelineExecutionResult result;
    };
    std::vector<PendingPipeline> pending_pipelines_;
    
    void PerformInference(const RouteRule& rule);
    void ExecutePipeline(const Pipeline& pipeline);
    std::string SerializeResult(const InferenceResult& result);
    std::string SerializePipelineResult(const PipelineExecutionResult& result);
    void ApplyInferenceResults();
    void ApplyPipelineResults();
    std::string GetRequestHeader(const std::string& name) const;
    void CollectRequestHeaders();
};

class AIGatewayRootContext : public RootContext {
public:
    explicit AIGatewayRootContext(uint32_t id) : RootContext(id) {}
    
    bool onConfigure(size_t configuration_size) override;
    void onTick() override;
    
private:
    std::string models_dir_;
    std::string config_file_;
    uint64_t last_config_load_ = 0;
    uint64_t last_model_check_ = 0;
    uint64_t tick_count_ = 0;
    uint64_t last_memory_cleanup_ = 0;
    
    void LoadInitialModels();
    void CheckConfigUpdates();
    void CheckModelUpdates();
    void LogMemoryUsage();
    void CleanupMemory();
};

}
