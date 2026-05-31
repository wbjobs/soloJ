import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  userId: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  userId: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const UserModel: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
