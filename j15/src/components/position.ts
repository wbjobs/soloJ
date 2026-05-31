import { Component } from '../ecs';

export const POSITION_COMPONENT = 'position';

export class Position extends Component {
  readonly type = POSITION_COMPONENT;

  constructor(
    public x: number,
    public y: number,
    public mapId: string = 'main'
  ) {
    super();
  }

  distance(other: Position): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  isNear(other: Position, range: number): boolean {
    return this.distance(other) <= range;
  }

  getChunkX(chunkSize: number): number {
    return Math.floor(this.x / chunkSize);
  }

  getChunkY(chunkSize: number): number {
    return Math.floor(this.y / chunkSize);
  }

  clone(): Position {
    return new Position(this.x, this.y, this.mapId);
  }
}
