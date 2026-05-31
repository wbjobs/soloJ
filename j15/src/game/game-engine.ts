import { World } from '../ecs';
import { Position, POSITION_COMPONENT, Health, HEALTH_COMPONENT, Player, PLAYER_COMPONENT, Inventory, INVENTORY_COMPONENT, Skill, SKILL_COMPONENT, Combat, COMBAT_COMPONENT, Mana, MANA_COMPONENT, Npc, NPC_COMPONENT } from '../components';
import { BattleSystem } from '../systems/battle-system';
import { InventorySystem } from '../systems/inventory-system';
import { MovementSystem } from '../systems/movement-system';
import { SkillSystem } from '../systems/skill-system';
import { MapSystem } from '../systems/map-system';
import { AoiSystem } from '../systems/aoi-system';
import { NpcAiSystem } from '../systems/npc-ai-system';
import { DropSystem } from '../systems/drop-system';
import { GameServer } from '../network/game-server';
import { StateBroadcaster } from '../network/state-broadcaster';
import { MessageHandler } from '../network/message-handler';
import { DatabaseService, PlayerSaveData } from '../db';
import { EntityFactory } from './entity-factory';
import { createMessage } from '../network/protocol';
import { AntiCheatSystem, PlayerState, OperationProof } from '../anticheat';

export class GameEngine {
  private world: World;
  private server: GameServer;
  private broadcaster: StateBroadcaster;
  private messageHandler: MessageHandler;
  private database: DatabaseService;
  private entityFactory: EntityFactory;
  private antiCheat: AntiCheatSystem;

  private battleSystem: BattleSystem;
  private inventorySystem: InventorySystem;
  private movementSystem: MovementSystem;
  private skillSystem: SkillSystem;
  private mapSystem: MapSystem;
  private aoiSystem: AoiSystem;
  private npcAiSystem: NpcAiSystem;
  private dropSystem: DropSystem;

  private playerEntities: Map<string, string> = new Map();
  private entityToPlayer: Map<string, string> = new Map();
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(port: number = 8080, dbPath: string = './data/game.db') {
    this.world = new World();
    this.server = new GameServer(port);
    this.database = new DatabaseService(dbPath);
    this.entityFactory = new EntityFactory(this.world);
    this.antiCheat = new AntiCheatSystem({
      snapshotInterval: 5000,
      maxSnapshots: 1000
    });

    this.battleSystem = new BattleSystem();
    this.inventorySystem = new InventorySystem();
    this.movementSystem = new MovementSystem();
    this.skillSystem = new SkillSystem();
    this.mapSystem = new MapSystem(Date.now() % 100000);
    this.aoiSystem = new AoiSystem();
    this.npcAiSystem = new NpcAiSystem();
    this.dropSystem = new DropSystem();

    this.broadcaster = new StateBroadcaster(
      this.world, this.server, this.aoiSystem, this.mapSystem, this.dropSystem
    );

    this.messageHandler = new MessageHandler(
      this.world, this.server, this.broadcaster,
      this.battleSystem, this.inventorySystem,
      this.movementSystem, this.skillSystem,
      this.mapSystem, this.dropSystem, this.aoiSystem
    );

    this.messageHandler.setAntiCheat(this.antiCheat);
    this.messageHandler.setEntityPlayerMapping(this.entityToPlayer);

    this.antiCheat.setPlayerStateProvider(() => this.collectPlayerStates());

    this.registerSystems();
    this.setupServerEvents();
  }

  private registerSystems(): void {
    this.world.registerSystem(this.movementSystem);
    this.world.registerSystem(this.battleSystem);
    this.world.registerSystem(this.inventorySystem);
    this.world.registerSystem(this.skillSystem);
    this.world.registerSystem(this.mapSystem);
    this.world.registerSystem(this.aoiSystem);
    this.world.registerSystem(this.npcAiSystem);
    this.world.registerSystem(this.dropSystem);

    console.log('[GameEngine] All systems registered');
  }

  private setupServerEvents(): void {
    this.server.on('player_connected', (data: any) => {
      this.handlePlayerConnected(data.sessionId, data.playerId, data.ws);
    });

    this.server.on('player_disconnected', (data: any) => {
      this.handlePlayerDisconnected(data.sessionId, data.playerId, data.entityId);
    });

    this.server.on('message', (data: any) => {
      this.messageHandler.handleMessage(data.connection, data.message);
    });
  }

  private handlePlayerConnected(sessionId: string, playerId: string, ws: any): void {
    const saveData = this.database.loadPlayer(playerId);
    const entityId = this.entityFactory.createPlayerEntity(playerId, saveData?.name || playerId.slice(0, 8), saveData || undefined);

    this.server.registerEntity(sessionId, entityId);
    this.playerEntities.set(playerId, entityId);
    this.entityToPlayer.set(entityId, playerId);

    const genesisHash = this.antiCheat.registerPlayer(playerId);

    const pos = this.world.getComponent<Position>(entityId, POSITION_COMPONENT)!;
    this.aoiSystem.addEntity(entityId, pos.x, pos.y);

    this.mapSystem.ensureChunksLoaded(pos.x, pos.y, 3);

    this.spawnInitialNpcs(pos.x, pos.y);

    this.server.sendToSession(sessionId, createMessage('entity_spawn', {
      entityId,
      position: { x: pos.x, y: pos.y },
      self: true,
      antiCheat: {
        genesisHash,
        publicKey: this.antiCheat.getPublicKey()
      }
    }));

    this.broadcaster.broadcastEntitySpawn(entityId);
    this.broadcaster.syncPlayerState(entityId);

    console.log(`[GameEngine] Player ${playerId} spawned at (${pos.x}, ${pos.y})`);
  }

  private handlePlayerDisconnected(sessionId: string, playerId: string, entityId: string): void {
    if (!entityId) {
      this.playerEntities.delete(playerId);
      this.antiCheat.unregisterPlayer(playerId);
      return;
    }

    this.savePlayerData(playerId, entityId);
    this.antiCheat.unregisterPlayer(playerId);

    this.aoiSystem.removeEntity(entityId);
    this.broadcaster.broadcastEntityDespawn(entityId);

    this.entityFactory.removeEntity(entityId);
    this.playerEntities.delete(playerId);
    this.entityToPlayer.delete(entityId);

    console.log(`[GameEngine] Player ${playerId} disconnected and saved`);
  }

  private spawnInitialNpcs(centerX: number, centerY: number): void {
    const chunkSize = this.mapSystem.getMapGenerator().getChunkSize();
    const centerCX = Math.floor(centerX / chunkSize);
    const centerCY = Math.floor(centerY / chunkSize);

    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const chunk = this.mapSystem.getChunk(centerCX + dx, centerCY + dy);
        if (chunk.hasEntities) {
          for (const entityData of chunk.entities) {
            const npcName = this.getNpcName(entityData.type);
            this.entityFactory.createNpcEntity(
              entityData.type as any,
              npcName,
              entityData.x,
              entityData.y,
              entityData.level
            );

            const createdEntities = this.world.getAllEntities();
            const lastEntity = createdEntities[createdEntities.length - 1];
            const pos = this.world.getComponent<Position>(lastEntity, POSITION_COMPONENT);
            if (pos) {
              this.aoiSystem.addEntity(lastEntity, pos.x, pos.y);
            }
          }
        }
      }
    }
  }

  private getNpcName(type: string): string {
    const names: Record<string, string[]> = {
      hostile: ['哥布林', '骷髅兵', '史莱姆', '兽人', '地精', '蝙蝠', '蜘蛛'],
      boss: ['巨龙', '巫妖', '恶魔领主', '巨型史莱姆王', '死灵法师'],
      merchant: ['旅行商人', '武器商', '药水商', '杂货商'],
      friendly: ['村民', '铁匠', '治疗师'],
      neutral: ['猫', '狗', '兔子']
    };

    const nameList = names[type] || ['未知生物'];
    return nameList[Math.floor(Math.random() * nameList.length)];
  }

  private collectPlayerStates(): PlayerState[] {
    const states: PlayerState[] = [];

    for (const [playerId, entityId] of this.playerEntities) {
      const player = this.world.getComponent<Player>(entityId, PLAYER_COMPONENT);
      const pos = this.world.getComponent<Position>(entityId, POSITION_COMPONENT);
      const health = this.world.getComponent<Health>(entityId, HEALTH_COMPONENT);
      const mana = this.world.getComponent<Mana>(entityId, MANA_COMPONENT);
      const combat = this.world.getComponent<Combat>(entityId, COMBAT_COMPONENT);
      const inventory = this.world.getComponent<Inventory>(entityId, INVENTORY_COMPONENT);
      const skill = this.world.getComponent<Skill>(entityId, SKILL_COMPONENT);

      if (!player || !pos || !health) continue;

      const inventoryHash = this.hashInventory(inventory);
      const skillsHash = this.hashSkills(skill);

      states.push({
        playerId,
        entityId,
        timestamp: Date.now(),
        position: { x: pos.x, y: pos.y },
        health: { current: health.current, max: health.max },
        mana: { current: mana?.current ?? 0, max: mana?.max ?? 0 },
        level: player.level,
        gold: player.gold,
        experience: player.experience,
        attack: combat?.attack ?? 10,
        defense: combat?.defense ?? 5,
        speed: combat?.speed ?? 100,
        inventoryHash,
        skillsHash,
        actionCount: this.antiCheat.getOperationCount(playerId)
      });
    }

    return states;
  }

  private hashInventory(inventory: Inventory | undefined): string {
    if (!inventory) return 'empty';
    const items = inventory.toArray()
      .map(i => `${i.itemId}:${i.quantity}`)
      .sort()
      .join('|');
    return require('crypto').createHash('sha256').update(items).digest('hex');
  }

  private hashSkills(skill: Skill | undefined): string {
    if (!skill) return 'empty';
    const skills = skill.getAvailableSkills()
      .map(s => `${s.skillId}:${s.cooldown}:${s.currentCooldown}`)
      .sort()
      .join('|');
    return require('crypto').createHash('sha256').update(skills).digest('hex');
  }

  recordPlayerOperation(playerId: string, type: any, data: Record<string, any>): OperationProof | null {
    return this.antiCheat.createAndValidateOperation(playerId, type, data);
  }

  private savePlayerData(playerId: string, entityId: string): void {
    const player = this.world.getComponent<Player>(entityId, PLAYER_COMPONENT);
    const pos = this.world.getComponent<Position>(entityId, POSITION_COMPONENT);
    const health = this.world.getComponent<Health>(entityId, HEALTH_COMPONENT);
    const mana = this.world.getComponent<Mana>(entityId, MANA_COMPONENT);
    const combat = this.world.getComponent<Combat>(entityId, COMBAT_COMPONENT);
    const inventory = this.world.getComponent<Inventory>(entityId, INVENTORY_COMPONENT);
    const skill = this.world.getComponent<Skill>(entityId, SKILL_COMPONENT);

    if (!player || !pos || !health) return;

    const saveData: PlayerSaveData = {
      playerId: player.playerId,
      name: player.name,
      level: player.level,
      experience: player.experience,
      gold: player.gold,
      x: pos.x,
      y: pos.y,
      healthCurrent: health.current,
      healthMax: health.max,
      manaCurrent: mana?.current ?? 0,
      manaMax: mana?.max ?? 0,
      attack: combat?.attack ?? 10,
      defense: combat?.defense ?? 5,
      speed: combat?.speed ?? 100,
      critChance: combat?.critChance ?? 0.05,
      critMultiplier: combat?.critMultiplier ?? 1.5,
      inventory: inventory?.toArray().map(i => ({ itemId: i.itemId, quantity: i.quantity })) ?? [],
      skills: skill?.getAvailableSkills().map(s => ({
        skillId: s.skillId,
        name: s.name,
        damage: s.damage,
        cooldown: s.cooldown,
        manaCost: s.manaCost,
        range: s.range,
        description: s.description
      })) ?? [],
      lastLogin: Date.now(),
      partyId: player.partyId
    };

    this.database.savePlayer(saveData);
    console.log(`[GameEngine] Saved player data: ${playerId}`);
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    let lastTime = Date.now();

    this.gameLoopInterval = setInterval(() => {
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      this.world.update(deltaTime);
      this.broadcaster.syncAllPlayers();
    }, 100);

    this.autoSaveInterval = setInterval(() => {
      this.autoSaveAllPlayers();
    }, 60000);

    this.broadcaster.start();
    this.antiCheat.start();

    console.log('[GameEngine] Game engine started');
    console.log(`[GameEngine] World initialized with ${this.world.getEntitiesCount()} entities and ${this.world.getSystemsCount()} systems`);
    console.log(`[GameEngine] Anti-cheat system active, snapshot interval: ${this.antiCheat.snapshotManager.getInterval()}ms`);
  }

  private autoSaveAllPlayers(): void {
    for (const [playerId, entityId] of this.playerEntities) {
      try {
        this.savePlayerData(playerId, entityId);
      } catch (err) {
        console.error(`[GameEngine] Failed to save player ${playerId}:`, err);
      }
    }
  }

  stop(): void {
    this.isRunning = false;

    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }

    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    this.antiCheat.stop();
    this.autoSaveAllPlayers();
    this.server.shutdown();
    this.database.close();

    console.log('[GameEngine] Game engine stopped');
  }

  getWorld(): World {
    return this.world;
  }

  getServer(): GameServer {
    return this.server;
  }

  getDatabase(): DatabaseService {
    return this.database;
  }

  getEntityFactory(): EntityFactory {
    return this.entityFactory;
  }

  getPlayerCount(): number {
    return this.playerEntities.size;
  }

  getEntityCount(): number {
    return this.world.getEntitiesCount();
  }

  getAntiCheat(): AntiCheatSystem {
    return this.antiCheat;
  }

  getPlayerRiskScore(playerId: string): number {
    return this.antiCheat.getPlayerRiskScore(playerId);
  }

  getSuspiciousPlayers(): { playerId: string; riskScore: number }[] {
    return this.antiCheat.getSuspiciousPlayers();
  }

  runPlayerVerification(playerId: string, startTime: number, endTime: number): any {
    return this.antiCheat.runRollbackVerification({
      playerId,
      startTime,
      endTime,
      reason: 'manual_verification',
      requestedBy: 'admin'
    });
  }
}
