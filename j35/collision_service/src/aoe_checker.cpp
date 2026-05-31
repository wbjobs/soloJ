#include "aoe_checker.h"
#include <cmath>
#include <algorithm>

bool AOEChecker::circle_vs_unit(const Vec2& center, float radius, const Unit* unit, float& dist) const {
    Vec2 diff = unit->position - center;
    dist = diff.length();
    return dist <= radius + unit->radius;
}

bool AOEChecker::rect_vs_unit(const Vec2& center, float hw, float hh, float heading, const Unit* unit, float& dist) const {
    Vec2 diff = unit->position - center;
    float cos_h = std::cos(-heading);
    float sin_h = std::sin(-heading);
    float local_x = diff.x * cos_h - diff.y * sin_h;
    float local_y = diff.x * sin_h + diff.y * cos_h;
    dist = diff.length();
    return std::abs(local_x) <= hw + unit->radius && std::abs(local_y) <= hh + unit->radius;
}

bool AOEChecker::sector_vs_unit(const Vec2& center, float radius, float heading, float angle, const Unit* unit, float& dist) const {
    Vec2 diff = unit->position - center;
    dist = diff.length();
    float eff_r = radius + unit->radius;
    if (dist > eff_r) return false;
    if (dist < 1e-6f) return true;
    float angle_to_unit = std::atan2(diff.y, diff.x);
    float diff_angle = angle_to_unit - heading;
    while (diff_angle > PI) diff_angle -= 2.0f * PI;
    while (diff_angle < -PI) diff_angle += 2.0f * PI;
    float half_angle = angle * 0.5f;
    if (std::abs(diff_angle) <= half_angle) return true;
    float angular_radius = std::asin(std::min(unit->radius / dist, 1.0f));
    return std::abs(diff_angle) <= half_angle + angular_radius;
}

bool AOEChecker::segment_vs_unit(const Vec2& origin, const Vec2& dir, float range, float projectile_radius, const Unit* unit, float& dist) const {
    Vec2 m = origin - unit->position;
    float b = m.dot(dir);
    float c = m.dot(m) - (unit->radius + projectile_radius) * (unit->radius + projectile_radius);
    if (c > 0.0f && b > 0.0f) return false;
    float discr = b * b - c;
    if (discr < 0.0f) return false;
    float t = -b - std::sqrt(discr);
    if (t < 0.0f) t = 0.0f;
    if (t > range) return false;
    dist = t;
    return true;
}

std::vector<HitInfo> AOEChecker::check_circle(const SkillCastInfo& cast, const Quadtree& quadtree) const {
    std::vector<Unit*> candidates;
    quadtree.query_circle(cast.origin, cast.radius, candidates);
    std::vector<HitInfo> results;
    results.reserve(candidates.size());
    for (Unit* u : candidates) {
        if (u->id == cast.caster_id) continue;
        float dist = 0.0f;
        bool hit = circle_vs_unit(cast.origin, cast.radius, u, dist);
        results.push_back({u->id, cast.skill_id, hit, dist});
    }
    return results;
}

std::vector<HitInfo> AOEChecker::check_rect(const SkillCastInfo& cast, const Quadtree& quadtree) const {
    float hw = cast.width * 0.5f;
    float hh = cast.height * 0.5f;
    float query_extent = std::sqrt(hw * hw + hh * hh);
    std::vector<Unit*> candidates;
    quadtree.query_circle(cast.origin, query_extent, candidates);
    std::vector<HitInfo> results;
    results.reserve(candidates.size());
    float heading = std::atan2(cast.direction.y, cast.direction.x);
    for (Unit* u : candidates) {
        if (u->id == cast.caster_id) continue;
        float dist = 0.0f;
        bool hit = rect_vs_unit(cast.origin, hw, hh, heading, u, dist);
        results.push_back({u->id, cast.skill_id, hit, dist});
    }
    return results;
}

std::vector<HitInfo> AOEChecker::check_sector(const SkillCastInfo& cast, const Quadtree& quadtree) const {
    std::vector<Unit*> candidates;
    quadtree.query_sector(cast.origin, cast.radius, cast.heading, cast.angle, candidates);
    std::vector<HitInfo> results;
    results.reserve(candidates.size());
    float heading = std::atan2(cast.direction.y, cast.direction.x);
    for (Unit* u : candidates) {
        if (u->id == cast.caster_id) continue;
        float dist = 0.0f;
        bool hit = sector_vs_unit(cast.origin, cast.radius, heading, cast.angle, u, dist);
        results.push_back({u->id, cast.skill_id, hit, dist});
    }
    return results;
}

std::vector<HitInfo> AOEChecker::check_projectile(const SkillCastInfo& cast, const Quadtree& quadtree) const {
    std::vector<Unit*> candidates;
    quadtree.query_circle(cast.origin, cast.range + cast.radius, candidates);
    std::vector<HitInfo> results;
    results.reserve(candidates.size());
    Vec2 dir = cast.direction.normalized();
    for (Unit* u : candidates) {
        if (u->id == cast.caster_id) continue;
        float dist = 0.0f;
        bool hit = segment_vs_unit(cast.origin, dir, cast.range, cast.radius, u, dist);
        results.push_back({u->id, cast.skill_id, hit, dist});
    }
    return results;
}

std::vector<HitInfo> AOEChecker::check(const SkillCastInfo& cast, const Quadtree& quadtree) const {
    switch (cast.shape) {
    case SkillShape::CIRCLE_AOE: return check_circle(cast, quadtree);
    case SkillShape::RECT_AOE: return check_rect(cast, quadtree);
    case SkillShape::SECTOR_AOE: return check_sector(cast, quadtree);
    case SkillShape::PROJECTILE: return check_projectile(cast, quadtree);
    }
    return {};
}

void AOEChecker::batch_check(const std::vector<SkillCastInfo>& casts, const Quadtree& quadtree,
                              std::vector<std::vector<HitInfo>>& results) const {
    results.resize(casts.size());
    for (size_t i = 0; i < casts.size(); ++i) {
        results[i] = check(casts[i], quadtree);
    }
}
