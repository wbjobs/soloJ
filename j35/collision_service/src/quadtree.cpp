#include "quadtree.h"
#include <cmath>
#include <algorithm>

static constexpr float PI = 3.14159265358979323846f;

float Vec2::length() const {
    return std::sqrt(x * x + y * y);
}

Vec2 Vec2::normalized() const {
    float len = length();
    if (len < 1e-6f) return {0.0f, 0.0f};
    return {x / len, y / len};
}

bool AABB::contains(const Vec2& p) const {
    return p.x >= center.x - half_w && p.x <= center.x + half_w &&
           p.y >= center.y - half_h && p.y <= center.y + half_h;
}

bool AABB::intersects_circle(const Vec2& c, float r) const {
    float dx = std::max(0.0f, std::abs(c.x - center.x) - half_w);
    float dy = std::max(0.0f, std::abs(c.y - center.y) - half_h);
    return dx * dx + dy * dy <= r * r;
}

bool AABB::intersects_rect(const Vec2& c, float hw, float hh) const {
    return std::abs(center.x - c.x) <= half_w + hw &&
           std::abs(center.y - c.y) <= half_h + hh;
}

bool AABB::intersects_sector(const Vec2& c, float r, float heading, float half_angle) const {
    if (intersects_circle(c, r)) return true;
    Vec2 d = center - c;
    float dist_sq = d.length_sq();
    if (dist_sq > r * r) return false;
    float dist = std::sqrt(dist_sq);
    if (dist < 1e-6f) return true;
    float angle_to_center = std::atan2(d.y, d.x);
    float diff = angle_to_center - heading;
    while (diff > PI) diff -= 2.0f * PI;
    while (diff < -PI) diff += 2.0f * PI;
    return std::abs(diff) <= half_angle;
}

QuadtreeNodePool::QuadtreeNodePool(size_t capacity) : capacity_(capacity) {
    pool_.resize(capacity);
    free_list_.reserve(capacity);
    for (size_t i = capacity; i > 0; --i) {
        free_list_.push_back(static_cast<int32_t>(i - 1));
    }
}

int32_t QuadtreeNodePool::allocate(const AABB& bounds, int32_t depth, int32_t parent) {
    if (free_list_.empty()) return -1;
    int32_t idx = free_list_.back();
    free_list_.pop_back();
    QuadtreeNode& node = pool_[idx];
    node.bounds = bounds;
    node.depth = depth;
    node.parent = parent;
    node.children[0] = node.children[1] = node.children[2] = node.children[3] = -1;
    node.unit_count = 0;
    node.leaf = true;
    return idx;
}

void QuadtreeNodePool::deallocate(int32_t idx) {
    if (idx < 0) return;
    free_list_.push_back(idx);
}

QuadtreeNode& QuadtreeNodePool::get(int32_t idx) {
    return pool_[idx];
}

const QuadtreeNode& QuadtreeNodePool::get(int32_t idx) const {
    return pool_[idx];
}

void QuadtreeNodePool::reset() {
    free_list_.clear();
    for (size_t i = capacity_; i > 0; --i) {
        free_list_.push_back(static_cast<int32_t>(i - 1));
    }
}

Quadtree::Quadtree(float world_size) : pool_(QT_NODE_POOL_SIZE), world_size_(world_size) {
    AABB root_bounds;
    root_bounds.center = {world_size * 0.5f, world_size * 0.5f};
    root_bounds.half_w = world_size * 0.5f;
    root_bounds.half_h = world_size * 0.5f;
    root_ = pool_.allocate(root_bounds, 0, -1);
}

void Quadtree::insert(Unit* unit) {
    if (!unit) return;
    auto it = unit_node_map_.find(unit->id);
    if (it != unit_node_map_.end()) {
        remove_from_node(it->second, unit);
    }
    insert_to_node(root_, unit);
    int32_t node_idx = root_;
    const QuadtreeNode* node = &pool_.get(root_);
    while (!node->leaf) {
        int32_t child = get_child_index(node_idx, unit->position);
        node_idx = child;
        node = &pool_.get(child);
    }
    unit_node_map_[unit->id] = node_idx;
}

void Quadtree::remove(Unit* unit) {
    if (!unit) return;
    auto it = unit_node_map_.find(unit->id);
    if (it == unit_node_map_.end()) return;
    remove_from_node(it->second, unit);
    unit_node_map_.erase(it);
}

void Quadtree::update(Unit* unit) {
    if (!unit) return;
    auto it = unit_node_map_.find(unit->id);
    if (it == unit_node_map_.end()) {
        insert(unit);
        return;
    }
    int32_t node_idx = it->second;
    const QuadtreeNode& node = pool_.get(node_idx);
    if (node.bounds.contains(unit->position)) {
        return;
    }
    remove_from_node(node_idx, unit);
    unit_node_map_.erase(it);
    insert(unit);
}

void Quadtree::query_circle(const Vec2& center, float radius, std::vector<Unit*>& out) const {
    query_circle_node(root_, center, radius, out);
}

void Quadtree::query_rect(const Vec2& center, float hw, float hh, std::vector<Unit*>& out) const {
    query_rect_node(root_, center, hw, hh, out);
}

void Quadtree::query_sector(const Vec2& center, float radius, float heading, float angle, std::vector<Unit*>& out) const {
    query_sector_node(root_, center, radius, heading, angle * 0.5f, out);
}

void Quadtree::batch_query_circle(const std::vector<std::pair<Vec2, float>>& queries,
                                   std::vector<std::vector<Unit*>>& outs) const {
    outs.resize(queries.size());
    for (size_t i = 0; i < queries.size(); ++i) {
        query_circle(queries[i].first, queries[i].second, outs[i]);
    }
}

void Quadtree::clear() {
    pool_.reset();
    unit_node_map_.clear();
    AABB root_bounds;
    root_bounds.center = {world_size_ * 0.5f, world_size_ * 0.5f};
    root_bounds.half_w = world_size_ * 0.5f;
    root_bounds.half_h = world_size_ * 0.5f;
    root_ = pool_.allocate(root_bounds, 0, -1);
}

void Quadtree::rebuild(const std::vector<Unit*>& units) {
    clear();
    for (Unit* u : units) {
        insert(u);
    }
}

bool Quadtree::should_subdivide(int32_t node_idx) const {
    const QuadtreeNode& node = pool_.get(node_idx);
    if (node.depth >= QT_MAX_DEPTH) return false;
    float child_size = node.bounds.half_w;
    if (child_size < QT_MIN_CHILD_SIZE) return false;
    int32_t boundary_units = 0;
    for (int32_t i = 0; i < node.unit_count; ++i) {
        Unit* u = node.units[i];
        float dx = std::abs(u->position.x - node.bounds.center.x);
        float dy = std::abs(u->position.y - node.bounds.center.y);
        if (dx < u->radius || dy < u->radius) {
            boundary_units++;
        }
    }
    float efficiency = 1.0f - static_cast<float>(boundary_units) / static_cast<float>(node.unit_count);
    return efficiency >= QT_SPLIT_EFFICIENCY_THRESHOLD;
}

void Quadtree::insert_to_node(int32_t node_idx, Unit* unit) {
    QuadtreeNode& node = pool_.get(node_idx);
    if (node.leaf) {
        if (node.unit_count < QT_MAX_UNITS_PER_NODE || node.depth >= QT_MAX_DEPTH) {
            node.units[node.unit_count++] = unit;
            return;
        }
        if (!should_subdivide(node_idx)) {
            node.units[node.unit_count++] = unit;
            return;
        }
        subdivide(node_idx);
    }
    int32_t child = get_child_index(node_idx, unit->position);
    insert_to_node(child, unit);
}

void Quadtree::remove_from_node(int32_t node_idx, Unit* unit) {
    QuadtreeNode& node = pool_.get(node_idx);
    for (int32_t i = 0; i < node.unit_count; ++i) {
        if (node.units[i] == unit) {
            node.units[i] = node.units[node.unit_count - 1];
            node.units[node.unit_count - 1] = nullptr;
            --node.unit_count;
            if (node.parent >= 0) {
                merge_if_needed(node.parent);
            }
            return;
        }
    }
}

int32_t Quadtree::count_units_in_subtree(int32_t node_idx) const {
    if (node_idx < 0) return 0;
    const QuadtreeNode& node = pool_.get(node_idx);
    int32_t count = node.unit_count;
    if (!node.leaf) {
        for (int i = 0; i < 4; ++i) {
            count += count_units_in_subtree(node.children[i]);
        }
    }
    return count;
}

void Quadtree::merge_if_needed(int32_t node_idx) {
    if (node_idx < 0) return;
    QuadtreeNode& node = pool_.get(node_idx);
    if (node.leaf) return;

    int32_t total_units = count_units_in_subtree(node_idx);
    if (total_units <= QT_MERGE_THRESHOLD) {
        for (int i = 0; i < 4; ++i) {
            if (node.children[i] >= 0) {
                QuadtreeNode& child = pool_.get(node.children[i]);
                for (int32_t j = 0; j < child.unit_count; ++j) {
                    if (node.unit_count < QT_MAX_UNITS_PER_NODE) {
                        Unit* u = child.units[j];
                        node.units[node.unit_count++] = u;
                        unit_node_map_[u->id] = node_idx;
                    }
                }
                child.unit_count = 0;
                pool_.deallocate(node.children[i]);
                node.children[i] = -1;
            }
        }
        node.leaf = true;
        if (node.parent >= 0) {
            merge_if_needed(node.parent);
        }
    }
}

void Quadtree::subdivide(int32_t node_idx) {
    QuadtreeNode& node = pool_.get(node_idx);
    float qw = node.bounds.half_w * 0.5f;
    float qh = node.bounds.half_h * 0.5f;
    float cx = node.bounds.center.x;
    float cy = node.bounds.center.y;

    AABB child_bounds[4] = {
        {{cx - qw, cy - qh}, qw, qh},
        {{cx + qw, cy - qh}, qw, qh},
        {{cx - qw, cy + qh}, qw, qh},
        {{cx + qw, cy + qh}, qw, qh}
    };

    for (int i = 0; i < 4; ++i) {
        node.children[i] = pool_.allocate(child_bounds[i], node.depth + 1, node_idx);
    }
    node.leaf = false;

    for (int32_t i = 0; i < node.unit_count; ++i) {
        Unit* u = node.units[i];
        int32_t child = get_child_index(node_idx, u->position);
        QuadtreeNode& child_node = pool_.get(child);
        child_node.units[child_node.unit_count++] = u;
        unit_node_map_[u->id] = child;
    }
    node.unit_count = 0;
}

int32_t Quadtree::get_child_index(int32_t node_idx, const Vec2& pos) const {
    const QuadtreeNode& node = pool_.get(node_idx);
    int idx = 0;
    if (pos.x >= node.bounds.center.x) idx |= 1;
    if (pos.y >= node.bounds.center.y) idx |= 2;
    return node.children[idx];
}

bool Quadtree::is_node_fully_inside_circle(int32_t node_idx, const Vec2& center, float radius) const {
    const QuadtreeNode& node = pool_.get(node_idx);
    Vec2 corners[4] = {
        {node.bounds.center.x - node.bounds.half_w, node.bounds.center.y - node.bounds.half_h},
        {node.bounds.center.x + node.bounds.half_w, node.bounds.center.y - node.bounds.half_h},
        {node.bounds.center.x - node.bounds.half_w, node.bounds.center.y + node.bounds.half_h},
        {node.bounds.center.x + node.bounds.half_w, node.bounds.center.y + node.bounds.half_h}
    };
    float r_sq = radius * radius;
    for (auto& c : corners) {
        Vec2 diff = c - center;
        if (diff.length_sq() > r_sq) return false;
    }
    return true;
}

void Quadtree::collect_all_units(int32_t node_idx, std::vector<Unit*>& out) const {
    if (node_idx < 0) return;
    const QuadtreeNode& node = pool_.get(node_idx);
    for (int32_t i = 0; i < node.unit_count; ++i) {
        out.push_back(node.units[i]);
    }
    if (!node.leaf) {
        for (int i = 0; i < 4; ++i) {
            collect_all_units(node.children[i], out);
        }
    }
}

void Quadtree::query_circle_node(int32_t node_idx, const Vec2& center, float radius, std::vector<Unit*>& out) const {
    if (node_idx < 0) return;
    const QuadtreeNode& node = pool_.get(node_idx);
    if (!node.bounds.intersects_circle(center, radius)) return;

    if (is_node_fully_inside_circle(node_idx, center, radius)) {
        collect_all_units(node_idx, out);
        return;
    }

    for (int32_t i = 0; i < node.unit_count; ++i) {
        Vec2 diff = node.units[i]->position - center;
        float dist_sq = diff.length_sq();
        if (dist_sq <= (radius + node.units[i]->radius) * (radius + node.units[i]->radius)) {
            out.push_back(node.units[i]);
        }
    }

    if (!node.leaf) {
        for (int i = 0; i < 4; ++i) {
            query_circle_node(node.children[i], center, radius, out);
        }
    }
}

bool Quadtree::is_node_fully_inside_rect(int32_t node_idx, const Vec2& center, float hw, float hh) const {
    const QuadtreeNode& node = pool_.get(node_idx);
    return (node.bounds.center.x - node.bounds.half_w >= center.x - hw) &&
           (node.bounds.center.x + node.bounds.half_w <= center.x + hw) &&
           (node.bounds.center.y - node.bounds.half_h >= center.y - hh) &&
           (node.bounds.center.y + node.bounds.half_h <= center.y + hh);
}

void Quadtree::query_rect_node(int32_t node_idx, const Vec2& center, float hw, float hh, std::vector<Unit*>& out) const {
    if (node_idx < 0) return;
    const QuadtreeNode& node = pool_.get(node_idx);
    if (!node.bounds.intersects_rect(center, hw, hh)) return;

    if (is_node_fully_inside_rect(node_idx, center, hw, hh)) {
        collect_all_units(node_idx, out);
        return;
    }

    for (int32_t i = 0; i < node.unit_count; ++i) {
        Unit* u = node.units[i];
        float dx = std::abs(u->position.x - center.x);
        float dy = std::abs(u->position.y - center.y);
        if (dx <= hw + u->radius && dy <= hh + u->radius) {
            out.push_back(u);
        }
    }

    if (!node.leaf) {
        for (int i = 0; i < 4; ++i) {
            query_rect_node(node.children[i], center, hw, hh, out);
        }
    }
}

void Quadtree::query_sector_node(int32_t node_idx, const Vec2& center, float radius,
                                  float heading, float half_angle, std::vector<Unit*>& out) const {
    if (node_idx < 0) return;
    const QuadtreeNode& node = pool_.get(node_idx);
    if (!node.bounds.intersects_circle(center, radius)) return;

    for (int32_t i = 0; i < node.unit_count; ++i) {
        Unit* u = node.units[i];
        Vec2 diff = u->position - center;
        float dist_sq = diff.length_sq();
        float eff_r = radius + u->radius;
        if (dist_sq > eff_r * eff_r) continue;
        float dist = std::sqrt(dist_sq);
        if (dist < 1e-6f) {
            out.push_back(u);
            continue;
        }
        float angle_to_unit = std::atan2(diff.y, diff.x);
        float diff_angle = angle_to_unit - heading;
        while (diff_angle > PI) diff_angle -= 2.0f * PI;
        while (diff_angle < -PI) diff_angle += 2.0f * PI;
        if (std::abs(diff_angle) <= half_angle + std::asin(u->radius / std::max(dist, u->radius))) {
            out.push_back(u);
        }
    }

    if (!node.leaf) {
        for (int i = 0; i < 4; ++i) {
            query_sector_node(node.children[i], center, radius, heading, half_angle, out);
        }
    }
}
