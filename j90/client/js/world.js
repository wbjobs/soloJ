import * as THREE from 'three';

const CHUNK_SIZE = 16;

const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  SAND: 5,
};

const BLOCK_COLORS = {
  [BLOCK.GRASS]: { top: 0x4ade80, side: 0x65a844, bottom: 0x854d0e },
  [BLOCK.DIRT]:  { top: 0x92600a, side: 0x854d0e, bottom: 0x713f12 },
  [BLOCK.STONE]: { top: 0x9ca3af, side: 0x8b8f97, bottom: 0x6b7280 },
  [BLOCK.WOOD]:  { top: 0xc28820, side: 0xb45309, bottom: 0xc28820 },
  [BLOCK.SAND]:  { top: 0xfde047, side: 0xeab308, bottom: 0xca8a04 },
};

class ClientWorld {
  constructor() {
    this.chunks = new Map();
    this.meshes = new Map();
    this.scene = null;
    this.material = null;
    this.pendingUpdates = new Set();
  }

  init(scene) {
    this.scene = scene;
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
  }

  chunkKey(cx, cy, cz) {
    return `${cx},${cy},${cz}`;
  }

  loadChunks(chunksData) {
    for (const cd of chunksData) {
      const chunk = new Uint8Array(cd.blocks);
      this.chunks.set(this.chunkKey(cd.cx, cd.cy, cd.cz), {
        cx: cd.cx,
        cy: cd.cy,
        cz: cd.cz,
        blocks: chunk,
      });
    }
    for (const cd of chunksData) {
      this.buildChunkMesh(cd.cx, cd.cy, cd.cz);
    }
  }

  reloadWorld(chunksData) {
    for (const [key, mesh] of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.meshes.clear();
    this.chunks.clear();
    this.loadChunks(chunksData);
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
    return chunk.blocks[ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx];
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
      chunk = { cx, cy, cz, blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE) };
      this.chunks.set(this.chunkKey(cx, cy, cz), chunk);
    }
    chunk.blocks[ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx] = block;

    this.buildChunkMesh(cx, cy, cz);

    if (lx === 0) this.tryRebuildChunk(cx - 1, cy, cz);
    if (lx === CHUNK_SIZE - 1) this.tryRebuildChunk(cx + 1, cy, cz);
    if (ly === 0) this.tryRebuildChunk(cx, cy - 1, cz);
    if (ly === CHUNK_SIZE - 1) this.tryRebuildChunk(cx, cy + 1, cz);
    if (lz === 0) this.tryRebuildChunk(cx, cy, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.tryRebuildChunk(cx, cy, cz + 1);
  }

  tryRebuildChunk(cx, cy, cz) {
    if (this.chunks.has(this.chunkKey(cx, cy, cz))) {
      this.buildChunkMesh(cx, cy, cz);
    }
  }

  buildChunkMesh(cx, cy, cz) {
    const chunk = this.getChunk(cx, cy, cz);
    if (!chunk) return;

    const key = this.chunkKey(cx, cy, cz);
    const oldMesh = this.meshes.get(key);

    const positions = [];
    const colors = [];
    const normals = [];

    const ox = cx * CHUNK_SIZE;
    const oy = cy * CHUNK_SIZE;
    const oz = cz * CHUNK_SIZE;

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const blockType = chunk.blocks[ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx];
          if (blockType === BLOCK.AIR) continue;

          const wx = ox + lx;
          const wy = oy + ly;
          const wz = oz + lz;
          const bc = BLOCK_COLORS[blockType];
          if (!bc) continue;

          if (this.getBlock(wx, wy + 1, wz) === BLOCK.AIR) {
            this.addFace(positions, colors, normals, wx, wy, wz, 'top', bc.top);
          }
          if (this.getBlock(wx, wy - 1, wz) === BLOCK.AIR) {
            this.addFace(positions, colors, normals, wx, wy, wz, 'bottom', bc.bottom);
          }
          if (this.getBlock(wx + 1, wy, wz) === BLOCK.AIR) {
            this.addFace(positions, colors, normals, wx, wy, wz, 'right', bc.side);
          }
          if (this.getBlock(wx - 1, wy, wz) === BLOCK.AIR) {
            this.addFace(positions, colors, normals, wx, wy, wz, 'left', bc.side);
          }
          if (this.getBlock(wx, wy, wz + 1) === BLOCK.AIR) {
            this.addFace(positions, colors, normals, wx, wy, wz, 'front', bc.side);
          }
          if (this.getBlock(wx, wy, wz - 1) === BLOCK.AIR) {
            this.addFace(positions, colors, normals, wx, wy, wz, 'back', bc.side);
          }
        }
      }
    }

    if (positions.length === 0) {
      if (oldMesh) {
        this.scene.remove(oldMesh);
        oldMesh.geometry.dispose();
      }
      this.meshes.delete(key);
      return;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(mesh);
    this.meshes.set(key, mesh);

    if (oldMesh) {
      this.scene.remove(oldMesh);
      oldMesh.geometry.dispose();
    }
  }

  addFace(positions, colors, normals, x, y, z, face, colorHex) {
    const r = ((colorHex >> 16) & 0xff) / 255;
    const g = ((colorHex >> 8) & 0xff) / 255;
    const b = (colorHex & 0xff) / 255;

    let verts, norm;
    switch (face) {
      case 'top':
        verts = [
          [x, y + 1, z], [x, y + 1, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y + 1, z],
        ];
        norm = [0, 1, 0];
        break;
      case 'bottom':
        verts = [
          [x, y, z + 1], [x, y, z], [x + 1, y, z], [x, y, z + 1], [x + 1, y, z], [x + 1, y, z + 1],
        ];
        norm = [0, -1, 0];
        break;
      case 'front':
        verts = [
          [x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1],
        ];
        norm = [0, 0, 1];
        break;
      case 'back':
        verts = [
          [x + 1, y, z], [x, y, z], [x, y + 1, z], [x + 1, y, z], [x, y + 1, z], [x + 1, y + 1, z],
        ];
        norm = [0, 0, -1];
        break;
      case 'right':
        verts = [
          [x + 1, y, z + 1], [x + 1, y, z], [x + 1, y + 1, z], [x + 1, y, z + 1], [x + 1, y + 1, z], [x + 1, y + 1, z + 1],
        ];
        norm = [1, 0, 0];
        break;
      case 'left':
        verts = [
          [x, y, z], [x, y, z + 1], [x, y + 1, z + 1], [x, y, z], [x, y + 1, z + 1], [x, y + 1, z],
        ];
        norm = [-1, 0, 0];
        break;
    }

    for (const v of verts) {
      positions.push(v[0], v[1], v[2]);
      colors.push(r, g, b);
      normals.push(norm[0], norm[1], norm[2]);
    }
  }

  raycast(origin, direction, maxDist = 8) {
    const dx = direction.x;
    const dy = direction.y;
    const dz = direction.z;

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;

    let tMaxX = dx !== 0 ? ((dx > 0 ? x + 1 : x) - origin.x) / dx : Infinity;
    let tMaxY = dy !== 0 ? ((dy > 0 ? y + 1 : y) - origin.y) / dy : Infinity;
    let tMaxZ = dz !== 0 ? ((dz > 0 ? z + 1 : z) - origin.z) / dz : Infinity;

    const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;

    let prevX = x, prevY = y, prevZ = z;
    let dist = 0;

    for (let i = 0; i < 200 && dist < maxDist; i++) {
      const block = this.getBlock(x, y, z);
      if (block !== BLOCK.AIR) {
        return {
          hit: true,
          blockPos: { x, y, z },
          placePos: { x: prevX, y: prevY, z: prevZ },
          blockType: block,
        };
      }

      prevX = x;
      prevY = y;
      prevZ = z;

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          dist = tMaxX;
          x += stepX;
          tMaxX += tDeltaX;
        } else {
          dist = tMaxZ;
          z += stepZ;
          tMaxZ += tDeltaZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          dist = tMaxY;
          y += stepY;
          tMaxY += tDeltaY;
        } else {
          dist = tMaxZ;
          z += stepZ;
          tMaxZ += tDeltaZ;
        }
      }
    }

    return { hit: false };
  }
}

export { ClientWorld, BLOCK, CHUNK_SIZE };
