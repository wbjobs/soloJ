import * as Y from 'yjs';
import { DocumentManager, documentManager, DocumentMeta, DocumentState } from '../../crdt';
import { OperationLogRepository, operationLogRepository } from '../repositories/OperationLogRepository';
import { documentRepository } from '../repositories/DocumentRepository';

export interface RollbackResult {
  success: boolean;
  docId: string;
  targetTime: Date;
  replayedOperations: number;
  message?: string;
}

export class RollbackService {
  private docManager: DocumentManager;
  private opLogRepo: OperationLogRepository;

  constructor(
    docManager: DocumentManager = documentManager,
    opLogRepo: OperationLogRepository = operationLogRepository
  ) {
    this.docManager = docManager;
    this.opLogRepo = opLogRepo;
  }

  async rollbackToTime(docId: string, targetTime: Date): Promise<RollbackResult> {
    const currentMeta = this.docManager.getMetadata(docId);
    if (!currentMeta) {
      const loaded = await documentRepository.getSnapshot(docId);
      if (!loaded) {
        return {
          success: false,
          docId,
          targetTime,
          replayedOperations: 0,
          message: 'Document not found',
        };
      }
      this.docManager.loadDocument(docId, loaded.meta, loaded.update);
    }

    const operations = await this.opLogRepo.getOperationsForReplay(docId, targetTime);

    if (operations.length === 0) {
      return {
        success: false,
        docId,
        targetTime,
        replayedOperations: 0,
        message: 'No operations found before target time',
      };
    }

    const rolledBackDoc = new Y.Doc();
    rolledBackDoc.guid = docId;

    for (const op of operations) {
      const update = Uint8Array.from(op.data);
      Y.applyUpdate(rolledBackDoc, update, 'rollback');
    }

    const rolledBackUpdate = Y.encodeStateAsUpdate(rolledBackDoc);

    const currentDoc = this.docManager.getDocument(docId);
    if (!currentDoc) {
      return {
        success: false,
        docId,
        targetTime,
        replayedOperations: operations.length,
        message: 'Document not found in memory',
      };
    }

    const currentState = Y.encodeStateAsUpdate(currentDoc);

    Y.applyUpdate(currentDoc, rolledBackUpdate, 'rollback');

    const meta = this.docManager.getMetadata(docId);
    if (meta) {
      meta.updatedAt = new Date();
    }

    rolledBackDoc.destroy();

    return {
      success: true,
      docId,
      targetTime,
      replayedOperations: operations.length,
      message: `Successfully rolled back to ${targetTime.toISOString()}, replayed ${operations.length} operations`,
    };
  }

  async rollbackToSequence(docId: string, targetSequence: number): Promise<RollbackResult> {
    const operations = await this.opLogRepo.getOperations(docId, {
      toSequence: targetSequence,
    });

    if (operations.length === 0) {
      return {
        success: false,
        docId,
        targetTime: new Date(),
        replayedOperations: 0,
        message: 'No operations found before target sequence',
      };
    }

    const lastOp = operations[operations.length - 1];
    return this.rollbackToTime(docId, lastOp.timestamp);
  }

  async previewRollback(
    docId: string,
    targetTime: Date
  ): Promise<{ content: unknown; operationCount: number } | null> {
    const operations = await this.opLogRepo.getOperationsForReplay(docId, targetTime);

    if (operations.length === 0) {
      return null;
    }

    const previewDoc = new Y.Doc();
    previewDoc.guid = docId;

    for (const op of operations) {
      const update = Uint8Array.from(op.data);
      Y.applyUpdate(previewDoc, update, 'preview');
    }

    const sharedTypes: Record<string, unknown> = {};
    previewDoc.share.forEach((type, name) => {
      if (type instanceof Y.Text) {
        sharedTypes[name] = type.toString();
      } else if (type instanceof Y.Map) {
        sharedTypes[name] = type.toJSON();
      } else if (type instanceof Y.Array) {
        sharedTypes[name] = type.toJSON();
      } else {
        sharedTypes[name] = 'unsupported-type';
      }
    });

    previewDoc.destroy();

    return {
      content: sharedTypes,
      operationCount: operations.length,
    };
  }

  async getOperationHistory(
    docId: string,
    options: {
      limit?: number;
      offset?: number;
      fromTime?: Date;
      toTime?: Date;
    } = {}
  ) {
    const operations = await this.opLogRepo.getOperations(docId, options);
    const totalCount = await this.opLogRepo.getOperationCount(docId);

    return {
      operations: operations.map((op) => ({
        operationId: op.operationId,
        sequence: op.sequence,
        createdBy: op.createdBy,
        sourceClientId: op.sourceClientId,
        timestamp: op.timestamp,
        size: op.size,
      })),
      pagination: {
        total: totalCount,
        limit: options.limit || 0,
        offset: options.offset || 0,
      },
    };
  }

  async getOperationDetail(docId: string, operationId: string) {
    const operations = await this.opLogRepo.getOperations(docId, { limit: 1 });
    const op = operations.find((o) => o.operationId === operationId);

    if (!op) {
      return null;
    }

    return {
      operationId: op.operationId,
      sequence: op.sequence,
      createdBy: op.createdBy,
      sourceClientId: op.sourceClientId,
      timestamp: op.timestamp,
      size: op.size,
      dataBase64: Buffer.from(op.data).toString('base64'),
    };
  }
}

export const rollbackService = new RollbackService();
