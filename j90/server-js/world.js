const CHUNK_SIZE = 16;

const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  SAND: 5,
};

class Chunk {
  constructor(cx, cy, cz) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
  }

  idx(x, y, z) {
    return y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;
  }

  getBlock(x, y, z) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      return BLOCK.AIR;
    }
    return this.blocks[this.idx(x, y, z)];
  }

  setBlock(x, y, z, block) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      return;
    }
    this.blocks[this.idx(x, y, z)] = block;
  }

  serialize() {
    return {
      cx: this.cx,
      cy: this.cy,
      cz: this.cz,
      blocks: Array.from(this.blocks),
    };
  }
}

function pseudoNoise(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return (n - Math.floor(n)) * 2 - 1;
}

function terrainHeight(wx, wz) {
  let h = 8;
  h += Math.floor(pseudoNoise(wx * 0.1, wz * 0.1) * 4);
  h += Math.floor(pseudoNoise(wx * 0.05, wz * 0.05) * 2);
  return Math.max(1, Math.min(14, h));
}

class World {
  constructor() {
    this.chunks = new Map();
    this.generateTerrain();
  }

  chunkKey(cx, cy, cz) {
    return `${cx},${cy},${cz}`;
  }

  generateTerrain() {
    const radius = 2;
    for (let cx = -radius; cx <= radius; cx++) {
      for (let cz = -radius; cz <= radius; cz++) {
        const chunk = new Chunk(cx, 0, cz);
        for (let x = 0; x < CHUNK_SIZE; x++) {
          for (let z = 0; z < CHUNK_SIZE; z++) {
            const wx = cx * CHUNK_SIZE + x;
            const wz = cz * CHUNK_SIZE + z;
            const height = terrainHeight(wx, wz);
            for (let y = 0; y < CHUNK_SIZE; y++) {
              if (y < height - 3) {
                chunk.setBlock(x, y, z, BLOCK.STONE);
              } else if (y < height) {
                chunk.setBlock(x, y, z, BLOCK.DIRT);
              } else if (y === height) {
                chunk.setBlock(x, y, z, BLOCK.GRASS);
              }
            }
          }
        }
        this.chunks.set(this.chunkKey(cx, 0, cz), chunk);
      }
    }
  }

  getChunk(cx, cy, cz) {
    return this.chunks.get(this.chunkKey(cx, cy, cz));
  }

  getBlock(wx, wy, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cy = Math.floor(wy / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((wy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const chunk = this.getChunk(cx, cy, cz);
    if (!chunk) return BLOCK.AIR;
    return chunk.getBlock(lx, ly, lz);
  }

  setBlock(wx, wy, wz, block) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cy = Math.floor(wy / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((wy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    let chunk = this.getChunk(cx, cy, cz);
    if (!chunk) {
      chunk = new Chunk(cx, cy, cz);
      this.chunks.set(this.chunkKey(cx, cy, cz), chunk);
    }
    chunk.setBlock(lx, ly, lz, block);
  }

  getAllChunkData() {
    const result = [];
    for (const chunk of this.chunks.values()) {
      result.push(chunk.serialize());
    }
    return result;
  }
}

module.exports = { World, Chunk, BLOCK, CHUNK_SIZE };
