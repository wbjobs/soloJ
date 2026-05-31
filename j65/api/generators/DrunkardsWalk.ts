import { TileType, type Position } from '../../shared/types.js'

interface DrunkardsWalkResult {
  map: number[][]
  startPosition: Position
  chestCount: number
}

const DIRECTIONS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
]

function floodFill(map: number[][], startX: number, startY: number): Set<string> {
  const visited = new Set<string>()
  const queue: Position[] = [{ x: startX, y: startY }]
  const key = (x: number, y: number) => `${x},${y}`

  visited.add(key(startX, startY))

  while (queue.length > 0) {
    const pos = queue.shift()!
    const neighbors = [
      { x: pos.x + 1, y: pos.y },
      { x: pos.x - 1, y: pos.y },
      { x: pos.x, y: pos.y + 1 },
      { x: pos.x, y: pos.y - 1 },
    ]

    for (const n of neighbors) {
      const k = key(n.x, n.y)
      if (
        !visited.has(k) &&
        n.y >= 0 && n.y < map.length &&
        n.x >= 0 && n.x < map[0].length &&
        map[n.y][n.x] !== TileType.WALL
      ) {
        visited.add(k)
        queue.push(n)
      }
    }
  }

  return visited
}

function ensureConnectivity(map: number[][], startPosition: Position): void {
  const reachable = floodFill(map, startPosition.x, startPosition.y)

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[0].length; x++) {
      if (map[y][x] !== TileType.WALL && !reachable.has(`${x},${y}`)) {
        map[y][x] = TileType.WALL
      }
    }
  }
}

export function generate(width: number, height: number): DrunkardsWalkResult {
  const totalTiles = width * height
  const targetFloorCount = Math.floor(totalTiles * 0.4)

  const map: number[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => TileType.WALL),
  )

  let x = Math.floor(Math.random() * (width - 4)) + 2
  let y = Math.floor(Math.random() * (height - 4)) + 2
  const startPosition: Position = { x, y }

  map[y][x] = TileType.FLOOR
  let floorCount = 1

  const floorPositions: Position[] = [{ x, y }]

  while (floorCount < targetFloorCount) {
    const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)]
    const newX = x + dir.dx
    const newY = y + dir.dy

    if (newX > 0 && newX < width - 1 && newY > 0 && newY < height - 1) {
      x = newX
      y = newY

      if (map[y][x] === TileType.WALL) {
        map[y][x] = TileType.FLOOR
        floorCount++
        floorPositions.push({ x, y })
      }
    }
  }

  ensureConnectivity(map, startPosition)

  const validFloorPositions = floorPositions.filter(
    (p) => map[p.y][p.x] === TileType.FLOOR,
  )

  const chestCount = Math.max(1, Math.floor(validFloorPositions.length * 0.03))
  for (let i = 0; i < chestCount && validFloorPositions.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * validFloorPositions.length)
    const chestPos = validFloorPositions[randomIndex]
    if (map[chestPos.y][chestPos.x] === TileType.FLOOR) {
      map[chestPos.y][chestPos.x] = TileType.CHEST
    }
    validFloorPositions.splice(randomIndex, 1)
  }

  return { map, startPosition, chestCount }
}
