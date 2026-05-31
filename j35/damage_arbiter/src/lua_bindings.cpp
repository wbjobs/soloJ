#include "lua_engine.h"
#include "damage_arbiter.pb.h"
#include <lua.hpp>
#include <unordered_map>
#include <string>
#include <cmath>

static const damage_arbiter::ArbitrateRequest* g_current_request = nullptr;
static std::unordered_map<uint64_t, const damage_arbiter::UnitState*> g_unit_map;

static void push_vec3(lua_State* L, const damage_arbiter::Vec3& v) {
    lua_newtable(L);
    lua_pushstring(L, "x"); lua_pushnumber(L, v.x()); lua_rawset(L, -3);
    lua_pushstring(L, "y"); lua_pushnumber(L, v.y()); lua_rawset(L, -3);
    lua_pushstring(L, "z"); lua_pushnumber(L, v.z()); lua_rawset(L, -3);
}

static void push_buff_info(lua_State* L, const damage_arbiter::BuffInfo& buff) {
    lua_newtable(L);
    lua_pushstring(L, "buff_id"); lua_pushinteger(L, buff.buff_id()); lua_rawset(L, -3);
    lua_pushstring(L, "buff_name"); lua_pushstring(L, buff.buff_name().c_str()); lua_rawset(L, -3);
    lua_pushstring(L, "duration"); lua_pushnumber(L, buff.duration()); lua_rawset(L, -3);
    lua_pushstring(L, "remaining"); lua_pushnumber(L, buff.remaining()); lua_rawset(L, -3);

    lua_pushstring(L, "effects");
    lua_newtable(L);
    for (int i = 0; i < buff.effects_size(); ++i) {
        const auto& eff = buff.effects(i);
        lua_newtable(L);
        lua_pushstring(L, "effect_type"); lua_pushstring(L, eff.effect_type().c_str()); lua_rawset(L, -3);
        lua_pushstring(L, "value"); lua_pushnumber(L, eff.value()); lua_rawset(L, -3);
        lua_rawseti(L, -2, i + 1);
    }
    lua_rawset(L, -3);
}

static void push_unit_state(lua_State* L, const damage_arbiter::UnitState& unit) {
    lua_newtable(L);
    lua_pushstring(L, "unit_id"); lua_pushinteger(L, static_cast<lua_Integer>(unit.unit_id())); lua_rawset(L, -3);
    lua_pushstring(L, "hp"); lua_pushnumber(L, unit.hp()); lua_rawset(L, -3);
    lua_pushstring(L, "max_hp"); lua_pushnumber(L, unit.max_hp()); lua_rawset(L, -3);

    lua_pushstring(L, "position"); push_vec3(L, unit.position()); lua_rawset(L, -3);
    lua_pushstring(L, "facing"); push_vec3(L, unit.facing()); lua_rawset(L, -3);

    lua_pushstring(L, "strength"); lua_pushnumber(L, unit.strength()); lua_rawset(L, -3);
    lua_pushstring(L, "agility"); lua_pushnumber(L, unit.agility()); lua_rawset(L, -3);
    lua_pushstring(L, "intelligence"); lua_pushnumber(L, unit.intelligence()); lua_rawset(L, -3);
    lua_pushstring(L, "critical_rate"); lua_pushnumber(L, unit.critical_rate()); lua_rawset(L, -3);
    lua_pushstring(L, "critical_damage"); lua_pushnumber(L, unit.critical_damage()); lua_rawset(L, -3);
    lua_pushstring(L, "dodge_rate"); lua_pushnumber(L, unit.dodge_rate()); lua_rawset(L, -3);
    lua_pushstring(L, "is_moving"); lua_pushboolean(L, unit.is_moving()); lua_rawset(L, -3);
    lua_pushstring(L, "team_id"); lua_pushinteger(L, unit.team_id()); lua_rawset(L, -3);
    lua_pushstring(L, "block_count"); lua_pushinteger(L, unit.block_count()); lua_rawset(L, -3);
    lua_pushstring(L, "last_block_time"); lua_pushinteger(L, static_cast<lua_Integer>(unit.last_block_time())); lua_rawset(L, -3);
    lua_pushstring(L, "last_dodge_time"); lua_pushinteger(L, static_cast<lua_Integer>(unit.last_dodge_time())); lua_rawset(L, -3);

    lua_pushstring(L, "buffs");
    lua_newtable(L);
    for (int i = 0; i < unit.buffs_size(); ++i) {
        push_buff_info(L, unit.buffs(i));
        lua_rawseti(L, -2, i + 1);
    }
    lua_rawset(L, -3);
}

static void push_skill_cast(lua_State* L, const damage_arbiter::SkillCast& skill) {
    lua_newtable(L);
    lua_pushstring(L, "skill_id"); lua_pushinteger(L, skill.skill_id()); lua_rawset(L, -3);
    lua_pushstring(L, "caster_id"); lua_pushinteger(L, static_cast<lua_Integer>(skill.caster_id())); lua_rawset(L, -3);
    lua_pushstring(L, "target_id"); lua_pushinteger(L, static_cast<lua_Integer>(skill.target_id())); lua_rawset(L, -3);
    lua_pushstring(L, "priority"); lua_pushinteger(L, skill.priority()); lua_rawset(L, -3);
    lua_pushstring(L, "timestamp"); lua_pushinteger(L, static_cast<lua_Integer>(skill.timestamp())); lua_rawset(L, -3);
    lua_pushstring(L, "damage_base"); lua_pushnumber(L, skill.damage_base()); lua_rawset(L, -3);
    lua_pushstring(L, "skill_type"); lua_pushstring(L, skill.skill_type().c_str()); lua_rawset(L, -3);
    lua_pushstring(L, "skill_level"); lua_pushinteger(L, skill.skill_level()); lua_rawset(L, -3);
    lua_pushstring(L, "attack_direction"); push_vec3(L, skill.attack_direction()); lua_rawset(L, -3);
}

static int lua_get_unit_state(lua_State* L) {
    if (!g_current_request) {
        lua_pushnil(L);
        return 1;
    }

    uint64_t unit_id = static_cast<uint64_t>(luaL_checkinteger(L, 1));
    auto it = g_unit_map.find(unit_id);
    if (it != g_unit_map.end()) {
        push_unit_state(L, *it->second);
    } else {
        lua_pushnil(L);
    }
    return 1;
}

static int lua_get_all_units(lua_State* L) {
    if (!g_current_request) {
        lua_pushnil(L);
        return 1;
    }

    lua_newtable(L);
    for (int i = 0; i < g_current_request->units_size(); ++i) {
        push_unit_state(L, g_current_request->units(i));
        lua_rawseti(L, -2, i + 1);
    }
    return 1;
}

static int lua_get_skill_casts(lua_State* L) {
    if (!g_current_request) {
        lua_pushnil(L);
        return 1;
    }

    lua_newtable(L);
    for (int i = 0; i < g_current_request->skills_size(); ++i) {
        push_skill_cast(L, g_current_request->skills(i));
        lua_rawseti(L, -2, i + 1);
    }
    return 1;
}

static int lua_get_collision_hits(lua_State* L) {
    if (!g_current_request) {
        lua_pushnil(L);
        return 1;
    }

    lua_newtable(L);
    for (int i = 0; i < g_current_request->hits_size(); ++i) {
        const auto& hit = g_current_request->hits(i);
        lua_newtable(L);
        lua_pushstring(L, "attacker_id"); lua_pushinteger(L, static_cast<lua_Integer>(hit.attacker_id())); lua_rawset(L, -3);
        lua_pushstring(L, "target_id"); lua_pushinteger(L, static_cast<lua_Integer>(hit.target_id())); lua_rawset(L, -3);
        lua_pushstring(L, "skill_id"); lua_pushinteger(L, hit.skill_id()); lua_rawset(L, -3);
        lua_pushstring(L, "hit_point"); push_vec3(L, hit.hit_point()); lua_rawset(L, -3);
        lua_pushstring(L, "attack_direction"); push_vec3(L, hit.attack_direction()); lua_rawset(L, -3);
        lua_pushstring(L, "damage_base"); lua_pushnumber(L, hit.damage_base()); lua_rawset(L, -3);
        lua_rawseti(L, -2, i + 1);
    }
    return 1;
}

static int lua_get_current_time(lua_State* L) {
    if (!g_current_request) {
        lua_pushinteger(L, 0);
        return 1;
    }
    lua_pushinteger(L, static_cast<lua_Integer>(g_current_request->current_time()));
    return 1;
}

static int lua_get_unit_buffs(lua_State* L) {
    uint64_t unit_id = static_cast<uint64_t>(luaL_checkinteger(L, 1));
    auto it = g_unit_map.find(unit_id);
    if (it == g_unit_map.end()) {
        lua_pushnil(L);
        return 1;
    }

    const auto& buffs = it->second->buffs();
    lua_newtable(L);
    for (int i = 0; i < buffs.size(); ++i) {
        push_buff_info(L, buffs.Get(i));
        lua_rawseti(L, -2, i + 1);
    }
    return 1;
}

static int lua_get_unit_attribute(lua_State* L) {
    uint64_t unit_id = static_cast<uint64_t>(luaL_checkinteger(L, 1));
    std::string attr = luaL_checkstring(L, 2);

    auto it = g_unit_map.find(unit_id);
    if (it == g_unit_map.end()) {
        lua_pushnumber(L, 0);
        return 1;
    }

    const auto& unit = *it->second;
    if (attr == "strength") lua_pushnumber(L, unit.strength());
    else if (attr == "agility") lua_pushnumber(L, unit.agility());
    else if (attr == "intelligence") lua_pushnumber(L, unit.intelligence());
    else if (attr == "critical_rate") lua_pushnumber(L, unit.critical_rate());
    else if (attr == "critical_damage") lua_pushnumber(L, unit.critical_damage());
    else if (attr == "dodge_rate") lua_pushnumber(L, unit.dodge_rate());
    else if (attr == "hp") lua_pushnumber(L, unit.hp());
    else if (attr == "max_hp") lua_pushnumber(L, unit.max_hp());
    else if (attr == "is_moving") lua_pushboolean(L, unit.is_moving());
    else if (attr == "team_id") lua_pushinteger(L, unit.team_id());
    else if (attr == "block_count") lua_pushinteger(L, unit.block_count());
    else lua_pushnumber(L, 0);

    return 1;
}

static int lua_vec3_dot(lua_State* L) {
    double ax = luaL_checknumber(L, 1);
    double ay = luaL_checknumber(L, 2);
    double az = luaL_checknumber(L, 3);
    double bx = luaL_checknumber(L, 4);
    double by = luaL_checknumber(L, 5);
    double bz = luaL_checknumber(L, 6);
    lua_pushnumber(L, ax * bx + ay * by + az * bz);
    return 1;
}

static int lua_vec3_length(lua_State* L) {
    double x = luaL_checknumber(L, 1);
    double y = luaL_checknumber(L, 2);
    double z = luaL_checknumber(L, 3);
    lua_pushnumber(L, std::sqrt(x * x + y * y + z * z));
    return 1;
}

static int lua_vec3_angle(lua_State* L) {
    double ax = luaL_checknumber(L, 1);
    double ay = luaL_checknumber(L, 2);
    double az = luaL_checknumber(L, 3);
    double bx = luaL_checknumber(L, 4);
    double by = luaL_checknumber(L, 5);
    double bz = luaL_checknumber(L, 6);

    double dot = ax * bx + ay * by + az * bz;
    double la = std::sqrt(ax * ax + ay * ay + az * az);
    double lb = std::sqrt(bx * bx + by * by + bz * bz);

    if (la < 1e-9 || lb < 1e-9) {
        lua_pushnumber(L, 0);
        return 1;
    }

    double cos_angle = dot / (la * lb);
    if (cos_angle > 1.0) cos_angle = 1.0;
    if (cos_angle < -1.0) cos_angle = -1.0;

    lua_pushnumber(L, std::acos(cos_angle));
    return 1;
}

static int lua_distance_3d(lua_State* L) {
    double x1 = luaL_checknumber(L, 1);
    double y1 = luaL_checknumber(L, 2);
    double z1 = luaL_checknumber(L, 3);
    double x2 = luaL_checknumber(L, 4);
    double y2 = luaL_checknumber(L, 5);
    double z2 = luaL_checknumber(L, 6);
    double dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    lua_pushnumber(L, std::sqrt(dx * dx + dy * dy + dz * dz));
    return 1;
}

void register_lua_bindings(LuaEngine& engine) {
    engine.register_global_function("get_unit_state", lua_get_unit_state);
    engine.register_global_function("get_all_units", lua_get_all_units);
    engine.register_global_function("get_skill_casts", lua_get_skill_casts);
    engine.register_global_function("get_collision_hits", lua_get_collision_hits);
    engine.register_global_function("get_current_time", lua_get_current_time);
    engine.register_global_function("get_unit_buffs", lua_get_unit_buffs);
    engine.register_global_function("get_unit_attribute", lua_get_unit_attribute);
    engine.register_global_function("vec3_dot", lua_vec3_dot);
    engine.register_global_function("vec3_length", lua_vec3_length);
    engine.register_global_function("vec3_angle", lua_vec3_angle);
    engine.register_global_function("distance_3d", lua_distance_3d);
}

void set_current_request(const damage_arbiter::ArbitrateRequest* request) {
    g_current_request = request;
    g_unit_map.clear();
    if (request) {
        for (int i = 0; i < request->units_size(); ++i) {
            g_unit_map[request->units(i).unit_id()] = &request->units(i);
        }
    }
}

void clear_current_request() {
    g_current_request = nullptr;
    g_unit_map.clear();
}
