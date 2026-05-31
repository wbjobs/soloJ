#include "inference_cache.h"

#include <cstring>
#include <algorithm>

namespace smart_gateway {

InferenceCache& InferenceCache::Instance() {
    static InferenceCache instance;
    return instance;
}

void InferenceCache::SetMaxSizeBytes(size_t max_bytes) {
    std::lock_guard<std::mutex> lock(mutex_);
    max_size_bytes_ = max_bytes;
    EvictIfNeeded();
}

void InferenceCache::SetDefaultTTL(int ttl_seconds) {
    std::lock_guard<std::mutex> lock(mutex_);
    default_ttl_seconds_ = ttl_seconds;
}

std::string InferenceCache::ComputeHash(const std::vector<uint8_t>& data) const {
    uint64_t hash = 14695981039346656037ULL;
    for (uint8_t byte : data) {
        hash ^= byte;
        hash *= 1099511628211ULL;
    }
    return std::to_string(hash);
}

bool InferenceCache::Get(const std::string& model_name,
                          const std::vector<uint8_t>& input_data,
                          std::vector<std::pair<std::string, float>>& output) {
    std::string hash = ComputeHash(input_data);
    return Get(model_name, hash, output);
}

bool InferenceCache::Get(const std::string& model_name,
                          const std::string& input_hash,
                          std::vector<std::pair<std::string, float>>& output) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    CacheKey key{model_name, input_hash};
    auto it = cache_.find(key);
    
    if (it == cache_.end()) {
        total_misses_++;
        model_misses_[model_name]++;
        return false;
    }
    
    auto now = std::chrono::steady_clock::now();
    auto age = std::chrono::duration_cast<std::chrono::seconds>(
        now - it->second->created_at).count();
    
    if (age > it->second->ttl_seconds) {
        current_size_bytes_ -= it->second->size_bytes;
        cache_.erase(it);
        total_misses_++;
        model_misses_[model_name]++;
        return false;
    }
    
    output = it->second->predictions;
    it->second->hit_count++;
    total_hits_++;
    model_hits_[model_name]++;
    
    return true;
}

void InferenceCache::Put(const std::string& model_name,
                          const std::vector<uint8_t>& input_data,
                          const std::vector<std::pair<std::string, float>>& predictions,
                          int ttl_seconds) {
    std::string hash = ComputeHash(input_data);
    Put(model_name, hash, predictions, ttl_seconds);
}

void InferenceCache::Put(const std::string& model_name,
                          const std::string& input_hash,
                          const std::vector<std::pair<std::string, float>>& predictions,
                          int ttl_seconds) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    CacheKey key{model_name, input_hash};
    
    auto existing = cache_.find(key);
    if (existing != cache_.end()) {
        current_size_bytes_ -= existing->second->size_bytes;
        cache_.erase(existing);
    }
    
    size_t entry_size = sizeof(CacheEntry);
    entry_size += model_name.capacity() + input_hash.capacity();
    for (const auto& pair : predictions) {
        entry_size += pair.first.capacity() + sizeof(float);
    }
    
    if (ttl_seconds <= 0) {
        ttl_seconds = default_ttl_seconds_;
    }
    
    auto entry = std::make_unique<CacheEntry>();
    entry->predictions = predictions;
    entry->created_at = std::chrono::steady_clock::now();
    entry->ttl_seconds = ttl_seconds;
    entry->hit_count = 0;
    entry->size_bytes = entry_size;
    
    current_size_bytes_ += entry_size;
    
    EvictIfNeeded();
    
    cache_[key] = std::move(entry);
}

void InferenceCache::EvictIfNeeded() {
    if (current_size_bytes_ <= max_size_bytes_) {
        return;
    }
    
    std::vector<std::pair<CacheKey, CacheEntry*>> entries;
    for (const auto& pair : cache_) {
        entries.emplace_back(pair.first, pair.second.get());
    }
    
    std::sort(entries.begin(), entries.end(),
              [](const auto& a, const auto& b) {
                  return a.second->hit_count < b.second->hit_count;
              });
    
    for (const auto& entry : entries) {
        if (current_size_bytes_ <= max_size_bytes_ * 0.8) {
            break;
        }
        
        auto it = cache_.find(entry.first);
        if (it != cache_.end()) {
            current_size_bytes_ -= it->second->size_bytes;
            cache_.erase(it);
        }
    }
}

void InferenceCache::Invalidate(const std::string& model_name) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    for (auto it = cache_.begin(); it != cache_.end(); ) {
        if (it->first.model_name == model_name) {
            current_size_bytes_ -= it->second->size_bytes;
            it = cache_.erase(it);
        } else {
            ++it;
        }
    }
}

void InferenceCache::InvalidateAll() {
    std::lock_guard<std::mutex> lock(mutex_);
    cache_.clear();
    current_size_bytes_ = 0;
    total_hits_ = 0;
    total_misses_ = 0;
    model_hits_.clear();
    model_misses_.clear();
}

void InferenceCache::CleanupExpired() {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto now = std::chrono::steady_clock::now();
    
    for (auto it = cache_.begin(); it != cache_.end(); ) {
        auto age = std::chrono::duration_cast<std::chrono::seconds>(
            now - it->second->created_at).count();
        
        if (age > it->second->ttl_seconds) {
            current_size_bytes_ -= it->second->size_bytes;
            it = cache_.erase(it);
        } else {
            ++it;
        }
    }
}

InferenceCache::Stats InferenceCache::GetStats() const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    Stats stats;
    stats.total_hits = total_hits_;
    stats.total_misses = total_misses_;
    stats.total_entries = cache_.size();
    stats.current_size_bytes = current_size_bytes_;
    stats.max_size_bytes = max_size_bytes_;
    stats.hit_rate = (total_hits_ + total_misses_ > 0) 
        ? static_cast<double>(total_hits_) / (total_hits_ + total_misses_) 
        : 0.0;
    
    return stats;
}

InferenceCache::Stats InferenceCache::GetStatsForModel(const std::string& model_name) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    Stats stats;
    
    uint64_t hits = 0;
    uint64_t misses = 0;
    size_t entries = 0;
    size_t size_bytes = 0;
    
    auto hits_it = model_hits_.find(model_name);
    if (hits_it != model_hits_.end()) {
        hits = hits_it->second;
    }
    
    auto misses_it = model_misses_.find(model_name);
    if (misses_it != model_misses_.end()) {
        misses = misses_it->second;
    }
    
    for (const auto& pair : cache_) {
        if (pair.first.model_name == model_name) {
            entries++;
            size_bytes += pair.second->size_bytes;
        }
    }
    
    stats.total_hits = hits;
    stats.total_misses = misses;
    stats.total_entries = entries;
    stats.current_size_bytes = size_bytes;
    stats.max_size_bytes = max_size_bytes_;
    stats.hit_rate = (hits + misses > 0) 
        ? static_cast<double>(hits) / (hits + misses) 
        : 0.0;
    
    return stats;
}

}
