#include "frame_sync.h"
#include <chrono>
#include <algorithm>

FrameSync::FrameSync(float world_size, int max_units)
    : quadtree_(world_size)
    , unit_pool_(max_units)
    , active_units_(max_units, nullptr)
{
}

FrameSync::~FrameSync() {
    stop();
}

void FrameSync::start(boost::asio::io_context& ioc) {
    ioc_ = &ioc;
    running_ = true;
    timer_ = std::make_unique<boost::asio::steady_timer>(ioc);
    timer_->expires_after(std::chrono::milliseconds(FRAME_INTERVAL_MS));
    timer_->async_wait([this](const boost::system::error_code& ec) { tick(ec); });
}

void FrameSync::stop() {
    running_ = false;
    if (timer_) {
        boost::system::error_code ec;
        timer_->cancel(ec);
    }
}

void FrameSync::add_unit(const Unit& unit) {
    auto it = unit_index_map_.find(unit.id);
    if (it != unit_index_map_.end()) {
        unit_pool_[it->second] = unit;
        return;
    }
    for (size_t i = 0; i < unit_pool_.size(); ++i) {
        if (unit_pool_[i].id == 0) {
            unit_pool_[i] = unit;
            active_units_[i] = &unit_pool_[i];
            unit_index_map_[unit.id] = i;
            quadtree_.insert(&unit_pool_[i]);
            previous_positions_.resize(std::max(previous_positions_.size(), i + 1));
            previous_headings_.resize(std::max(previous_headings_.size(), i + 1));
            previous_positions_[i] = unit.position;
            previous_headings_[i] = unit.heading;
            return;
        }
    }
}

void FrameSync::remove_unit(uint64_t unit_id) {
    auto it = unit_index_map_.find(unit_id);
    if (it == unit_index_map_.end()) return;
    size_t idx = it->second;
    quadtree_.remove(&unit_pool_[idx]);
    unit_pool_[idx].id = 0;
    active_units_[idx] = nullptr;
    unit_index_map_.erase(it);
}

void FrameSync::move_unit(uint64_t unit_id, const Vec2& pos, float heading) {
    auto it = unit_index_map_.find(unit_id);
    if (it == unit_index_map_.end()) return;
    size_t idx = it->second;
    unit_pool_[idx].position = pos;
    unit_pool_[idx].heading = heading;
}

void FrameSync::submit_cast(const SkillCastInfo& cast) {
    std::lock_guard<std::mutex> lock(cast_mutex_);
    pending_casts_.push_back(cast);

    if (prediction_enabled_ && predictor_) {
        float prev_x = 0.0f, prev_y = 0.0f;
        auto pit = unit_index_map_.find(cast.caster_id);
        if (pit != unit_index_map_.end() && pit->second < previous_positions_.size()) {
            prev_x = previous_positions_[pit->second].x;
            prev_y = previous_positions_[pit->second].y;
        }
        predictor_->record_action(cast.caster_id, PlayerAction{
            cast.skill_id,
            cast.origin.x - prev_x,
            cast.origin.y - prev_y,
            cast.range,
            0.0f,
            1.0f
        });
    }
}

void FrameSync::set_result_callback(ResultCallback cb) {
    on_result_ = std::move(cb);
}

void FrameSync::init_prediction(const std::string& onnx_model_path) {
    predictor_ = std::make_unique<SkillPredictor>();
    if (predictor_->load_model(onnx_model_path)) {
        prediction_enabled_ = true;
        allocator_ = std::make_unique<ResourceAllocator>();
    }
}

uint64_t FrameSync::frame_number() const {
    return frame_number_.load();
}

size_t FrameSync::unit_count() const {
    return unit_index_map_.size();
}

void FrameSync::tick(const boost::system::error_code& ec) {
    if (ec || !running_) return;
    process_frame();
    timer_->expires_after(std::chrono::milliseconds(FRAME_INTERVAL_MS));
    timer_->async_wait([this](const boost::system::error_code& e) { tick(e); });
}

void FrameSync::process_frame() {
    ++frame_number_;

    update_quadtree_incremental();

    if (prediction_enabled_ && frame_number_.load() % PREDICTION_INTERVAL_FRAMES == 0) {
        run_predictions();
    }

    {
        std::lock_guard<std::mutex> lock(cast_mutex_);
        current_casts_.swap(pending_casts_);
        pending_casts_.clear();
    }

    if (current_casts_.empty()) return;

    FrameResult result;
    result.frame_number = frame_number_.load();
    auto now = std::chrono::steady_clock::now();
    result.timestamp_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()).count();

    std::vector<std::vector<HitInfo>> batch_results;

    if (prediction_enabled_ && allocator_) {
        for (auto& cast : current_casts_) {
            auto* res = allocator_->get_preallocated(cast.caster_id, cast.skill_id);
            if (res) {
                allocator_->record_hit(cast.caster_id, cast.skill_id);
            }
        }
        allocator_->clear_expired(frame_number_.load());
    }

    checker_.batch_check(current_casts_, quadtree_, batch_results);

    for (auto& hits : batch_results) {
        for (auto& h : hits) {
            if (h.hit) {
                result.hits.push_back(h);
            }
        }
    }

    current_casts_.clear();

    if (on_result_) {
        on_result_(result);
    }
}

void FrameSync::run_predictions() {
    if (!predictor_ || !allocator_) return;

    FrameResult result;
    result.frame_number = frame_number_.load();

    for (auto& [id, idx] : unit_index_map_) {
        auto pred = predictor_->predict_next_skill(id);
        if (pred.entries[0].probability > 0.1f) {
            result.predictions.push_back(pred);

            Unit& u = unit_pool_[idx];
            allocator_->preallocate_for_prediction(id, pred, u.position, u.heading);
        }
    }

    if (on_result_ && !result.predictions.empty()) {
        on_result_(result);
    }
}

void FrameSync::update_quadtree_incremental() {
    for (auto& [id, idx] : unit_index_map_) {
        if (idx >= previous_positions_.size()) continue;
        Unit& u = unit_pool_[idx];
        if (u.position.x != previous_positions_[idx].x ||
            u.position.y != previous_positions_[idx].y ||
            u.heading != previous_headings_[idx]) {
            quadtree_.update(&u);
            previous_positions_[idx] = u.position;
            previous_headings_[idx] = u.heading;
        }
    }
}
