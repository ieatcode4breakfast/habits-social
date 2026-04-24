import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const habitSchema = new mongoose.Schema({
  ownerid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  frequencyCount: { type: Number, default: 1 },
  frequencyPeriod: { type: String, default: 'daily' },
  color: { type: String, default: '#6366f1' },
  sharedwith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  sortOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedat: { type: Date, default: Date.now }
});

const habitLogSchema = new mongoose.Schema({
  habitid: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true },
  ownerid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  status: { type: String, required: true },
  sharedwith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  updatedat: { type: Date, default: Date.now }
});

const friendshipSchema = new mongoose.Schema({
  initiatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Habit = mongoose.models.Habit || mongoose.model('Habit', habitSchema);
export const HabitLog = mongoose.models.HabitLog || mongoose.model('HabitLog', habitLogSchema);
export const Friendship = mongoose.models.Friendship || mongoose.model('Friendship', friendshipSchema);
