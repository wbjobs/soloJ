import { System } from '../ecs';
import { Position, POSITION_COMPONENT } from '../components';

export class MovementSystem extends System {
  readonly name = 'MovementSystem';
  readonly requiredComponents = [POSITION_COMPONENT];

  private pendingMoves: Map<string, { targetX: number; targetY: number }> = new Map();

  protected onInit(): void {
    this.world['movementSystem'] = this;
  }

  requestMove(entityId: string, targetX: number, targetY: number): boolean {
    const pos = this.world.getComponent<Position>(entityId, POSITION_COMPONENT);
    if (!pos) return false;
    this.pendingMoves.set(entityId, { targetX, targetY });
    return true;
  }

  moveEntity(entityId: string, dx: number, dy: number): boolean {
    const pos = this.world.getComponent<Position>(entityId, POSITION_COMPONENT);
    if (!pos) return false;
    pos.x += dx;
    pos.y += dy;
    return true;
  }

  update(deltaTime: number): void {
    for (const [entityId, move] of this.pendingMoves) {
      const pos = this.world.getComponent<Position>(entityId, POSITION_COMPONENT);
      if (!pos) continue;
      pos.x = move.targetX;
      pos.y = move.targetY;
    }
    this.pendingMoves.clear();
  }
}
