#include "inference_engine.h"
#include "memory_pool.h"

#include <fstream>
#include <algorithm>
#include <cmath>
#include <sstream>
#include <numeric>
#include <array>

namespace smart_gateway {

InferenceEngine& InferenceEngine::Instance() {
    static InferenceEngine instance;
    return instance;
}

bool InferenceEngine::LoadModel(const ModelConfig& config) {
    std::lock_guard<std::mutex> lock(models_mutex_);
    
    if (models_.find(config.name) != models_.end()) {
        return false;
    }
    
    auto entry = std::make_shared<ModelEntry>();
    entry->config = config;
    entry->stats.start_time = std::chrono::steady_clock::now();
    
    entry->model = tflite::FlatBufferModel::BuildFromFile(config.path.c_str());
    if (!entry->model) {
        return false;
    }
    
    if (!CreateInterpreter(*entry)) {
        return false;
    }
    
    models_[config.name] = entry;
    return true;
}

bool InferenceEngine::UnloadModel(const std::string& model_name) {
    std::lock_guard<std::mutex> lock(models_mutex_);
    
    auto it = models_.find(model_name);
    if (it == models_.end()) {
        return false;
    }
    
#ifdef ENABLE_GPU
    if (it->second->gpu_delegate) {
        TfLiteGpuDelegateV2Delete(it->second->gpu_delegate);
    }
#endif
    
    models_.erase(it);
    return true;
}

bool InferenceEngine::ReloadModel(const std::string& model_name) {
    std::lock_guard<std::mutex> lock(models_mutex_);
    
    auto it = models_.find(model_name);
    if (it == models_.end()) {
        return false;
    }
    
    ModelConfig config = it->second->config;
    auto& entry = it->second;
    
#ifdef ENABLE_GPU
    if (entry->gpu_delegate) {
        TfLiteGpuDelegateV2Delete(entry->gpu_delegate);
        entry->gpu_delegate = nullptr;
    }
#endif
    
    entry->model.reset();
    entry->interpreter.reset();
    entry->resolver.reset();
    
    entry->model = tflite::FlatBufferModel::BuildFromFile(config.path.c_str());
    if (!entry->model) {
        return false;
    }
    
    return CreateInterpreter(*entry);
}

bool InferenceEngine::HasModel(const std::string& model_name) const {
    std::lock_guard<std::mutex> lock(models_mutex_);
    return models_.find(model_name) != models_.end();
}

bool InferenceEngine::CreateInterpreter(ModelEntry& entry) {
    entry.resolver = std::make_unique<tflite::ops::builtin::BuiltinOpResolver>();
    
    tflite::InterpreterBuilder builder(*entry.model, *entry.resolver);
    if (builder(&entry.interpreter) != kTfLiteOk) {
        return false;
    }
    
    if (entry.config.num_threads > 0) {
        entry.interpreter->SetNumThreads(entry.config.num_threads);
    }
    
#ifdef ENABLE_GPU
    if (entry.config.use_gpu) {
        TfLiteGpuDelegateOptionsV2 options = TfLiteGpuDelegateOptionsV2Default();
        options.inference_preference = TFLITE_GPU_INFERENCE_PREFERENCE_FAST_SINGLE_ANSWER;
        options.inference_priority1 = TFLITE_GPU_INFERENCE_PRIORITY_MIN_LATENCY;
        
        entry.gpu_delegate = TfLiteGpuDelegateV2Create(&options);
        if (entry.gpu_delegate) {
            if (entry.interpreter->ModifyGraphWithDelegate(entry.gpu_delegate) != kTfLiteOk) {
                TfLiteGpuDelegateV2Delete(entry.gpu_delegate);
                entry.gpu_delegate = nullptr;
            }
        }
    }
#endif
    
    if (entry.interpreter->AllocateTensors() != kTfLiteOk) {
        return false;
    }
    
    return true;
}

InferenceResult InferenceEngine::RunInference(const std::string& model_name,
                                               const std::vector<uint8_t>& input_data) {
    InferenceResult result;
    result.model_name = model_name;
    result.success = false;
    
    std::shared_ptr<ModelEntry> entry;
    {
        std::lock_guard<std::mutex> lock(models_mutex_);
        auto it = models_.find(model_name);
        if (it == models_.end()) {
            result.error_message = "Model not found: " + model_name;
            return result;
        }
        entry = it->second;
    }
    
    std::lock_guard<std::mutex> lock(entry->mutex);
    
    auto start = std::chrono::steady_clock::now();
    
    try {
        std::vector<float> processed_input;
        PreprocessInput(entry->config, input_data, processed_input);
        
        int input_tensor_idx = entry->interpreter->inputs()[0];
        TfLiteTensor* input_tensor = entry->interpreter->tensor(input_tensor_idx);
        
        int input_size = 1;
        for (int i = 0; i < input_tensor->dims->size; ++i) {
            input_size *= input_tensor->dims->data[i];
        }
        
        if (processed_input.size() != static_cast<size_t>(input_size)) {
            result.error_message = "Input size mismatch";
            entry->stats.failed_inferences++;
            return result;
        }
        
        std::memcpy(input_tensor->data.f, processed_input.data(), 
                    input_size * sizeof(float));
        
        TfLiteStatus status = entry->interpreter->Invoke();
        if (status != kTfLiteOk) {
            result.error_message = "Inference failed";
            entry->stats.failed_inferences++;
            return result;
        }
        
        int output_tensor_idx = entry->interpreter->outputs()[0];
        TfLiteTensor* output_tensor = entry->interpreter->tensor(output_tensor_idx);
        
        int output_size = 1;
        for (int i = 0; i < output_tensor->dims->size; ++i) {
            output_size *= output_tensor->dims->data[i];
        }
        
        std::vector<float> output_data(output_tensor->data.f, 
                                        output_tensor->data.f + output_size);
        
        result.predictions = PostprocessOutput(entry->config, output_data);
        result.success = true;
        
    } catch (const std::exception& e) {
        result.error_message = e.what();
        entry->stats.failed_inferences++;
    }
    
    auto end = std::chrono::steady_clock::now();
    result.latency_ms = std::chrono::duration<double, std::milli>(end - start).count();
    
    entry->stats.total_inferences++;
    entry->stats.total_latency_ms += result.latency_ms;
    
    return result;
}

InferenceResult InferenceEngine::RunInference(const std::string& model_name,
                                               const std::vector<float>& input_data) {
    InferenceResult result;
    result.model_name = model_name;
    result.success = false;
    
    std::shared_ptr<ModelEntry> entry;
    {
        std::lock_guard<std::mutex> lock(models_mutex_);
        auto it = models_.find(model_name);
        if (it == models_.end()) {
            result.error_message = "Model not found: " + model_name;
            return result;
        }
        entry = it->second;
    }
    
    std::lock_guard<std::mutex> lock(entry->mutex);
    
    auto start = std::chrono::steady_clock::now();
    
    try {
        int input_tensor_idx = entry->interpreter->inputs()[0];
        TfLiteTensor* input_tensor = entry->interpreter->tensor(input_tensor_idx);
        
        int input_size = 1;
        for (int i = 0; i < input_tensor->dims->size; ++i) {
            input_size *= input_tensor->dims->data[i];
        }
        
        if (input_data.size() != static_cast<size_t>(input_size)) {
            result.error_message = "Input size mismatch";
            entry->stats.failed_inferences++;
            return result;
        }
        
        std::memcpy(input_tensor->data.f, input_data.data(), 
                    input_size * sizeof(float));
        
        TfLiteStatus status = entry->interpreter->Invoke();
        if (status != kTfLiteOk) {
            result.error_message = "Inference failed";
            entry->stats.failed_inferences++;
            return result;
        }
        
        int output_tensor_idx = entry->interpreter->outputs()[0];
        TfLiteTensor* output_tensor = entry->interpreter->tensor(output_tensor_idx);
        
        int output_size = 1;
        for (int i = 0; i < output_tensor->dims->size; ++i) {
            output_size *= output_tensor->dims->data[i];
        }
        
        std::vector<float> output_data(output_tensor->data.f, 
                                        output_tensor->data.f + output_size);
        
        result.predictions = PostprocessOutput(entry->config, output_data);
        result.success = true;
        
    } catch (const std::exception& e) {
        result.error_message = e.what();
        entry->stats.failed_inferences++;
    }
    
    auto end = std::chrono::steady_clock::now();
    result.latency_ms = std::chrono::duration<double, std::milli>(end - start).count();
    
    entry->stats.total_inferences++;
    entry->stats.total_latency_ms += result.latency_ms;
    
    return result;
}

void InferenceEngine::PreprocessInput(const ModelConfig& config,
                                       const std::vector<uint8_t>& input_data,
                                       std::vector<float>& output) {
    int expected_size = config.input_width * config.input_height * config.input_channels;
    output.resize(expected_size);
    
    for (int i = 0; i < expected_size && i < static_cast<int>(input_data.size()); ++i) {
        output[i] = (static_cast<float>(input_data[i]) / 255.0f - config.mean) / config.std;
    }
}

static const std::array<std::string, 1000> kClassNames = []() {
    std::array<std::string, 1000> arr;
    for (size_t i = 0; i < arr.size(); ++i) {
        arr[i] = "class_" + std::to_string(i);
    }
    return arr;
}();

static const std::array<std::string, 100> kOutputNames = []() {
    std::array<std::string, 100> arr;
    for (size_t i = 0; i < arr.size(); ++i) {
        arr[i] = "output_" + std::to_string(i);
    }
    return arr;
}();

std::vector<std::pair<std::string, float>> InferenceEngine::PostprocessOutput(
    const ModelConfig& config,
    const std::vector<float>& output_data) {
    
    auto indices_ptr = MemoryPool::Instance().GetIndexBufferPool().Acquire();
    auto& indices = *indices_ptr;
    indices.resize(output_data.size());
    
    std::iota(indices.begin(), indices.end(), 0);
    
    std::vector<std::pair<std::string, float>> predictions;
    predictions.reserve(5);
    
    if (config.type == "image_classification" || config.type == "emotion_detection") {
        size_t top_k = std::min(static_cast<size_t>(5), output_data.size());
        std::partial_sort(indices.begin(), indices.begin() + top_k,
                          indices.end(),
                          [&output_data](size_t a, size_t b) {
                              return output_data[a] > output_data[b];
                          });
        
        for (size_t i = 0; i < top_k; ++i) {
            size_t idx = indices[i];
            const std::string& label = idx < kClassNames.size() 
                ? kClassNames[idx] 
                : kClassNames.back();
            predictions.emplace_back(label, output_data[idx]);
        }
    } else if (config.type == "sentiment_analysis") {
        if (output_data.size() >= 2) {
            predictions.emplace_back("negative", output_data[0]);
            predictions.emplace_back("positive", output_data[1]);
        } else if (output_data.size() == 1) {
            predictions.emplace_back("sentiment", output_data[0]);
        }
    } else {
        size_t count = std::min(output_data.size(), static_cast<size_t>(10));
        for (size_t i = 0; i < count; ++i) {
            const std::string& label = i < kOutputNames.size() 
                ? kOutputNames[i] 
                : kOutputNames.back();
            predictions.emplace_back(label, output_data[i]);
        }
    }
    
    return predictions;
}

std::vector<std::string> InferenceEngine::GetLoadedModels() const {
    std::lock_guard<std::mutex> lock(models_mutex_);
    std::vector<std::string> names;
    names.reserve(models_.size());
    for (const auto& pair : models_) {
        names.push_back(pair.first);
    }
    return names;
}

InferenceEngine::Stats InferenceEngine::GetStats(const std::string& model_name) const {
    std::lock_guard<std::mutex> lock(models_mutex_);
    auto it = models_.find(model_name);
    if (it != models_.end()) {
        return it->second->stats;
    }
    return Stats{};
}

void InferenceEngine::ResetStats(const std::string& model_name) {
    std::lock_guard<std::mutex> lock(models_mutex_);
    auto it = models_.find(model_name);
    if (it != models_.end()) {
        it->second->stats = Stats{};
        it->second->stats.start_time = std::chrono::steady_clock::now();
    }
}

}
