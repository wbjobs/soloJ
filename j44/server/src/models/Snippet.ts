import mongoose, { Schema, Document } from 'mongoose';

export interface ISnippet extends Document {
  id: string;
  title: string;
  language: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const SnippetSchema: Schema = new Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  language: {
    type: String,
    required: true,
    default: 'javascript'
  },
  content: {
    type: String,
    required: true,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

SnippetSchema.pre<ISnippet>('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<ISnippet>('Snippet', SnippetSchema);
