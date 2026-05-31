export type MessageType =
  | 'connect'
  | 'disconnect'
  | 'move'
  | 'state_update'
  | 'entity_spawn'
  | 'entity_despawn'
  | 'entity_update'
  | 'attack'
  | 'skill'
  | 'defend'
  | 'flee'
  | 'battle_start'
  | 'battle_end'
  | 'battle_log'
  | 'pickup'
  | 'drop'
  | 'inventory_update'
  | 'trade_request'
  | 'trade_offer'
  | 'trade_confirm'
  | 'trade_cancel'
  | 'party_invite'
  | 'party_join'
  | 'party_leave'
  | 'chat'
  | 'ping'
  | 'pong'
  | 'error'
  | 'sync';

export interface GameMessage {
  type: MessageType;
  sessionId?: string;
  entityId?: string;
  playerId?: string;
  data?: any;
  timestamp: number;
}

export interface MoveData {
  x: number;
  y: number;
}

export interface AttackData {
  targetId: string;
}

export interface SkillData {
  skillId: string;
  targetId: string;
}

export interface EntityState {
  entityId: string;
  position: { x: number; y: number };
  health: { current: number; max: number };
  name: string;
  level: number;
  type: 'player' | 'npc' | 'item';
  npcType?: string;
  isOnline?: boolean;
}

export interface TileState {
  x: number;
  y: number;
  type: number;
}

export interface ChunkData {
  chunkX: number;
  chunkY: number;
  tiles: number[][];
  entities: EntityState[];
}

export interface BattleState {
  battleId: string;
  round: number;
  activeEntityId: string;
  participants: {
    entityId: string;
    name: string;
    health: { current: number; max: number };
    team: 'ally' | 'enemy';
    isDead: boolean;
  }[];
  log: {
    round: number;
    actorName: string;
    actionType: string;
    targetName?: string;
    damage?: number;
    message: string;
  }[];
}

export interface SyncData {
  entities: EntityState[];
  groundItems: {
    id: string;
    itemId: string;
    quantity: number;
    x: number;
    y: number;
  }[];
  tiles: TileState[];
}

export function createMessage(type: MessageType, data?: any, sessionId?: string, entityId?: string, playerId?: string): GameMessage {
  return {
    type,
    sessionId,
    entityId,
    playerId,
    data,
    timestamp: Date.now()
  };
}
