package main

import "sync"

const ChunkSize = 16

type Chunk struct {
	CX, CY, CZ int
	Blocks      [ChunkSize * ChunkSize * ChunkSize]byte
	mu          sync.RWMutex
}

func chunkIndex(x, y, z int) int {
	return (y*ChunkSize*ChunkSize + z*ChunkSize + x)
}

func (c *Chunk) GetBlock(x, y, z int) byte {
	if x < 0 || x >= ChunkSize || y < 0 || y >= ChunkSize || z < 0 || z >= ChunkSize {
		return BlockAir
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.Blocks[chunkIndex(x, y, z)]
}

func (c *Chunk) SetBlock(x, y, z int, block byte) {
	if x < 0 || x >= ChunkSize || y < 0 || y >= ChunkSize || z < 0 || z >= ChunkSize {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Blocks[chunkIndex(x, y, z)] = block
}

func (c *Chunk) ToChunkData() ChunkData {
	c.mu.RLock()
	defer c.mu.RUnlock()
	blocks := make([]byte, len(c.Blocks))
	copy(blocks, c.Blocks[:])
	return ChunkData{
		CX:     c.CX,
		CY:     c.CY,
		CZ:     c.CZ,
		Blocks: blocks,
	}
}

type World struct {
	Chunks map[ChunkKey]*Chunk
	mu     sync.RWMutex
}

type ChunkKey struct {
	X, Y, Z int
}

func NewWorld() *World {
	w := &World{
		Chunks: make(map[ChunkKey]*Chunk),
	}
	w.generateTerrain()
	return w
}

func (w *World) generateTerrain() {
	radius := 2
	for cx := -radius; cx <= radius; cx++ {
		for cz := -radius; cz <= radius; cz++ {
			chunk := &Chunk{
				CX: cx,
				CY: 0,
				CZ: cz,
			}
			for x := 0; x < ChunkSize; x++ {
				for z := 0; z < ChunkSize; z++ {
					worldX := cx*ChunkSize + x
					worldZ := cz*ChunkSize + z
					height := terrainHeight(worldX, worldZ)

					for y := 0; y < ChunkSize; y++ {
						worldY := y
						if worldY < height-3 {
							chunk.Blocks[chunkIndex(x, y, z)] = BlockStone
						} else if worldY < height {
							chunk.Blocks[chunkIndex(x, y, z)] = BlockDirt
						} else if worldY == height {
							chunk.Blocks[chunkIndex(x, y, z)] = BlockGrass
						}
					}
				}
			}
			w.Chunks[ChunkKey{cx, 0, cz}] = chunk
		}
	}
}

func terrainHeight(x, z int) int {
	h := 8
	h += int(pseudoNoise(x*0.1, z*0.1) * 4)
	h += int(pseudoNoise(x*0.05, z*0.05) * 2)
	if h < 1 {
		h = 1
	}
	if h > 14 {
		h = 14
	}
	return h
}

func pseudoNoise(x, z float64) float64 {
	n := sinHash(x*127.1+z*311.7)
	return n
}

func sinHash(v float64) float64 {
	const k = 43758.5453123
	val := v * k
	intPart := float64(int(val))
	frac := val - intPart
	if frac < 0 {
		frac = -frac
	}
	result := frac - float64(int(frac*1.0))
	if result < 0 {
		result = -result
	}
	return result*2 - 1
}

func (w *World) GetChunk(cx, cy, cz int) *Chunk {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.Chunks[ChunkKey{cx, cy, cz}]
}

func (w *World) GetBlock(wx, wy, wz int) byte {
	cx, cy, cz := WorldToChunk(wx, wy, wz)
	lx, ly, lz := WorldToLocal(wx, wy, wz)
	chunk := w.GetChunk(cx, cy, cz)
	if chunk == nil {
		return BlockAir
	}
	return chunk.GetBlock(lx, ly, lz)
}

func (w *World) SetBlock(wx, wy, wz int, block byte) {
	cx, cy, cz := WorldToChunk(wx, wy, wz)
	lx, ly, lz := WorldToLocal(wx, wy, wz)
	w.mu.Lock()
	chunk, exists := w.Chunks[ChunkKey{cx, cy, cz}]
	if !exists {
		chunk = &Chunk{CX: cx, CY: cy, CZ: cz}
		w.Chunks[ChunkKey{cx, cy, cz}] = chunk
	}
	w.mu.Unlock()
	chunk.SetBlock(lx, ly, lz, block)
}

func (w *World) GetAllChunkData() []ChunkData {
	w.mu.RLock()
	defer w.mu.RUnlock()
	result := make([]ChunkData, 0, len(w.Chunks))
	for _, chunk := range w.Chunks {
		result = append(result, chunk.ToChunkData())
	}
	return result
}

func WorldToChunk(wx, wy, wz int) (int, int, int) {
	cx := floorDiv(wx, ChunkSize)
	cy := floorDiv(wy, ChunkSize)
	cz := floorDiv(wz, ChunkSize)
	return cx, cy, cz
}

func WorldToLocal(wx, wy, wz int) (int, int, int) {
	lx := floorMod(wx, ChunkSize)
	ly := floorMod(wy, ChunkSize)
	lz := floorMod(wz, ChunkSize)
	return lx, ly, lz
}

func floorDiv(a, b int) int {
	if a >= 0 {
		return a / b
	}
	return (a - b + 1) / b
}

func floorMod(a, b int) int {
	r := a % b
	if r < 0 {
		r += b
	}
	return r
}
