import mongoose, { Document, Model } from 'mongoose';

export interface IUser extends Document {
  email: string;
  username: string;
  passwordHash: string;
  photourl?: string;
  createdAt: Date;
}

export interface IHabit extends Document {
  ownerid: string | mongoose.Types.ObjectId;
  title: string;
  description: string;
  frequencyCount: number;
  frequencyPeriod: string;
  color: string;
  sharedwith: (string | mongoose.Types.ObjectId)[];
  sortOrder: number;
  createdAt: Date;
  updatedat: Date;
}

export interface IHabitLog extends Document {
  habitid: string | mongoose.Types.ObjectId;
  ownerid: string | mongoose.Types.ObjectId;
  date: string;
  status: string;
  sharedwith: (string | mongoose.Types.ObjectId)[];
  updatedat: Date;
}

export interface IFriendship extends Document {
  initiatorId: string | mongoose.Types.ObjectId;
  receiverId: string | mongoose.Types.ObjectId;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<IUser>({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  photourl: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const habitSchema = new mongoose.Schema<IHabit>({
  ownerid: { type: mongoose.Schema.Types.Mixed, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  frequencyCount: { type: Number, default: 1 },
  frequencyPeriod: { type: String, default: 'daily' },
  color: { type: String, default: '#6366f1' },
  sharedwith: [{ type: mongoose.Schema.Types.Mixed, ref: 'User' }],
  sortOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedat: { type: Date, default: Date.now }
});

const habitLogSchema = new mongoose.Schema<IHabitLog>({
  habitid: { type: mongoose.Schema.Types.Mixed, ref: 'Habit', required: true },
  ownerid: { type: mongoose.Schema.Types.Mixed, ref: 'User', required: true },
  date: { type: String, required: true },
  status: { type: String, required: true },
  sharedwith: [{ type: mongoose.Schema.Types.Mixed, ref: 'User' }],
  updatedat: { type: Date, default: Date.now }
});

const friendshipSchema = new mongoose.Schema<IFriendship>({
  initiatorId: { type: mongoose.Schema.Types.Mixed, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.Mixed, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const User = (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', userSchema);
export const Habit = (mongoose.models.Habit as Model<IHabit>) || mongoose.model<IHabit>('Habit', habitSchema);
export const HabitLog = (mongoose.models.HabitLog as Model<IHabitLog>) || mongoose.model<IHabitLog>('HabitLog', habitLogSchema);
export const Friendship = (mongoose.models.Friendship as Model<IFriendship>) || mongoose.model<IFriendship>('Friendship', friendshipSchema);
