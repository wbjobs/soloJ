class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  add(v) {
    return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  sub(v) {
    return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  mul(t) {
    if (t instanceof Vec3) {
      return new Vec3(this.x * t.x, this.y * t.y, this.z * t.z);
    }
    return new Vec3(this.x * t, this.y * t, this.z * t);
  }

  div(t) {
    return new Vec3(this.x / t, this.y / t, this.z / t);
  }

  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v) {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  length() {
    return Math.sqrt(this.dot(this));
  }

  normalize() {
    const len = this.length();
    if (len === 0) return new Vec3(0, 0, 0);
    return this.div(len);
  }

  negate() {
    return new Vec3(-this.x, -this.y, -this.z);
  }

  clone() {
    return new Vec3(this.x, this.y, this.z);
  }

  toArray() {
    return [this.x, this.y, this.z];
  }

  static fromObject(obj) {
    return new Vec3(obj.x, obj.y, obj.z);
  }
}

function mulberry32(seed) {
  return function() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashSeed(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

function randomInUnitSphere(rng = Math.random) {
  while (true) {
    const p = new Vec3(
      rng() * 2 - 1,
      rng() * 2 - 1,
      rng() * 2 - 1
    );
    if (p.dot(p) < 1) return p;
  }
}

function randomInHemisphere(normal, rng = Math.random) {
  const inUnitSphere = randomInUnitSphere(rng);
  if (inUnitSphere.dot(normal) > 0) return inUnitSphere;
  return inUnitSphere.negate();
}

function reflect(v, n) {
  return v.sub(n.mul(2 * v.dot(n)));
}

module.exports = { Vec3, mulberry32, hashSeed, randomInUnitSphere, randomInHemisphere, reflect };
