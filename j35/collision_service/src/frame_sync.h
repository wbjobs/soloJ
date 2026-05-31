#pragma once

#include <cstdint>
#include <vector>
#include <functional>
#include <mutex>
#include <atomic>
#include <chrono>
#include <memory>
#include <boost/asio.hpp>
#include "unit.h"
#include "skill.h"
#include "aoe_checker.h"
#include "quadtree.h"
#include "skill_predictor.h"
#include "resource_allocator.h"

static constexpr int64_t FRAME_INTERVAL_MS = 16;
static constexpr int FRAME_RATE = 60;
static constexpr int PREDICTION_INTERVAL_FRAMES = 6;

struct FrameResult {
    uint64_t frame_number = 0;
    int64_t timestamp_ms = 0;
    std::vector<HitInfo> hits;
    std::vector<Top3Prediction> predictions;
};

class FrameSync {
public:
    using ResultCallback = std::function<void(const FrameResult&)>;

    FrameSync(float world_size, int max_units = 2000);
    ~FrameSync();

    void start(boost::asio::io_context& ioc);
    void stop();

    void add_unit(const Unit& unit);
    void remove_unit(uint64_t unit_id);
    void move_unit(uint64_t unit_id, const Vec2& pos, float heading);

    void submit_cast(const SkillCastInfo& cast);

    void set_result_callback(ResultCallback cb);

    void init_prediction(const std::string& onnx_model_path);

    uint64_t frame_number() const;
    size_t unit_count() const;

private:
    void tick(const boost::system::error_code& ec);
    void process_frame();
    void update_quadtree_incremental();
    void run_predictions();

    std::unique_ptr<boost::asio::steady_timer> timer_;
    boost::asio::io_context* ioc_ = nullptr;
    std::atomic<bool> running_{false};
    std::atomic<uint64_t> frame_number_{0};

    Quadtree quadtree_;
    AOEChecker checker_;

    std::unique_ptr<SkillPredictor> predictor_;
    std::unique_ptr<ResourceAllocator> allocator_;
    bool prediction_enabled_ = false;

    std::vector<Unit> unit_pool_;
    std::vector<Unit*> active_units_;
    std::unordered_map<uint64_t, size_t> unit_index_map_;

    std::mutex cast_mutex_;
    std::vector<SkillCastInfo> pending_casts_;
    std::vector<SkillCastInfo> current_casts_;

    std::vector<Vec2> previous_positions_;
    std::vector<float> previous_headings_;

    ResultCallback on_result_;
};
