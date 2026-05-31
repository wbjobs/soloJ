export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    case 5: return [v, p, q];
    default: return [v, v, v];
  }
}

export function densityToColor(density: number, restDensity: number): [number, number, number] {
  const ratio = Math.min(density / (restDensity * 2), 1.0);
  return hsvToRgb(0.66 - ratio * 0.66, 0.7, 0.9);
}

export function velocityToColor(velocity: [number, number, number], maxSpeed: number): [number, number, number] {
  const speed = Math.sqrt(velocity[0] ** 2 + velocity[1] ** 2 + velocity[2] ** 2);
  const ratio = Math.min(speed / maxSpeed, 1.0);
  return hsvToRgb(0.66 - ratio * 0.66, 0.8, 0.9);
}

export function lerpColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}