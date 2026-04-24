import { ObjectId } from 'mongodb';

export interface IUser {
  _id?: ObjectId;
  email: string;
  username: string;
  passwordHash: string;
  photourl?: string;
  createdAt: Date;
}

export interface IHabit {
  _id?: ObjectId;
  ownerid: string | ObjectId;
  title: string;
  description: string;
  frequencyCount: number;
  frequencyPeriod: string;
  color: string;
  sharedwith: (string | ObjectId)[];
  sortOrder: number;
  createdAt: Date;
  updatedat: Date;
}

export interface IHabitLog {
  _id?: ObjectId;
  habitid: string | ObjectId;
  ownerid: string | ObjectId;
  date: string;
  status: string;
  sharedwith: (string | ObjectId)[];
  updatedat: Date;
}

export interface IFriendship {
  _id?: ObjectId;
  initiatorId: string | ObjectId;
  receiverId: string | ObjectId;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
