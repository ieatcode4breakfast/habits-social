export interface IUser {
  id?: string;
  email: string;
  username: string;
  passwordHash: string;
  photourl?: string;
  emailVerifiedAt?: Date | null;
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
