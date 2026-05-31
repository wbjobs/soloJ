import { MerkleTree, MerkleProof } from './merkle-tree';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface PlayerState {
  playerId: string;
  entityId: string;
  timestamp: number;
  position: { x: number; y: number };
  health: { current: number; max: number };
  mana: { current: number; max: number };
  level: number;
  gold: number;
  experience: number;
  attack: number;
  defense: number;
  speed: number;
  inventoryHash: string;
  skillsHash: string;
  actionCount: number;
}

export interface Snapshot {
  id: string;
  timestamp: number;
  sequenceNumber: number;
  playerStates: Map<string, PlayerState>;
  merkleRoot: string;
  previousSnapshotHash: string;
  signature: string;
}

export interface SnapshotInfo {
  id: string;
  timestamp: number;
  sequenceNumber: number;
  playerCount: number;
  merkleRoot: string;
  size: number;
}

export class SnapshotManager {
  private snapshots: Map<string, Snapshot> = new Map();
  private snapshotList: Snapshot[] = [];
  private sequenceNumber: number = 0;
  private intervalMs: number;
  private maxSnapshots: number;
  private storagePath: string;
  private privateKey: string;
  private publicKey: string;

  constructor(
    intervalMs: number = 5000,
    maxSnapshots: number = 1000,
    storagePath: string = './data/snapshots'
  ) {
    this.intervalMs = intervalMs;
    this.maxSnapshots = maxSnapshots;
    this.storagePath = storagePath;

    const { privateKey, publicKey } = this.generateKeys();
    this.privateKey = privateKey;
    this.publicKey = publicKey;

    fs.mkdirSync(storagePath, { recursive: true });
  }

  private generateKeys(): { privateKey: string; publicKey: string } {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    return { privateKey, publicKey };
  }

  private sign(data: string): string {
    const signer = crypto.createSign('SHA256');
    signer.update(data);
    return signer.sign(this.privateKey, 'base64');
  }

  verifySignature(data: string, signature: string): boolean {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(data);
    return verifier.verify(this.publicKey, signature, 'base64');
  }

  getPublicKey(): string {
    return this.publicKey;
  }

  createSnapshot(playerStates: PlayerState[]): Snapshot {
    this.sequenceNumber++;

    const statesMap = new Map<string, PlayerState>();
    const sortedStates = [...playerStates].sort((a, b) => a.playerId.localeCompare(b.playerId));
    const stateStrings: string[] = [];

    for (const state of sortedStates) {
      state.timestamp = Date.now();
      statesMap.set(state.playerId, state);
      stateStrings.push(JSON.stringify(state));
    }

    const merkleTree = new MerkleTree(stateStrings);
    const merkleRoot = merkleTree.getRootHash() || '';

    const prevSnapshot = this.snapshotList[this.snapshotList.length - 1];
    const prevHash = prevSnapshot ? this.hashSnapshot(prevSnapshot) : 'genesis';

    const snapshotId = `snap_${this.sequenceNumber}_${Date.now()}`;

    const snapshotData = {
      id: snapshotId,
      timestamp: Date.now(),
      sequenceNumber: this.sequenceNumber,
      merkleRoot,
      previousSnapshotHash: prevHash,
      playerCount: statesMap.size
    };

    const signature = this.sign(JSON.stringify(snapshotData));

    const snapshot: Snapshot = {
      ...snapshotData,
      playerStates: statesMap,
      signature
    };

    this.snapshots.set(snapshotId, snapshot);
    this.snapshotList.push(snapshot);

    if (this.snapshotList.length > this.maxSnapshots) {
      const removed = this.snapshotList.shift();
      if (removed) {
        this.snapshots.delete(removed.id);
      }
    }

    this.persistSnapshot(snapshot);

    console.log(`[SnapshotManager] Created snapshot #${this.sequenceNumber} with ${statesMap.size} players, root: ${merkleRoot.slice(0, 16)}...`);
    return snapshot;
  }

  private hashSnapshot(snapshot: Snapshot): string {
    return crypto.createHash('sha256')
      .update(snapshot.sequenceNumber.toString())
      .update(snapshot.merkleRoot)
      .update(snapshot.previousSnapshotHash)
      .digest('hex');
  }

  private persistSnapshot(snapshot: Snapshot): void {
    try {
      const filePath = path.join(this.storagePath, `${snapshot.id}.json`);
      const data = JSON.stringify({
        ...snapshot,
        playerStates: Array.from(snapshot.playerStates.entries())
      });
      fs.writeFileSync(filePath, data);
    } catch (err) {
      console.error('[SnapshotManager] Failed to persist snapshot:', err);
    }
  }

  getSnapshot(id: string): Snapshot | undefined {
    return this.snapshots.get(id);
  }

  getSnapshotByTime(timestamp: number): Snapshot | null {
    if (this.snapshotList.length === 0) return null;

    let left = 0;
    let right = this.snapshotList.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const snap = this.snapshotList[mid];

      if (snap.timestamp === timestamp) {
        return snap;
      } else if (snap.timestamp < timestamp) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    const closest = right >= 0 ? this.snapshotList[right] : this.snapshotList[0];
    return closest;
  }

  getSnapshotBySequence(seq: number): Snapshot | null {
    const index = seq - 1;
    if (index < 0 || index >= this.snapshotList.length) {
      return null;
    }
    return this.snapshotList[index];
  }

  getLatestSnapshot(): Snapshot | null {
    return this.snapshotList[this.snapshotList.length - 1] || null;
  }

  getSnapshotRange(startSeq: number, endSeq: number): Snapshot[] {
    const start = Math.max(0, startSeq - 1);
    const end = Math.min(this.snapshotList.length, endSeq);
    return this.snapshotList.slice(start, end);
  }

  getPlayerMerkleProof(snapshotId: string, playerId: string): MerkleProof | null {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return null;

    const states = Array.from(snapshot.playerStates.values())
      .sort((a, b) => a.playerId.localeCompare(b.playerId));

    const stateStrings = states.map(s => JSON.stringify(s));
    const playerIndex = states.findIndex(s => s.playerId === playerId);

    if (playerIndex === -1) return null;

    const merkleTree = new MerkleTree(stateStrings);
    return merkleTree.getProof(playerIndex);
  }

  verifyPlayerState(snapshotId: string, playerId: string, state: PlayerState): boolean {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return false;

    const proof = this.getPlayerMerkleProof(snapshotId, playerId);
    if (!proof) return false;

    return MerkleTree.verifyProofWithData(JSON.stringify(state), proof);
  }

  verifySnapshotChain(snapshotId: string): boolean {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return false;

    const snapshotData = {
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      sequenceNumber: snapshot.sequenceNumber,
      merkleRoot: snapshot.merkleRoot,
      previousSnapshotHash: snapshot.previousSnapshotHash,
      playerCount: snapshot.playerStates.size
    };

    if (!this.verifySignature(JSON.stringify(snapshotData), snapshot.signature)) {
      return false;
    }

    let current = snapshot;
    let seq = snapshot.sequenceNumber - 1;

    while (seq > 0 && current.previousSnapshotHash !== 'genesis') {
      const prev = this.getSnapshotBySequence(seq);
      if (!prev) return false;

      const calculatedPrevHash = this.hashSnapshot(prev);
      if (calculatedPrevHash !== current.previousSnapshotHash) {
        return false;
      }

      current = prev;
      seq--;
    }

    return true;
  }

  listSnapshots(limit: number = 10): SnapshotInfo[] {
    return this.snapshotList
      .slice(-limit)
      .reverse()
      .map(s => ({
        id: s.id,
        timestamp: s.timestamp,
        sequenceNumber: s.sequenceNumber,
        playerCount: s.playerStates.size,
        merkleRoot: s.merkleRoot,
        size: JSON.stringify(s).length
      }));
  }

  getSnapshotCount(): number {
    return this.snapshotList.length;
  }

  getInterval(): number {
    return this.intervalMs;
  }

  clear(): void {
    this.snapshots.clear();
    this.snapshotList = [];
  }
}
