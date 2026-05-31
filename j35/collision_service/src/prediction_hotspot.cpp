#include "prediction_hotspot.h"
#include <algorithm>

PredictionHotspot::PredictionHotspot(size_t max_hotspots)
    : max_hotspots_(max_hotspots)
{
    hotspots_.reserve(max_hotspots);
}

bool PredictionHotspot::overlaps(const AABB& a, const AABB& b) const {
    float dx = std::abs(a.center.x - b.center.x);
    float dy = std::abs(a.center.y - b.center.y);
    return dx < (a.half_w + b.half_w) && dy < (a.half_h + b.half_h);
}

void PredictionHotspot::merge_into(HotspotRegion& target, const HotspotRegion& source) {
    float left = std::min(target.region.center.x - target.region.half_w,
                          source.region.center.x - source.region.half_w);
    float right = std::max(target.region.center.x + target.region.half_w,
                           source.region.center.x + source.region.half_w);
    float bottom = std::min(target.region.center.y - target.region.half_h,
                            source.region.center.y - source.region.half_h);
    float top = std::max(target.region.center.y + target.region.half_h,
                         source.region.center.y + source.region.half_h);

    target.region.center.x = (left + right) * 0.5f;
    target.region.center.y = (bottom + top) * 0.5f;
    target.region.half_w = (right - left) * 0.5f;
    target.region.half_h = (top - bottom) * 0.5f;
    target.intensity = std::max(target.intensity, source.intensity);
    target.frame_number = std::max(target.frame_number, source.frame_number);
}

void PredictionHotspot::add_hotspot(const AABB& region, float intensity, uint64_t frame_number) {
    std::lock_guard<std::mutex> lock(mutex_);

    HotspotRegion new_hs;
    new_hs.region = region;
    new_hs.intensity = intensity;
    new_hs.frame_number = frame_number;

    for (auto& hs : hotspots_) {
        if (hs.frame_number != frame_number) continue;
        if (overlaps(hs.region, new_hs.region)) {
            merge_into(hs, new_hs);
            return;
        }
    }

    if (hotspots_.size() < max_hotspots_) {
        hotspots_.push_back(new_hs);
    } else {
        auto min_it = std::min_element(hotspots_.begin(), hotspots_.end(),
            [](const HotspotRegion& a, const HotspotRegion& b) {
                return a.intensity < b.intensity;
            });
        if (new_hs.intensity > min_it->intensity) {
            *min_it = new_hs;
        }
    }
}

std::vector<HotspotRegion> PredictionHotspot::get_hotspots_in_area(const AABB& area) const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<HotspotRegion> result;
    result.reserve(hotspots_.size());

    for (const auto& hs : hotspots_) {
        if (overlaps(hs.region, area)) {
            result.push_back(hs);
        }
    }
    return result;
}

void PredictionHotspot::clear_expired(uint64_t current_frame) {
    std::lock_guard<std::mutex> lock(mutex_);
    hotspots_.erase(
        std::remove_if(hotspots_.begin(), hotspots_.end(),
            [current_frame](const HotspotRegion& hs) {
                return current_frame > hs.frame_number + 1;
            }),
        hotspots_.end());
}

const std::vector<HotspotRegion>& PredictionHotspot::hotspots() const {
    return hotspots_;
}

size_t PredictionHotspot::hotspot_count() const {
    return hotspots_.size();
}
