#pragma once

#include <cstdint>
#include <array>
#include <vector>
#include <unordered_map>
#include <shared_mutex>
#include <memory>
#include <string>

namespace Ort {
class Env;
class Session;
class SessionOptions;
class MemoryInfo;
}

struct PlayerAction {
    uint32_t skill_id = 0;
    float pos_delta_x = 0.0f;
    float pos_delta_y = 0.0f;
    float target_dist = 0.0f;
    float cooldown_ratio = 0.0f;
    float hp_pct = 0.0f;
};

static constexpr size_t ACTION_SEQ_LEN = 20;

struct PlayerActionSeq {
    std::array<PlayerAction, ACTION_SEQ_LEN> actions{};
    size_t count = 0;
    size_t head = 0;

    void push(const PlayerAction& action) {
        if (count < ACTION_SEQ_LEN) {
            actions[count] = action;
            ++count;
        } else {
            actions[head] = action;
            head = (head + 1) % ACTION_SEQ_LEN;
        }
    }

    void copy_sequential(std::array<PlayerAction, ACTION_SEQ_LEN>& out) const {
        for (size_t i = 0; i < ACTION_SEQ_LEN; ++i) {
            if (count < ACTION_SEQ_LEN) {
                if (i < count) {
                    out[i] = actions[i];
                } else {
                    out[i] = PlayerAction{};
                }
            } else {
                out[i] = actions[(head + i) % ACTION_SEQ_LEN];
            }
        }
    }
};

struct SkillPrediction {
    uint32_t skill_id = 0;
    float probability = 0.0f;
};

struct Top3Prediction {
    std::array<SkillPrediction, 3> predictions{};
    size_t count = 0;
};

class SkillPredictor {
public:
    explicit SkillPredictor(const std::string& model_path, int num_skill_classes = 50);
    ~SkillPredictor();

    Top3Prediction predict_next_skill(uint64_t player_id);
    void record_action(uint64_t player_id, const PlayerAction& action);

    void remove_player(uint64_t player_id);

private:
    void run_inference(const std::array<PlayerAction, ACTION_SEQ_LEN>& seq, Top3Prediction& out);

    std::unique_ptr<Ort::Env> env_;
    std::unique_ptr<Ort::Session> session_;
    std::unique_ptr<Ort::SessionOptions> session_options_;
    std::unique_ptr<Ort::MemoryInfo> memory_info_;

    int num_skill_classes_;

    std::unordered_map<uint64_t, PlayerActionSeq> player_sequences_;
    std::unordered_map<uint64_t, std::shared_mutex> player_mutexes_;
    std::shared_mutex map_mutex_;
};
