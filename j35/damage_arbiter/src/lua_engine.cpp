#include "lua_engine.h"
#include <lua.hpp>
#include <iostream>
#include <algorithm>
#include <cmath>

LuaEngine::LuaEngine() : L_(nullptr) {}

LuaEngine::~LuaEngine() {
    shutdown();
}

bool LuaEngine::initialize() {
    L_ = luaL_newstate();
    if (!L_) {
        last_error_ = "Failed to create Lua state";
        return false;
    }

    luaL_openlibs(L_);
    apply_sandbox();

    return true;
}

void LuaEngine::shutdown() {
    if (L_) {
        lua_close(L_);
        L_ = nullptr;
    }
}

void LuaEngine::apply_sandbox() {
    lua_getglobal(L_, "io");
    lua_pushnil(L_);
    lua_setfield(L_, -2, "open");
    lua_pushnil(L_);
    lua_setfield(L_, -2, "lines");
    lua_pushnil(L_);
    lua_setfield(L_, -2, "read");
    lua_pushnil(L_);
    lua_setfield(L_, -2, "write");
    lua_pushnil(L_);
    lua_setfield(L_, -2, "input");
    lua_pushnil(L_);
    lua_setfield(L_, -2, "output");
    lua_pushnil(L_);
    lua_setfield(L_, -2, "tmpfile");
    lua_pushnil(L_);
    lua_setfield(L_, -2, "popen");
    lua_pop(L_, 1);

    lua_getglobal(L_, "os");
    lua_pushnil(L_);
    lua_setfield(L_, -2, "execute");
    lua_pushnil(L_);
    lua_setfield(L_, -2, "exit");
    lua_pushnil(L_);
    lua_setfield(L_, -2, "remove");
    lua_pushnil(L_);
    lua_setfield(L_, -2, "rename");
    lua_pushnil(L_);
    lua_setfield(L_, -2, "getenv");
    lua_pushnil(L_);
    lua_setfield(L_, -2, "tmpname");
    lua_pop(L_, 1);

    lua_pushnil(L_);
    lua_setglobal(L_, "dofile");
    lua_pushnil(L_);
    lua_setglobal(L_, "loadfile");

    lua_getglobal(L_, "package");
    lua_pushnil(L_);
    lua_setfield(L_, -2, "loaders");
    lua_pushstring(L_, "");
    lua_setfield(L_, -2, "path");
    lua_pushstring(L_, "");
    lua_setfield(L_, -2, "cpath");
    lua_pop(L_, 1);
}

bool LuaEngine::load_script(const std::string& filepath) {
    if (!L_) {
        last_error_ = "Lua state not initialized";
        return false;
    }

    std::lock_guard<std::mutex> lock(reload_mutex_);

    int status = luaL_loadfile(L_, filepath.c_str());
    if (status != LUA_OK) {
        last_error_ = lua_tostring(L_, -1);
        lua_pop(L_, 1);
        return false;
    }

    status = lua_pcall(L_, 0, 0, 0);
    if (status != LUA_OK) {
        last_error_ = lua_tostring(L_, -1);
        lua_pop(L_, 1);
        return false;
    }

    loaded_scripts_.push_back(filepath);
    return true;
}

bool LuaEngine::load_scripts_from_directory(const std::string& dir_path) {
    scripts_dir_ = dir_path;

    if (!std::filesystem::exists(dir_path)) {
        last_error_ = "Scripts directory not found: " + dir_path;
        return false;
    }

    std::string init_path = dir_path + "/init.lua";
    if (std::filesystem::exists(init_path)) {
        if (!load_script(init_path)) {
            return false;
        }
    }

    for (const auto& entry : std::filesystem::directory_iterator(dir_path)) {
        if (entry.is_regular_file() && entry.path().extension() == ".lua") {
            std::string filename = entry.path().filename().string();
            if (filename != "init.lua") {
                if (!load_script(entry.path().string())) {
                    return false;
                }
            }
        }
    }

    return true;
}

bool LuaEngine::reload_all_scripts() {
    if (!L_) {
        last_error_ = "Lua state not initialized";
        return false;
    }

    lua_close(L_);
    L_ = luaL_newstate();
    if (!L_) {
        last_error_ = "Failed to recreate Lua state";
        return false;
    }

    luaL_openlibs(L_);
    apply_sandbox();

    for (auto& [name, func] : registered_modules_) {
        func(L_);
    }

    auto scripts = loaded_scripts_;
    loaded_scripts_.clear();

    for (const auto& script : scripts) {
        if (!load_script(script)) {
            return false;
        }
    }

    return true;
}

bool LuaEngine::reload_script(const std::string& filepath) {
    if (!L_) {
        last_error_ = "Lua state not initialized";
        return false;
    }

    return load_script(filepath);
}

void LuaEngine::register_module(const std::string& name, RegisterFunc func) {
    registered_modules_[name] = func;
    if (L_) {
        func(L_);
    }
}

void LuaEngine::register_global_function(const std::string& name, lua_CFunction func) {
    if (!L_) return;
    lua_register(L_, name.c_str(), func);
}

bool LuaEngine::call_function(const std::string& func_name, int nargs, int nresults) {
    if (!L_) {
        last_error_ = "Lua state not initialized";
        return false;
    }

    lua_getglobal(L_, func_name.c_str());
    if (!lua_isfunction(L_, -1)) {
        last_error_ = "Function not found: " + func_name;
        lua_pop(L_, 1);
        return false;
    }

    if (nargs > 0) {
        lua_insert(L_, lua_gettop(L_) - nargs);
    }

    int status = lua_pcall(L_, nargs, nresults, 0);
    if (status != LUA_OK) {
        last_error_ = lua_tostring(L_, -1);
        lua_pop(L_, 1);
        return false;
    }

    return true;
}

bool LuaEngine::call_function(const std::string& module_name, const std::string& func_name, int nargs, int nresults) {
    if (!L_) {
        last_error_ = "Lua state not initialized";
        return false;
    }

    lua_getglobal(L_, module_name.c_str());
    if (!lua_istable(L_, -1)) {
        last_error_ = "Module not found: " + module_name;
        lua_pop(L_, 1);
        return false;
    }

    lua_getfield(L_, -1, func_name.c_str());
    if (!lua_isfunction(L_, -1)) {
        last_error_ = "Function not found: " + module_name + "." + func_name;
        lua_pop(L_, 2);
        return false;
    }

    lua_remove(L_, -2);

    if (nargs > 0) {
        lua_insert(L_, lua_gettop(L_) - nargs);
    }

    int status = lua_pcall(L_, nargs, nresults, 0);
    if (status != LUA_OK) {
        last_error_ = lua_tostring(L_, -1);
        lua_pop(L_, 1);
        return false;
    }

    return true;
}

void LuaEngine::push_value(int v) { lua_pushinteger(L_, v); }
void LuaEngine::push_value(double v) { lua_pushnumber(L_, v); }
void LuaEngine::push_value(const std::string& v) { lua_pushstring(L_, v.c_str()); }
void LuaEngine::push_value(bool v) { lua_pushboolean(L_, v ? 1 : 0); }
void LuaEngine::push_value(uint64_t v) { lua_pushinteger(L_, static_cast<lua_Integer>(v)); }

int LuaEngine::to_int(int idx) { return static_cast<int>(lua_tointeger(L_, idx)); }
double LuaEngine::to_double(int idx) { return lua_tonumber(L_, idx); }
std::string LuaEngine::to_string(int idx) { return lua_tostring(L_, idx); }
bool LuaEngine::to_bool(int idx) { return lua_toboolean(L_, idx) != 0; }

void LuaEngine::create_table(const std::string& name) {
    lua_newtable(L_);
    lua_setglobal(L_, name.c_str());
}

void LuaEngine::set_table_field(const std::string& key, int value) {
    lua_pushstring(L_, key.c_str());
    lua_pushinteger(L_, value);
    lua_rawset(L_, -3);
}

void LuaEngine::set_table_field(const std::string& key, double value) {
    lua_pushstring(L_, key.c_str());
    lua_pushnumber(L_, value);
    lua_rawset(L_, -3);
}

void LuaEngine::set_table_field(const std::string& key, const std::string& value) {
    lua_pushstring(L_, key.c_str());
    lua_pushstring(L_, value.c_str());
    lua_rawset(L_, -3);
}

void LuaEngine::set_table_field(const std::string& key, bool value) {
    lua_pushstring(L_, key.c_str());
    lua_pushboolean(L_, value ? 1 : 0);
    lua_rawset(L_, -3);
}

std::string LuaEngine::find_script_file(const std::string& module_name) {
    std::string path = scripts_dir_ + "/" + module_name + ".lua";
    if (std::filesystem::exists(path)) {
        return path;
    }
    return "";
}

void LuaEngine::store_loaded_scripts() {
}
