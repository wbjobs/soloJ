import type { Vector2, Vector3, Vector4, ColorMapPoint } from '../types';

export const vec2 = (x: number = 0, y: number = x): Vector2 => ({ x, y });

export const vec3 = (x: number = 0, y: number = x, z: number = x): Vector3 => ({ x, y, z });

export const vec4 = (x: number = 0, y: number = x, z: number = x, w: number = 1): Vector4 => ({ x, y, z, w });

export const vec2Add = (a: Vector2, b: Vector2): Vector2 => ({
  x: a.x + b.x,
  y: a.y + b.y,
});

export const vec2Sub = (a: Vector2, b: Vector2): Vector2 => ({
  x: a.x - b.x,
  y: a.y - b.y,
});

export const vec2Mul = (v: Vector2, s: number): Vector2 => ({
  x: v.x * s,
  y: v.y * s,
});

export const vec2MulVec = (a: Vector2, b: Vector2): Vector2 => ({
  x: a.x * b.x,
  y: a.y * b.y,
});

export const vec2Div = (v: Vector2, s: number): Vector2 => ({
  x: v.x / s,
  y: v.y / s,
});

export const vec2Dot = (a: Vector2, b: Vector2): number => a.x * b.x + a.y * b.y;

export const vec2Length = (v: Vector2): number => Math.sqrt(vec2Dot(v, v));

export const vec2Normalize = (v: Vector2): Vector2 => {
  const len = vec2Length(v);
  return len > 1e-8 ? vec2Div(v, len) : vec2(0);
};

export const vec2Distance = (a: Vector2, b: Vector2): number => vec2Length(vec2Sub(a, b));

export const vec2Lerp = (a: Vector2, b: Vector2, t: number): Vector2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export const vec2Clamp = (v: Vector2, min: Vector2, max: Vector2): Vector2 => ({
  x: Math.max(min.x, Math.min(max.x, v.x)),
  y: Math.max(min.y, Math.min(max.y, v.y)),
});

export const vec3Add = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

export const vec3Sub = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

export const vec3Mul = (v: Vector3, s: number): Vector3 => ({
  x: v.x * s,
  y: v.y * s,
  z: v.z * s,
});

export const vec3Dot = (a: Vector3, b: Vector3): number =>
  a.x * b.x + a.y * b.y + a.z * b.z;

export const vec3Cross = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export const vec3Length = (v: Vector3): number => Math.sqrt(vec3Dot(v, v));

export const vec3Normalize = (v: Vector3): Vector3 => {
  const len = vec3Length(v);
  return len > 1e-8 ? vec3Mul(v, 1 / len) : vec3(0);
};

export const vec4Add = (a: Vector4, b: Vector4): Vector4 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
  w: a.w + b.w,
});

export const vec4Sub = (a: Vector4, b: Vector4): Vector4 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
  w: a.w - b.w,
});

export const vec4Mul = (v: Vector4, s: number): Vector4 => ({
  x: v.x * s,
  y: v.y * s,
  z: v.z * s,
  w: v.w * s,
});

export const vec4Lerp = (a: Vector4, b: Vector4, t: number): Vector4 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
  w: a.w + (b.w - a.w) * t,
});

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothStep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const fract = (x: number): number => x - Math.floor(x);

export const hash = (x: number): number =>
  fract(Math.sin(x) * 43758.5453123);

export const hash2 = (p: Vector2): number =>
  fract(Math.sin(p.x * 127.1 + p.y * 311.7) * 43758.5453123);

export const hash3 = (p: Vector3): number =>
  fract(Math.sin(p.x * 127.1 + p.y * 311.7 + p.z * 74.7) * 43758.5453123);

export const noise1D = (x: number): number => {
  const i = Math.floor(x);
  const f = fract(x);
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u);
};

export const noise2D = (p: Vector2): number => {
  const i = { x: Math.floor(p.x), y: Math.floor(p.y) };
  const f = { x: fract(p.x), y: fract(p.y) };

  const a = hash2(i);
  const b = hash2({ x: i.x + 1, y: i.y });
  const c = hash2({ x: i.x, y: i.y + 1 });
  const d = hash2({ x: i.x + 1, y: i.y + 1 });

  const u = {
    x: f.x * f.x * (3 - 2 * f.x),
    y: f.y * f.y * (3 - 2 * f.y),
  };

  return lerp(lerp(a, b, u.x), lerp(c, d, u.x), u.y);
};

export const fbm2D = (
  p: Vector2,
  octaves: number = 4,
  lacunarity: number = 2,
  gain: number = 0.5
): number => {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise2D({ x: p.x * frequency, y: p.y * frequency }) * amplitude;
    maxValue += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return value / maxValue;
};

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;

export const radToDeg = (rad: number): number => (rad * 180) / Math.PI;

export const randomRange = (min: number, max: number): number =>
  min + Math.random() * (max - min);

export const randomVec2 = (min: number, max: number): Vector2 => ({
  x: randomRange(min, max),
  y: randomRange(min, max),
});

export const hsvToRgb = (h: number, s: number, v: number): Vector3 => {
  const c = v * s;
  const hPrime = (h % 1) * 6;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  const m = v - c;

  let r = 0,
    g = 0,
    b = 0;

  if (hPrime < 1) {
    r = c;
    g = x;
  } else if (hPrime < 2) {
    r = x;
    g = c;
  } else if (hPrime < 3) {
    g = c;
    b = x;
  } else if (hPrime < 4) {
    g = x;
    b = c;
  } else if (hPrime < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return vec3(r + m, g + m, b + m);
};

export const rgbToHsv = (r: number, g: number, b: number): Vector3 => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    if (max === r) {
      h = ((g - b) / d) % 6;
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else {
      h = (r - g) / d + 4;
    }
    h /= 6;
  }

  return vec3(h, s, v);
};

export const applyColorMap = (
  t: number,
  colorMap: ColorMapPoint[]
): Vector4 => {
  const clampedT = clamp(t, 0, 1);

  if (clampedT <= colorMap[0].position) {
    return colorMap[0].color;
  }

  for (let i = 0; i < colorMap.length - 1; i++) {
    if (
      clampedT >= colorMap[i].position &&
      clampedT <= colorMap[i + 1].position
    ) {
      const range = colorMap[i + 1].position - colorMap[i].position;
      const localT = (clampedT - colorMap[i].position) / range;
      return vec4Lerp(colorMap[i].color, colorMap[i + 1].color, localT);
    }
  }

  return colorMap[colorMap.length - 1].color;
};

export const defaultColorMap: ColorMapPoint[] = [
  { position: 0, color: vec4(0, 0, 0.1, 1) },
  { position: 0.25, color: vec4(0, 0.2, 0.6, 1) },
  { position: 0.5, color: vec4(0, 0.6, 0.8, 1) },
  { position: 0.75, color: vec4(0.2, 0.9, 0.6, 1) },
  { position: 1, color: vec4(1, 1, 1, 1) },
];

export const plasmaColorMap: ColorMapPoint[] = [
  { position: 0, color: vec4(0.05, 0.02, 0.1, 1) },
  { position: 0.16, color: vec4(0.25, 0.01, 0.45, 1) },
  { position: 0.42, color: vec4(0.5, 0.04, 0.5, 1) },
  { position: 0.6425, color: vec4(0.75, 0.2, 0.4, 1) },
  { position: 0.8575, color: vec4(0.95, 0.5, 0.3, 1) },
  { position: 1, color: vec4(1, 0.9, 0.5, 1) },
];

export const viridisColorMap: ColorMapPoint[] = [
  { position: 0, color: vec4(0.267, 0.004, 0.329, 1) },
  { position: 0.19, color: vec4(0.282, 0.140, 0.458, 1) },
  { position: 0.38, color: vec4(0.253, 0.265, 0.529, 1) },
  { position: 0.57, color: vec4(0.206, 0.371, 0.553, 1) },
  { position: 0.76, color: vec4(0.127, 0.466, 0.550, 1) },
  { position: 0.95, color: vec4(0.026, 0.607, 0.457, 1) },
  { position: 1, color: vec4(0.993, 0.906, 0.144, 1) },
];
