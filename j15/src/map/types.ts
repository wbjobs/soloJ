export enum TileType {
  Floor = 0,
  Wall = 1,
  Water = 2,
  Grass = 3,
  Sand = 4,
  Stone = 5,
  Tree = 6,
  Chest = 7,
  Portal = 8,
  Spawn = 9,
}

export interface Tile {
  type: TileType;
  passable: boolean;
  variant: number;
}

export interface Chunk {
  chunkX: number;
  chunkY: number;
  size: number;
  tiles: Tile[][];
  generatedAt: number;
  hasEntities: boolean;
  entities: { type: string; x: number; y: number; level: number }[];
}
