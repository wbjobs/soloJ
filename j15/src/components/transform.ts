import { Component } from '../ecs';

export const TRANSFORM_COMPONENT = 'transform';

export type Direction = 'up' | 'down' | 'left' | 'right';

export class Transform extends Component {
  readonly type = TRANSFORM_COMPONENT;

  public facing: Direction = 'down';
  public isMoving: boolean = false;
  public moveSpeed: number = 5;

  constructor(facing: Direction = 'down', moveSpeed: number = 5) {
    super();
    this.facing = facing;
    this.moveSpeed = moveSpeed;
  }

  setFacing(direction: Direction): void {
    this.facing = direction;
  }

  getVector(): { dx: number; dy: number } {
    switch (this.facing) {
      case 'up': return { dx: 0, dy: -1 };
      case 'down': return { dx: 0, dy: 1 };
      case 'left': return { dx: -1, dy: 0 };
      case 'right': return { dx: 1, dy: 0 };
    }
  }

  clone(): Transform {
    return new Transform(this.facing, this.moveSpeed);
  }
}
