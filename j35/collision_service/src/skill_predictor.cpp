#include "skill_predictor.h"
#include <onnxruntime_cxx_api.h>
#include <algorithm>
#include <numeric>

SkillPredictor::SkillPredictor(const std::string& model_path, int num_skill_classes)
    : num_skill_classes_(num_skill_classes)
{
    env_ = std::make_unique<Ort::Env>(ORT_LOGGING_LEVEL_WARNING, "SkillPredictor");
    session_options_ = std::make_unique<Ort::SessionOptions>();
    session_options_->SetIntraOpNumThreads(2);
    session_options_->SetGraphOptimizationLevel(GraphOptimizationLevel::ORT_ENABLE_ALL);

    session_ = std::make_unique<Ort::Session>(*env_, model_path.c_str(), *session_options_);
    memory_info_ = std::make_unique<Ort::MemoryInfo>(OrtArenaAllocator, OrtMemTypeDefault);
}

SkillPredictor::~SkillPredictor() = default;

void SkillPredictor::record_action(uint64_t player_id, const PlayerAction& action) {
    std::shared_lock<std::shared_mutex> read_lock(map_mutex_);
    auto it = player_sequences_.find(player_id);
    if (it != player_sequences_.end()) {
        std::unique_lock<std::shared_mutex> player_lock(player_mutexes_[player_id]);
        it->second.push(action);
        return;
    }
    read_lock.unlock();

    std::unique_lock<std::shared_mutex> write_lock(map_mutex_);
    auto& seq = player_sequences_[player_id];
    seq.push(action);
}

Top3Prediction SkillPredictor::predict_next_skill(uint64_t player_id) {
    std::shared_lock<std::shared_mutex> read_lock(map_mutex_);
    auto it = player_sequences_.find(player_id);
    if (it == player_sequences_.end()) {
        return Top3Prediction{};
    }

    std::array<PlayerAction, ACTION_SEQ_LEN> seq_copy;
    {
        std::shared_lock<std::shared_mutex> player_lock(player_mutexes_[player_id]);
        it->second.copy_sequential(seq_copy);
    }
    read_lock.unlock();

    Top3Prediction result;
    run_inference(seq_copy, result);
    return result;
}

void SkillPredictor::remove_player(uint64_t player_id) {
    std::unique_lock<std::shared_mutex> write_lock(map_mutex_);
    player_sequences_.erase(player_id);
    player_mutexes_.erase(player_id);
}

void SkillPredictor::run_inference(const std::array<PlayerAction, ACTION_SEQ_LEN>& seq, Top3Prediction& out) {
    constexpr size_t input_feature_size = 6;
    std::array<float, ACTION_SEQ_LEN * input_feature_size> input_tensor{};

    for (size_t i = 0; i < ACTION_SEQ_LEN; ++i) {
        input_tensor[i * input_feature_size + 0] = static_cast<float>(seq[i].skill_id);
        input_tensor[i * input_feature_size + 1] = seq[i].pos_delta_x;
        input_tensor[i * input_feature_size + 2] = seq[i].pos_delta_y;
        input_tensor[i * input_feature_size + 3] = seq[i].target_dist;
        input_tensor[i * input_feature_size + 4] = seq[i].cooldown_ratio;
        input_tensor[i * input_feature_size + 5] = seq[i].hp_pct;
    }

    std::array<int64_t, 3> input_shape = {1, static_cast<int64_t>(ACTION_SEQ_LEN), static_cast<int64_t>(input_feature_size)};
    Ort::Value input_value = Ort::Value::CreateTensor<float>(
        *memory_info_, input_tensor.data(), input_tensor.size(),
        input_shape.data(), input_shape.size());

    const char* input_names[] = {"input"};
    const char* output_names[] = {"output"};

    auto output_tensors = session_->Run(
        Ort::RunOptions{nullptr},
        input_names, &input_value, 1,
        output_names, 1);

    float* output_data = output_tensors[0].GetTensorMutableData<float>();
    auto output_info = output_tensors[0].GetTensorTypeAndShapeInfo();
    size_t output_size = output_info.GetElementCount();

    std::vector<std::pair<float, uint32_t>> scored;
    scored.reserve(output_size);
    for (size_t i = 0; i < output_size; ++i) {
        scored.emplace_back(output_data[i], static_cast<uint32_t>(i));
    }

    size_t top_k = std::min(size_t(3), scored.size());
    std::partial_sort(scored.begin(), scored.begin() + top_k, scored.end(),
        [](const auto& a, const auto& b) { return a.first > b.first; });

    out.count = top_k;
    for (size_t i = 0; i < top_k; ++i) {
        out.predictions[i].skill_id = scored[i].second;
        out.predictions[i].probability = scored[i].first;
    }
}
