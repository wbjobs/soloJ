import type {
  ForceField,
  User,
  Room,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../shared/index.ts'

export interface ServerUser extends User {
  socketId: string
  lastHeartbeat: number
}

export interface ServerRoom extends Room {
  users: ServerUser[]
}

export type {
  ForceField,
  User,
  Room,
  ClientToServerEvents,
  ServerToClientEvents,
}
