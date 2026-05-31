import { PlayerState, Snapshot } from './snapshot-manager';
import { Operation } from './hash-chain';

export interface CheatDetectionRule {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  check: (
    currentState: PlayerState,
    previousState: PlayerState | null,
    operations: Operation[],
    timeDelta: number
  ) => DetectionResult | null;
}

export interface DetectionResult {
  ruleId: string;
  playerId: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  details: Record<string, any>;
  evidence: {
    snapshotIds: string[];
    operationIds: string[];
    expectedValues: Record<string, any>;
    actualValues: Record<string, any>;
  };
}

export interface DetectionSummary {
  playerId: string;
  detections: DetectionResult[];
  riskScore: number;
  isSuspicious: boolean;
  recommendedAction: 'none' | 'warn' | 'kick' | 'ban' | 'investigate';
}

export class CheatDetector {
  private rules: Map<string, CheatDetectionRule> = new Map();
  private detectionHistory: Map<string, DetectionResult[]> = new Map();
  private maxHistoryPerPlayer: number = 100;

  constructor() {
    this.registerDefaultRules();
  }

  private registerDefaultRules(): void {
    this.registerRule({
      id: 'speed_hack',
      name: '移动速度异常',
      description: '检测玩家移动速度超过正常范围',
      severity: 'high',
      check: (current, previous, ops, delta) => {
        if (!previous || delta <= 0) return null;

        const dx = current.position.x - previous.position.x;
        const dy = current.position.y - previous.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = distance / (delta / 1000);
        const maxAllowedSpeed = 10;

        if (speed > maxAllowedSpeed) {
          return {
            ruleId: 'speed_hack',
            playerId: current.playerId,
            timestamp: Date.now(),
            severity: 'high',
            confidence: Math.min(100, (speed / maxAllowedSpeed - 1) * 100),
            details: { speed, maxAllowedSpeed, distance, timeSeconds: delta / 1000 },
            evidence: {
              snapshotIds: [],
              operationIds: [],
              expectedValues: { maxSpeed: maxAllowedSpeed },
              actualValues: { speed }
            }
          };
        }
        return null;
      }
    });

    this.registerRule({
      id: 'teleport',
      name: '瞬移检测',
      description: '检测玩家瞬间移动过大距离',
      severity: 'critical',
      check: (current, previous, ops, delta) => {
        if (!previous) return null;

        const dx = current.position.x - previous.position.x;
        const dy = current.position.y - previous.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const teleportThreshold = 20;

        if (distance > teleportThreshold) {
          return {
            ruleId: 'teleport',
            playerId: current.playerId,
            timestamp: Date.now(),
            severity: 'critical',
            confidence: 95,
            details: {
              distance,
              from: { x: previous.position.x, y: previous.position.y },
              to: { x: current.position.x, y: current.position.y }
            },
            evidence: {
              snapshotIds: [],
              operationIds: [],
              expectedValues: { maxDistance: teleportThreshold },
              actualValues: { distance }
            }
          };
        }
        return null;
      }
    });

    this.registerRule({
      id: 'damage_modification',
      name: '伤害修改',
      description: '检测玩家输出伤害超出正常范围',
      severity: 'critical',
      check: (current, previous, ops, delta) => {
        const attackOps = ops.filter(o => o.type === 'attack' || o.type === 'skill');
        if (attackOps.length === 0) return null;

        let totalDamage = 0;
        let expectedMaxDamage = 0;

        for (const op of attackOps) {
          const damage = op.data.damage || 0;
          totalDamage += damage;

          const baseDamage = current.attack;
          const maxMultiplier = 2.0;
          expectedMaxDamage += baseDamage * maxMultiplier;
        }

        if (totalDamage > expectedMaxDamage * 1.5) {
          return {
            ruleId: 'damage_modification',
            playerId: current.playerId,
            timestamp: Date.now(),
            severity: 'critical',
            confidence: 85,
            details: { totalDamage, expectedMaxDamage, attackCount: attackOps.length },
            evidence: {
              snapshotIds: [],
              operationIds: attackOps.map(o => o.id),
              expectedValues: { maxDamage: expectedMaxDamage },
              actualValues: { totalDamage }
            }
          };
        }
        return null;
      }
    });

    this.registerRule({
      id: 'health_regen_hack',
      name: '生命值异常恢复',
      description: '检测玩家生命值恢复速度异常',
      severity: 'high',
      check: (current, previous, ops, delta) => {
        if (!previous) return null;

        const healthIncrease = current.health.current - previous.health.current;
        const maxNormalRegen = 5;

        const healOps = ops.filter(o => o.type === 'skill' && o.data.isHeal);
        const expectedHeal = healOps.reduce((sum, op) => sum + (op.data.healAmount || 0), 0);

        if (healthIncrease > expectedHeal + maxNormalRegen) {
          return {
            ruleId: 'health_regen_hack',
            playerId: current.playerId,
            timestamp: Date.now(),
            severity: 'high',
            confidence: 80,
            details: { healthIncrease, expectedHeal, maxNormalRegen },
            evidence: {
              snapshotIds: [],
              operationIds: healOps.map(o => o.id),
              expectedValues: { maxHeal: expectedHeal + maxNormalRegen },
              actualValues: { healthIncrease }
            }
          };
        }
        return null;
      }
    });

    this.registerRule({
      id: 'stat_modification',
      name: '属性修改',
      description: '检测玩家属性值异常变化',
      severity: 'critical',
      check: (current, previous, ops, delta) => {
        if (!previous) return null;

        const anomalies: string[] = [];
        const expected: Record<string, any> = {};
        const actual: Record<string, any> = {};

        const maxStatChange = 50;

        if (Math.abs(current.attack - previous.attack) > maxStatChange) {
          anomalies.push('attack');
          expected.attack = previous.attack;
          actual.attack = current.attack;
        }

        if (Math.abs(current.defense - previous.defense) > maxStatChange) {
          anomalies.push('defense');
          expected.defense = previous.defense;
          actual.defense = current.defense;
        }

        if (current.level < previous.level) {
          anomalies.push('level_decrease');
          expected.level = previous.level;
          actual.level = current.level;
        }

        if (current.gold < previous.gold && !ops.some(o => o.type === 'trade')) {
          anomalies.push('gold_manipulation');
          expected.gold = previous.gold;
          actual.gold = current.gold;
        }

        if (anomalies.length > 0) {
          return {
            ruleId: 'stat_modification',
            playerId: current.playerId,
            timestamp: Date.now(),
            severity: 'critical',
            confidence: 90,
            details: { anomalies },
            evidence: {
              snapshotIds: [],
              operationIds: [],
              expectedValues: expected,
              actualValues: actual
            }
          };
        }
        return null;
      }
    });

    this.registerRule({
      id: 'action_spam',
      name: '操作频率异常',
      description: '检测玩家操作频率超过人类极限',
      severity: 'medium',
      check: (current, previous, ops, delta) => {
        const actionsPerSecond = ops.length / (delta / 1000);
        const maxNormalRate = 10;

        if (actionsPerSecond > maxNormalRate) {
          return {
            ruleId: 'action_spam',
            playerId: current.playerId,
            timestamp: Date.now(),
            severity: 'medium',
            confidence: Math.min(90, (actionsPerSecond / maxNormalRate - 1) * 50 + 50),
            details: { actionsPerSecond, actionCount: ops.length, timeSeconds: delta / 1000 },
            evidence: {
              snapshotIds: [],
              operationIds: ops.map(o => o.id),
              expectedValues: { maxRate: maxNormalRate },
              actualValues: { rate: actionsPerSecond }
            }
          };
        }
        return null;
      }
    });

    this.registerRule({
      id: 'no_clip',
      name: '穿墙检测',
      description: '检测玩家穿过不可通行区域',
      severity: 'high',
      check: (current, previous, ops, delta) => {
        if (!previous) return null;

        const isClipping = ops.some(o => o.data.passable === false && o.data.moved === true);

        if (isClipping) {
          return {
            ruleId: 'no_clip',
            playerId: current.playerId,
            timestamp: Date.now(),
            severity: 'high',
            confidence: 95,
            details: {},
            evidence: {
              snapshotIds: [],
              operationIds: ops.filter(o => o.data.passable === false).map(o => o.id),
              expectedValues: { passable: true },
              actualValues: { passable: false }
            }
          };
        }
        return null;
      }
    });

    this.registerRule({
      id: 'inventory_duplication',
      name: '物品复制',
      description: '检测物品数量异常增加',
      severity: 'critical',
      check: (current, previous, ops, delta) => {
        if (!previous) return null;

        const inventoryHashChanged = current.inventoryHash !== previous.inventoryHash;
        if (!inventoryHashChanged) return null;

        const pickupOps = ops.filter(o => o.type === 'pickup' || o.type === 'trade');
        const expectedAdditions = pickupOps.length;

        if (expectedAdditions === 0 && inventoryHashChanged) {
          return {
            ruleId: 'inventory_duplication',
            playerId: current.playerId,
            timestamp: Date.now(),
            severity: 'critical',
            confidence: 70,
            details: { inventoryHashChanged, expectedAdditions },
            evidence: {
              snapshotIds: [],
              operationIds: [],
              expectedValues: { additions: expectedAdditions },
              actualValues: { hashChanged: inventoryHashChanged }
            }
          };
        }
        return null;
      }
    });
  }

  registerRule(rule: CheatDetectionRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  getRule(ruleId: string): CheatDetectionRule | undefined {
    return this.rules.get(ruleId);
  }

  getAllRules(): CheatDetectionRule[] {
    return Array.from(this.rules.values());
  }

  detect(
    currentState: PlayerState,
    previousState: PlayerState | null,
    operations: Operation[],
    timeDelta: number
  ): DetectionResult[] {
    const results: DetectionResult[] = [];

    for (const rule of this.rules.values()) {
      try {
        const result = rule.check(currentState, previousState, operations, timeDelta);
        if (result) {
          results.push(result);
          this.addToHistory(currentState.playerId, result);
        }
      } catch (err) {
        console.error(`[CheatDetector] Rule ${rule.id} execution error:`, err);
      }
    }

    return results;
  }

  private addToHistory(playerId: string, result: DetectionResult): void {
    if (!this.detectionHistory.has(playerId)) {
      this.detectionHistory.set(playerId, []);
    }

    const history = this.detectionHistory.get(playerId)!;
    history.push(result);

    while (history.length > this.maxHistoryPerPlayer) {
      history.shift();
    }
  }

  getPlayerHistory(playerId: string): DetectionResult[] {
    return this.detectionHistory.get(playerId) || [];
  }

  calculateRiskScore(playerId: string): number {
    const history = this.detectionHistory.get(playerId);
    if (!history || history.length === 0) return 0;

    const severityWeights: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 5,
      critical: 10
    };

    const recentDetections = history.filter(d => Date.now() - d.timestamp < 3600000);
    let score = 0;

    for (const detection of recentDetections) {
      score += severityWeights[detection.severity] * (detection.confidence / 100);
    }

    return Math.min(100, score);
  }

  assessPlayer(playerId: string): DetectionSummary {
    const history = this.detectionHistory.get(playerId) || [];
    const riskScore = this.calculateRiskScore(playerId);

    let recommendedAction: 'none' | 'warn' | 'kick' | 'ban' | 'investigate' = 'none';

    if (riskScore >= 80) {
      recommendedAction = 'ban';
    } else if (riskScore >= 50) {
      recommendedAction = 'kick';
    } else if (riskScore >= 25) {
      recommendedAction = 'warn';
    } else if (history.some(d => d.severity === 'critical')) {
      recommendedAction = 'investigate';
    }

    return {
      playerId,
      detections: history,
      riskScore,
      isSuspicious: riskScore >= 25 || history.some(d => d.severity === 'critical'),
      recommendedAction
    };
  }

  clearHistory(playerId?: string): void {
    if (playerId) {
      this.detectionHistory.delete(playerId);
    } else {
      this.detectionHistory.clear();
    }
  }

  getSuspiciousPlayers(threshold: number = 25): { playerId: string; riskScore: number }[] {
    const result: { playerId: string; riskScore: number }[] = [];

    for (const playerId of this.detectionHistory.keys()) {
      const score = this.calculateRiskScore(playerId);
      if (score >= threshold) {
        result.push({ playerId, riskScore: score });
      }
    }

    return result.sort((a, b) => b.riskScore - a.riskScore);
  }
}
