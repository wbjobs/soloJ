local M = {}

M.SHARE_RANGE = 5.0
M.MIN_SHARE_PERCENT = 0.20
M.CAN_RECURSE = false

local function distance_3d(x1, y1, z1, x2, y2, z2)
    local dx = x2 - x1
    local dy = y2 - y1
    local dz = z2 - z1
    return math.sqrt(dx * dx + dy * dy + dz * dz)
end

function M.calculate(params)
    local target_id = params.target_id
    local damage = params.damage
    local target_pos = params.target_position or {}
    local team_id = params.team_id or 0
    local allies = params.allies or {}

    if not target_pos.x then
        return { shared = false, final_damage = damage, share_targets = {} }
    end

    local nearby_allies = {}
    for _, ally in ipairs(allies) do
        if ally.position and ally.position.x then
            local dist = distance_3d(
                target_pos.x, target_pos.y, target_pos.z,
                ally.position.x, ally.position.y, ally.position.z
            )
            if dist <= M.SHARE_RANGE then
                table.insert(nearby_allies, ally)
            end
        end
    end

    if #nearby_allies == 0 then
        return { shared = false, final_damage = damage, share_targets = {} }
    end

    local total_recipients = #nearby_allies + 1
    local share_per_person = damage / total_recipients
    local min_damage = damage * M.MIN_SHARE_PERCENT

    if share_per_person < min_damage then
        share_per_person = min_damage
    end

    local total_shared = share_per_person * #nearby_allies
    local target_damage = damage - total_shared

    if target_damage < min_damage then
        target_damage = min_damage
    end

    local share_targets = {}
    for _, ally in ipairs(nearby_allies) do
        table.insert(share_targets, ally.unit_id)
    end

    return {
        shared = true,
        final_damage = target_damage,
        share_targets = share_targets,
        share_damage_per_person = share_per_person
    }
end

return M
