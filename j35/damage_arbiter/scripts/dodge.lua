local M = {}

M.MOVING_DODGE_BONUS = 0.10
M.MAX_DODGE_RATE = 0.75
M.DODGE_COOLDOWN_MS = 500
M.AGILITY_TO_DODGE_FACTOR = 0.005

function M.calculate(params)
    local dodge_rate = params.dodge_rate or 0
    local is_moving = params.is_moving or false
    local agility = params.agility or 0
    local last_dodge_time = params.last_dodge_time or 0
    local current_time = params.current_time or 0

    local time_since_last = current_time - last_dodge_time
    if time_since_last < M.DODGE_COOLDOWN_MS then
        return false
    end

    local base_dodge = dodge_rate + agility * M.AGILITY_TO_DODGE_FACTOR

    if is_moving then
        base_dodge = base_dodge + M.MOVING_DODGE_BONUS
    end

    if base_dodge > M.MAX_DODGE_RATE then
        base_dodge = M.MAX_DODGE_RATE
    end

    if base_dodge < 0 then
        base_dodge = 0
    end

    local roll = math.random()
    return roll < base_dodge
end

return M
