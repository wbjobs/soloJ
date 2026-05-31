export enum TileType {
  WALL = 0,
  FLOOR = 1,
  CHEST = 2,
}

export enum FogState {
  UNEXPLORED = 0,
  EXPLORED = 1,
  VISIBLE = 2,
}

export interface MapRequest {
  algorithm: 'drunkard' | 'bsp';
  width: number;
  height: number;
  seed?: number;
}

export interface MapResponse {
  map: number[][];
  width: number;
  height: number;
  algorithm: string;
  startPosition: { x: number; y: number };
  chestCount: number;
}

export interface VisibilityRequest {
  map: number[][];
  playerX: number;
  playerY: number;
  viewRadius?: number;
}

export interface VisibilityResponse {
  visibleTiles: Array<{ x: number; y: number; type: number }>;
  viewRadius: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface PlayerState {
  x: number;
  y: number;
  chestsCollected: number;
}

export interface BSPNode {
  x: number;
  y: number;
  width: number;
  height: number;
  left?: BSPNode;
  right?: BSPNode;
  room?: Room;
}

export interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}
