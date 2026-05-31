#pragma once

#include <vector>
#include <queue>
#include <functional>
#include <algorithm>
#include <cstdint>

struct SkillCastEntry {
    uint32_t skill_id;
    uint64_t caster_id;
    uint64_t target_id;
    uint32_t priority;
    uint64_t timestamp;
    double damage_base;
    std::string skill_type;
    uint32_t skill_level;

    bool operator<(const SkillCastEntry& other) const {
        if (priority != other.priority) {
            return priority < other.priority;
        }
        return timestamp > other.timestamp;
    }

    bool operator>(const SkillCastEntry& other) const {
        if (priority != other.priority) {
            return priority > other.priority;
        }
        return timestamp < other.timestamp;
    }
};

class SkillPriorityQueue {
public:
    SkillPriorityQueue() = default;

    void push(const SkillCastEntry& entry) {
        entries_.push_back(entry);
        std::push_heap(entries_.begin(), entries_.end(), std::greater<SkillCastEntry>());
    }

    SkillCastEntry pop() {
        std::pop_heap(entries_.begin(), entries_.end(), std::greater<SkillCastEntry>());
        SkillCastEntry top = entries_.back();
        entries_.pop_back();
        return top;
    }

    const SkillCastEntry& top() const {
        return entries_.front();
    }

    bool empty() const {
        return entries_.empty();
    }

    size_t size() const {
        return entries_.size();
    }

    void clear() {
        entries_.clear();
    }

    std::vector<SkillCastEntry> pop_batch(size_t count) {
        std::vector<SkillCastEntry> result;
        result.reserve(count);
        while (!entries_.empty() && result.size() < count) {
            result.push_back(pop());
        }
        return result;
    }

    std::vector<SkillCastEntry> pop_all() {
        std::sort_heap(entries_.begin(), entries_.end(), std::greater<SkillCastEntry>());
        std::vector<SkillCastEntry> result = std::move(entries_);
        entries_.clear();
        return result;
    }

    void sort_by_lua_priority(const std::function<uint32_t(const SkillCastEntry&)>& priority_resolver) {
        for (auto& entry : entries_) {
            entry.priority = priority_resolver(entry);
        }
        std::make_heap(entries_.begin(), entries_.end(), std::greater<SkillCastEntry>());
    }

private:
    std::vector<SkillCastEntry> entries_;
};
