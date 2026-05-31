#pragma once

#include <cstdint>
#include <vector>
#include <array>
#include <unordered_map>
#include "unit.h"

static constexpr int QT_MAX_DEPTH = 8;
static constexpr int QT_MAX_UNITS_PER_NODE = 16;
static constexpr size_t QT_NODE_POOL_SIZE = 8192;
static constexpr float QT_MIN_CHILD_SIZE = 2.0f;
static constexpr float QT_SPLIT_EFFICIENCY_THRESHOLD = 0.7f;
static constexpr int QT_MERGE_THRESHOLD = 4;

struct AABB {
    Vec2 center;
    float half_w;
    float half_h;

    bool contains(const Vec2& p) const;
    bool intersects_circle(const Vec2& c, float r) const;
    bool intersects_rect(const Vec2& c, float hw, float hh) const;
    bool intersects_sector(const Vec2& c, float r, float heading, float half_angle) const;
};

struct QuadtreeNode {
    AABB bounds;
    int32_t depth = 0;
    int32_t parent = -1;
    int32_t children[4] = {-1, -1, -1, -1};
    int32_t unit_count = 0;
    Unit* units[QT_MAX_UNITS_PER_NODE] = {};
    bool leaf = true;
};

class QuadtreeNodePool {
public:
    QuadtreeNodePool(size_t capacity);

    int32_t allocate(const AABB& bounds, int32_t depth, int32_t parent);
    void deallocate(int32_t idx);
    QuadtreeNode& get(int32_t idx);
    const QuadtreeNode& get(int32_t idx) const;
    void reset();

private:
    std::vector<QuadtreeNode> pool_;
    std::vector<int32_t> free_list_;
    size_t capacity_;
};

class Quadtree {
public:
    explicit Quadtree(float world_size);

    void insert(Unit* unit);
    void remove(Unit* unit);
    void update(Unit* unit);

    void query_circle(const Vec2& center, float radius, std::vector<Unit*>& out) const;
    void query_rect(const Vec2& center, float hw, float hh, std::vector<Unit*>& out) const;
    void query_sector(const Vec2& center, float radius, float heading, float angle, std::vector<Unit*>& out) const;

    void batch_query_circle(const std::vector<std::pair<Vec2, float>>& queries,
                            std::vector<std::vector<Unit*>>& outs) const;

    void clear();
    void rebuild(const std::vector<Unit*>& units);

private:
    bool should_subdivide(int32_t node_idx) const;
    void merge_if_needed(int32_t node_idx);
    int32_t count_units_in_subtree(int32_t node_idx) const;
    void insert_to_node(int32_t node_idx, Unit* unit);
    void remove_from_node(int32_t node_idx, Unit* unit);
    void subdivide(int32_t node_idx);
    int32_t get_child_index(int32_t node_idx, const Vec2& pos) const;
    void query_circle_node(int32_t node_idx, const Vec2& center, float radius, std::vector<Unit*>& out) const;
    void query_rect_node(int32_t node_idx, const Vec2& center, float hw, float hh, std::vector<Unit*>& out) const;
    void query_sector_node(int32_t node_idx, const Vec2& center, float radius, float heading, float half_angle, std::vector<Unit*>& out) const;

    bool is_node_fully_inside_circle(int32_t node_idx, const Vec2& center, float radius) const;
    bool is_node_fully_inside_rect(int32_t node_idx, const Vec2& center, float hw, float hh) const;
    void collect_all_units(int32_t node_idx, std::vector<Unit*>& out) const;

    QuadtreeNodePool pool_;
    int32_t root_;
    float world_size_;
    std::unordered_map<uint64_t, int32_t> unit_node_map_;
};
