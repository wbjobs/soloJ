local M = {}

M.MIN_CRIT_MULTIPLIER = 1.5
M.MAX_CRIT_MULTIPLIER = 3.0
M.BACK_ATTACK_BONUS = 0.15
M.BACK_ATTACK_ANGLE_RAD = math.rad(120)

local function angle_between_vectors(ax, ay, az, bx, by, bz)
    local dot = ax * bx + ay * by + az * bz
    local la = math.sqrt(ax * ax + ay * ay + az * az)
    local lb = math.sqrt(bx * bx + by * by + bz * bz)
    if la < 1e-9 or lb < 1e-9 then
        return 0
    end
    local cos_a = dot / (la * lb)
    if cos_a > 1.0 then cos_a = 1.0 end
    if cos_a < -1.0 then cos_a = -1.0 end
    return math.acos(cos_a)
end

function M.calculate(params)
    local critical_rate = params.critical_rate or 0
    local critical_damage = params.critical_damage or M.MIN_CRIT_MULTIPLIER
    local ax = params.attack_dir_x or 0
    local ay = params.attack_dir_y or 0
    local az = params.attack_dir_z or -1
    local tfx = params.target_facing_x or 0
    local tfy = params.target_facing_y or 0
    local tfz = params.target_facing_z or 1

    local angle = angle_between_vectors(ax, ay, az, tfx, tfy, tfz)

    local is_back_attack = angle > M.BACK_ATTACK_ANGLE_RAD
    local effective_crit_rate = critical_rate

    if is_back_attack then
        effective_crit_rate = effective_crit_rate + M.BACK_ATTACK_BONUS
    end

    if effective_crit_rate > 1.0 then
        effective_crit_rate = 1.0
    end

    local roll = math.random()
    local is_critical = roll < effective_crit_rate

    local multiplier = M.MIN_CRIT_MULTIPLIER
    if is_critical then
        local crit_range = M.MAX_CRIT_MULTIPLIER - M.MIN_CRIT_MULTIPLIER
        local rate_ratio = math.min(critical_rate, 1.0)
        multiplier = M.MIN_CRIT_MULTIPLIER + crit_range * rate_ratio

        multiplier = math.max(M.MIN_CRIT_MULTIPLIER, math.min(M.MAX_CRIT_MULTIPLIER, multiplier))
    end

    return {
        is_critical = is_critical,
        multiplier = multiplier,
        is_back_attack = is_back_attack,
        effective_crit_rate = effective_crit_rate
    }
end

return M
