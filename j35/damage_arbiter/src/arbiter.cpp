#include "arbiter.h"
#include "lua_bindings.cpp"
#include <lua.hpp>
#include <iostream>
#include <cmath>
#include <algorithm>

Arbiter::Arbiter() : initialized_(false) {}

Arbiter::~Arbiter() {
    shutdown();
}

bool Arbiter::initialize(const std::string& scripts_dir) {
    scripts_dir_ = scripts_dir;

    lua_engine_ = std::make_unique<LuaEngine>();
    if (!lua_engine_->initialize()) {
        std::cerr << "Failed to initialize Lua engine: " << lua_engine_->get_last_error() << std::endl;
        return false;
    }

    register_lua_bindings(*lua_engine_);

    if (!lua_engine_->load_scripts_from_directory(scripts_dir)) {
        std::cerr << "Failed to load scripts: " << lua_engine_->get_last_error() << std::endl;
        return false;
    }

    initialized_ = true;
    return true;
}

void Arbiter::shutdown() {
    if (lua_engine_) {
        lua_engine_->shutdown();
        lua_engine_.reset();
    }
    initialized_ = false;
}

void Arbiter::sort_skills_by_priority(const damage_arbiter::ArbitrateRequest& request,
                                       SkillPriorityQueue& queue) {
    for (int i = 0; i < request.skills_size(); ++i) {
        const auto& skill = request.skills(i);
        SkillCastEntry entry;
        entry.skill_id = skill.skill_id();
        entry.caster_id = skill.caster_id();
        entry.target_id = skill.target_id();
        entry.priority = skill.priority();
        entry.timestamp = skill.timestamp();
        entry.damage_base = skill.damage_base();
        entry.skill_type = skill.skill_type();
        entry.skill_level = skill.skill_level();
        queue.push(entry);
    }

    if (lua_engine_->state()) {
        lua_State* L = lua_engine_->state();
        lua_getglobal(L, "skill_priority");
        if (lua_istable(L, -1)) {
            lua_getfield(L, -1, "resolve_priority");
            if (lua_isfunction(L, -1)) {
                queue.sort_by_lua_priority([&](const SkillCastEntry& entry) -> uint32_t {
                    lua_getglobal(L, "skill_priority");
                    lua_getfield(L, -1, "resolve_priority");
                    if (!lua_isfunction(L, -1)) {
                        lua_pop(L, 2);
                        return entry.priority;
                    }

                    lua_newtable(L);
                    lua_pushstring(L, "skill_id"); lua_pushinteger(L, entry.skill_id); lua_rawset(L, -3);
                    lua_pushstring(L, "caster_id"); lua_pushinteger(L, static_cast<lua_Integer>(entry.caster_id)); lua_rawset(L, -3);
                    lua_pushstring(L, "target_id"); lua_pushinteger(L, static_cast<lua_Integer>(entry.target_id)); lua_rawset(L, -3);
                    lua_pushstring(L, "priority"); lua_pushinteger(L, entry.priority); lua_rawset(L, -3);
                    lua_pushstring(L, "timestamp"); lua_pushinteger(L, static_cast<lua_Integer>(entry.timestamp)); lua_rawset(L, -3);
                    lua_pushstring(L, "damage_base"); lua_pushnumber(L, entry.damage_base); lua_rawset(L, -3);
                    lua_pushstring(L, "skill_type"); lua_pushstring(L, entry.skill_type.c_str()); lua_rawset(L, -3);
                    lua_pushstring(L, "skill_level"); lua_pushinteger(L, entry.skill_level); lua_rawset(L, -3);

                    if (lua_pcall(L, 1, 1, 0) != LUA_OK) {
                        lua_pop(L, 1);
                        return entry.priority;
                    }

                    uint32_t resolved = static_cast<uint32_t>(lua_tointeger(L, -1));
                    lua_pop(L, 2);
                    return resolved;
                });
                lua_pop(L, 1);
            } else {
                lua_pop(L, 1);
            }
        }
        lua_pop(L, 1);
    }
}

static bool is_unit_alive(const damage_arbiter::UnitState* unit) {
    if (!unit) return false;
    if (unit->hp() <= 0) return false;
    return true;
}

static bool is_unit_alive(uint64_t unit_id) {
    auto it = g_unit_map.find(unit_id);
    if (it == g_unit_map.end()) return false;
    return is_unit_alive(it->second);
}

damage_arbiter::DamageResult Arbiter::process_hit(const damage_arbiter::CollisionHit& hit,
                                                    const damage_arbiter::ArbitrateRequest& request) {
    damage_arbiter::DamageResult result;
    result.set_target_id(hit.target_id());
    result.set_source_id(hit.attacker_id());
    result.set_skill_id(hit.skill_id());
    result.set_raw_damage(hit.damage_base());
    result.set_final_damage(0);
    result.set_is_critical(false);
    result.set_is_blocked(false);
    result.set_is_dodged(false);
    result.set_is_perfect_block(false);
    result.set_is_damage_shared(false);
    result.set_damage_reduction(0.0);

    uint64_t current_time = request.current_time();

    auto it = g_unit_map.find(hit.target_id());
    if (it == g_unit_map.end()) {
        return result;
    }

    const damage_arbiter::UnitState* target_ptr = it->second;
    if (!target_ptr || !is_unit_alive(target_ptr)) {
        return result;
    }
    const auto& target = *target_ptr;

    if (hit.attacker_id() != 0 && !is_unit_alive(hit.attacker_id())) {
        return result;
    }

    result.set_final_damage(hit.damage_base());

    result = apply_dodge(result, target, current_time);
    if (result.is_dodged()) {
        result.set_final_damage(0);
        return result;
    }

    result = apply_block(result, target, hit, current_time);

    auto attacker_it = g_unit_map.find(hit.attacker_id());
    if (attacker_it != g_unit_map.end() && attacker_it->second) {
        const auto& attacker = *attacker_it->second;
        if (is_unit_alive(&attacker)) {
            result = apply_critical(result, attacker, target, hit);
        }
    }

    result = apply_damage_share(result, request);

    return result;
}

damage_arbiter::DamageResult Arbiter::apply_dodge(const damage_arbiter::DamageResult& result,
                                                    const damage_arbiter::UnitState& target,
                                                    uint64_t current_time) {
    damage_arbiter::DamageResult out = result;

    if (!lua_engine_->state()) return out;

    lua_State* L = lua_engine_->state();
    lua_getglobal(L, "dodge");
    if (!lua_istable(L, -1)) {
        lua_pop(L, 1);
        return out;
    }

    lua_getfield(L, -1, "calculate");
    if (!lua_isfunction(L, -1)) {
        lua_pop(L, 2);
        return out;
    }

    lua_newtable(L);
    lua_pushstring(L, "dodge_rate"); lua_pushnumber(L, target.dodge_rate()); lua_rawset(L, -3);
    lua_pushstring(L, "is_moving"); lua_pushboolean(L, target.is_moving()); lua_rawset(L, -3);
    lua_pushstring(L, "agility"); lua_pushnumber(L, target.agility()); lua_rawset(L, -3);
    lua_pushstring(L, "last_dodge_time"); lua_pushinteger(L, static_cast<lua_Integer>(target.last_dodge_time())); lua_rawset(L, -3);
    lua_pushstring(L, "current_time"); lua_pushinteger(L, static_cast<lua_Integer>(current_time)); lua_rawset(L, -3);

    if (lua_pcall(L, 1, 1, 0) != LUA_OK) {
        lua_pop(L, 2);
        return out;
    }

    if (lua_isboolean(L, -1) && lua_toboolean(L, -1)) {
        out.set_is_dodged(true);
        out.set_final_damage(0);
    }

    lua_pop(L, 2);
    return out;
}

damage_arbiter::DamageResult Arbiter::apply_block(const damage_arbiter::DamageResult& result,
                                                    const damage_arbiter::UnitState& target,
                                                    const damage_arbiter::CollisionHit& hit,
                                                    uint64_t current_time) {
    damage_arbiter::DamageResult out = result;

    if (!lua_engine_->state()) return out;

    lua_State* L = lua_engine_->state();
    lua_getglobal(L, "block");
    if (!lua_istable(L, -1)) {
        lua_pop(L, 1);
        return out;
    }

    lua_getfield(L, -1, "calculate");
    if (!lua_isfunction(L, -1)) {
        lua_pop(L, 2);
        return out;
    }

    lua_newtable(L);
    lua_pushstring(L, "facing_x"); lua_pushnumber(L, target.facing().x()); lua_rawset(L, -3);
    lua_pushstring(L, "facing_y"); lua_pushnumber(L, target.facing().y()); lua_rawset(L, -3);
    lua_pushstring(L, "facing_z"); lua_pushnumber(L, target.facing().z()); lua_rawset(L, -3);
    lua_pushstring(L, "attack_dir_x"); lua_pushnumber(L, hit.attack_direction().x()); lua_rawset(L, -3);
    lua_pushstring(L, "attack_dir_y"); lua_pushnumber(L, hit.attack_direction().y()); lua_rawset(L, -3);
    lua_pushstring(L, "attack_dir_z"); lua_pushnumber(L, hit.attack_direction().z()); lua_rawset(L, -3);
    lua_pushstring(L, "block_count"); lua_pushinteger(L, target.block_count()); lua_rawset(L, -3);
    lua_pushstring(L, "last_block_time"); lua_pushinteger(L, static_cast<lua_Integer>(target.last_block_time())); lua_rawset(L, -3);
    lua_pushstring(L, "current_time"); lua_pushinteger(L, static_cast<lua_Integer>(current_time)); lua_rawset(L, -3);

    if (lua_pcall(L, 1, 1, 0) != LUA_OK) {
        lua_pop(L, 2);
        return out;
    }

    if (lua_istable(L, -1)) {
        lua_getfield(L, -1, "blocked");
        bool blocked = lua_toboolean(L, -1) != 0;
        lua_pop(L, 1);

        if (blocked) {
            out.set_is_blocked(true);

            lua_getfield(L, -1, "perfect");
            bool perfect = lua_toboolean(L, -1) != 0;
            lua_pop(L, 1);
            out.set_is_perfect_block(perfect);

            lua_getfield(L, -1, "reduction");
            double reduction = lua_tonumber(L, -1);
            lua_pop(L, 1);

            out.set_damage_reduction(reduction);
            double final_dmg = out.final_damage() * (1.0 - reduction);
            out.set_final_damage(final_dmg);
        }
    }

    lua_pop(L, 2);
    return out;
}

damage_arbiter::DamageResult Arbiter::apply_critical(const damage_arbiter::DamageResult& result,
                                                      const damage_arbiter::UnitState& attacker,
                                                      const damage_arbiter::UnitState& target,
                                                      const damage_arbiter::CollisionHit& hit) {
    damage_arbiter::DamageResult out = result;

    if (!lua_engine_->state()) return out;

    lua_State* L = lua_engine_->state();
    lua_getglobal(L, "critical");
    if (!lua_istable(L, -1)) {
        lua_pop(L, 1);
        return out;
    }

    lua_getfield(L, -1, "calculate");
    if (!lua_isfunction(L, -1)) {
        lua_pop(L, 2);
        return out;
    }

    lua_newtable(L);
    lua_pushstring(L, "critical_rate"); lua_pushnumber(L, attacker.critical_rate()); lua_rawset(L, -3);
    lua_pushstring(L, "critical_damage"); lua_pushnumber(L, attacker.critical_damage()); lua_rawset(L, -3);
    lua_pushstring(L, "attack_dir_x"); lua_pushnumber(L, hit.attack_direction().x()); lua_rawset(L, -3);
    lua_pushstring(L, "attack_dir_y"); lua_pushnumber(L, hit.attack_direction().y()); lua_rawset(L, -3);
    lua_pushstring(L, "attack_dir_z"); lua_pushnumber(L, hit.attack_direction().z()); lua_rawset(L, -3);
    lua_pushstring(L, "target_facing_x"); lua_pushnumber(L, target.facing().x()); lua_rawset(L, -3);
    lua_pushstring(L, "target_facing_y"); lua_pushnumber(L, target.facing().y()); lua_rawset(L, -3);
    lua_pushstring(L, "target_facing_z"); lua_pushnumber(L, target.facing().z()); lua_rawset(L, -3);

    if (lua_pcall(L, 1, 1, 0) != LUA_OK) {
        lua_pop(L, 2);
        return out;
    }

    if (lua_istable(L, -1)) {
        lua_getfield(L, -1, "is_critical");
        bool is_crit = lua_toboolean(L, -1) != 0;
        lua_pop(L, 1);

        if (is_crit) {
            out.set_is_critical(true);
            lua_getfield(L, -1, "multiplier");
            double multiplier = lua_tonumber(L, -1);
            lua_pop(L, 1);
            out.set_final_damage(out.final_damage() * multiplier);
        }
    }

    lua_pop(L, 2);
    return out;
}

damage_arbiter::DamageResult Arbiter::apply_damage_share(const damage_arbiter::DamageResult& result,
                                                          const damage_arbiter::ArbitrateRequest& request) {
    damage_arbiter::DamageResult out = result;

    if (!lua_engine_->state()) return out;

    lua_State* L = lua_engine_->state();
    lua_getglobal(L, "damage_share");
    if (!lua_istable(L, -1)) {
        lua_pop(L, 1);
        return out;
    }

    lua_getfield(L, -1, "calculate");
    if (!lua_isfunction(L, -1)) {
        lua_pop(L, 2);
        return out;
    }

    lua_newtable(L);
    lua_pushstring(L, "target_id"); lua_pushinteger(L, static_cast<lua_Integer>(out.target_id())); lua_rawset(L, -3);
    lua_pushstring(L, "damage"); lua_pushnumber(L, out.final_damage()); lua_rawset(L, -3);

    auto target_it = g_unit_map.find(out.target_id());
    if (target_it != g_unit_map.end() && target_it->second && is_unit_alive(target_it->second)) {
        const auto& target = *target_it->second;

        lua_pushstring(L, "target_position");
        lua_newtable(L);
        lua_pushstring(L, "x"); lua_pushnumber(L, target.position().x()); lua_rawset(L, -3);
        lua_pushstring(L, "y"); lua_pushnumber(L, target.position().y()); lua_rawset(L, -3);
        lua_pushstring(L, "z"); lua_pushnumber(L, target.position().z()); lua_rawset(L, -3);
        lua_rawset(L, -3);

        lua_pushstring(L, "team_id"); lua_pushinteger(L, target.team_id()); lua_rawset(L, -3);

        lua_pushstring(L, "allies");
        lua_newtable(L);
        int ally_idx = 1;
        for (int i = 0; i < request.units_size(); ++i) {
            const auto& unit = request.units(i);
            if (unit.unit_id() != out.target_id() && unit.team_id() == target.team_id() && unit.hp() > 0) {
                lua_newtable(L);
                lua_pushstring(L, "unit_id"); lua_pushinteger(L, static_cast<lua_Integer>(unit.unit_id())); lua_rawset(L, -3);
                lua_pushstring(L, "position");
                lua_newtable(L);
                lua_pushstring(L, "x"); lua_pushnumber(L, unit.position().x()); lua_rawset(L, -3);
                lua_pushstring(L, "y"); lua_pushnumber(L, unit.position().y()); lua_rawset(L, -3);
                lua_pushstring(L, "z"); lua_pushnumber(L, unit.position().z()); lua_rawset(L, -3);
                lua_rawset(L, -3);
                lua_rawseti(L, -2, ally_idx++);
            }
        }
        lua_rawset(L, -3);
    }

    if (lua_pcall(L, 1, 1, 0) != LUA_OK) {
        lua_pop(L, 2);
        return out;
    }

    if (lua_istable(L, -1)) {
        lua_getfield(L, -1, "shared");
        bool shared = lua_toboolean(L, -1) != 0;
        lua_pop(L, 1);

        if (shared) {
            out.set_is_damage_shared(true);

            lua_getfield(L, -1, "final_damage");
            double final_dmg = lua_tonumber(L, -1);
            lua_pop(L, 1);
            out.set_final_damage(final_dmg);

            lua_getfield(L, -1, "share_targets");
            if (lua_istable(L, -1)) {
                lua_pushnil(L);
                while (lua_next(L, -2) != 0) {
                    uint64_t tid = static_cast<uint64_t>(lua_tointeger(L, -1));
                    out.add_share_targets(tid);
                    lua_pop(L, 1);
                }
            }
            lua_pop(L, 1);
        }
    }

    lua_pop(L, 2);
    return out;
}

damage_arbiter::ArbitrateResponse Arbiter::arbitrate(const damage_arbiter::ArbitrateRequest& request) {
    damage_arbiter::ArbitrateResponse response;
    response.set_success(true);

    if (!initialized_) {
        response.set_success(false);
        response.set_error_message("Arbiter not initialized");
        return response;
    }

    set_current_request(&request);

    SkillPriorityQueue queue;
    sort_skills_by_priority(request, queue);

    for (int i = 0; i < request.hits_size(); ++i) {
        const auto& hit = request.hits(i);
        auto result = process_hit(hit, request);
        *response.add_results() = result;
    }

    clear_current_request();
    return response;
}

bool Arbiter::reload_scripts() {
    if (!lua_engine_) return false;
    return lua_engine_->reload_all_scripts();
}

void Arbiter::set_scripts_directory(const std::string& dir) {
    scripts_dir_ = dir;
    if (lua_engine_) {
        lua_engine_->set_scripts_directory(dir);
    }
}

const std::string& Arbiter::get_scripts_directory() const {
    return scripts_dir_;
}
