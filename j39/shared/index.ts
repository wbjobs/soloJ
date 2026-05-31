export type ForceType = 'attract' | 'repel' | 'vortex';

export interface ForceField {
  id: string;
  userId: string;
  type: ForceType;
  x: number;
  y: number;
  strength: number;
  radius: number;
  timestamp: number;
}

export interface User {
  id: string;
  name: string;
  color: string;
  connectedAt: number;
}

export interface Room {
  id: string;
  name: string;
  users: User[];
  forceFields: ForceField[];
  createdAt: number;
}

export interface SimulationParams {
  resolution: number;
  viscosity: number;
  velocity: number;
  vorticity: number;
  pressureIterations: number;
  timeStep: number;
}

export type VisualizationMode = 'particles' | 'streamlines' | 'vorticity';

export interface NormalizedForceData {
  x: number;
  y: number;
  type: ForceType;
  strength: number;
  radius: number;
}

export interface ClientToServerEvents {
  create_room: (data: { name: string }) => void;
  join_room: (data: { roomId: string; userName: string }) => void;
  leave_room: (data: { roomId: string }) => void;
  force_field: (data: { roomId: string; force: NormalizedForceData & { userId: string; id: string; timestamp: number } }) => void;
  request_sync: (data: { roomId: string }) => void;
  get_rooms: () => void;
}

export interface ServerToClientEvents {
  room_created: (room: Room) => void;
  user_joined: (user: User) => void;
  user_left: (userId: string) => void;
  force_field: (force: NormalizedForceData & { userId: string; id: string; timestamp: number }) => void;
  sync_state: (state: { forceFields: ForceField[] }) => void;
  room_list: (rooms: Room[]) => void;
  error: (message: string) => void;
}
