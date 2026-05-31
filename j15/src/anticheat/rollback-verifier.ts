import { SnapshotManager, Snapshot, PlayerState } from './snapshot-manager';
import { HashChain, Operation, ChainProof } from './hash-chain';
import { CheatDetector, DetectionResult } from './cheat-detector';
import * as crypto from 'crypto';

export interface RollbackVerificationRequest {
  playerId: string;
  startTime: number;
  endTime: number;
  reason: string;
  requestedBy: string;
}

export interface RollbackVerificationResult {
  requestId: string;
  playerId: string;
  startTime: number;
  endTime: number;
  isLegitimate: boolean;
  detections: DetectionResult[];
  snapshotsVerified: number;
  operationsVerified: number;
  chainProof?: ChainProof;
  integrityScore: number;
  summary: string;
  executedAt: number;
}

export interface StateTransition {
  fromState: PlayerState;
  toState: PlayerState;
  operations: Operation[];
  isValid: boolean;
  violations: string[];
}

export class RollbackVerifier {
  private snapshotManager: SnapshotManager;
  private hashChain: HashChain;
  private cheatDetector: CheatDetector;
  private verificationHistory: RollbackVerificationResult[] = [];

  constructor(
    snapshotManager: SnapshotManager,
    hashChain: HashChain,
    cheatDetector: CheatDetector
  ) {
    this.snapshotManager = snapshotManager;
    this.hashChain = hashChain;
    this.cheatDetector = cheatDetector;
  }

  verifyPlayer(request: RollbackVerificationRequest): RollbackVerificationResult {
    const requestId = crypto.randomUUID();

    const startSnapshot = this.snapshotManager.getSnapshotByTime(request.startTime);
    const endSnapshot = this.snapshotManager.getSnapshotByTime(request.endTime);

    if (!startSnapshot || !endSnapshot) {
      return {
        requestId,
        playerId: request.playerId,
        startTime: request.startTime,
        endTime: request.endTime,
        isLegitimate: false,
        detections: [],
        snapshotsVerified: 0,
        operationsVerified: 0,
        integrityScore: 0,
        summary: '快照数据不足，无法进行验证',
        executedAt: Date.now()
      };
    }

    const snapshots = this.snapshotManager.getSnapshotRange(
      startSnapshot.sequenceNumber,
      endSnapshot.sequenceNumber + 1
    );

    const allDetections: DetectionResult[] = [];
    let validTransitions = 0;
    let totalTransitions = 0;
    let operationsVerified = 0;

    for (let i = 0; i < snapshots.length - 1; i++) {
      const fromSnap = snapshots[i];
      const toSnap = snapshots[i + 1];

      const transition = this.verifyStateTransition(
        request.playerId,
        fromSnap,
        toSnap
      );

      if (!transition.isValid) {
        const detections = this.cheatDetector.detect(
          transition.toState,
          transition.fromState,
          transition.operations,
          toSnap.timestamp - fromSnap.timestamp
        );
        allDetections.push(...detections);
      } else {
        validTransitions++;
      }

      totalTransitions++;
      operationsVerified += transition.operations.length;
    }

    const chainValid = this.hashChain.verifyChainIntegrity(
      request.playerId,
      1
    );

    const chainProofResult = this.hashChain.getChainProof(
      request.playerId,
      1,
      this.hashChain.getLatestSequence(request.playerId)
    );
    const chainProof = chainProofResult ?? undefined;

    const integrityScore = this.calculateIntegrityScore(
      allDetections,
      validTransitions,
      totalTransitions,
      chainValid
    );

    const isLegitimate = allDetections.length === 0 && chainValid;

    const result: RollbackVerificationResult = {
      requestId,
      playerId: request.playerId,
      startTime: request.startTime,
      endTime: request.endTime,
      isLegitimate,
      detections: allDetections,
      snapshotsVerified: snapshots.length,
      operationsVerified,
      chainProof,
      integrityScore,
      summary: this.generateSummary(allDetections, chainValid, integrityScore),
      executedAt: Date.now()
    };

    this.verificationHistory.push(result);
    return result;
  }

  private verifyStateTransition(
    playerId: string,
    fromSnapshot: Snapshot,
    toSnapshot: Snapshot
  ): StateTransition {
    const fromState = fromSnapshot.playerStates.get(playerId);
    const toState = toSnapshot.playerStates.get(playerId);

    if (!fromState || !toState) {
      return {
        fromState: fromState || toState!,
        toState: toState || fromState!,
        operations: [],
        isValid: false,
        violations: ['玩家状态数据缺失']
      };
    }

    const operations = this.hashChain.getOperations(playerId).filter(op =>
      op.timestamp >= fromSnapshot.timestamp &&
      op.timestamp <= toSnapshot.timestamp
    );

    const violations = this.validateStateChanges(fromState, toState, operations);

    return {
      fromState,
      toState,
      operations,
      isValid: violations.length === 0,
      violations
    };
  }

  private validateStateChanges(
    fromState: PlayerState,
    toState: PlayerState,
    operations: Operation[]
  ): string[] {
    const violations: string[] = [];

    const dx = toState.position.x - fromState.position.x;
    const dy = toState.position.y - fromState.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const timeDelta = toState.timestamp - fromState.timestamp;
    const maxDistance = 5 * (timeDelta / 1000);

    if (distance > maxDistance && operations.length === 0) {
      violations.push(`位置变化异常: 移动距离 ${distance.toFixed(2)} 超过最大允许 ${maxDistance.toFixed(2)}`);
    }

    const healthChange = toState.health.current - fromState.health.current;
    if (healthChange > 0) {
      const healOps = operations.filter(o => o.type === 'skill' && o.data.isHeal);
      const totalHeal = healOps.reduce((sum, op) => sum + (op.data.healAmount || 0), 0);
      if (healthChange > totalHeal + 10) {
        violations.push(`生命值异常恢复: 增加 ${healthChange}，操作记录 ${totalHeal}`);
      }
    }

    if (toState.level > fromState.level) {
      const expectedExpNeeded = fromState.level * 100;
      if (toState.experience + expectedExpNeeded > fromState.experience + 10000) {
        violations.push('经验值异常增长');
      }
    }

    if (toState.actionCount > fromState.actionCount + operations.length * 2) {
      violations.push(`操作计数不匹配: 快照显示 ${toState.actionCount - fromState.actionCount}，实际记录 ${operations.length}`);
    }

    const expectedHash = this.calculateInventoryHash(operations);
    if (toState.inventoryHash !== fromState.inventoryHash &&
        operations.filter(o => o.type === 'pickup' || o.type === 'trade').length === 0) {
      violations.push('背包哈希异常变化');
    }

    return violations;
  }

  private calculateInventoryHash(operations: Operation[]): string {
    const items = operations
      .filter(o => o.type === 'pickup' || o.type === 'trade')
      .map(o => `${o.data.itemId}:${o.data.quantity}`)
      .sort()
      .join('|');
    return crypto.createHash('sha256').update(items).digest('hex');
  }

  private calculateIntegrityScore(
    detections: DetectionResult[],
    validTransitions: number,
    totalTransitions: number,
    chainValid: boolean
  ): number {
    if (totalTransitions === 0) return 100;

    let score = (validTransitions / totalTransitions) * 50;

    const severityWeights: Record<string, number> = {
      low: 2,
      medium: 5,
      high: 15,
      critical: 30
    };

    let penalty = 0;
    for (const detection of detections) {
      penalty += severityWeights[detection.severity] * (detection.confidence / 100);
    }
    score = Math.max(0, score - penalty);

    if (chainValid) {
      score += 50;
    }

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  private generateSummary(
    detections: DetectionResult[],
    chainValid: boolean,
    integrityScore: number
  ): string {
    if (detections.length === 0 && chainValid) {
      return '验证通过：玩家行为正常，操作链完整';
    }

    const parts: string[] = [];

    if (!chainValid) {
      parts.push('操作哈希链完整性验证失败');
    }

    if (detections.length > 0) {
      const bySeverity: Record<string, number> = {};
      for (const d of detections) {
        bySeverity[d.severity] = (bySeverity[d.severity] || 0) + 1;
      }
      const detail = Object.entries(bySeverity)
        .map(([s, c]) => `${s}×${c}`)
        .join(', ');
      parts.push(`检测到 ${detections.length} 项异常 (${detail})`);
    }

    parts.push(`完整性评分: ${integrityScore}/100`);

    return parts.join('；');
  }

  quickVerify(playerId: string, operation: Operation): { valid: boolean; reason?: string } {
    if (!this.hashChain.validateOperation(operation)) {
      return { valid: false, reason: '操作哈希验证失败' };
    }

    const latestSnapshot = this.snapshotManager.getLatestSnapshot();
    if (!latestSnapshot) {
      return { valid: true };
    }

    const playerState = latestSnapshot.playerStates.get(playerId);
    if (!playerState) {
      return { valid: true };
    }

    return { valid: true };
  }

  getVerificationHistory(playerId?: string): RollbackVerificationResult[] {
    if (playerId) {
      return this.verificationHistory.filter(r => r.playerId === playerId);
    }
    return [...this.verificationHistory];
  }

  getLatestVerification(playerId: string): RollbackVerificationResult | undefined {
    return this.verificationHistory
      .filter(r => r.playerId === playerId)
      .sort((a, b) => b.executedAt - a.executedAt)[0];
  }
}
