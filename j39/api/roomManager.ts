import type { ForceField, Room, User } from './types.ts'
import type { ServerRoom, ServerUser } from './types.ts'

const MAX_USERS_PER_ROOM = 10
const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
]

export class RoomManager {
  private rooms: Map<string, ServerRoom> = new Map()

  createRoom(name: string): Room {
    const id = this.generateId()
    const room: ServerRoom = {
      id,
      name,
      users: [],
      forceFields: [],
      createdAt: Date.now(),
    }
    this.rooms.set(id, room)
    return this.toPublicRoom(room)
  }

  deleteRoom(roomId: string): boolean {
    return this.rooms.delete(roomId)
  }

  getRoom(roomId: string): ServerRoom | undefined {
    return this.rooms.get(roomId)
  }

  getRooms(): Room[] {
    return Array.from(this.rooms.values()).map(room => this.toPublicRoom(room))
  }

  joinRoom(roomId: string, userId: string, userName: string, socketId: string): User | null {
    const room = this.rooms.get(roomId)
    if (!room) {
      return null
    }

    if (room.users.length >= MAX_USERS_PER_ROOM) {
      return null
    }

    const existingUser = room.users.find(u => u.id === userId)
    if (existingUser) {
      existingUser.socketId = socketId
      existingUser.lastHeartbeat = Date.now()
      return this.toPublicUser(existingUser)
    }

    const color = COLORS[room.users.length % COLORS.length]
    const user: ServerUser = {
      id: userId,
      name: userName,
      color,
      socketId,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
    }

    room.users.push(user)
    return this.toPublicUser(user)
  }

  leaveRoom(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId)
    if (!room) {
      return false
    }

    const index = room.users.findIndex(u => u.id === userId)
    if (index === -1) {
      return false
    }

    room.users.splice(index, 1)
    room.forceFields = room.forceFields.filter(f => f.userId !== userId)

    if (room.users.length === 0) {
      this.deleteRoom(roomId)
    }

    return true
  }

  addForceField(roomId: string, force: ForceField): boolean {
    const room = this.rooms.get(roomId)
    if (!room) {
      return false
    }

    const existingIndex = room.forceFields.findIndex(f => f.id === force.id)
    if (existingIndex !== -1) {
      room.forceFields[existingIndex] = force
    } else {
      room.forceFields.push(force)
    }

    return true
  }

  removeForceField(roomId: string, forceId: string): boolean {
    const room = this.rooms.get(roomId)
    if (!room) {
      return false
    }

    const index = room.forceFields.findIndex(f => f.id === forceId)
    if (index === -1) {
      return false
    }

    room.forceFields.splice(index, 1)
    return true
  }

  getForceFields(roomId: string): ForceField[] {
    const room = this.rooms.get(roomId)
    return room ? [...room.forceFields] : []
  }

  updateHeartbeat(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId)
    if (!room) {
      return false
    }

    const user = room.users.find(u => u.id === userId)
    if (!user) {
      return false
    }

    user.lastHeartbeat = Date.now()
    return true
  }

  removeInactiveUsers(timeoutMs: number): Array<{ roomId: string; userId: string }> {
    const removed: Array<{ roomId: string; userId: string }> = []
    const now = Date.now()

    for (const [roomId, room] of this.rooms) {
      const inactiveUsers = room.users.filter(u => now - u.lastHeartbeat > timeoutMs)
      for (const user of inactiveUsers) {
        this.leaveRoom(roomId, user.id)
        removed.push({ roomId, userId: user.id })
      }
    }

    return removed
  }

  findUserBySocketId(socketId: string): { roomId: string; user: ServerUser } | null {
    for (const [roomId, room] of this.rooms) {
      const user = room.users.find(u => u.socketId === socketId)
      if (user) {
        return { roomId, user }
      }
    }
    return null
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 10)
  }

  private toPublicRoom(room: ServerRoom): Room {
    return {
      id: room.id,
      name: room.name,
      users: room.users.map(u => this.toPublicUser(u)),
      forceFields: [...room.forceFields],
      createdAt: room.createdAt,
    }
  }

  private toPublicUser(user: ServerUser): User {
    return {
      id: user.id,
      name: user.name,
      color: user.color,
      connectedAt: user.connectedAt,
    }
  }
}

export const roomManager = new RoomManager()
