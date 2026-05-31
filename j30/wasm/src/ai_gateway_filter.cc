#include "ai_gateway_filter.h"
#include "memory_pool.h"

#include <string>
#include <vector>
#include <sstream>
#include <chrono>
#include <sys/stat.h>
#include <algorithm>
#include <cinttypes>

#include "include/nlohmann/json.hpp"

namespace smart_gateway {

using json = nlohmann::json;

static constexpr const char* kModelsDirKey = "models_dir";
static constexpr const char* kConfigFileKey = "config_file";
static constexpr const char* kDefaultModelsDir = "/models";
static constexpr const char* kDefaultConfigFile = "/config/routes.json";

static uint64_t GetFileModificationTime(const std::string& path) {
    struct stat stat_buf;
    if (stat(path.c_str(), &stat_buf) == 0) {
        return static_cast<uint64_t>(stat_buf.st_mtime);
    }
    return 0;
}

bool AIGatewayRootContext::onConfigure(size_t configuration_size) {
    auto config_bytes = getBufferBytes(WasmBufferType::PluginConfiguration, 0, configuration_size);
    if (!config_bytes) {
        LOG_WARN("No configuration provided, using defaults");
        models_dir_ = kDefaultModelsDir;
        config_file_ = kDefaultConfigFile;
        LoadInitialModels();
        return true;
    }
    
    std::string config_str(reinterpret_cast<const char*>(config_bytes->data()), config_bytes->size());
    
    try {
        json config = json::parse(config_str);
        models_dir_ = config.value(kModelsDirKey, kDefaultModelsDir);
        config_file_ = config.value(kConfigFileKey, kDefaultConfigFile);
    } catch (const json::parse_error& e) {
        LOG_WARN(std::string("Failed to parse config: ") + e.what());
        models_dir_ = kDefaultModelsDir;
        config_file_ = kDefaultConfigFile;
    }
    
    LoadInitialModels();
    
    setTickPeriod(std::chrono::seconds(5));
    
    LOG_INFO(std::string("AI Gateway Wasm filter configured. Models dir: ") + models_dir_);
    return true;
}

void AIGatewayRootContext::onTick() {
    tick_count_++;
    
    CheckConfigUpdates();
    CheckModelUpdates();
    
    if (tick_count_ % 12 == 0) {
        LogMemoryUsage();
    }
    
    if (tick_count_ % 720 == 0) {
        CleanupMemory();
    }
}

void AIGatewayRootContext::LoadInitialModels() {
    std::string models_config = models_dir_ + "/models.json";
    
    struct stat st;
    if (stat(models_config.c_str(), &st) == 0) {
        FILE* f = fopen(models_config.c_str(), "rb");
        if (f) {
            fseek(f, 0, SEEK_END);
            long size = ftell(f);
            fseek(f, 0, SEEK_SET);
            
            std::vector<char> buffer(size);
            if (fread(buffer.data(), 1, size, f) == static_cast<size_t>(size)) {
                try {
                    json models_json = json::parse(buffer.data(), buffer.data() + size);
                    if (models_json.contains("models") && models_json["models"].is_array()) {
                        for (const auto& model_cfg : models_json["models"]) {
                            ModelConfig config;
                            config.name = model_cfg.value("name", "");
                            config.path = models_dir_ + "/" + model_cfg.value("file", "");
                            config.type = model_cfg.value("type", "image_classification");
                            config.input_width = model_cfg.value("input_width", 224);
                            config.input_height = model_cfg.value("input_height", 224);
                            config.input_channels = model_cfg.value("input_channels", 3);
                            config.mean = model_cfg.value("mean", 0.5f);
                            config.std = model_cfg.value("std", 0.5f);
                            config.use_gpu = model_cfg.value("use_gpu", false);
                            config.num_threads = model_cfg.value("num_threads", 4);
                            
                            if (!config.name.empty()) {
                                InferenceEngine::Instance().LoadModel(config);
                                LOG_INFO(std::string("Loaded model: ") + config.name);
                            }
                        }
                    }
                } catch (...) {
                }
            }
            fclose(f);
        }
    }
    
    last_model_check_ = GetFileModificationTime(models_config);
    last_config_load_ = GetFileModificationTime(config_file_);
    
    RouteConfig::Instance().LoadFromFile(config_file_);
    
    std::string pipelines_config = models_dir_ + "/pipelines.json";
    PipelineConfig::Instance().LoadFromFile(pipelines_config);
    
    PipelineExecutor::Instance().SetInferenceEngine(&InferenceEngine::Instance());
    
    LOG_INFO("Initial models, routes, and pipelines loaded");
}

void AIGatewayRootContext::CheckConfigUpdates() {
    uint64_t current_mtime = GetFileModificationTime(config_file_);
    if (current_mtime > last_config_load_ && current_mtime != 0) {
        LOG_INFO("Config file changed, reloading routes...");
        RouteConfig::Instance().LoadFromFile(config_file_);
        last_config_load_ = current_mtime;
    }
}

void AIGatewayRootContext::CheckModelUpdates() {
    auto models = InferenceEngine::Instance().GetLoadedModels();
    for (const auto& model_name : models) {
        auto stats = InferenceEngine::Instance().GetStats(model_name);
        uint64_t uptime_seconds = std::chrono::duration_cast<std::chrono::seconds>(
            std::chrono::steady_clock::now() - stats.start_time).count();
        
        if (uptime_seconds > 0 && stats.total_inferences > 0) {
            double qps = static_cast<double>(stats.total_inferences) / uptime_seconds;
            double avg_latency = stats.total_latency_ms / stats.total_inferences;
            
            LOG_INFO(std::string("Model [") + model_name + "]: " +
                     "QPS=" + std::to_string(qps) + ", " +
                     "AvgLatency=" + std::to_string(avg_latency) + "ms, " +
                     "Total=" + std::to_string(stats.total_inferences) + ", " +
                     "Failed=" + std::to_string(stats.failed_inferences));
        }
    }
}

FilterHeadersStatus AIGatewayFilter::onRequestHeaders(uint32_t headers, bool end_of_stream) {
    auto path = getRequestHeader(":path");
    auto method = getRequestHeader(":method");
    
    if (path) {
        request_path_.assign(path->view().data(), path->view().size());
    }
    if (method) {
        request_method_.assign(method->view().data(), method->view().size());
    }
    
    CollectRequestHeaders();
    
    auto pipelines = PipelineConfig::Instance().GetPipelinesForRequest(request_path_, request_method_);
    auto rules = RouteConfig::Instance().GetRulesForRequest(request_path_, request_method_);
    
    bool needs_body = false;
    
    for (const auto& pipeline : pipelines) {
        for (const auto& step_pair : pipeline.steps) {
            const PipelineStep& step = step_pair.second;
            if (step.input_source == "body" || step.input_source == "body_base64") {
                needs_body = true;
                goto body_check_done;
            }
        }
    }
body_check_done:
    
    if (!needs_body) {
        for (const auto& rule : rules) {
            if (rule.input_source == "body" || rule.input_source == "body_base64") {
                needs_body = true;
                break;
            }
        }
    }
    
    if (!pipelines.empty() && !needs_body) {
        pending_pipelines_.reserve(pipelines.size());
        for (const auto& pipeline : pipelines) {
            ExecutePipeline(pipeline);
        }
        ApplyPipelineResults();
    }
    
    if (!rules.empty() && !needs_body) {
        pending_inferences_.reserve(rules.size());
        for (const auto& rule : rules) {
            if (rule.input_source == "headers") {
                PerformInference(rule);
            }
        }
        ApplyInferenceResults();
    }
    
    return needs_body ? FilterHeadersStatus::StopIteration : FilterHeadersStatus::Continue;
}

FilterDataStatus AIGatewayFilter::onRequestBody(size_t body_buffer_length, bool end_of_stream) {
    auto body_bytes = getBufferBytes(WasmBufferType::HttpRequestBody, 0, body_buffer_length);
    if (body_bytes && body_bytes->size() > 0) {
        if (request_body_.capacity() < body_buffer_length) {
            request_body_.reserve(body_buffer_length);
        }
        request_body_.assign(body_bytes->data(), 
                            body_bytes->data() + body_bytes->size());
    }
    
    body_complete_ = end_of_stream;
    
    if (body_complete_ && !inference_performed_) {
        auto pipelines = PipelineConfig::Instance().GetPipelinesForRequest(request_path_, request_method_);
        auto rules = RouteConfig::Instance().GetRulesForRequest(request_path_, request_method_);
        
        pending_pipelines_.reserve(pipelines.size());
        for (const auto& pipeline : pipelines) {
            ExecutePipeline(pipeline);
        }
        ApplyPipelineResults();
        
        pending_inferences_.reserve(rules.size());
        for (const auto& rule : rules) {
            if (rule.input_source == "body" || rule.input_source == "body_base64") {
                PerformInference(rule);
            }
        }
        
        ApplyInferenceResults();
        inference_performed_ = true;
    }
    
    return FilterDataStatus::Continue;
}

void AIGatewayFilter::PerformInference(const RouteRule& rule) {
    if (!InferenceEngine::Instance().HasModel(rule.model_name)) {
        LOG_WARN(std::string("Model not found for rule: ") + rule.id + 
                 ", model: " + rule.model_name);
        return;
    }
    
    InferenceResult result;
    
    if (rule.input_source == "body") {
        result = InferenceEngine::Instance().RunInference(rule.model_name, request_body_);
    } else if (rule.input_source == "headers") {
        std::vector<float> input_data;
        auto header_val = getRequestHeader("X-Input-Data");
        if (header_val) {
            std::string header_str(header_val->view());
            try {
                std::stringstream ss(header_str);
                std::string token;
                while (std::getline(ss, token, ',')) {
                    input_data.push_back(std::stof(token));
                }
            } catch (...) {
            }
        }
        result = InferenceEngine::Instance().RunInference(rule.model_name, input_data);
    }
    
    pending_inferences_.push_back({rule, result});
    
    LOG_INFO(std::string("Inference completed for rule: ") + rule.id + 
             ", success: " + (result.success ? "true" : "false") +
             ", latency: " + std::to_string(result.latency_ms) + "ms");
}

std::string AIGatewayFilter::SerializeResult(const InferenceResult& result) {
    auto output_ptr = MemoryPool::Instance().GetStringPool().Acquire();
    std::string& output = *output_ptr;
    output.clear();
    output.reserve(512);
    
    output += "{\"model\":\"";
    output += result.model_name;
    output += "\",\"success\":";
    output += result.success ? "true" : "false";
    output += ",\"latency_ms\":";
    
    char buf[64];
    int len = snprintf(buf, sizeof(buf), "%.3f", result.latency_ms);
    output.append(buf, len);
    
    if (result.success) {
        output += ",\"predictions\":[";
        for (size_t i = 0; i < result.predictions.size(); ++i) {
            if (i > 0) {
                output += ",";
            }
            output += "{\"label\":\"";
            output += result.predictions[i].first;
            output += "\",\"confidence\":";
            len = snprintf(buf, sizeof(buf), "%.6f", result.predictions[i].second);
            output.append(buf, len);
            output += "}";
        }
        output += "]";
    } else {
        output += ",\"error\":\"";
        output += result.error_message;
        output += "\"";
    }
    
    output += "}";
    
    return output;
}

void AIGatewayFilter::ApplyInferenceResults() {
    for (const auto& pending : pending_inferences_) {
        const RouteRule& rule = pending.rule;
        const InferenceResult& result = pending.result;
        
        std::string serialized = SerializeResult(result);
        
        if (rule.output_mode == "header") {
            addRequestHeader(rule.header_name, serialized);
        } else if (rule.output_mode == "body") {
            size_t body_size = getBufferLength(WasmBufferType::HttpRequestBody);
            auto original_body = getBufferBytes(WasmBufferType::HttpRequestBody, 0, body_size);
            
            try {
                json body_json;
                if (original_body && original_body->size() > 0) {
                    body_json = json::parse(original_body->data(), 
                                           original_body->data() + original_body->size());
                }
                
                json inference_json = json::parse(serialized);
                body_json["inference"] = inference_json;
                
                std::string new_body = body_json.dump();
                setBuffer(WasmBufferType::HttpRequestBody, 0, body_size, 
                         new_body.data(), new_body.size());
                
                replaceRequestHeader("content-length", std::to_string(new_body.size()));
            } catch (...) {
                addRequestHeader(rule.header_name, serialized);
            }
        }
    }
}

void AIGatewayRootContext::LogMemoryUsage() {
    auto stats = MemoryPool::Instance().GetStats();
    
    LOG_INFO(std::string("Memory Pool Stats: ") +
             "byte_buffers=" + std::to_string(stats.byte_buffer_count) + ", " +
             "float_buffers=" + std::to_string(stats.float_buffer_count) + ", " +
             "index_buffers=" + std::to_string(stats.index_buffer_count) + ", " +
             "strings=" + std::to_string(stats.string_count));
}

void AIGatewayRootContext::CleanupMemory() {
    LOG_INFO("Performing periodic memory cleanup...");
    
    auto models = InferenceEngine::Instance().GetLoadedModels();
    for (const auto& model_name : models) {
        InferenceEngine::Instance().ResetStats(model_name);
    }
    
    LOG_INFO("Memory cleanup completed");
}

void AIGatewayFilter::onLog() {
    for (const auto& pending : pending_inferences_) {
        const InferenceResult& result = pending.result;
        incrementMetric("inference_total", result.model_name, 1);
        incrementMetric("inference_latency_ms", result.model_name, 
                       static_cast<uint64_t>(result.latency_ms));
        if (!result.success) {
            incrementMetric("inference_failed", result.model_name, 1);
        }
    }
}

void AIGatewayFilter::onDone() {
    {
        std::vector<uint8_t> empty;
        request_body_.swap(empty);
    }
    {
        std::vector<PendingInference> empty;
        pending_inferences_.swap(empty);
    }
    {
        std::vector<PendingPipeline> empty;
        pending_pipelines_.swap(empty);
    }
    {
        std::unordered_map<std::string, std::string> empty;
        request_headers_.swap(empty);
    }
    {
        std::string empty;
        request_path_.swap(empty);
    }
    {
        std::string empty;
        request_method_.swap(empty);
    }
    body_complete_ = false;
    inference_performed_ = false;
}

void AIGatewayFilter::CollectRequestHeaders() {
    auto headers = getRequestHeaders();
    if (headers) {
        for (const auto& h : *headers) {
            std::string key(h.first.view().data(), h.first.view().size());
            std::string value(h.second.view().data(), h.second.view().size());
            request_headers_[key] = value;
        }
    }
}

std::string AIGatewayFilter::GetRequestHeader(const std::string& name) const {
    auto it = request_headers_.find(name);
    if (it != request_headers_.end()) {
        return it->second;
    }
    return "";
}

void AIGatewayFilter::ExecutePipeline(const Pipeline& pipeline) {
    LOG_INFO(std::string("Executing pipeline: ") + pipeline.id);
    
    PipelineExecutionResult result = PipelineExecutor::Instance().ExecutePipeline(
        pipeline, request_body_, request_headers_);
    
    pending_pipelines_.push_back({pipeline, result});
    
    LOG_INFO(std::string("Pipeline ") + pipeline.id + 
             " completed, success: " + (result.success ? "true" : "false") +
             ", total steps: " + std::to_string(result.step_results.size()));
}

std::string AIGatewayFilter::SerializePipelineResult(const PipelineExecutionResult& result) {
    auto output_ptr = MemoryPool::Instance().GetStringPool().Acquire();
    std::string& output = *output_ptr;
    output.clear();
    output.reserve(1024);
    
    output += "{\"pipeline_id\":\"";
    output += result.pipeline_id;
    output += "\",\"success\":";
    output += result.success ? "true" : "false";
    output += ",\"total_latency_ms\":";
    
    char buf[64];
    int len = snprintf(buf, sizeof(buf), "%" PRId64, result.total_latency.count());
    output.append(buf, len);
    
    output += ",\"steps\":[";
    for (size_t i = 0; i < result.step_results.size(); ++i) {
        if (i > 0) output += ",";
        const auto& step = result.step_results[i];
        output += "{\"step_id\":\"";
        output += step.step_id;
        output += "\",\"model\":\"";
        output += step.model_name;
        output += "\",\"success\":";
        output += step.success ? "true" : "false";
        output += ",\"from_cache\":";
        output += step.from_cache ? "true" : "false";
        output += ",\"latency_ms\":";
        len = snprintf(buf, sizeof(buf), "%" PRId64, step.latency.count());
        output.append(buf, len);
        
        if (step.success && !step.predictions.empty()) {
            output += ",\"predictions\":[";
            for (size_t j = 0; j < step.predictions.size(); ++j) {
                if (j > 0) output += ",";
                output += "{\"label\":\"";
                output += step.predictions[j].first;
                output += "\",\"confidence\":";
                len = snprintf(buf, sizeof(buf), "%.6f", step.predictions[j].second);
                output.append(buf, len);
                output += "}";
            }
            output += "]";
        }
        output += "}";
    }
    output += "]}";
    
    return output;
}

void AIGatewayFilter::ApplyPipelineResults() {
    for (const auto& pending : pending_pipelines_) {
        const Pipeline& pipeline = pending.pipeline;
        const PipelineExecutionResult& result = pending.result;
        
        std::string serialized = SerializePipelineResult(result);
        
        std::string header_name = "X-Pipeline-Result-" + pipeline.id;
        addRequestHeader(header_name, serialized);
        
        if (!result.step_results.empty()) {
            const StepResult& last_step = result.step_results.back();
            std::string last_header = "X-Pipeline-Last-" + pipeline.id;
            std::ostringstream oss;
            oss << "{\"step\":\"" << last_step.step_id << "\",";
            oss << "\"model\":\"" << last_step.model_name << "\",";
            oss << "\"success\":" << (last_step.success ? "true" : "false") << "}";
            addRequestHeader(last_header, oss.str());
        }
    }
}

}

static RegisterContextFactory register_AI_Gateway(
    "smart_gateway.AIGatewayFilter",
    [](uint32_t id, RootContext* root) -> Context* {
        return new smart_gateway::AIGatewayFilter(id);
    },
    [](uint32_t id) -> RootContext* {
        return new smart_gateway::AIGatewayRootContext(id);
    }
);
