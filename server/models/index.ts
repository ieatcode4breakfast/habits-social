import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  displayname: { type: String },
  photourl: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const HabitSchema = new mongoose.Schema({
  ownerid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  color: { type: String, default: '#3b82f6' },
  sharedwith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
  updatedat: { type: Date, default: Date.now }
});

const HabitLogSchema = new mongoose.Schema({
  habitid: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true },
  ownerid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // "yyyy-MM-dd"
  status: { type: String, enum: ["completed", "skipped", "failed"], required: true },
  sharedwith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  updatedat: { type: Date, default: Date.now }
});

const FriendshipSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  initiatorid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ["pending", "accepted"], required: true },
  updatedat: { type: Date, default: Date.now }
});

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const Habit = mongoose.models.Habit || mongoose.model('Habit', HabitSchema);
export const HabitLog = mongoose.models.HabitLog || mongoose.model('HabitLog', HabitLogSchema);
export const Friendship = mongoose.models.Friendship || mongoose.model('Friendship', FriendshipSchema);
