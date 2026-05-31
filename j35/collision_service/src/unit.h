#pragma once

#include <cstdint>

struct Vec2 {
    float x = 0.0f;
    float y = 0.0f;

    Vec2() = default;
    Vec2(float x_, float y_) : x(x_), y(y_) {}

    Vec2 operator-(const Vec2& o) const { return {x - o.x, y - o.y}; }
    Vec2 operator+(const Vec2& o) const { return {x + o.x, y + o.y}; }
    Vec2 operator*(float s) const { return {x * s, y * s}; }

    float dot(const Vec2& o) const { return x * o.x + y * o.y; }
    float length_sq() const { return x * x + y * y; }
    float length() const;
    Vec2 normalized() const;
};

struct Unit {
    uint64_t id = 0;
    Vec2 position;
    float heading = 0.0f;
    float radius = 0.5f;
    int32_t faction = 0;
};
