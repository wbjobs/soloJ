import { OperationLogModel, IOperationLog } from '../models/OperationLog';
import { v4 as uuidv4 } from 'uuid';

export interface OperationLogEntry {
  operationId: string;
  sequence: number;
  data: Uint8Array;
  createdBy: string | null;
  sourceClientId: string | null;
  timestamp: Date;
  size: number;
}

export class OperationLogRepository {
  private sequenceCounters: Map<string, number> = new Map();

  async initialize(): Promise<void> {
    const docs = await OperationLogModel.aggregate([
      { $group: { _id: '$docId', maxSeq: { $max: '$sequence' } } },
    ]);
    docs.forEach((doc: { _id: string; maxSeq: number }) => {
      this.sequenceCounters.set(doc._id, doc.maxSeq);
    });
    console.log(`Initialized ${this.sequenceCounters.size} document sequence counters`);
  }

  async logOperation(
    docId: string,
    data: Uint8Array,
    createdBy: string | null = null,
    sourceClientId: string | null = null
  ): Promise<IOperationLog> {
    const currentSeq = this.sequenceCounters.get(docId) || 0;
    const nextSeq = currentSeq + 1;
    this.sequenceCounters.set(docId, nextSeq);

    const log = new OperationLogModel({
      docId,
      operationId: uuidv4(),
      sequence: nextSeq,
      data: Buffer.from(data),
      createdBy,
      sourceClientId,
      timestamp: new Date(),
      size: data.length,
    });

    return log.save();
  }

  async getOperations(
    docId: string,
    options: {
      fromSequence?: number;
      toSequence?: number;
      fromTime?: Date;
      toTime?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<IOperationLog[]> {
    const query: Record<string, unknown> = { docId };

    if (options.fromSequence !== undefined) {
      query.sequence = { ...(query.sequence as object || {}), $gte: options.fromSequence };
    }
    if (options.toSequence !== undefined) {
      query.sequence = { ...(query.sequence as object || {}), $lte: options.toSequence };
    }
    if (options.fromTime !== undefined) {
      query.timestamp = { ...(query.timestamp as object || {}), $gte: options.fromTime };
    }
    if (options.toTime !== undefined) {
      query.timestamp = { ...(query.timestamp as object || {}), $lte: options.toTime };
    }

    const findQuery = OperationLogModel.find(query)
      .sort({ sequence: 1 });

    if (options.offset !== undefined) {
      findQuery.skip(options.offset);
    }
    if (options.limit !== undefined) {
      findQuery.limit(options.limit);
    }

    return findQuery.exec();
  }

  async getOperationsForReplay(
    docId: string,
    toTime: Date
  ): Promise<IOperationLog[]> {
    return OperationLogModel.find({
      docId,
      timestamp: { $lte: toTime },
    }).sort({ sequence: 1 }).exec();
  }

  async getOperationCount(docId: string): Promise<number> {
    return OperationLogModel.countDocuments({ docId });
  }

  async getLatestOperation(docId: string): Promise<IOperationLog | null> {
    return OperationLogModel.findOne({ docId })
      .sort({ sequence: -1 })
      .limit(1)
      .exec();
  }

  async getOperationAtTime(docId: string, targetTime: Date): Promise<IOperationLog | null> {
    return OperationLogModel.findOne({
      docId,
      timestamp: { $lte: targetTime },
    })
      .sort({ sequence: -1 })
      .limit(1)
      .exec();
  }

  async deleteAllOperations(docId: string): Promise<number> {
    const result = await OperationLogModel.deleteMany({ docId });
    this.sequenceCounters.delete(docId);
    return result.deletedCount || 0;
  }

  async deleteOldOperations(docId: string, beforeSequence: number): Promise<number> {
    const result = await OperationLogModel.deleteMany({
      docId,
      sequence: { $lt: beforeSequence },
    });
    return result.deletedCount || 0;
  }

  async toJSONArray(operations: IOperationLog[]): Promise<Array<{
    operationId: string;
    sequence: number;
    data: string;
    createdBy: string | null;
    sourceClientId: string | null;
    timestamp: string;
    size: number;
  }>> {
    return operations.map((op) => ({
      operationId: op.operationId,
      sequence: op.sequence,
      data: Buffer.from(op.data).toString('base64'),
      createdBy: op.createdBy,
      sourceClientId: op.sourceClientId,
      timestamp: op.timestamp.toISOString(),
      size: op.size,
    }));
  }
}

export const operationLogRepository = new OperationLogRepository();
