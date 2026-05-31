import { System } from '../ecs';
import { Position, POSITION_COMPONENT } from '../components';
import { MapGenerator, TileType, Chunk, Tile } from '../map';

export class MapSystem extends System {
  readonly name = 'MapSystem';
  readonly requiredComponents = [POSITION_COMPONENT];

  private mapGenerator: MapGenerator;
  private loadedChunks: Map<string, Chunk> = new Map();

  constructor(seed: number = 12345) {
    super();
    this.mapGenerator = new MapGenerator(seed);
  }

  getChunk(chunkX: number, chunkY: number): Chunk {
    const key = `${chunkX}_${chunkY}`;
    if (!this.loadedChunks.has(key)) {
      const chunk = this.mapGenerator.generateChunk(chunkX, chunkY);
      this.loadedChunks.set(key, chunk);
    }
    return this.loadedChunks.get(key)!;
  }

  getTile(x: number, y: number): Tile | null {
    const chunkX = Math.floor(x / this.mapGenerator.getChunkSize());
    const chunkY = Math.floor(y / this.mapGenerator.getChunkSize());
    const chunk = this.getChunk(chunkX, chunkY);
    const localX = ((x % this.mapGenerator.getChunkSize()) + this.mapGenerator.getChunkSize()) % this.mapGenerator.getChunkSize();
    const localY = ((y % this.mapGenerator.getChunkSize()) + this.mapGenerator.getChunkSize()) % this.mapGenerator.getChunkSize();
    return chunk.tiles[localY][localX];
  }

  isPassable(x: number, y: number): boolean {
    const tile = this.getTile(x, y);
    if (!tile) return false;
    return tile.type !== TileType.Wall && tile.type !== TileType.Water;
  }

  getTileType(x: number, y: number): TileType {
    const tile = this.getTile(x, y);
    return tile ? tile.type : TileType.Floor;
  }

  canMoveTo(entityId: string, targetX: number, targetY: number): boolean {
    if (!this.isPassable(targetX, targetY)) return false;

    const entities = this.world.getEntitiesWithComponents([POSITION_COMPONENT]);
    for (const otherId of entities) {
      if (otherId === entityId) continue;
      const pos = this.world.getComponent<Position>(otherId, POSITION_COMPONENT);
      if (pos && pos.x === targetX && pos.y === targetY) {
        return false;
      }
    }
    return true;
  }

  ensureChunksLoaded(centerX: number, centerY: number, range: number): void {
    const chunkSize = this.mapGenerator.getChunkSize();
    const centerCX = Math.floor(centerX / chunkSize);
    const centerCY = Math.floor(centerY / chunkSize);

    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        const cx = centerCX + dx;
        const cy = centerCY + dy;
        this.getChunk(cx, cy);
      }
    }
  }

  unloadDistantChunks(centerX: number, centerY: number, range: number): void {
    const chunkSize = this.mapGenerator.getChunkSize();
    const centerCX = Math.floor(centerX / chunkSize);
    const centerCY = Math.floor(centerY / chunkSize);

    for (const [key, chunk] of this.loadedChunks) {
      const dx = Math.abs(chunk.chunkX - centerCX);
      const dy = Math.abs(chunk.chunkY - centerCY);
      if (dx > range + 2 || dy > range + 2) {
        this.loadedChunks.delete(key);
      }
    }
  }

  getLoadedChunkCount(): number {
    return this.loadedChunks.size;
  }

  getMapGenerator(): MapGenerator {
    return this.mapGenerator;
  }

  update(deltaTime: number): void {}
}
