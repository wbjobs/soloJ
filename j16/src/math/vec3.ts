import type { Vec3 } from '../types/index';

export const vec3 = {
  create(x: number = 0, y: number = 0, z: number = 0): Vec3 {
    return { x, y, z };
  },

  add(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  },

  sub(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  },

  scale(a: Vec3, s: number): Vec3 {
    return { x: a.x * s, y: a.y * s, z: a.z * s };
  },

  dot(a: Vec3, b: Vec3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  },

  cross(a: Vec3, b: Vec3): Vec3 {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  },

  length(a: Vec3): number {
    return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
  },

  lengthSquared(a: Vec3): number {
    return a.x * a.x + a.y * a.y + a.z * a.z;
  },

  normalize(a: Vec3): Vec3 {
    const len = vec3.length(a);
    if (len < 1e-10) return { x: 0, y: 0, z: 0 };
    return { x: a.x / len, y: a.y / len, z: a.z / len };
  },

  lerp(a: Vec3, b: Vec3, t: number): Vec3 {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t
    };
  },

  toArray(a: Vec3): [number, number, number] {
    return [a.x, a.y, a.z];
  }
};