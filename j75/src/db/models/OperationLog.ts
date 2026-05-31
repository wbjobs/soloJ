import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOperationLog extends Document {
  docId: string;
  operationId: string;
  sequence: number;
  data: Buffer;
  createdBy: string | null;
  sourceClientId: string | null;
  timestamp: Date;
  size: number;
}

const OperationLogSchema: Schema = new Schema({
  docId: { type: String, required: true, index: true },
  operationId: { type: String, required: true, unique: true, index: true },
  sequence: { type: Number, required: true, index: true },
  data: { type: Buffer, required: true },
  createdBy: { type: String, default: null, index: true },
  sourceClientId: { type: String, default: null },
  timestamp: { type: Date, default: Date.now, index: true },
  size: { type: Number, required: true },
});

OperationLogSchema.index({ docId: 1, sequence: 1 }, { unique: true });
OperationLogSchema.index({ docId: 1, timestamp: -1 });

export const OperationLogModel: Model<IOperationLog> = mongoose.model<IOperationLog>(
  'OperationLog',
  OperationLogSchema
);
