export interface IUser {
  id?: string;
  email: string;
  username: string;
  passwordHash: string;
  photoUrl?: string;
  emailVerifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHabit {
  id?: string;
  ownerId: string;
  title: string;
  description: string;
  skipsCount: number;
  skipsPeriod: string;
  color: string;
  sharedWith: string[];
  sortOrder: number;
  currentStreak: number;
  longestStreak: number;
  streakAnchorDate: Date | null;
  userDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IShareEvent {
  id?: string;
  ownerId: string;
  recipientId: string;
  habitIds: string[];
  userDate: string;
  createdAt: Date;
}

export interface IHabitLog {
  id?: string;
  habitId: string;
  ownerId: string;
  date: string;
  status: string;
  streakCount: number;
  brokenStreakCount?: number;
  sharedWith: string[];
  updatedAt: Date;
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
  ownerId: string;
  title: string;
  description?: string;
  color?: string;
  currentStreak: number;
  longestStreak: number;
  streakAnchorDate: Date | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  // Shared metadata
  sharedMembers?: ISharedBucketMember[];
  sharedHabits?: IBucketHabit[];
}

export interface ISharedBucketMember {
  bucketId: string;
  userId: string;
  username?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IBucketHabit {
  bucketId: string;
  habitId: string;
  addedBy: string;
  approvalStatus: 'pending' | 'accepted' | 'declined' | 'removed';
  habitOwnerId?: string;
}

export interface IBucketLog {
  id?: string;
  bucketId: string;
  ownerId: string;
  date: string;
  status: string;
  streakCount: number;
  brokenStreakCount?: number;
  updatedAt: Date;
}

