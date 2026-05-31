import { UserModel, IUser } from '../models/User';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export class UserRepository {
  async createUser(username: string, password: string): Promise<IUser> {
    const existingUser = await UserModel.findOne({ username });
    if (existingUser) {
      throw new Error(`Username ${username} already exists`);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    const user = new UserModel({
      userId,
      username,
      passwordHash,
    });

    return user.save();
  }

  async findByUsername(username: string): Promise<IUser | null> {
    return UserModel.findOne({ username });
  }

  async findByUserId(userId: string): Promise<IUser | null> {
    return UserModel.findOne({ userId });
  }

  async verifyPassword(username: string, password: string): Promise<IUser | null> {
    const user = await this.findByUsername(username);
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
  }

  async listUsers(): Promise<IUser[]> {
    return UserModel.find({}, { passwordHash: 0 });
  }
}

export const userRepository = new UserRepository();
