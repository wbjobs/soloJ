#include "resource_allocator.h"
#include <cmath>

static constexpr float PI = 3.14159265358979323846f;

ResourceAllocator::ResourceAllocator(size_t max_players, size_t prealloc_result_size)
    : prealloc_result_size_(prealloc_result_size)
{
    player_resources_.reserve(max_players);
}

void ResourceAllocator::register_skill_template(const SkillTemplate& tmpl) {
    std::lock_guard<std::mutex> lock(template_mutex_);
    skill_templates_[tmpl.skill_id] = tmpl;
}

SkillTemplate* ResourceAllocator::find_template(uint32_t skill_id) {
    auto it = skill_templates_.find(skill_id);
    if (it == skill_templates_.end()) return nullptr;
    return &it->second;
}

void ResourceAllocator::compute_aoe_region(const SkillTemplate& tmpl, const Vec2& origin, float heading, AABB& out) {
    float max_extent = 0.0f;

    switch (tmpl.shape) {
    case SkillShape::CIRCLE_AOE:
        max_extent = tmpl.radius;
        out.center = origin;
        out.half_w = max_extent;
        out.half_h = max_extent;
        return;
    case SkillShape::RECT_AOE: {
        float hw = tmpl.width * 0.5f;
        float hh = tmpl.height * 0.5f;
        float cos_h = std::cos(heading);
        float sin_h = std::sin(heading);
        float abs_cos = std::abs(cos_h);
        float abs_sin = std::sin(sin_h);
        float extent_x = hw * abs_cos + hh * std::abs(sin_h);
        float extent_y = hw * std::abs(sin_h) + hh * abs_cos;
        Vec2 offset(cos_h * tmpl.range * 0.5f, sin_h * tmpl.range * 0.5f);
        out.center = origin + offset;
        out.half_w = extent_x;
        out.half_h = extent_y;
        return;
    }
    case SkillShape::SECTOR_AOE:
        max_extent = tmpl.range;
        out.center = origin;
        out.half_w = max_extent;
        out.half_h = max_extent;
        return;
    case SkillShape::PROJECTILE: {
        float cos_h = std::cos(heading);
        float sin_h = std::sin(heading);
        Vec2 end_pos(origin.x + cos_h * tmpl.range, origin.y + sin_h * tmpl.range);
        out.center = Vec2((origin.x + end_pos.x) * 0.5f, (origin.y + end_pos.y) * 0.5f);
        max_extent = tmpl.range * 0.5f + tmpl.radius;
        out.half_w = max_extent;
        out.half_h = max_extent;
        return;
    }
    }
    out.center = origin;
    out.half_w = 0.0f;
    out.half_h = 0.0f;
}

void ResourceAllocator::preallocate_for_prediction(uint64_t player_id, const Top3Prediction& predicted,
                                                    const Vec2& player_pos, float player_heading,
                                                    uint64_t frame_number) {
    total_predictions_.fetch_add(1, std::memory_order_relaxed);

    auto& resources = player_resources_[player_id];

    for (size_t i = 0; i < predicted.count; ++i) {
        uint32_t skill_id = predicted.predictions[i].skill_id;
        float probability = predicted.predictions[i].probability;

        SkillTemplate* tmpl = find_template(skill_id);
        if (!tmpl) continue;

        SkillResource& res = resources[i];
        res.skill_id = skill_id;
        res.shape = tmpl->shape;
        res.origin = player_pos;
        res.direction = Vec2(std::cos(player_heading), std::sin(player_heading));
        res.range = tmpl->range;
        res.radius = tmpl->radius;
        res.width = tmpl->width;
        res.height = tmpl->height;
        res.angle = tmpl->angle;
        res.frame_number = frame_number;
        res.valid = true;

        compute_aoe_region(*tmpl, player_pos, player_heading, res.aoe_region);
        res.preallocated_results.clear();
        res.preallocated_results.reserve(prealloc_result_size_);

        hotspot_tracker_.add_hotspot(res.aoe_region, probability, frame_number);
    }
}

SkillResource* ResourceAllocator::get_preallocated(uint64_t player_id, uint32_t skill_id) {
    auto it = player_resources_.find(player_id);
    if (it == player_resources_.end()) return nullptr;

    for (auto& res : it->second) {
        if (res.valid && res.skill_id == skill_id) {
            prediction_hit_count_.fetch_add(1, std::memory_order_relaxed);
            return &res;
        }
    }
    return nullptr;
}

void ResourceAllocator::clear_expired(uint64_t current_frame) {
    for (auto& [pid, resources] : player_resources_) {
        for (auto& res : resources) {
            if (res.valid && current_frame > res.frame_number + 1) {
                res.valid = false;
                res.preallocated_results.clear();
            }
        }
    }
    hotspot_tracker_.clear_expired(current_frame);
}

double ResourceAllocator::hit_rate() const {
    uint64_t total = total_predictions_.load(std::memory_order_relaxed);
    if (total == 0) return 0.0;
    return static_cast<double>(prediction_hit_count_.load(std::memory_order_relaxed)) / static_cast<double>(total);
}

uint64_t ResourceAllocator::prediction_hit_count() const {
    return prediction_hit_count_.load(std::memory_order_relaxed);
}

uint64_t ResourceAllocator::total_predictions() const {
    return total_predictions_.load(std::memory_order_relaxed);
}

PredictionHotspot& ResourceAllocator::hotspot_tracker() {
    return hotspot_tracker_;
}
