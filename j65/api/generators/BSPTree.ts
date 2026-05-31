import { TileType, type Position, type BSPNode, type Room } from '../../shared/types.js'

interface BSPTreeResult {
  map: number[][]
  startPosition: Position
  chestCount: number
}

const MIN_ROOM_SIZE = 8
const CORRIDOR_WIDTH = 2

function createNode(x: number, y: number, width: number, height: number): BSPNode {
  return { x, y, width, height }
}

function splitNode(node: BSPNode): boolean {
  if (node.left || node.right) {
    return false
  }

  const canSplitH = node.height >= MIN_ROOM_SIZE * 2
  const canSplitV = node.width >= MIN_ROOM_SIZE * 2

  if (!canSplitH && !canSplitV) {
    return false
  }

  let splitHorizontal: boolean
  if (canSplitH && canSplitV) {
    splitHorizontal = Math.random() > 0.5
  } else {
    splitHorizontal = canSplitH
  }

  if (splitHorizontal) {
    const splitMin = MIN_ROOM_SIZE
    const splitMax = node.height - MIN_ROOM_SIZE
    const splitY = Math.floor(Math.random() * (splitMax - splitMin + 1)) + splitMin

    node.left = createNode(node.x, node.y, node.width, splitY)
    node.right = createNode(node.x, node.y + splitY, node.width, node.height - splitY)
  } else {
    const splitMin = MIN_ROOM_SIZE
    const splitMax = node.width - MIN_ROOM_SIZE
    const splitX = Math.floor(Math.random() * (splitMax - splitMin + 1)) + splitMin

    node.left = createNode(node.x, node.y, splitX, node.height)
    node.right = createNode(node.x + splitX, node.y, node.width - splitX, node.height)
  }

  return true
}

function buildTree(node: BSPNode): void {
  splitNode(node)
  if (node.left) {
    buildTree(node.left)
  }
  if (node.right) {
    buildTree(node.right)
  }
}

function createRoom(node: BSPNode): Room {
  const maxRoomWidth = Math.max(3, node.width - 2)
  const maxRoomHeight = Math.max(3, node.height - 2)
  const roomWidth = Math.max(3, Math.floor(maxRoomWidth * (0.6 + Math.random() * 0.3)))
  const roomHeight = Math.max(3, Math.floor(maxRoomHeight * (0.6 + Math.random() * 0.3)))
  const roomX = node.x + 1 + Math.floor(Math.random() * Math.max(1, maxRoomWidth - roomWidth))
  const roomY = node.y + 1 + Math.floor(Math.random() * Math.max(1, maxRoomHeight - roomHeight))

  return {
    x: roomX,
    y: roomY,
    width: roomWidth,
    height: roomHeight,
    centerX: Math.floor(roomX + roomWidth / 2),
    centerY: Math.floor(roomY + roomHeight / 2),
  }
}

function carveRoom(map: number[][], room: Room): void {
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
        map[y][x] = TileType.FLOOR
      }
    }
  }
}

function carveCorridor(map: number[][], x1: number, y1: number, x2: number, y2: number): void {
  const halfWidth = Math.floor(CORRIDOR_WIDTH / 2)

  if (Math.random() > 0.5) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      for (let dy = -halfWidth; dy <= halfWidth; dy++) {
        const y = y1 + dy
        if (y > 0 && y < map.length - 1 && x > 0 && x < map[0].length - 1) {
          map[y][x] = TileType.FLOOR
        }
      }
    }
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      for (let dx = -halfWidth; dx <= halfWidth; dx++) {
        const x = x2 + dx
        if (y > 0 && y < map.length - 1 && x > 0 && x < map[0].length - 1) {
          map[y][x] = TileType.FLOOR
        }
      }
    }
  } else {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      for (let dx = -halfWidth; dx <= halfWidth; dx++) {
        const x = x1 + dx
        if (y > 0 && y < map.length - 1 && x > 0 && x < map[0].length - 1) {
          map[y][x] = TileType.FLOOR
        }
      }
    }
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      for (let dy = -halfWidth; dy <= halfWidth; dy++) {
        const y = y2 + dy
        if (y > 0 && y < map.length - 1 && x > 0 && x < map[0].length - 1) {
          map[y][x] = TileType.FLOOR
        }
      }
    }
  }
}

function getRoom(node: BSPNode): Room | undefined {
  if (node.room) return node.room
  if (node.left) {
    const leftRoom = getRoom(node.left)
    if (leftRoom) return leftRoom
  }
  if (node.right) {
    const rightRoom = getRoom(node.right)
    if (rightRoom) return rightRoom
  }
  return undefined
}

function connectTree(map: number[][], node: BSPNode): void {
  if (!node.left || !node.right) return

  connectTree(map, node.left)
  connectTree(map, node.right)

  const leftRoom = getRoom(node.left)
  const rightRoom = getRoom(node.right)

  if (leftRoom && rightRoom) {
    carveCorridor(map, leftRoom.centerX, leftRoom.centerY, rightRoom.centerX, rightRoom.centerY)
  }
}

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

export function generate(width: number, height: number): BSPTreeResult {
  const map: number[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => TileType.WALL),
  )

  const root = createNode(1, 1, width - 2, height - 2)
  buildTree(root)

  const leafNodes: BSPNode[] = []
  function collectLeaves(node: BSPNode): void {
    if (!node.left && !node.right) {
      leafNodes.push(node)
      return
    }
    if (node.left) collectLeaves(node.left)
    if (node.right) collectLeaves(node.right)
  }
  collectLeaves(root)

  const rooms: Room[] = []
  for (const node of leafNodes) {
    const room = createRoom(node)
    node.room = room
    rooms.push(room)
    carveRoom(map, room)
  }

  connectTree(map, root)

  const startRoom = rooms[0]
  const startPosition: Position = {
    x: startRoom.centerX,
    y: startRoom.centerY,
  }

  ensureConnectivity(map, startPosition)

  let chestCount = 0
  for (const room of rooms) {
    if (Math.random() < 0.3) {
      const chestX = room.x + Math.floor(Math.random() * room.width)
      const chestY = room.y + Math.floor(Math.random() * room.height)
      if (map[chestY][chestX] === TileType.FLOOR) {
        map[chestY][chestX] = TileType.CHEST
        chestCount++
      }
    }
  }

  return { map, startPosition, chestCount }
}
