#pragma once

#include <cstdint>
#include <vector>
#include <mutex>
#include "quadtree.h"

struct HotspotRegion {
    AABB region{};
    float intensity = 0.0f;
    uint64_t frame_number = 0;
};

class PredictionHotspot {
public:
    explicit PredictionHotspot(size_t max_hotspots = 1024);

    void add_hotspot(const AABB& region, float intensity, uint64_t frame_number);
    std::vector<HotspotRegion> get_hotspots_in_area(const AABB& area) const;
    void clear_expired(uint64_t current_frame);

    const std::vector<HotspotRegion>& hotspots() const;
    size_t hotspot_count() const;

private:
    bool overlaps(const AABB& a, const AABB& b) const;
    void merge_into(HotspotRegion& target, const HotspotRegion& source);

    std::vector<HotspotRegion> hotspots_;
    mutable std::mutex mutex_;
    size_t max_hotspots_;
};
