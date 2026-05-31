#pragma once

#include <cstdint>
#include "unit.h"

enum class SkillShape : int32_t {
    CIRCLE_AOE = 0,
    RECT_AOE = 1,
    SECTOR_AOE = 2,
    PROJECTILE = 3
};

struct SkillCastInfo {
    uint64_t caster_id = 0;
    uint32_t skill_id = 0;
    SkillShape shape = SkillShape::CIRCLE_AOE;
    int32_t base_damage = 0;
    Vec2 origin;
    Vec2 direction;
    float range = 0.0f;
    float radius = 0.0f;
    float width = 0.0f;
    float height = 0.0f;
    float angle = 0.0f;
    float speed = 0.0f;
    uint64_t frame_number = 0;
};
