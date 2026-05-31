#pragma once

#include <vector>
#include <string>
#include <mutex>
#include <memory>
#include <unordered_map>
#include <utility>

namespace smart_gateway {

template <typename T>
class ObjectPool {
public:
    using Ptr = std::unique_ptr<T, std::function<void(T*)>>;
    
    explicit ObjectPool(size_t max_size = 64) : max_size_(max_size) {}
    
    Ptr Acquire() {
        std::lock_guard<std::mutex> lock(mutex_);
        
        T* obj = nullptr;
        if (!pool_.empty()) {
            obj = pool_.back();
            pool_.pop_back();
        } else {
            obj = new T();
        }
        
        return Ptr(obj, [this](T* ptr) {
            std::lock_guard<std::mutex> lock(this->mutex_);
            if (this->pool_.size() < this->max_size_) {
                ptr->clear();
                this->pool_.push_back(ptr);
            } else {
                delete ptr;
            }
        });
    }
    
    size_t Size() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return pool_.size();
    }
    
    void Clear() {
        std::lock_guard<std::mutex> lock(mutex_);
        for (T* ptr : pool_) {
            delete ptr;
        }
        pool_.clear();
    }
    
    ~ObjectPool() {
        Clear();
    }
    
private:
    std::vector<T*> pool_;
    mutable std::mutex mutex_;
    size_t max_size_;
};

class MemoryPool {
public:
    static MemoryPool& Instance() {
        static MemoryPool instance;
        return instance;
    }
    
    ObjectPool<std::vector<uint8_t>>& GetByteBufferPool() { return byte_buffer_pool_; }
    ObjectPool<std::vector<float>>& GetFloatBufferPool() { return float_buffer_pool_; }
    ObjectPool<std::vector<size_t>>& GetIndexBufferPool() { return index_buffer_pool_; }
    ObjectPool<std::string>& GetStringPool() { return string_pool_; }
    
    struct Stats {
        size_t byte_buffer_count;
        size_t float_buffer_count;
        size_t index_buffer_count;
        size_t string_count;
    };
    
    Stats GetStats() const {
        return Stats{
            byte_buffer_pool_.Size(),
            float_buffer_pool_.Size(),
            index_buffer_pool_.Size(),
            string_pool_.Size()
        };
    }
    
    void ClearAll() {
        byte_buffer_pool_.Clear();
        float_buffer_pool_.Clear();
        index_buffer_pool_.Clear();
        string_pool_.Clear();
    }
    
private:
    MemoryPool() 
        : byte_buffer_pool_(128),
          float_buffer_pool_(128),
          index_buffer_pool_(64),
          string_pool_(256) {}
    
    ObjectPool<std::vector<uint8_t>> byte_buffer_pool_;
    ObjectPool<std::vector<float>> float_buffer_pool_;
    ObjectPool<std::vector<size_t>> index_buffer_pool_;
    ObjectPool<std::string> string_pool_;
};

}
