#pragma once

#include <vector>
#include <cstdint>
#include "unit.h"
#include "skill.h"
#include "quadtree.h"

struct HitInfo {
    uint64_t target_id = 0;
    uint32_t skill_id = 0;
    bool hit = false;
    float distance = 0.0f;
};

class AOEChecker {
public:
    AOEChecker() = default;

    std::vector<HitInfo> check_circle(const SkillCastInfo& cast, const Quadtree& quadtree) const;
    std::vector<HitInfo> check_rect(const SkillCastInfo& cast, const Quadtree& quadtree) const;
    std::vector<HitInfo> check_sector(const SkillCastInfo& cast, const Quadtree& quadtree) const;
    std::vector<HitInfo> check_projectile(const SkillCastInfo& cast, const Quadtree& quadtree) const;

    std::vector<HitInfo> check(const SkillCastInfo& cast, const Quadtree& quadtree) const;
    void batch_check(const std::vector<SkillCastInfo>& casts, const Quadtree& quadtree,
                     std::vector<std::vector<HitInfo>>& results) const;

private:
    bool circle_vs_unit(const Vec2& center, float radius, const Unit* unit, float& dist) const;
    bool rect_vs_unit(const Vec2& center, float hw, float hh, float heading, const Unit* unit, float& dist) const;
    bool sector_vs_unit(const Vec2& center, float radius, float heading, float angle, const Unit* unit, float& dist) const;
    bool segment_vs_unit(const Vec2& origin, const Vec2& dir, float range, float projectile_radius, const Unit* unit, float& dist) const;

    static constexpr float PI = 3.14159265358979323846f;
};
