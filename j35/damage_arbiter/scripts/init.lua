local skill_priority = require("skill_priority")
local block = require("block")
local dodge = require("dodge")
local damage_share = require("damage_share")
local critical = require("critical")

local M = {}

M.skill_priority = skill_priority
M.block = block
M.dodge = dodge
M.damage_share = damage_share
M.critical = critical

M.version = "1.0.0"

function M.arbitrate(hit, attacker, target, context)
    local result = {
        raw_damage = hit.damage_base,
        final_damage = hit.damage_base,
        is_critical = false,
        is_blocked = false,
        is_dodged = false,
        is_perfect_block = false,
        is_damage_shared = false,
        damage_reduction = 0,
        share_targets = {}
    }

    local dodge_result = dodge.calculate({
        dodge_rate = target.dodge_rate,
        is_moving = target.is_moving,
        agility = target.agility,
        last_dodge_time = target.last_dodge_time,
        current_time = context.current_time
    })
    if dodge_result then
        result.is_dodged = true
        result.final_damage = 0
        return result
    end

    local block_result = block.calculate({
        facing_x = target.facing and target.facing.x or 0,
        facing_y = target.facing and target.facing.y or 0,
        facing_z = target.facing and target.facing.z or 1,
        attack_dir_x = hit.attack_direction and hit.attack_direction.x or 0,
        attack_dir_y = hit.attack_direction and hit.attack_direction.y or 0,
        attack_dir_z = hit.attack_direction and hit.attack_direction.z or -1,
        block_count = target.block_count or 0,
        last_block_time = target.last_block_time or 0,
        current_time = context.current_time
    })
    if block_result.blocked then
        result.is_blocked = true
        result.is_perfect_block = block_result.perfect
        result.damage_reduction = block_result.reduction
        result.final_damage = result.final_damage * (1 - block_result.reduction)
    end

    local crit_result = critical.calculate({
        critical_rate = attacker.critical_rate,
        critical_damage = attacker.critical_damage,
        attack_dir_x = hit.attack_direction and hit.attack_direction.x or 0,
        attack_dir_y = hit.attack_direction and hit.attack_direction.y or 0,
        attack_dir_z = hit.attack_direction and hit.attack_direction.z or -1,
        target_facing_x = target.facing and target.facing.x or 0,
        target_facing_y = target.facing and target.facing.y or 0,
        target_facing_z = target.facing and target.facing.z or 1
    })
    if crit_result.is_critical then
        result.is_critical = true
        result.final_damage = result.final_damage * crit_result.multiplier
    end

    return result
end

return M
