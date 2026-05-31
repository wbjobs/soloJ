import type { Vec3 } from '../types/index';

export class SpatialHashGrid {
  private _cellSize: number;
  private _gridSize: number;
  private _table: Map<number, number[]>;

  constructor(cellSize: number, gridSize: number = 100000) {
    this._cellSize = cellSize;
    this._gridSize = gridSize;
    this._table = new Map();
  }

  get cellSize(): number {
    return this._cellSize;
  }

  get gridSize(): number {
    return this._gridSize;
  }

  private hash(x: number, y: number, z: number): number {
    let h = x * 374761393 + y * 668265263 + z * 2147483647;
    h = (h ^ (h >> 13)) * 1274126177;
    return Math.abs((h ^ (h >> 16)) % this._gridSize);
  }

  private cellCoord(pos: Vec3): [number, number, number] {
    return [
      Math.floor(pos.x / this._cellSize),
      Math.floor(pos.y / this._cellSize),
      Math.floor(pos.z / this._cellSize)
    ];
  }

  clear(): void {
    this._table.clear();
  }

  insert(index: number, pos: Vec3): void {
    const [cx, cy, cz] = this.cellCoord(pos);
    const h = this.hash(cx, cy, cz);
    if (!this._table.has(h)) {
      this._table.set(h, []);
    }
    this._table.get(h)!.push(index);
  }

  query(pos: Vec3): number[] {
    const [cx, cy, cz] = this.cellCoord(pos);
    const results: number[] = [];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const h = this.hash(cx + dx, cy + dy, cz + dz);
          const cell = this._table.get(h);
          if (cell) {
            for (const idx of cell) {
              results.push(idx);
            }
          }
        }
      }
    }
    return results;
  }

  rebuild(positions: Float32Array, count: number): void {
    this.clear();
    for (let i = 0; i < count; i++) {
      const pos: Vec3 = {
        x: positions[i * 3],
        y: positions[i * 3 + 1],
        z: positions[i * 3 + 2]
      };
      this.insert(i, pos);
    }
  }
}

export class GpuSpatialHashGrid {
  private _cellSize: number;
  private _tableSize: number;
  private _cellStartBuffer: GPUBuffer;
  private _cellCountBuffer: GPUBuffer;
  private _sortedIndicesBuffer: GPUBuffer;
  private _maxParticles: number;

  constructor(
    device: GPUDevice,
    cellSize: number,
    maxParticles: number,
    tableSize: number = 262144
  ) {
    this._cellSize = cellSize;
    this._tableSize = tableSize;
    this._maxParticles = maxParticles;

    this._cellStartBuffer = device.createBuffer({
      size: tableSize * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    this._cellCountBuffer = device.createBuffer({
      size: tableSize * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    this._sortedIndicesBuffer = device.createBuffer({
      size: maxParticles * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
  }

  get cellSize(): number {
    return this._cellSize;
  }

  get tableSize(): number {
    return this._tableSize;
  }

  get cellStartBuffer(): GPUBuffer {
    return this._cellStartBuffer;
  }

  get cellCountBuffer(): GPUBuffer {
    return this._cellCountBuffer;
  }

  get sortedIndicesBuffer(): GPUBuffer {
    return this._sortedIndicesBuffer;
  }

  get maxParticles(): number {
    return this._maxParticles;
  }

  destroy(): void {
    this._cellStartBuffer.destroy();
    this._cellCountBuffer.destroy();
    this._sortedIndicesBuffer.destroy();
  }
}