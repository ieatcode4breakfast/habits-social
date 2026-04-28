export interface IUser {
  id?: string;
  email: string;
  username: string;
  passwordHash: string;
  photourl?: string;
  createdAt: Date;
}

export interface IHabit {
  id?: string;
  ownerid: string;
  title: string;
  description: string;
  frequencyCount: number;
  frequencyPeriod: string;
  color: string;
  sharedwith: string[];
  sortOrder: number;
  currentStreak: number;
  longestStreak: number;
  streakAnchorDate: Date | null;
  createdAt: Date;
  updatedat: Date;
}

export interface IHabitLog {
  id?: string;
  habitid: string;
  ownerid: string;
  date: string;
  status: string;
  streakCount: number;
  brokenStreakCount?: number;
  sharedwith: string[];
  updatedat: Date;
}

export interface IFriendship {
  id?: string;
  initiatorId: string;
  receiverId: string;
  status: string;
  initiatorFavorite?: boolean;
  receiverFavorite?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
