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
  skipsCount: number;
  skipsPeriod: string;
  color: string;
  sharedwith: string[];
  sortOrder: number;
  currentStreak: number;
  longestStreak: number;
  streakAnchorDate: Date | null;
  user_date?: string;
  createdAt: Date;
  updatedat: Date;
}

export interface IShareEvent {
  id?: string;
  ownerid: string;
  recipientid: string;
  habitids: string[];
  user_date: string;
  created_at: Date;
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

export interface IBucket {
  id?: string;
  ownerid: string;
  title: string;
  description?: string;
  color?: string;
  currentStreak: number;
  longestStreak: number;
  streakAnchorDate: Date | null;
  sortOrder: number;
  createdAt: Date;
  updatedat: Date;
  // Shared metadata
  sharedMembers?: ISharedBucketMember[];
  sharedHabits?: IBucketHabit[];
}

export interface ISharedBucketMember {
  bucket_id: string;
  user_id: string;
  username?: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at?: Date;
  updated_at?: Date;
}

export interface IBucketHabit {
  bucket_id: string;
  habit_id: string;
  added_by: string;
  approval_status: 'pending' | 'accepted' | 'declined' | 'removed';
  habitOwnerId?: string;
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
