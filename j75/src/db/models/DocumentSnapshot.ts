import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDocumentSnapshot extends Document {
  docId: string;
  title: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  snapshot: Buffer;
  version: number;
  chunked: boolean;
}

const DocumentSnapshotSchema: Schema = new Schema({
  docId: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  createdBy: { type: String, required: true, index: true },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true, index: true },
  snapshot: { type: Buffer, required: false },
  version: { type: Number, default: 1 },
  chunked: { type: Boolean, default: false, index: true },
});

export const DocumentSnapshotModel: Model<IDocumentSnapshot> = mongoose.model<IDocumentSnapshot>(
  'DocumentSnapshot',
  DocumentSnapshotSchema
);
