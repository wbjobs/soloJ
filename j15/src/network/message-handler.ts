import { World } from '../ecs';
import { GameServer, PlayerConnection } from './game-server';
import { GameMessage, createMessage } from './protocol';
import { StateBroadcaster } from './state-broadcaster';
import { BattleSystem } from '../systems/battle-system';
import { InventorySystem } from '../systems/inventory-system';
import { MovementSystem } from '../systems/movement-system';
import { SkillSystem } from '../systems/skill-system';
import { MapSystem } from '../systems/map-system';
import { DropSystem } from '../systems/drop-system';
import { AoiSystem } from '../systems/aoi-system';
import { Position, POSITION_COMPONENT, Health, HEALTH_COMPONENT, Player, PLAYER_COMPONENT, Inventory, INVENTORY_COMPONENT, Combat, COMBAT_COMPONENT, Skill, SKILL_COMPONENT } from '../components';
import { AntiCheatSystem } from '../anticheat';

export class MessageHandler {
  private world: World;
  private server: GameServer;
  private broadcaster: StateBroadcaster;
  private battleSystem: BattleSystem;
  private inventorySystem: InventorySystem;
  private movementSystem: MovementSystem;
  private skillSystem: SkillSystem;
  private mapSystem: MapSystem;
  private dropSystem: DropSystem;
  private aoiSystem: AoiSystem;
  private antiCheat: AntiCheatSystem | null = null;
  private entityToPlayer: Map<string, string> = new Map();

  constructor(
    world: World,
    server: GameServer,
    broadcaster: StateBroadcaster,
    battleSystem: BattleSystem,
    inventorySystem: InventorySystem,
    movementSystem: MovementSystem,
    skillSystem: SkillSystem,
    mapSystem: MapSystem,
    dropSystem: DropSystem,
    aoiSystem: AoiSystem
  ) {
    this.world = world;
    this.server = server;
    this.broadcaster = broadcaster;
    this.battleSystem = battleSystem;
    this.inventorySystem = inventorySystem;
    this.movementSystem = movementSystem;
    this.skillSystem = skillSystem;
    this.mapSystem = mapSystem;
    this.dropSystem = dropSystem;
    this.aoiSystem = aoiSystem;
  }

  setAntiCheat(antiCheat: AntiCheatSystem): void {
    this.antiCheat = antiCheat;
  }

  setEntityPlayerMapping(entityToPlayer: Map<string, string>): void {
    this.entityToPlayer = entityToPlayer;
  }

  private recordOperation(entityId: string, type: any, data: Record<string, any>): void {
    if (!this.antiCheat) return;
    const playerId = this.entityToPlayer.get(entityId);
    if (playerId) {
      this.antiCheat.createAndValidateOperation(playerId, type, data);
    }
  }

  handleMessage(connection: PlayerConnection, message: GameMessage): void {
    const entityId = connection.entityId;
    if (!entityId) {
      this.server.sendToSession(connection.sessionId, createMessage('error', { message: 'Entity not initialized' }));
      return;
    }

    switch (message.type) {
      case 'move':
        this.handleMove(entityId, message);
        break;
      case 'attack':
        this.handleAttack(entityId, message);
        break;
      case 'skill':
        this.handleSkill(entityId, message);
        break;
      case 'defend':
        this.handleDefend(entityId);
        break;
      case 'flee':
        this.handleFlee(entityId);
        break;
      case 'pickup':
        this.handlePickup(entityId, message);
        break;
      case 'trade_request':
        this.handleTradeRequest(entityId, message);
        break;
      case 'trade_offer':
        this.handleTradeOffer(entityId, message);
        break;
      case 'trade_confirm':
        this.handleTradeConfirm(entityId, message);
        break;
      case 'trade_cancel':
        this.handleTradeCancel(entityId);
        break;
      case 'chat':
        this.handleChat(entityId, message);
        break;
      case 'sync':
        this.broadcaster.syncPlayerState(entityId);
        break;
      default:
        console.log(`[MessageHandler] Unknown message type: ${message.type}`);
    }
  }

  private handleMove(entityId: string, message: GameMessage): void {
    const { x, y } = message.data;
    if (typeof x !== 'number' || typeof y !== 'number') return;

    const currentPos = this.world.getComponent<Position>(entityId, POSITION_COMPONENT);
    if (!currentPos) return;

    const oldX = currentPos.x;
    const oldY = currentPos.y;
    const dx = x - currentPos.x;
    const dy = y - currentPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) return;

    if (!this.mapSystem.canMoveTo(entityId, x, y)) {
      this.server.sendToEntity(entityId, createMessage('error', { message: 'Cannot move to this position' }));
      return;
    }

    currentPos.x = x;
    currentPos.y = y;

    const oldCell = this.aoiSystem.getEntityCell(entityId);
    this.aoiSystem.updateEntityPosition(entityId, x, y);
    const newCell = this.aoiSystem.getEntityCell(entityId);

    if (oldCell !== newCell) {
      this.broadcaster.broadcastEntityDespawn(entityId);
      this.broadcaster.broadcastEntitySpawn(entityId);
    } else {
      this.broadcaster.broadcastEntityUpdate(entityId, {
        position: { x, y }
      });
    }

    this.recordOperation(entityId, 'move', { x, y, oldX, oldY, distance: dist });
  }

  private handleAttack(entityId: string, message: GameMessage): void {
    const { targetId } = message.data;
    if (!targetId) return;

    const result = this.battleSystem.performAttack(entityId, targetId);
    if (result) {
      const battle = this.battleSystem.getEntityBattle(entityId);
      if (battle) {
        this.broadcaster.broadcastToAOI(entityId, createMessage('battle_log', {
          battleId: battle.id,
          entries: [result]
        }), true);

        if (battle.isFinished) {
          this.broadcaster.broadcastToAOI(entityId, createMessage('battle_end', {
            battleId: battle.id,
            winner: battle.winner
          }), true);
        }
      }
    }

    this.recordOperation(entityId, 'attack', { targetId, damage: result?.damage || 0 });
  }

  private handleSkill(entityId: string, message: GameMessage): void {
    const { skillId, targetId } = message.data;
    if (!skillId || !targetId) return;

    const result = this.battleSystem.performSkill(entityId, skillId, targetId);
    if (result) {
      const battle = this.battleSystem.getEntityBattle(entityId);
      if (battle) {
        this.broadcaster.broadcastToAOI(entityId, createMessage('battle_log', {
          battleId: battle.id,
          entries: [result]
        }), true);

        if (battle.isFinished) {
          this.broadcaster.broadcastToAOI(entityId, createMessage('battle_end', {
            battleId: battle.id,
            winner: battle.winner
          }), true);
        }
      }
    }

    this.recordOperation(entityId, 'skill', { skillId, targetId, damage: result?.damage || 0 });
  }

  private handleDefend(entityId: string): void {
    const result = this.battleSystem.performDefend(entityId);
    if (result) {
      const battle = this.battleSystem.getEntityBattle(entityId);
      if (battle) {
        this.broadcaster.broadcastToAOI(entityId, createMessage('battle_log', {
          battleId: battle.id,
          entries: [result]
        }), true);
      }
    }

    this.recordOperation(entityId, 'defend', {});
  }

  private handleFlee(entityId: string): void {
    const result = this.battleSystem.attemptFlee(entityId);
    if (result) {
      const battle = this.battleSystem.getEntityBattle(entityId);
      if (battle) {
        this.broadcaster.broadcastToAOI(entityId, createMessage('battle_log', {
          battleId: battle.id,
          entries: [result]
        }), true);

        if (battle.isFinished) {
          this.broadcaster.broadcastToAOI(entityId, createMessage('battle_end', {
            battleId: battle.id,
            winner: battle.winner
          }), true);
        }
      }
    }

    this.recordOperation(entityId, 'flee', { success: result?.message?.includes('成功') || false });
  }

  private handlePickup(entityId: string, message: GameMessage): void {
    const { dropId } = message.data;
    if (!dropId) return;

    const result = this.dropSystem.pickupItem(entityId, dropId);
    if (result.success) {
      this.server.sendToEntity(entityId, createMessage('pickup', {
        itemId: result.itemId,
        quantity: result.quantity
      }));

      const inventory = this.world.getComponent<Inventory>(entityId, INVENTORY_COMPONENT);
      if (inventory) {
        this.server.sendToEntity(entityId, createMessage('inventory_update', {
          items: inventory.toArray()
        }));
      }
    }

    this.recordOperation(entityId, 'pickup', {
      dropId,
      itemId: result?.itemId || '',
      quantity: result?.quantity || 0,
      success: result.success
    });
  }

  private handleTradeRequest(entityId: string, message: GameMessage): void {
    const { targetId } = message.data;
    if (!targetId) return;

    const trade = this.inventorySystem.requestTrade(entityId, targetId);
    if (trade) {
      this.server.sendToEntity(entityId, createMessage('trade_request', {
        tradeId: trade.id,
        targetId
      }));
      this.server.sendToEntity(targetId, createMessage('trade_request', {
        tradeId: trade.id,
        initiatorId: entityId
      }));
    }

    this.recordOperation(entityId, 'trade', { type: 'request', targetId, tradeId: trade?.id || '' });
  }

  private handleTradeOffer(entityId: string, message: GameMessage): void {
    const { tradeId, itemId, quantity, gold } = message.data;
    if (!tradeId) return;

    this.inventorySystem.addTradeOffer(tradeId, entityId, itemId || '', quantity || 0, gold || 0);
    this.recordOperation(entityId, 'trade', { type: 'offer', tradeId, itemId, quantity, gold });
  }

  private handleTradeConfirm(entityId: string, message: GameMessage): void {
    const { tradeId } = message.data;
    if (!tradeId) return;

    const confirmed = this.inventorySystem.confirmTrade(tradeId, entityId);
    if (confirmed) {
      const trade = this.inventorySystem.getEntityTrade(entityId);
      if (!trade) {
        this.server.sendToEntity(entityId, createMessage('trade_confirm', { tradeId, completed: true }));
        this.server.sendToEntity(entityId, createMessage('inventory_update', {}));
      }
    }

    this.recordOperation(entityId, 'trade', { type: 'confirm', tradeId, confirmed });
  }

  private handleTradeCancel(entityId: string): void {
    const trade = this.inventorySystem.getEntityTrade(entityId);
    if (trade) {
      this.inventorySystem.cancelTrade(trade.id, entityId);
      this.server.sendToEntity(trade.initiatorId, createMessage('trade_cancel', { tradeId: trade.id }));
      this.server.sendToEntity(trade.targetId, createMessage('trade_cancel', { tradeId: trade.id }));
    }

    this.recordOperation(entityId, 'trade', { type: 'cancel', tradeId: trade?.id || '' });
  }

  private handleChat(entityId: string, message: GameMessage): void {
    const { text } = message.data;
    if (!text || typeof text !== 'string') return;

    const player = this.world.getComponent<Player>(entityId, PLAYER_COMPONENT);
    if (!player) return;

    this.broadcaster.broadcastToAOI(entityId, createMessage('chat', {
      senderId: entityId,
      senderName: player.name,
      text: text.slice(0, 200)
    }), true);

    this.recordOperation(entityId, 'chat', { length: text.length });
  }

  getServer(): GameServer {
    return this.server;
  }
}
