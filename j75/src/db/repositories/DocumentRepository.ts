import { DocumentSnapshotModel, IDocumentSnapshot } from '../models/DocumentSnapshot';
import { SnapshotChunkModel, ISnapshotChunk } from '../models/SnapshotChunk';
import { DocumentMeta, DocumentState } from '../../crdt';

const CHUNK_SIZE = 14 * 1024 * 1024;

export class DocumentRepository {
  async saveSnapshot(docState: DocumentState): Promise<IDocumentSnapshot> {
    const data = Buffer.from(docState.update);
    const needsChunking = data.length > CHUNK_SIZE;
    const existing = await DocumentSnapshotModel.findOne({ docId: docState.meta.id });

    if (existing) {
      existing.title = docState.meta.title;
      existing.updatedAt = docState.meta.updatedAt;
      existing.version += 1;

      if (needsChunking) {
        existing.snapshot = undefined as any;
        existing.chunked = true;
        await this.saveChunks(docState.meta.id, existing.version, data);
      } else {
        existing.snapshot = data;
        existing.chunked = false;
        await this.deleteChunks(docState.meta.id, existing.version - 1);
      }

      return existing.save();
    }

    const version = 1;
    const snapshot = new DocumentSnapshotModel({
      docId: docState.meta.id,
      title: docState.meta.title,
      createdBy: docState.meta.createdBy,
      createdAt: docState.meta.createdAt,
      updatedAt: docState.meta.updatedAt,
      snapshot: needsChunking ? undefined : data,
      version,
      chunked: needsChunking,
    });

    if (needsChunking) {
      await this.saveChunks(docState.meta.id, version, data);
    }

    return snapshot.save();
  }

  async getSnapshot(docId: string): Promise<DocumentState | null> {
    const snapshot = await DocumentSnapshotModel.findOne({ docId });
    if (!snapshot) {
      return null;
    }

    const meta: DocumentMeta = {
      id: snapshot.docId,
      title: snapshot.title,
      createdBy: snapshot.createdBy,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    };

    let updateData: Uint8Array;

    if (snapshot.chunked) {
      const chunks = await this.loadChunks(docId, snapshot.version);
      if (chunks.length === 0) {
        return null;
      }
      updateData = this.reassembleChunks(chunks);
    } else if (snapshot.snapshot) {
      updateData = Uint8Array.from(snapshot.snapshot);
    } else {
      return null;
    }

    return { meta, update: updateData };
  }

  async getMetadata(docId: string): Promise<DocumentMeta | null> {
    const snapshot = await DocumentSnapshotModel.findOne(
      { docId },
      { snapshot: 0 }
    );
    if (!snapshot) {
      return null;
    }

    return {
      id: snapshot.docId,
      title: snapshot.title,
      createdBy: snapshot.createdBy,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    };
  }

  async listDocuments(createdBy?: string): Promise<DocumentMeta[]> {
    const query = createdBy ? { createdBy } : {};
    const snapshots = await DocumentSnapshotModel.find(
      query,
      { snapshot: 0 }
    ).sort({ updatedAt: -1 });

    return snapshots.map((s) => ({
      id: s.docId,
      title: s.title,
      createdBy: s.createdBy,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  async deleteSnapshot(docId: string): Promise<boolean> {
    const snapshot = await DocumentSnapshotModel.findOne({ docId });
    if (!snapshot) {
      return false;
    }

    if (snapshot.chunked) {
      await this.deleteChunks(docId, snapshot.version);
    }

    const result = await DocumentSnapshotModel.deleteOne({ docId });
    return result.deletedCount > 0;
  }

  async snapshotExists(docId: string): Promise<boolean> {
    const count = await DocumentSnapshotModel.countDocuments({ docId });
    return count > 0;
  }

  private async saveChunks(docId: string, version: number, data: Buffer): Promise<void> {
    await this.deleteChunks(docId, version);

    const chunks: Buffer[] = [];
    for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
      chunks.push(data.subarray(offset, offset + CHUNK_SIZE));
    }

    const chunkDocs = chunks.map((chunkData, index) => ({
      docId,
      version,
      chunkIndex: index,
      chunkData,
    }));

    await SnapshotChunkModel.insertMany(chunkDocs);
  }

  private async loadChunks(docId: string, version: number): Promise<ISnapshotChunk[]> {
    return SnapshotChunkModel.find({ docId, version })
      .sort({ chunkIndex: 1 })
      .exec();
  }

  private async deleteChunks(docId: string, version: number): Promise<void> {
    await SnapshotChunkModel.deleteMany({ docId, version });
  }

  private reassembleChunks(chunks: ISnapshotChunk[]): Uint8Array {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.chunkData.length, 0);
    const result = Buffer.alloc(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      chunk.chunkData.copy(result, offset);
      offset += chunk.chunkData.length;
    }
    return Uint8Array.from(result);
  }
}

export const documentRepository = new DocumentRepository();
