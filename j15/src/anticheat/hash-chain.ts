import * as crypto from 'crypto';

export type OperationType =
  | 'move'
  | 'attack'
  | 'skill'
  | 'defend'
  | 'flee'
  | 'pickup'
  | 'trade'
  | 'chat'
  | 'inventory'
  | 'party';

export interface Operation {
  id: string;
  type: OperationType;
  playerId: string;
  timestamp: number;
  sequenceNumber: number;
  previousHash: string;
  data: Record<string, any>;
  nonce: number;
}

export interface OperationReceipt {
  operation: Operation;
  operationHash: string;
  serverTimestamp: number;
  snapshotSequence: number;
  merkleProof?: any;
}

export interface ChainProof {
  playerId: string;
  startSequence: number;
  endSequence: number;
  operations: Operation[];
  startStateHash: string;
  endStateHash: string;
}

export class HashChain {
  private chains: Map<string, Operation[]> = new Map();
  private sequenceNumbers: Map<string, number> = new Map();
  private genesisHashes: Map<string, string> = new Map();

  static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  hashOperation(op: Operation): string {
    const data = JSON.stringify({
      type: op.type,
      playerId: op.playerId,
      timestamp: op.timestamp,
      sequenceNumber: op.sequenceNumber,
      previousHash: op.previousHash,
      data: op.data,
      nonce: op.nonce
    });
    return HashChain.hash(data);
  }

  initChain(playerId: string, seed?: string): string {
    const genesisHash = HashChain.hash(seed || `genesis_${playerId}_${Date.now()}`);
    this.chains.set(playerId, []);
    this.sequenceNumbers.set(playerId, 0);
    this.genesisHashes.set(playerId, genesisHash);
    return genesisHash;
  }

  getPreviousHash(playerId: string): string {
    const chain = this.chains.get(playerId);
    if (!chain || chain.length === 0) {
      return this.genesisHashes.get(playerId) || this.initChain(playerId);
    }
    return this.hashOperation(chain[chain.length - 1]);
  }

  createOperation(
    playerId: string,
    type: OperationType,
    data: Record<string, any>
  ): Operation {
    const seq = (this.sequenceNumbers.get(playerId) || 0) + 1;
    this.sequenceNumbers.set(playerId, seq);

    const op: Operation = {
      id: `op_${playerId}_${seq}_${Date.now()}`,
      type,
      playerId,
      timestamp: Date.now(),
      sequenceNumber: seq,
      previousHash: this.getPreviousHash(playerId),
      data,
      nonce: Math.floor(Math.random() * 1000000)
    };

    return op;
  }

  addOperation(playerId: string, op: Operation): OperationReceipt | null {
    const currentSeq = this.sequenceNumbers.get(playerId) || 0;

    if (op.sequenceNumber !== currentSeq + 1) {
      return null;
    }

    const expectedPrevHash = this.getPreviousHash(playerId);
    if (op.previousHash !== expectedPrevHash) {
      return null;
    }

    const chain = this.chains.get(playerId);
    if (!chain) {
      this.initChain(playerId);
      return this.addOperation(playerId, op);
    }

    chain.push(op);

    if (chain.length > 10000) {
      chain.shift();
    }

    return {
      operation: op,
      operationHash: this.hashOperation(op),
      serverTimestamp: Date.now(),
      snapshotSequence: 0
    };
  }

  validateOperation(op: Operation): boolean {
    const chain = this.chains.get(op.playerId);
    if (!chain) return false;

    const expectedSeq = op.sequenceNumber;
    if (expectedSeq > chain.length + 1) return false;

    const calculatedHash = this.hashOperation(op);

    if (op.sequenceNumber === 1) {
      return op.previousHash === this.genesisHashes.get(op.playerId);
    }

    const prevOp = chain[op.sequenceNumber - 2];
    if (!prevOp) return false;

    const prevHash = this.hashOperation(prevOp);
    return op.previousHash === prevHash;
  }

  verifyChainIntegrity(playerId: string, fromSeq: number = 1, toSeq?: number): boolean {
    const chain = this.chains.get(playerId);
    if (!chain) return false;

    const end = toSeq ? Math.min(toSeq, chain.length) : chain.length;
    const start = Math.max(0, fromSeq - 1);

    let prevHash = start === 0 ? this.genesisHashes.get(playerId) : this.hashOperation(chain[start - 1]);

    for (let i = start; i < end; i++) {
      const op = chain[i];
      if (op.previousHash !== prevHash) {
        return false;
      }
      prevHash = this.hashOperation(op);
    }

    return true;
  }

  getChainProof(playerId: string, startSeq: number, endSeq: number): ChainProof | null {
    const chain = this.chains.get(playerId);
    if (!chain) return null;

    const start = startSeq - 1;
    const end = endSeq;

    if (start < 0 || end > chain.length) return null;

    const ops = chain.slice(start, end);
    const startStateHash = start === 0 ? this.genesisHashes.get(playerId)! : this.hashOperation(chain[start - 1]);
    const endStateHash = this.hashOperation(chain[end - 1]);

    return {
      playerId,
      startSequence: startSeq,
      endSequence: endSeq,
      operations: ops,
      startStateHash,
      endStateHash
    };
  }

  getOperations(playerId: string, limit: number = 100): Operation[] {
    const chain = this.chains.get(playerId);
    if (!chain) return [];
    return chain.slice(-limit);
  }

  getOperationCount(playerId: string): number {
    return this.chains.get(playerId)?.length || 0;
  }

  getLatestSequence(playerId: string): number {
    return this.sequenceNumbers.get(playerId) || 0;
  }

  resetChain(playerId: string): void {
    this.initChain(playerId);
  }

  removeChain(playerId: string): void {
    this.chains.delete(playerId);
    this.sequenceNumbers.delete(playerId);
    this.genesisHashes.delete(playerId);
  }

  getAllPlayerIds(): string[] {
    return Array.from(this.chains.keys());
  }
}
