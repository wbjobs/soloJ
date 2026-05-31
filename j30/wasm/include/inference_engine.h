#pragma once

#include <string>
#include <vector>
#include <memory>
#include <unordered_map>
#include <mutex>
#include <chrono>

#include "tensorflow/lite/interpreter.h"
#include "tensorflow/lite/kernels/register.h"
#include "tensorflow/lite/model.h"

#ifdef ENABLE_GPU
#include "tensorflow/lite/delegates/gpu/delegate.h"
#endif

namespace smart_gateway {

struct InferenceResult {
    std::string model_name;
    std::vector<std::pair<std::string, float>> predictions;
    double latency_ms;
    bool success;
    std::string error_message;
};

struct ModelConfig {
    std::string name;
    std::string path;
    std::string type;
    int input_width;
    int input_height;
    int input_channels;
    float mean;
    float std;
    bool use_gpu;
    int num_threads;
};

class InferenceEngine {
public:
    static InferenceEngine& Instance();
    
    bool LoadModel(const ModelConfig& config);
    bool UnloadModel(const std::string& model_name);
    bool ReloadModel(const std::string& model_name);
    bool HasModel(const std::string& model_name) const;
    
    InferenceResult RunInference(const std::string& model_name, 
                                  const std::vector<uint8_t>& input_data);
    
    InferenceResult RunInference(const std::string& model_name,
                                  const std::vector<float>& input_data);
    
    std::vector<std::string> GetLoadedModels() const;
    
    struct Stats {
        uint64_t total_inferences;
        uint64_t failed_inferences;
        double total_latency_ms;
        std::chrono::steady_clock::time_point start_time;
    };
    
    Stats GetStats(const std::string& model_name) const;
    void ResetStats(const std::string& model_name);
    
private:
    InferenceEngine() = default;
    ~InferenceEngine() = default;
    
    struct ModelEntry {
        ModelConfig config;
        std::unique_ptr<tflite::FlatBufferModel> model;
        std::unique_ptr<tflite::Interpreter> interpreter;
        std::unique_ptr<tflite::ops::builtin::BuiltinOpResolver> resolver;
        Stats stats;
        std::mutex mutex;
        
#ifdef ENABLE_GPU
        TfLiteDelegate* gpu_delegate = nullptr;
#endif
    };
    
    std::unordered_map<std::string, std::shared_ptr<ModelEntry>> models_;
    mutable std::mutex models_mutex_;
    
    bool CreateInterpreter(ModelEntry& entry);
    void PreprocessInput(const ModelConfig& config, 
                         const std::vector<uint8_t>& input_data,
                         std::vector<float>& output);
    std::vector<std::pair<std::string, float>> PostprocessOutput(
        const ModelConfig& config,
        const std::vector<float>& output_data);
};

}
