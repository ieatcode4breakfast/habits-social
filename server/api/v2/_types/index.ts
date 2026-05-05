export interface IUser {
  id?: string;
  email: string;
  username: string;
  passwordHash: string;
  photourl?: string | null;
  emailVerifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHabit {
  id?: string;
  ownerid: string;
  title: string;
  description: string;
  skipsCount: number;
  skipsPeriod: string;
  color: string;
  sharedwith: string[];
  sortOrder: number;
  currentStreak: number;
  longestStreak: number;
  streakAnchorDate: Date | null;
  user_date?: string | null;
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

export interface IBucket {
  id?: string;
  ownerid: string;
  title: string;
  description?: string;
  color?: string;
  sortOrder: number;
  currentStreak: number;
  longestStreak: number;
  streakAnchorDate: Date | null;
  createdAt: Date;
  updatedat: Date;
}

export interface IBucketLog {
  id?: string;
  bucketid: string;
  ownerid: string;
  date: string;
  status: string;
  streakCount: number;
  brokenStreakCount?: number;
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

export interface IShareEvent {
  id?: string;
  ownerid: string;
  recipientid: string;
  habitids: string[];
  user_date: string;
  created_at: Date;
}

export interface ISyncDeletion {
  ownerid: string;
  entity_id: string;
  entity_type: string;
  created_at: Date;
}
