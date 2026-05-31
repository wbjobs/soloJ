#pragma once

#include <cstdint>
#include <vector>
#include <unordered_map>
#include <mutex>
#include "quadtree.h"
#include "skill.h"
#include "skill_predictor.h"
#include "prediction_hotspot.h"

struct SkillResource {
    uint32_t skill_id = 0;
    SkillShape shape = SkillShape::CIRCLE_AOE;
    AABB aoe_region{};
    Vec2 origin{};
    Vec2 direction{};
    float range = 0.0f;
    float radius = 0.0f;
    float width = 0.0f;
    float height = 0.0f;
    float angle = 0.0f;
    std::vector<Unit*> preallocated_results;
    uint64_t frame_number = 0;
    bool valid = false;
};

struct SkillTemplate {
    uint32_t skill_id = 0;
    SkillShape shape = SkillShape::CIRCLE_AOE;
    float range = 0.0f;
    float radius = 0.0f;
    float width = 0.0f;
    float height = 0.0f;
    float angle = 0.0f;
};

class ResourceAllocator {
public:
    explicit ResourceAllocator(size_t max_players = 256, size_t prealloc_result_size = 64);

    void preallocate_for_prediction(uint64_t player_id, const Top3Prediction& predicted,
                                    const Vec2& player_pos, float player_heading,
                                    uint64_t frame_number);

    SkillResource* get_preallocated(uint64_t player_id, uint32_t skill_id);

    void register_skill_template(const SkillTemplate& tmpl);
    void clear_expired(uint64_t current_frame);

    double hit_rate() const;
    uint64_t prediction_hit_count() const;
    uint64_t total_predictions() const;

    PredictionHotspot& hotspot_tracker();

private:
    SkillTemplate* find_template(uint32_t skill_id);
    void compute_aoe_region(const SkillTemplate& tmpl, const Vec2& origin, float heading, AABB& out);

    std::unordered_map<uint32_t, SkillTemplate> skill_templates_;
    std::unordered_map<uint64_t, std::array<SkillResource, 3>> player_resources_;
    std::unordered_map<uint64_t, std::mutex> player_resource_mutexes_;
    std::mutex template_mutex_;

    std::atomic<uint64_t> prediction_hit_count_{0};
    std::atomic<uint64_t> total_predictions_{0};

    size_t prealloc_result_size_;
    PredictionHotspot hotspot_tracker_;
};
