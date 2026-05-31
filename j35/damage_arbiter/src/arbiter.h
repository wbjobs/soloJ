#pragma once

#include "lua_engine.h"
#include "priority_queue.h"
#include "damage_arbiter.pb.h"
#include <memory>
#include <string>
#include <vector>
#include <unordered_map>
#include <functional>

class Arbiter {
public:
    Arbiter();
    ~Arbiter();

    bool initialize(const std::string& scripts_dir);
    void shutdown();

    damage_arbiter::ArbitrateResponse arbitrate(const damage_arbiter::ArbitrateRequest& request);

    bool reload_scripts();

    void set_scripts_directory(const std::string& dir);
    const std::string& get_scripts_directory() const;

    bool is_initialized() const { return initialized_; }

private:
    void sort_skills_by_priority(const damage_arbiter::ArbitrateRequest& request,
                                  SkillPriorityQueue& queue);

    damage_arbiter::DamageResult process_hit(const damage_arbiter::CollisionHit& hit,
                                              const damage_arbiter::ArbitrateRequest& request);

    damage_arbiter::DamageResult apply_dodge(const damage_arbiter::DamageResult& result,
                                              const damage_arbiter::UnitState& target,
                                              uint64_t current_time);

    damage_arbiter::DamageResult apply_block(const damage_arbiter::DamageResult& result,
                                              const damage_arbiter::UnitState& target,
                                              const damage_arbiter::CollisionHit& hit,
                                              uint64_t current_time);

    damage_arbiter::DamageResult apply_critical(const damage_arbiter::DamageResult& result,
                                                 const damage_arbiter::UnitState& attacker,
                                                 const damage_arbiter::UnitState& target,
                                                 const damage_arbiter::CollisionHit& hit);

    damage_arbiter::DamageResult apply_damage_share(const damage_arbiter::DamageResult& result,
                                                     const damage_arbiter::ArbitrateRequest& request);

    std::unique_ptr<LuaEngine> lua_engine_;
    bool initialized_;
    std::string scripts_dir_;
};
