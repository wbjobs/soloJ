local M = {}

M.BLOCK_REDUCTION = 0.50
M.PERFECT_BLOCK_REDUCTION = 0.80
M.PERFECT_BLOCK_ANGLE_RAD = math.rad(15)
M.BLOCK_COOLDOWN_MS = 5000
M.MAX_BLOCKS_PER_WINDOW = 3

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
    local fx = params.facing_x or 0
    local fy = params.facing_y or 0
    local fz = params.facing_z or 1
    local ax = params.attack_dir_x or 0
    local ay = params.attack_dir_y or 0
    local az = params.attack_dir_z or -1
    local block_count = params.block_count or 0
    local last_block_time = params.last_block_time or 0
    local current_time = params.current_time or 0

    local time_since_last = current_time - last_block_time
    if time_since_last >= M.BLOCK_COOLDOWN_MS then
        block_count = 0
    end

    if block_count >= M.MAX_BLOCKS_PER_WINDOW then
        return { blocked = false, perfect = false, reduction = 0 }
    end

    local angle = angle_between_vectors(fx, fy, fz, -ax, -ay, -az)
    local front_angle_threshold = math.rad(90)

    if angle > front_angle_threshold then
        return { blocked = false, perfect = false, reduction = 0 }
    end

    local is_perfect = angle <= M.PERFECT_BLOCK_ANGLE_RAD
    local reduction = is_perfect and M.PERFECT_BLOCK_REDUCTION or M.BLOCK_REDUCTION

    return {
        blocked = true,
        perfect = is_perfect,
        reduction = reduction
    }
end

return M
