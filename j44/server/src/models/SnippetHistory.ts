import mongoose, { Schema, Document } from 'mongoose';

export interface ISnippetHistory extends Document {
  snippetId: string;
  version: number;
  snapshot: string;
  timestamp: Date;
  content: string;
  title: string;
  language: string;
  author?: string;
  changesCount: number;
}

const SnippetHistorySchema: Schema = new Schema({
  snippetId: {
    type: String,
    required: true,
    index: true
  },
  version: {
    type: Number,
    required: true,
    min: 1
  },
  snapshot: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  content: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  language: {
    type: String,
    required: true
  },
  author: {
    type: String
  },
  changesCount: {
    type: Number,
    default: 1
  }
});

SnippetHistorySchema.index({ snippetId: 1, version: 1 }, { unique: true });

export default mongoose.model<ISnippetHistory>('SnippetHistory', SnippetHistorySchema);
