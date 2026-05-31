import { Tile, TileType, Chunk } from './types';

function createRNG(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function hash2D(x: number, y: number, seed: number): number {
  let hash = seed;
  hash = (hash * 374761393) ^ Math.floor(x);
  hash = (hash * 668265263) ^ Math.floor(y);
  hash = (hash * 2147483647) >>> 0;
  return hash / 4294967296;
}

function smoothNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const v00 = hash2D(xi, yi, seed);
  const v10 = hash2D(xi + 1, yi, seed);
  const v01 = hash2D(xi, yi + 1, seed);
  const v11 = hash2D(xi + 1, yi + 1, seed);

  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  return v00 * (1 - u) * (1 - v) +
         v10 * u * (1 - v) +
         v01 * (1 - u) * v +
         v11 * u * v;
}

export class MapGenerator {
  private chunkSize: number;
  private seed: number;
  private noiseScale: number;
  private rng: () => number;

  constructor(seed: number = 12345, chunkSize: number = 16) {
    this.seed = seed;
    this.chunkSize = chunkSize;
    this.noiseScale = 0.1;
    this.rng = createRNG(seed);
  }

  getChunkSize(): number {
    return this.chunkSize;
  }

  getSeed(): number {
    return this.seed;
  }

  generateChunk(chunkX: number, chunkY: number): Chunk {
    const chunkRNG = createRNG(this.seed + chunkX * 73856093 + chunkY * 19349663);
    const tiles: Tile[][] = [];
    const entities: { type: string; x: number; y: number; level: number }[] = [];

    for (let localY = 0; localY < this.chunkSize; localY++) {
      tiles[localY] = [];
      for (let localX = 0; localX < this.chunkSize; localX++) {
        const worldX = chunkX * this.chunkSize + localX;
        const worldY = chunkY * this.chunkSize + localY;

        const elevation = this.getElevation(worldX, worldY);
        const moisture = this.getMoisture(worldX, worldY);
        const biomeNoise = chunkRNG();

        let tileType: TileType;
        let passable: boolean;

        if (elevation > 0.75) {
          tileType = TileType.Wall;
          passable = false;
        } else if (elevation > 0.65) {
          tileType = TileType.Stone;
          passable = true;
        } else if (elevation < 0.2) {
          tileType = TileType.Water;
          passable = false;
        } else if (moisture > 0.7 && elevation < 0.5) {
          tileType = TileType.Water;
          passable = false;
        } else if (moisture > 0.5) {
          if (biomeNoise > 0.85) {
            tileType = TileType.Tree;
            passable = false;
          } else {
            tileType = TileType.Grass;
            passable = true;
          }
        } else if (moisture > 0.25) {
          tileType = TileType.Floor;
          passable = true;
        } else {
          tileType = TileType.Sand;
          passable = true;
        }

        if (this.isNearSpawn(worldX, worldY)) {
          tileType = TileType.Floor;
          passable = true;
        }

        tiles[localY][localX] = {
          type: tileType,
          passable,
          variant: Math.floor(chunkRNG() * 4)
        };

        if (tileType === TileType.Floor || tileType === TileType.Grass || tileType === TileType.Sand) {
          if (chunkRNG() < 0.01) {
            const npcLevel = this.calculateNpcLevel(worldX, worldY);
            const npcType = chunkRNG() < 0.3 ? 'boss' : 'hostile';
            entities.push({
              type: npcType,
              x: worldX,
              y: worldY,
              level: npcLevel
            });
          } else if (chunkRNG() < 0.003) {
            entities.push({
              type: 'merchant',
              x: worldX,
              y: worldY,
              level: 1
            });
          } else if (chunkRNG() < 0.005) {
            tiles[localY][localX] = {
              type: TileType.Chest,
              passable: false,
              variant: 0
            };
          }
        }
      }
    }

    return {
      chunkX,
      chunkY,
      size: this.chunkSize,
      tiles,
      generatedAt: Date.now(),
      hasEntities: entities.length > 0,
      entities
    };
  }

  private getElevation(x: number, y: number): number {
    const nx = x * this.noiseScale;
    const ny = y * this.noiseScale;

    let elevation = 0;
    elevation += smoothNoise(nx, ny, this.seed) * 0.5;
    elevation += smoothNoise(nx * 2, ny * 2, this.seed + 100) * 0.25;
    elevation += smoothNoise(nx * 4, ny * 4, this.seed + 200) * 0.125;
    elevation += smoothNoise(nx * 8, ny * 8, this.seed + 300) * 0.0625;

    return Math.min(1, Math.max(0, elevation));
  }

  private getMoisture(x: number, y: number): number {
    const nx = x * this.noiseScale * 1.5;
    const ny = y * this.noiseScale * 1.5;

    let moisture = 0;
    moisture += smoothNoise(nx, ny, this.seed + 400) * 0.5;
    moisture += smoothNoise(nx * 2, ny * 2, this.seed + 500) * 0.25;
    moisture += smoothNoise(nx * 4, ny * 4, this.seed + 600) * 0.125;

    return Math.min(1, Math.max(0, moisture));
  }

  private isNearSpawn(x: number, y: number): boolean {
    return Math.abs(x) < 3 && Math.abs(y) < 3;
  }

  private calculateNpcLevel(x: number, y: number): number {
    const distance = Math.sqrt(x * x + y * y);
    const baseLevel = Math.floor(distance / 10) + 1;
    const variation = Math.floor(Math.random() * 3) - 1;
    return Math.max(1, baseLevel + variation);
  }

  generateSpawnArea(): { x: number; y: number } {
    return { x: 0, y: 0 };
  }

  getTileDescription(type: TileType): string {
    switch (type) {
      case TileType.Floor: return 'floor';
      case TileType.Wall: return 'wall';
      case TileType.Water: return 'water';
      case TileType.Grass: return 'grass';
      case TileType.Sand: return 'sand';
      case TileType.Stone: return 'stone';
      case TileType.Tree: return 'tree';
      case TileType.Chest: return 'chest';
      case TileType.Portal: return 'portal';
      case TileType.Spawn: return 'spawn';
    }
  }
}
