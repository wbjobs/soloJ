import type { Mat4, Vec3 } from '../types/index';

export const mat4 = {
  identity(): Mat4 {
    return {
      m: new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ])
    };
  },

  perspective(fov: number, aspect: number, near: number, far: number): Mat4 {
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    return {
      m: new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0
      ])
    };
  },

  lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
    const f = normalize(sub(target, eye));
    const s = normalize(cross(f, up));
    const u = cross(s, f);
    return {
      m: new Float32Array([
        s.x, u.x, -f.x, 0,
        s.y, u.y, -f.y, 0,
        s.z, u.z, -f.z, 0,
        -dot(s, eye), -dot(u, eye), dot(f, eye), 1
      ])
    };
  },

  multiply(a: Mat4, b: Mat4): Mat4 {
    const result = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a.m[k * 4 + j] * b.m[i * 4 + k];
        }
        result[i * 4 + j] = sum;
      }
    }
    return { m: result };
  },

  translate(m: Mat4, v: Vec3): Mat4 {
    const result = { m: new Float32Array(m.m) };
    result.m[12] = m.m[0] * v.x + m.m[4] * v.y + m.m[8] * v.z + m.m[12];
    result.m[13] = m.m[1] * v.x + m.m[5] * v.y + m.m[9] * v.z + m.m[13];
    result.m[14] = m.m[2] * v.x + m.m[6] * v.y + m.m[10] * v.z + m.m[14];
    result.m[15] = m.m[3] * v.x + m.m[7] * v.y + m.m[11] * v.z + m.m[15];
    return result;
  },

  toFloat32Array(m: Mat4): Float32Array {
    return m.m;
  }
};

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len < 1e-10) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}