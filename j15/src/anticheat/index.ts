import { SnapshotManager, PlayerState } from './snapshot-manager';
import { HashChain, Operation, OperationType } from './hash-chain';
import { CheatDetector, DetectionResult } from './cheat-detector';
import { RollbackVerifier, RollbackVerificationRequest, RollbackVerificationResult } from './rollback-verifier';
import { MerkleTree } from './merkle-tree';

export { PlayerState, Snapshot } from './snapshot-manager';
export { Operation, OperationType, OperationReceipt, ChainProof } from './hash-chain';
export { DetectionResult, CheatDetectionRule } from './cheat-detector';
export { RollbackVerificationRequest, RollbackVerificationResult } from './rollback-verifier';
import * as crypto from 'crypto';

export interface AntiCheatConfig {
  snapshotInterval?: number;
  maxSnapshots?: number;
  snapshotStoragePath?: string;
  autoSnapshot?: boolean;
  autoDetect?: boolean;
}

export interface OperationProof {
  operation: Operation;
  operationHash: string;
  previousHash: string;
  serverSignature: string;
  snapshotProof?: any;
}

export class AntiCheatSystem {
  public snapshotManager: SnapshotManager;
  public hashChain: HashChain;
  public cheatDetector: CheatDetector;
  public rollbackVerifier: RollbackVerifier;

  private config: Required<AntiCheatConfig>;
  private snapshotTimer: NodeJS.Timeout | null = null;
  private onlinePlayers: Set<string> = new Set();
  private getPlayerStates: (() => PlayerState[]) | null = null;

  constructor(config: AntiCheatConfig = {}) {
    this.config = {
      snapshotInterval: config.snapshotInterval ?? 5000,
      maxSnapshots: config.maxSnapshots ?? 1000,
      snapshotStoragePath: config.snapshotStoragePath ?? './data/snapshots',
      autoSnapshot: config.autoSnapshot ?? true,
      autoDetect: config.autoDetect ?? true
    };

    this.snapshotManager = new SnapshotManager(
      this.config.snapshotInterval,
      this.config.maxSnapshots,
      this.config.snapshotStoragePath
    );

    this.hashChain = new HashChain();
    this.cheatDetector = new CheatDetector();
    this.rollbackVerifier = new RollbackVerifier(
      this.snapshotManager,
      this.hashChain,
      this.cheatDetector
    );

    console.log('[AntiCheatSystem] Anti-cheat system initialized');
    console.log(`[AntiCheatSystem] Snapshot interval: ${this.config.snapshotInterval}ms`);
    console.log(`[AntiCheatSystem] Max snapshots: ${this.config.maxSnapshots}`);
    console.log(`[AntiCheatSystem] Merkle root public key available`);
  }

  setPlayerStateProvider(provider: () => PlayerState[]): void {
    this.getPlayerStates = provider;
  }

  start(): void {
    if (this.config.autoSnapshot) {
      this.startAutoSnapshot();
    }
    console.log('[AntiCheatSystem] Anti-cheat system started');
  }

  private startAutoSnapshot(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
    }

    this.snapshotTimer = setInterval(() => {
      this.takeSnapshot();
    }, this.config.snapshotInterval);
  }

  takeSnapshot(): void {
    if (!this.getPlayerStates) {
      return;
    }

    try {
      const states = this.getPlayerStates();
      const snapshot = this.snapshotManager.createSnapshot(states);

      if (this.config.autoDetect) {
        this.runDetectionForAllPlayers(snapshot);
      }
    } catch (err) {
      console.error('[AntiCheatSystem] Snapshot creation error:', err);
    }
  }

  private runDetectionForAllPlayers(snapshot: any): void {
    const prevSnapshot = this.snapshotManager.getSnapshotBySequence(snapshot.sequenceNumber - 1);

    for (const [playerId, currentState] of snapshot.playerStates) {
      const prevState = prevSnapshot?.playerStates.get(playerId) || null;
      const timeDelta = snapshot.timestamp - (prevSnapshot?.timestamp || snapshot.timestamp);

      const operations = this.hashChain.getOperations(playerId).filter(op =>
        op.timestamp >= (prevSnapshot?.timestamp || 0) &&
        op.timestamp <= snapshot.timestamp
      );

      const detections = this.cheatDetector.detect(
        currentState,
        prevState,
        operations,
        timeDelta
      );

      if (detections.length > 0) {
        this.handleDetections(playerId, detections);
      }
    }
  }

  private handleDetections(playerId: string, detections: DetectionResult[]): void {
    for (const detection of detections) {
      console.warn(`[AntiCheatSystem] Cheat detected for ${playerId}: ${detection.ruleId} (confidence: ${detection.confidence}%)`);
    }
  }

  registerPlayer(playerId: string, seed?: string): string {
    this.onlinePlayers.add(playerId);
    return this.hashChain.initChain(playerId, seed);
  }

  unregisterPlayer(playerId: string): void {
    this.onlinePlayers.delete(playerId);
    this.hashChain.removeChain(playerId);
  }

  createAndValidateOperation(
    playerId: string,
    type: OperationType,
    data: Record<string, any>
  ): OperationProof | null {
    const operation = this.hashChain.createOperation(playerId, type, data);
    const receipt = this.hashChain.addOperation(playerId, operation);

    if (!receipt) {
      return null;
    }

    const signature = this.signData(receipt.operationHash);

    return {
      operation,
      operationHash: receipt.operationHash,
      previousHash: operation.previousHash,
      serverSignature: signature
    };
  }

  private signData(data: string): string {
    const signer = crypto.createSign('SHA256');
    signer.update(data);
    return signer.sign(this.snapshotManager.getPublicKey(), 'base64');
  }

  verifyOperationProof(proof: OperationProof): boolean {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(proof.operationHash);
    return verifier.verify(this.snapshotManager.getPublicKey(), proof.serverSignature, 'base64');
  }

  getPlayerMerkleProof(snapshotId: string, playerId: string): any {
    return this.snapshotManager.getPlayerMerkleProof(snapshotId, playerId);
  }

  verifyPlayerAtSnapshot(snapshotId: string, playerId: string, state: PlayerState): boolean {
    return this.snapshotManager.verifyPlayerState(snapshotId, playerId, state);
  }

  runRollbackVerification(request: RollbackVerificationRequest): RollbackVerificationResult {
    return this.rollbackVerifier.verifyPlayer(request);
  }

  getPlayerRiskScore(playerId: string): number {
    return this.cheatDetector.calculateRiskScore(playerId);
  }

  getPlayerDetectionHistory(playerId: string): DetectionResult[] {
    return this.cheatDetector.getPlayerHistory(playerId);
  }

  getSuspiciousPlayers(): { playerId: string; riskScore: number }[] {
    return this.cheatDetector.getSuspiciousPlayers();
  }

  getSnapshotCount(): number {
    return this.snapshotManager.getSnapshotCount();
  }

  getLatestSnapshot(): any {
    return this.snapshotManager.getLatestSnapshot();
  }

  listRecentSnapshots(limit: number = 10): any[] {
    return this.snapshotManager.listSnapshots(limit);
  }

  getOperationCount(playerId: string): number {
    return this.hashChain.getOperationCount(playerId);
  }

  getPublicKey(): string {
    return this.snapshotManager.getPublicKey();
  }

  stop(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    this.takeSnapshot();
    console.log('[AntiCheatSystem] Anti-cheat system stopped');
  }
}
