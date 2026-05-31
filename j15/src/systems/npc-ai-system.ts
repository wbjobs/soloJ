import { System } from '../ecs';
import { Position, POSITION_COMPONENT, Health, HEALTH_COMPONENT, Combat, COMBAT_COMPONENT, Npc, NPC_COMPONENT, Player, PLAYER_COMPONENT } from '../components';
import { MapSystem } from './map-system';

export class NpcAiSystem extends System {
  readonly name = 'NpcAiSystem';
  readonly requiredComponents = [NPC_COMPONENT, POSITION_COMPONENT, HEALTH_COMPONENT];

  private aiUpdateInterval: number = 1000;
  private lastUpdate: Map<string, number> = new Map();

  protected onInit(): void {
    this.world['npcAiSystem'] = this;
  }

  update(deltaTime: number): void {
    const now = Date.now();
    const entities = this.getEntitiesWithRequiredComponents();

    for (const entityId of entities) {
      const npc = this.world.getComponent<Npc>(entityId, NPC_COMPONENT);
      const health = this.world.getComponent<Health>(entityId, HEALTH_COMPONENT);
      const pos = this.world.getComponent<Position>(entityId, POSITION_COMPONENT);
      const combat = this.world.getComponent<Combat>(entityId, COMBAT_COMPONENT);

      if (!npc || !health || !pos || !combat) continue;
      if (health.isDead) {
        npc.aiState = 'dead';
        continue;
      }

      const last = this.lastUpdate.get(entityId) || 0;
      if (now - last < this.aiUpdateInterval) continue;
      this.lastUpdate.set(entityId, now);

      this.updateNpcAI(entityId, npc, pos, health, combat, now);
    }
  }

  private updateNpcAI(
    entityId: string,
    npc: Npc,
    pos: Position,
    health: Health,
    combat: Combat,
    now: number
  ): void {
    if (combat.isInBattle) return;

    if (health.current < health.max * 0.3) {
      npc.aiState = 'flee';
      this.fleeFromThreat(entityId, pos);
      return;
    }

    const nearestEnemy = this.findNearestPlayer(entityId, pos, npc.aggroRange);

    if (nearestEnemy) {
      if (this.isInAttackRange(pos, nearestEnemy.pos)) {
        npc.aiState = 'attack';
        this.initiateBattle(entityId, nearestEnemy.id);
      } else {
        npc.aiState = 'chase';
        this.moveTowards(entityId, pos, nearestEnemy.pos);
      }
    } else {
      npc.aiState = 'patrol';
      this.patrol(entityId, pos);
    }
  }

  private findNearestPlayer(
    entityId: string,
    pos: Position,
    range: number
  ): { id: string; pos: Position } | null {
    const playerEntities = this.world.getEntitiesWithComponents([PLAYER_COMPONENT, POSITION_COMPONENT]);
    let nearest: { id: string; pos: Position } | null = null;
    let nearestDist = range;

    for (const playerId of playerEntities) {
      const playerPos = this.world.getComponent<Position>(playerId, POSITION_COMPONENT);
      if (!playerPos) continue;

      const dist = pos.distance(playerPos);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = { id: playerId, pos: playerPos };
      }
    }

    return nearest;
  }

  private isInAttackRange(from: Position, to: Position): boolean {
    return from.distance(to) <= 1.5;
  }

  private moveTowards(entityId: string, from: Position, to: Position): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    let moveX = 0;
    let moveY = 0;

    if (Math.abs(dx) > Math.abs(dy)) {
      moveX = dx > 0 ? 1 : -1;
    } else if (dy !== 0) {
      moveY = dy > 0 ? 1 : -1;
    }

    const newX = from.x + moveX;
    const newY = from.y + moveY;

    const mapSystem = this.world['mapSystem'] as MapSystem | undefined;
    if (mapSystem && mapSystem.canMoveTo(entityId, newX, newY)) {
      from.x = newX;
      from.y = newY;
    }
  }

  private patrol(entityId: string, pos: Position): void {
    if (Math.random() > 0.3) return;

    const directions = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
    ];

    const dir = directions[Math.floor(Math.random() * directions.length)];
    const newX = pos.x + dir.dx;
    const newY = pos.y + dir.dy;

    const mapSystem = this.world['mapSystem'] as MapSystem | undefined;
    if (mapSystem && mapSystem.canMoveTo(entityId, newX, newY)) {
      pos.x = newX;
      pos.y = newY;
    }
  }

  private fleeFromThreat(entityId: string, pos: Position): void {
    const playerEntities = this.world.getEntitiesWithComponents([PLAYER_COMPONENT, POSITION_COMPONENT]);
    let threatX = pos.x;
    let threatY = pos.y;

    for (const playerId of playerEntities) {
      const playerPos = this.world.getComponent<Position>(playerId, POSITION_COMPONENT);
      if (playerPos && pos.distance(playerPos) < 10) {
        threatX = playerPos.x;
        threatY = playerPos.y;
        break;
      }
    }

    const dx = pos.x - threatX;
    const dy = pos.y - threatY;
    const moveX = dx !== 0 ? Math.sign(dx) : (Math.random() > 0.5 ? 1 : -1);
    const moveY = dy !== 0 ? Math.sign(dy) : (Math.random() > 0.5 ? 1 : -1);

    const newX = pos.x + moveX;
    const newY = pos.y + moveY;

    const mapSystem = this.world['mapSystem'] as MapSystem | undefined;
    if (mapSystem && mapSystem.canMoveTo(entityId, newX, newY)) {
      pos.x = newX;
      pos.y = newY;
    }
  }

  private initiateBattle(npcId: string, playerId: string): void {
    const battleSystem = this.world['battleSystem'] as any;
    if (battleSystem && battleSystem.startBattle) {
      battleSystem.startBattle([playerId], [npcId]);
    }
  }

  getNpcState(entityId: string): string | undefined {
    const npc = this.world.getComponent<Npc>(entityId, NPC_COMPONENT);
    return npc?.aiState;
  }
}
