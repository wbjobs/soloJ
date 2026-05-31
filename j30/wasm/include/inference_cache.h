#pragma once

#include <string>
#include <unordered_map>
#include <mutex>
#include <chrono>
#include <vector>
#include <memory>
#include <functional>
#include <cstdint>

namespace smart_gateway {

struct CacheKey {
    std::string model_name;
    std::string input_hash;
    
    bool operator==(const CacheKey& other) const {
        return model_name == other.model_name && input_hash == other.input_hash;
    }
};

struct CacheKeyHash {
    size_t operator()(const CacheKey& key) const {
        size_t h1 = std::hash<std::string>{}(key.model_name);
        size_t h2 = std::hash<std::string>{}(key.input_hash);
        return h1 ^ (h2 << 1);
    }
};

struct CacheEntry {
    std::vector<std::pair<std::string, float>> predictions;
    std::chrono::steady_clock::time_point created_at;
    int ttl_seconds;
    uint64_t hit_count;
    size_t size_bytes;
};

class InferenceCache {
public:
    static InferenceCache& Instance();
    
    void SetMaxSizeBytes(size_t max_bytes);
    void SetDefaultTTL(int ttl_seconds);
    
    bool Get(const std::string& model_name, 
             const std::vector<uint8_t>& input_data,
             std::vector<std::pair<std::string, float>>& output);
    
    bool Get(const std::string& model_name,
             const std::string& input_hash,
             std::vector<std::pair<std::string, float>>& output);
    
    void Put(const std::string& model_name,
             const std::vector<uint8_t>& input_data,
             const std::vector<std::pair<std::string, float>>& predictions,
             int ttl_seconds = 0);
    
    void Put(const std::string& model_name,
             const std::string& input_hash,
             const std::vector<std::pair<std::string, float>>& predictions,
             int ttl_seconds = 0);
    
    void Invalidate(const std::string& model_name);
    void InvalidateAll();
    
    struct Stats {
        uint64_t total_hits;
        uint64_t total_misses;
        uint64_t total_entries;
        size_t current_size_bytes;
        size_t max_size_bytes;
        double hit_rate;
    };
    
    Stats GetStats() const;
    Stats GetStatsForModel(const std::string& model_name) const;
    
    void CleanupExpired();
    
private:
    InferenceCache() = default;
    ~InferenceCache() = default;
    
    std::string ComputeHash(const std::vector<uint8_t>& data) const;
    void EvictIfNeeded();
    
    std::unordered_map<CacheKey, std::unique_ptr<CacheEntry>, CacheKeyHash> cache_;
    mutable std::mutex mutex_;
    
    size_t max_size_bytes_ = 100 * 1024 * 1024;
    size_t current_size_bytes_ = 0;
    int default_ttl_seconds_ = 300;
    
    uint64_t total_hits_ = 0;
    uint64_t total_misses_ = 0;
    std::unordered_map<std::string, uint64_t> model_hits_;
    std::unordered_map<std::string, uint64_t> model_misses_;
};

}
