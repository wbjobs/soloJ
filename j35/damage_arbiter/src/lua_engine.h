#pragma once

#include <lua.hpp>
#include <string>
#include <functional>
#include <unordered_map>
#include <filesystem>
#include <mutex>
#include <vector>

class LuaEngine {
public:
    using RegisterFunc = std::function<void(lua_State*)>;

    LuaEngine();
    ~LuaEngine();

    LuaEngine(const LuaEngine&) = delete;
    LuaEngine& operator=(const LuaEngine&) = delete;

    bool initialize();
    void shutdown();

    bool load_script(const std::string& filepath);
    bool load_scripts_from_directory(const std::string& dir_path);
    bool reload_all_scripts();
    bool reload_script(const std::string& filepath);

    void register_module(const std::string& name, RegisterFunc func);
    void register_global_function(const std::string& name, lua_CFunction func);

    lua_State* state() { return L_; }

    bool call_function(const std::string& func_name, int nargs = 0, int nresults = 0);
    bool call_function(const std::string& module_name, const std::string& func_name, int nargs = 0, int nresults = 0);

    void push_value(int v);
    void push_value(double v);
    void push_value(const std::string& v);
    void push_value(bool v);
    void push_value(uint64_t v);

    int to_int(int idx);
    double to_double(int idx);
    std::string to_string(int idx);
    bool to_bool(int idx);

    void create_table(const std::string& name);
    void set_table_field(const std::string& key, int value);
    void set_table_field(const std::string& key, double value);
    void set_table_field(const std::string& key, const std::string& value);
    void set_table_field(const std::string& key, bool value);

    std::string get_last_error() const { return last_error_; }

    void set_scripts_directory(const std::string& dir) { scripts_dir_ = dir; }
    const std::string& get_scripts_directory() const { return scripts_dir_; }

private:
    void apply_sandbox();
    void store_loaded_scripts();
    std::string find_script_file(const std::string& module_name);

    lua_State* L_;
    std::string last_error_;
    std::string scripts_dir_;
    std::unordered_map<std::string, RegisterFunc> registered_modules_;
    std::vector<std::string> loaded_scripts_;
    std::mutex reload_mutex_;
};
