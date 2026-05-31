import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISnapshotChunk extends Document {
  docId: string;
  version: number;
  chunkIndex: number;
  chunkData: Buffer;
}

const SnapshotChunkSchema: Schema = new Schema({
  docId: { type: String, required: true, index: true },
  version: { type: Number, required: true, index: true },
  chunkIndex: { type: Number, required: true },
  chunkData: { type: Buffer, required: true },
});

SnapshotChunkSchema.index({ docId: 1, version: 1, chunkIndex: 1 }, { unique: true });

export const SnapshotChunkModel: Model<ISnapshotChunk> = mongoose.model<ISnapshotChunk>(
  'SnapshotChunk',
  SnapshotChunkSchema
);
