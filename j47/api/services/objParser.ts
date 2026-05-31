export interface ParseResult {
  pointCount: number;
  positions: number[];
  colors: number[] | null;
  normals: number[] | null;
  boundingBox: { min: [number, number, number]; max: [number, number, number] };
}

export function parseOBJ(buffer: Buffer): ParseResult {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/);

  const positions: number[] = [];
  const colors: number[] = [];
  let hasColor = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('v ')) continue;

    const parts = trimmed.split(/\s+/);
    const x = parseFloat(parts[1]);
    const y = parseFloat(parts[2]);
    const z = parseFloat(parts[3]);

    if (isNaN(x) || isNaN(y) || isNaN(z)) continue;

    positions.push(x, y, z);

    if (parts.length >= 7) {
      const r = parseFloat(parts[4]);
      const g = parseFloat(parts[5]);
      const b = parseFloat(parts[6]);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        hasColor = true;
        colors.push(r, g, b);
      }
    }
  }

  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < positions.length; i += 3) {
    min[0] = Math.min(min[0], positions[i]);
    min[1] = Math.min(min[1], positions[i + 1]);
    min[2] = Math.min(min[2], positions[i + 2]);
    max[0] = Math.max(max[0], positions[i]);
    max[1] = Math.max(max[1], positions[i + 1]);
    max[2] = Math.max(max[2], positions[i + 2]);
  }

  return {
    pointCount: positions.length / 3,
    positions,
    colors: hasColor ? colors : null,
    normals: null,
    boundingBox: { min, max },
  };
}
