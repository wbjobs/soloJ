import { TileType } from '../../shared/types';

export const DEFAULT_VIEW_RADIUS = 2;

export function getVisiblePositions(
  playerX: number,
  playerY: number,
  viewRadius: number = DEFAULT_VIEW_RADIUS,
): Set<string> {
  const visible = new Set<string>();

  for (let dy = -viewRadius; dy <= viewRadius; dy++) {
    for (let dx = -viewRadius; dx <= viewRadius; dx++) {
      const x = playerX + dx;
      const y = playerY + dy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= viewRadius + 0.5) {
        visible.add(`${x},${y}`);
      }
    }
  }

  return visible;
}

export function getVisibleTiles(
  map: number[][],
  playerX: number,
  playerY: number,
  viewRadius: number = DEFAULT_VIEW_RADIUS,
): { x: number; y: number; type: number }[] {
  const visibleTiles: { x: number; y: number; type: number }[] = [];
  const height = map.length;
  const width = map[0].length;

  for (let dy = -viewRadius; dy <= viewRadius; dy++) {
    for (let dx = -viewRadius; dx <= viewRadius; dx++) {
      const x = playerX + dx;
      const y = playerY + dy;

      if (x < 0 || x >= width || y < 0 || y >= height) {
        continue;
      }

      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= viewRadius + 0.5) {
        if (hasLineOfSight(map, playerX, playerY, x, y)) {
          visibleTiles.push({ x, y, type: map[y][x] });
        }
      }
    }
  }

  return visibleTiles;
}

function hasLineOfSight(map: number[][], x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;

  while (x !== x1 || y !== y1) {
    if (map[y][x] === TileType.WALL) {
      return x === x1 && y === y1;
    }

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return true;
}
