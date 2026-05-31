import { World } from '../ecs';
import { Position, POSITION_COMPONENT, Health, HEALTH_COMPONENT, Player, PLAYER_COMPONENT, Npc, NPC_COMPONENT, Item, ITEM_COMPONENT } from '../components';
import { AoiSystem, AOI_GRID_SIZE, AOI_VIEW_RANGE } from '../systems/aoi-system';
import { GameServer } from './game-server';
import { GameMessage, createMessage, EntityState, SyncData, TileState } from './protocol';
import { MapSystem } from '../systems/map-system';
import { DropSystem, GroundItem } from '../systems/drop-system';

export class StateBroadcaster {
  private world: World;
  private server: GameServer;
  private aoiSystem: AoiSystem;
  private mapSystem: MapSystem;
  private dropSystem: DropSystem;
  private syncInterval: number;
  private lastSync: Map<string, number> = new Map();

  constructor(
    world: World,
    server: GameServer,
    aoiSystem: AoiSystem,
    mapSystem: MapSystem,
    dropSystem: DropSystem,
    syncInterval: number = 100
  ) {
    this.world = world;
    this.server = server;
    this.aoiSystem = aoiSystem;
    this.mapSystem = mapSystem;
    this.dropSystem = dropSystem;
    this.syncInterval = syncInterval;
  }

  start(): void {
    console.log('[StateBroadcaster] State broadcaster started');
  }

  broadcastEntitySpawn(entityId: string): void {
    const state = this.buildEntityState(entityId);
    if (!state) return;

    const message = createMessage('entity_spawn', state);
    const nearbyEntities = this.aoiSystem.getEntitiesInAOI(entityId);
    this.server.sendToEntities(nearbyEntities, message);
  }

  broadcastEntityDespawn(entityId: string): void {
    const message = createMessage('entity_despawn', { entityId });
    const nearbyEntities = this.aoiSystem.getEntitiesInAOI(entityId);
    this.server.sendToEntities(nearbyEntities, message);
  }

  broadcastEntityUpdate(entityId: string, data: Partial<EntityState>): void {
    const message = createMessage('entity_update', { entityId, ...data });
    const nearbyEntities = this.aoiSystem.getEntitiesInAOI(entityId);
    this.server.sendToEntities(nearbyEntities, message);
  }

  broadcastToEntity(entityId: string, message: GameMessage): void {
    this.server.sendToEntity(entityId, message);
  }

  broadcastToAOI(entityId: string, message: GameMessage, includeSelf: boolean = false): void {
    let entities = this.aoiSystem.getEntitiesInAOI(entityId);
    if (includeSelf) {
      entities = [...entities, entityId];
    }
    this.server.sendToEntities(entities, message);
  }

  syncPlayerState(entityId: string): void {
    const now = Date.now();
    const last = this.lastSync.get(entityId) || 0;
    if (now - last < this.syncInterval) return;
    this.lastSync.set(entityId, now);

    const nearbyEntities = this.aoiSystem.getEntitiesInAOI(entityId);
    const entities: EntityState[] = [];

    for (const nearbyId of nearbyEntities) {
      const state = this.buildEntityState(nearbyId);
      if (state) entities.push(state);
    }

    const pos = this.world.getComponent<Position>(entityId, POSITION_COMPONENT);
    const groundItems = pos ? this.dropSystem.getNearbyItems(pos.x, pos.y, 15) : [];

    const data: SyncData = {
      entities,
      groundItems: groundItems.map((item: GroundItem) => ({
        id: item.id,
        itemId: item.itemId,
        quantity: item.quantity,
        x: item.x,
        y: item.y
      })),
      tiles: this.getVisibleTiles(pos)
    };

    this.server.sendToEntity(entityId, createMessage('sync', data));
  }

  syncAllPlayers(): void {
    const playerEntities = this.world.getEntitiesWithComponents([PLAYER_COMPONENT]);
    for (const entityId of playerEntities) {
      this.syncPlayerState(entityId);
    }
  }

  private getVisibleTiles(pos: Position | undefined): TileState[] {
    if (!pos) return [];

    const tiles: TileState[] = [];
    const viewRange = 15;

    for (let dy = -viewRange; dy <= viewRange; dy++) {
      for (let dx = -viewRange; dx <= viewRange; dx++) {
        const x = Math.floor(pos.x + dx);
        const y = Math.floor(pos.y + dy);
        const tileType = this.mapSystem.getTileType(x, y);
        tiles.push({ x, y, type: tileType });
      }
    }

    return tiles;
  }

  private buildEntityState(entityId: string): EntityState | undefined {
    const pos = this.world.getComponent<Position>(entityId, POSITION_COMPONENT);
    const health = this.world.getComponent<Health>(entityId, HEALTH_COMPONENT);
    const player = this.world.getComponent<Player>(entityId, PLAYER_COMPONENT);
    const npc = this.world.getComponent<Npc>(entityId, NPC_COMPONENT);

    if (!pos) return undefined;

    let name = '';
    let level = 1;
    let type: 'player' | 'npc' | 'item' = 'npc';
    let npcType: string | undefined;
    let isOnline: boolean | undefined;

    if (player) {
      name = player.name;
      level = player.level;
      type = 'player';
      isOnline = player.isOnline;
    } else if (npc) {
      name = npc.npcName;
      level = npc.level;
      npcType = npc.npcType;
    }

    return {
      entityId,
      position: { x: pos.x, y: pos.y },
      health: health ? { current: health.current, max: health.max } : { current: 0, max: 0 },
      name,
      level,
      type,
      npcType,
      isOnline
    };
  }

  getSyncInterval(): number {
    return this.syncInterval;
  }
}
