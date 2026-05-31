local M = {}

M.SKILL_TYPE_CONTROL = "control"
M.SKILL_TYPE_ULTIMATE = "ultimate"
M.SKILL_TYPE_NORMAL = "normal"
M.SKILL_TYPE_DOT = "dot"

M.PRIORITY_CONTROL = 100
M.PRIORITY_ULTIMATE = 80
M.PRIORITY_NORMAL = 50
M.PRIORITY_DOT = 30

local type_priority = {
    [M.SKILL_TYPE_CONTROL] = M.PRIORITY_CONTROL,
    [M.SKILL_TYPE_ULTIMATE] = M.PRIORITY_ULTIMATE,
    [M.SKILL_TYPE_NORMAL] = M.PRIORITY_NORMAL,
    [M.SKILL_TYPE_DOT] = M.PRIORITY_DOT
}

function M.resolve_priority(skill)
    local base = type_priority[skill.skill_type] or M.PRIORITY_NORMAL
    local level_bonus = (skill.skill_level or 1) * 2
    return base + level_bonus
end

function M.sort_skills(skills)
    local sorted = {}
    for i, skill in ipairs(skills) do
        skill.computed_priority = M.resolve_priority(skill)
        table.insert(sorted, skill)
    end

    table.sort(sorted, function(a, b)
        if a.computed_priority ~= b.computed_priority then
            return a.computed_priority > b.computed_priority
        end
        return a.timestamp < b.timestamp
    end)

    return sorted
end

return M
