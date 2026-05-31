import { System } from '../ecs';
import { Health, HEALTH_COMPONENT, Combat, COMBAT_COMPONENT, Skill, SKILL_COMPONENT, Mana, MANA_COMPONENT, Position, POSITION_COMPONENT, Player, PLAYER_COMPONENT, Npc, NPC_COMPONENT } from '../components';

export interface BattleInstance {
  id: string;
  participants: string[];
  allies: string[];
  enemies: string[];
  currentTurn: number;
  activeEntityId: string | null;
  turnOrder: string[];
  round: number;
  isFinished: boolean;
  winner: 'allies' | 'enemies' | null;
  startedAt: number;
  lastActionAt: number;
  log: BattleLogEntry[];
  skillChain: SkillChainContext;
}

export interface SkillChainContext {
  callStack: SkillChainFrame[];
  maxDepth: number;
  visitedPairs: Set<string>;
  isProcessing: boolean;
}

export interface SkillChainFrame {
  actorId: string;
  targetId: string;
  actionType: 'attack' | 'skill' | 'counter';
  skillId?: string;
  timestamp: number;
}

export interface BattleLogEntry {
  round: number;
  actorId: string;
  actionType: 'attack' | 'skill' | 'defend' | 'flee' | 'dead' | 'counter';
  targetId?: string;
  skillId?: string;
  damage?: number;
  isCrit?: boolean;
  message: string;
}

export class BattleSystem extends System {
  readonly name = 'BattleSystem';
  readonly requiredComponents = [COMBAT_COMPONENT, HEALTH_COMPONENT];

  private battles: Map<string, BattleInstance> = new Map();
  private entityToBattle: Map<string, string> = new Map();
  private readonly MAX_SKILL_CHAIN_DEPTH = 3;
  private readonly COUNTER_ATTACK_CHANCE = 0.1;

  private getPairKey(a: string, b: string): string {
    return `${a}:${b}`;
  }

  private checkAndPushSkillFrame(
    battle: BattleInstance,
    actorId: string,
    targetId: string,
    actionType: 'attack' | 'skill' | 'counter',
    skillId?: string
  ): { allowed: boolean; reason?: string } {
    const chain = battle.skillChain;

    if (chain.callStack.length >= chain.maxDepth) {
      return {
        allowed: false,
        reason: `技能链深度已达上限 (${chain.maxDepth})，防止无限循环`
      };
    }

    const pairKey = this.getPairKey(actorId, targetId);
    if (chain.visitedPairs.has(pairKey)) {
      return {
        allowed: false,
        reason: `检测到循环调用: ${actorId} -> ${targetId}，已在当前技能链中执行过`
      };
    }

    const reversePairKey = this.getPairKey(targetId, actorId);
    const reverseVisitCount = Array.from(chain.visitedPairs).filter(
      k => k === reversePairKey || k === pairKey
    ).length;
    if (reverseVisitCount >= 2) {
      return {
        allowed: false,
        reason: `检测到双向循环: ${actorId} <-> ${targetId}，已超过2次交互`
      };
    }

    chain.visitedPairs.add(pairKey);
    chain.callStack.push({
      actorId,
      targetId,
      actionType,
      skillId,
      timestamp: Date.now()
    });
    chain.isProcessing = true;

    return { allowed: true };
  }

  private popSkillFrame(battle: BattleInstance): void {
    const frame = battle.skillChain.callStack.pop();
    if (battle.skillChain.callStack.length === 0) {
      battle.skillChain.isProcessing = false;
      battle.skillChain.visitedPairs.clear();
    }
  }

  startBattle(allyIds: string[], enemyIds: string[]): BattleInstance | null {
    const allEntities = [...allyIds, ...enemyIds];

    for (const id of allEntities) {
      const combat = this.world.getComponent<Combat>(id, COMBAT_COMPONENT);
      if (!combat || combat.isInBattle) return null;
    }

    const battleId = `battle_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    for (const id of allEntities) {
      const combat = this.world.getComponent<Combat>(id, COMBAT_COMPONENT)!;
      combat.isInBattle = true;
      combat.hasActed = false;
      this.entityToBattle.set(id, battleId);
    }

    const turnOrder = this.calculateTurnOrder(allEntities);

    const battle: BattleInstance = {
      id: battleId,
      participants: allEntities,
      allies: [...allyIds],
      enemies: [...enemyIds],
      currentTurn: 0,
      activeEntityId: turnOrder.length > 0 ? turnOrder[0] : null,
      turnOrder,
      round: 1,
      isFinished: false,
      winner: null,
      startedAt: Date.now(),
      lastActionAt: Date.now(),
      log: [],
      skillChain: {
        callStack: [],
        maxDepth: this.MAX_SKILL_CHAIN_DEPTH,
        visitedPairs: new Set<string>(),
        isProcessing: false
      }
    };

    this.battles.set(battleId, battle);
    this.addLogEntry(battle, {
      round: 1,
      actorId: 'system',
      actionType: 'attack',
      message: '战斗开始！'
    });

    return battle;
  }

  private calculateTurnOrder(entities: string[]): string[] {
    const speeds: { id: string; speed: number }[] = entities.map(id => {
      const combat = this.world.getComponent<Combat>(id, COMBAT_COMPONENT)!;
      return { id, speed: combat.speed + Math.random() * 10 };
    });
    speeds.sort((a, b) => b.speed - a.speed);
    return speeds.map(s => s.id);
  }

  private tryTriggerCounterAttack(battle: BattleInstance, targetId: string, attackerId: string): void {
    const targetCombat = this.world.getComponent<Combat>(targetId, COMBAT_COMPONENT);
    const attackerHealth = this.world.getComponent<Health>(attackerId, HEALTH_COMPONENT);
    const attackerCombat = this.world.getComponent<Combat>(attackerId, COMBAT_COMPONENT);

    if (!targetCombat || !attackerHealth || !attackerCombat) return;
    if (attackerHealth.isDead) return;

    const counterChance = this.COUNTER_ATTACK_CHANCE + (targetCombat.speed - attackerCombat.speed) / 1000;
    if (Math.random() > Math.min(0.5, Math.max(0, counterChance))) return;

    const check = this.checkAndPushSkillFrame(battle, targetId, attackerId, 'counter');
    if (!check.allowed) {
      if (check.reason) {
        this.addLogEntry(battle, {
          round: battle.round,
          actorId: 'system',
          actionType: 'attack',
          message: `[技能链中断] ${check.reason}`
        });
      }
      return;
    }

    try {
      const isCrit = targetCombat.rollCrit();
      const rawDamage = targetCombat.calculateDamage(isCrit) * 0.5;
      const damage = Math.max(1, Math.floor(rawDamage - attackerCombat.defense * 0.5));
      const result = attackerHealth.takeDamage(damage);

      const targetName = this.getEntityName(targetId);
      const attackerName = this.getEntityName(attackerId);

      this.addLogEntry(battle, {
        round: battle.round,
        actorId: targetId,
        actionType: 'attack',
        targetId: attackerId,
        damage: result.actualDamage,
        isCrit,
        message: `⚡ ${targetName} 发动反击${isCrit ? '（暴击！）' : ''}，对 ${attackerName} 造成 ${result.actualDamage} 点伤害${result.isDead ? '，击败了对方！' : ''}`
      });

      if (result.isDead) {
        this.handleEntityDeath(battle, attackerId);
      } else {
        this.tryTriggerCounterAttack(battle, attackerId, targetId);
      }
    } finally {
      this.popSkillFrame(battle);
    }
  }

  performAttack(attackerId: string, targetId: string): BattleLogEntry | null {
    const battle = this.getEntityBattle(attackerId);
    if (!battle || battle.isFinished) return null;
    if (battle.activeEntityId !== attackerId && !battle.skillChain.isProcessing) return null;

    const attackerCombat = this.world.getComponent<Combat>(attackerId, COMBAT_COMPONENT);
    const targetHealth = this.world.getComponent<Health>(targetId, HEALTH_COMPONENT);
    const targetCombat = this.world.getComponent<Combat>(targetId, COMBAT_COMPONENT);
    if (!attackerCombat || !targetHealth || !targetCombat) return null;

    if (!battle.skillChain.isProcessing) {
      const check = this.checkAndPushSkillFrame(battle, attackerId, targetId, 'attack');
      if (!check.allowed) {
        if (check.reason) {
          this.addLogEntry(battle, {
            round: battle.round,
            actorId: 'system',
            actionType: 'attack',
            message: `[技能链中断] ${check.reason}`
          });
        }
        return null;
      }
    }

    try {
      const isCrit = attackerCombat.rollCrit();
      const rawDamage = attackerCombat.calculateDamage(isCrit);
      const damage = Math.max(1, rawDamage - targetCombat.defense);
      const result = targetHealth.takeDamage(damage);

      const attackerName = this.getEntityName(attackerId);
      const targetName = this.getEntityName(targetId);

      const entry: BattleLogEntry = {
        round: battle.round,
        actorId: attackerId,
        actionType: 'attack',
        targetId,
        damage: result.actualDamage,
        isCrit,
        message: `${attackerName} ${isCrit ? '暴击' : '攻击'} ${targetName}，造成 ${result.actualDamage} 点伤害${result.isDead ? '，击败了对方！' : ''}`
      };

      this.addLogEntry(battle, entry);

      if (result.isDead) {
        this.handleEntityDeath(battle, targetId);
      } else {
        this.tryTriggerCounterAttack(battle, targetId, attackerId);
      }

      if (!battle.skillChain.isProcessing || battle.skillChain.callStack.length <= 1) {
        this.endTurn(battle);
      }

      return entry;
    } finally {
      if (battle.skillChain.callStack.length > 0 && battle.skillChain.callStack[battle.skillChain.callStack.length - 1].actorId === attackerId) {
        this.popSkillFrame(battle);
      }
    }
  }

  performSkill(attackerId: string, skillId: string, targetId: string): BattleLogEntry | null {
    const battle = this.getEntityBattle(attackerId);
    if (!battle || battle.isFinished) return null;
    if (battle.activeEntityId !== attackerId && !battle.skillChain.isProcessing) return null;

    const skill = this.world.getComponent<Skill>(attackerId, SKILL_COMPONENT);
    const mana = this.world.getComponent<Mana>(attackerId, MANA_COMPONENT);
    const targetHealth = this.world.getComponent<Health>(targetId, HEALTH_COMPONENT);
    if (!skill || !targetHealth) return null;

    const skillData = skill.getSkill(skillId);
    if (!skillData || skillData.currentCooldown > 0) return null;
    if (mana && !mana.spend(skillData.manaCost)) return null;

    skill.useSkill(skillId);

    if (!battle.skillChain.isProcessing) {
      const check = this.checkAndPushSkillFrame(battle, attackerId, targetId, 'skill', skillId);
      if (!check.allowed) {
        if (check.reason) {
          this.addLogEntry(battle, {
            round: battle.round,
            actorId: 'system',
            actionType: 'skill',
            message: `[技能链中断] ${check.reason}`
          });
        }
        return null;
      }
    }

    try {
      const isCrit = Math.random() < 0.15;
      const damage = Math.max(1, Math.floor(skillData.damage * (isCrit ? 1.5 : 1)));
      const result = targetHealth.takeDamage(damage);

      const attackerName = this.getEntityName(attackerId);
      const targetName = this.getEntityName(targetId);

      const entry: BattleLogEntry = {
        round: battle.round,
        actorId: attackerId,
        actionType: 'skill',
        targetId,
        skillId,
        damage: result.actualDamage,
        isCrit,
        message: `${attackerName} 使用 ${skillData.name}${isCrit ? '（暴击！）' : ''} 对 ${targetName} 造成 ${result.actualDamage} 点伤害${result.isDead ? '，击败了对方！' : ''}`
      };

      this.addLogEntry(battle, entry);

      if (result.isDead) {
        this.handleEntityDeath(battle, targetId);
      } else {
        this.tryTriggerCounterAttack(battle, targetId, attackerId);
      }

      if (!battle.skillChain.isProcessing || battle.skillChain.callStack.length <= 1) {
        this.endTurn(battle);
      }

      return entry;
    } finally {
      if (battle.skillChain.callStack.length > 0 && battle.skillChain.callStack[battle.skillChain.callStack.length - 1].actorId === attackerId) {
        this.popSkillFrame(battle);
      }
    }
  }

  performDefend(entityId: string): BattleLogEntry | null {
    const battle = this.getEntityBattle(entityId);
    if (!battle || battle.isFinished) return null;
    if (battle.activeEntityId !== entityId) return null;

    const combat = this.world.getComponent<Combat>(entityId, COMBAT_COMPONENT);
    if (!combat) return null;

    combat.defense = Math.floor(combat.defense * 1.5);

    const entityName = this.getEntityName(entityId);
    const entry: BattleLogEntry = {
      round: battle.round,
      actorId: entityId,
      actionType: 'defend',
      message: `${entityName} 进入防御姿态，防御力提升！`
    };

    this.addLogEntry(battle, entry);
    this.endTurn(battle);
    return entry;
  }

  attemptFlee(entityId: string): BattleLogEntry | null {
    const battle = this.getEntityBattle(entityId);
    if (!battle || battle.isFinished) return null;

    const success = Math.random() < 0.5;
    const entityName = this.getEntityName(entityId);

    if (success) {
      this.removeEntityFromBattle(battle, entityId);
      const entry: BattleLogEntry = {
        round: battle.round,
        actorId: entityId,
        actionType: 'flee',
        message: `${entityName} 成功逃离了战斗！`
      };
      this.addLogEntry(battle, entry);
      this.checkBattleEnd(battle);
      if (!battle.isFinished) {
        this.endTurn(battle);
      }
      return entry;
    } else {
      const entry: BattleLogEntry = {
        round: battle.round,
        actorId: entityId,
        actionType: 'flee',
        message: `${entityName} 逃跑失败！`
      };
      this.addLogEntry(battle, entry);
      this.endTurn(battle);
      return entry;
    }
  }

  private endTurn(battle: BattleInstance): void {
    const currentIndex = battle.turnOrder.indexOf(battle.activeEntityId!);
    const aliveParticipants = battle.turnOrder.filter(id => {
      const health = this.world.getComponent<Health>(id, HEALTH_COMPONENT);
      return health && !health.isDead;
    });

    let nextIndex = currentIndex + 1;
    let foundNext = false;

    while (nextIndex < battle.turnOrder.length && !foundNext) {
      const candidate = battle.turnOrder[nextIndex];
      if (aliveParticipants.includes(candidate)) {
        battle.activeEntityId = candidate;
        foundNext = true;
      } else {
        nextIndex++;
      }
    }

    if (!foundNext) {
      battle.round++;
      battle.activeEntityId = aliveParticipants.length > 0 ? aliveParticipants[0] : null;
    }

    battle.currentTurn++;
    battle.lastActionAt = Date.now();

    for (const entityId of battle.participants) {
      const skill = this.world.getComponent<Skill>(entityId, SKILL_COMPONENT);
      if (skill) skill.tickCooldowns(1);
      const mana = this.world.getComponent<Mana>(entityId, MANA_COMPONENT);
      if (mana) mana.regen(1);
    }

    this.checkBattleEnd(battle);
  }

  private handleEntityDeath(battle: BattleInstance, entityId: string): void {
    const entityName = this.getEntityName(entityId);
    this.addLogEntry(battle, {
      round: battle.round,
      actorId: 'system',
      actionType: 'dead',
      message: `${entityName} 被击败了！`
    });
    this.checkBattleEnd(battle);
  }

  private removeEntityFromBattle(battle: BattleInstance, entityId: string): void {
    const combat = this.world.getComponent<Combat>(entityId, COMBAT_COMPONENT);
    if (combat) combat.resetForNewBattle();
    this.entityToBattle.delete(entityId);
    battle.participants = battle.participants.filter(id => id !== entityId);
    battle.allies = battle.allies.filter(id => id !== entityId);
    battle.enemies = battle.enemies.filter(id => id !== entityId);
    battle.turnOrder = battle.turnOrder.filter(id => id !== entityId);
  }

  private checkBattleEnd(battle: BattleInstance): void {
    const aliveAllies = battle.allies.filter(id => {
      const health = this.world.getComponent<Health>(id, HEALTH_COMPONENT);
      return health && !health.isDead;
    });
    const aliveEnemies = battle.enemies.filter(id => {
      const health = this.world.getComponent<Health>(id, HEALTH_COMPONENT);
      return health && !health.isDead;
    });

    if (aliveAllies.length === 0) {
      battle.isFinished = true;
      battle.winner = 'enemies';
      this.endBattle(battle);
    } else if (aliveEnemies.length === 0) {
      battle.isFinished = true;
      battle.winner = 'allies';
      this.endBattle(battle);
    }
  }

  private endBattle(battle: BattleInstance): void {
    for (const entityId of battle.participants) {
      const combat = this.world.getComponent<Combat>(entityId, COMBAT_COMPONENT);
      if (combat) combat.resetForNewBattle();
      this.entityToBattle.delete(entityId);
    }
    this.battles.delete(battle.id);
  }

  private addLogEntry(battle: BattleInstance, entry: BattleLogEntry): void {
    battle.log.push(entry);
    if (battle.log.length > 100) {
      battle.log.shift();
    }
  }

  getEntityBattle(entityId: string): BattleInstance | undefined {
    const battleId = this.entityToBattle.get(entityId);
    return battleId ? this.battles.get(battleId) : undefined;
  }

  getBattle(battleId: string): BattleInstance | undefined {
    return this.battles.get(battleId);
  }

  getActiveBattleCount(): number {
    return this.battles.size;
  }

  getSkillChainDepth(entityId: string): number {
    const battle = this.getEntityBattle(entityId);
    return battle ? battle.skillChain.callStack.length : 0;
  }

  isSkillChainProcessing(entityId: string): boolean {
    const battle = this.getEntityBattle(entityId);
    return battle ? battle.skillChain.isProcessing : false;
  }

  getMaxSkillChainDepth(): number {
    return this.MAX_SKILL_CHAIN_DEPTH;
  }

  private getEntityName(entityId: string): string {
    const player = this.world.getComponent<Player>(entityId, PLAYER_COMPONENT);
    if (player) return player.name;
    const npc = this.world.getComponent<Npc>(entityId, NPC_COMPONENT);
    if (npc) return npc.npcName;
    return entityId;
  }

  update(deltaTime: number): void {
    const now = Date.now();
    const timeout = 30000;

    for (const [battleId, battle] of this.battles) {
      if (now - battle.lastActionAt > timeout && !battle.isFinished) {
        this.addLogEntry(battle, {
          round: battle.round,
          actorId: 'system',
          actionType: 'attack',
          message: '战斗超时，自动结束！'
        });
        battle.isFinished = true;
        battle.winner = null;
        this.endBattle(battle);
      }
    }
  }
}
