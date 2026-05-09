import { format, parseISO } from 'date-fns';

export interface NarratorUser {
  id: string;
  name: string;
  photoUrl: string | null;
}

export interface NarratorHabit {
  id: string | null;
  title: string;
}

export interface FeedItem {
  id: string;
  type: string;
  user: NarratorUser;
  habit: NarratorHabit;
  habits?: NarratorHabit[];
  message: string;
  date: string;
  timestamp: Date;
}

export class SocialNarratorService {
  static formatStreak(days: number, isBroken: boolean = false) {
    const suffix = isBroken ? ':broken' : '';
    if (days < 365) return `[S:${days}${suffix}]${days}-day streak[/S]`;
    const years = Math.floor(days / 365);
    const rem = days % 365;
    const yt = years === 1 ? '1-year' : `${years}-year`;
    if (rem === 0) return `[S:${days}${suffix}]${yt} streak (${days} days)[/S]`;
    return `[S:${days}${suffix}]${yt} and ${rem}-day streak (${days} days)[/S]`;
  }

  static formatExtensionDuration(days: number) {
    if (days < 365) return `[S:${days}]${days} days[/S]`;
    const years = Math.floor(days / 365);
    const rem = days % 365;
    const yt = years === 1 ? '1-year' : `${years}-year`;
    if (rem === 0) return `[S:${days}]${yt} (${days} days)[/S]`;
    const dt = rem === 1 ? '1 day' : `${rem} days`;
    return `[S:${days}]${yt} and ${dt} (${days} days)[/S]`;
  }

  static narrateLog(log: any, currentUserId: string): FeedItem | null {
    let type = '';
    let message = '';
    const dateFormatted = format(parseISO(log.date), 'MMM d');
    const pronoun = log.ownerId === currentUserId ? 'your' : 'their';
    const isVeteran = (log.streakCount || 0) >= 365;
    const milestones = [5, 7, 14, 21, 30, 60, 90, 100, 180, 300];

    if (log.status === 'completed' && log.streakCount === 1) {
      type = 'INITIAL_COMPLETION';
      message = `completed [H]${log.habitTitle}[/H] for ${dateFormatted}.`;
    } else if (log.status === 'skipped' && log.streakCount <= 1) {
      type = 'INITIAL_SKIP';
      message = `skipped [H]${log.habitTitle}[/H] for ${dateFormatted}.`;
    } else if (log.status === 'failed' && log.streakCount === 0 && (log.brokenStreakCount || 0) <= 1) {
      type = 'INITIAL_FAILURE';
      message = `failed [H]${log.habitTitle}[/H] for ${dateFormatted}.`;
    } else if (log.status === 'vacation' && log.streakCount <= 1) {
      type = 'INITIAL_VACATION';
      message = `took a vacation day for [H]${log.habitTitle}[/H] on ${dateFormatted}.`;
    } else if (log.status === 'completed' && log.streakCount > 1) {
      const isAnnual = log.streakCount % 365 === 0;
      const rem = log.streakCount % 365;
      if (log.streakCount === 2 && !isVeteran) {
        type = 'STREAK_STARTED';
        message = `started a streak by completing [H]${log.habitTitle}[/H] for ${dateFormatted}. That's [S:2]2[/S] in row!`;
      } else if ((log.streakCount === 3 || log.streakCount === 4) && !isVeteran) {
        type = 'STREAK_CONTINUED';
        message = `hit a [S:${log.streakCount}]${log.streakCount}-day streak[/S] by completing [H]${log.habitTitle}[/H] for ${dateFormatted}.`;
      } else if (isAnnual) {
        type = 'ANNUAL_ANNIVERSARY';
        message = `hit a ${this.formatStreak(log.streakCount)} by completing [H]${log.habitTitle}[/H] for ${dateFormatted}!`;
      } else if (log.streakCount < 365 && milestones.includes(log.streakCount)) {
        if (!(isVeteran && log.streakCount === 5)) {
          type = 'STREAK_MILESTONE';
          message = `hit a [S:${log.streakCount}]${log.streakCount}-day streak[/S] by completing [H]${log.habitTitle}[/H] for ${dateFormatted}!`;
        }
      } else if (log.streakCount > 365 && rem >= 7 && milestones.includes(rem)) {
        type = 'POST_YEAR_MILESTONE';
        message = `hit a ${this.formatStreak(log.streakCount)} by completing [H]${log.habitTitle}[/H] for ${dateFormatted}!`;
      } else if (log.streakCount > 4 || (isVeteran && log.streakCount >= 2)) {
        if (log.streakCount > 365) {
          type = 'POST_YEAR_EXTENSION';
          message = `completed [H]${log.habitTitle}[/H] for ${dateFormatted}—extending ${pronoun} streak to ${this.formatExtensionDuration(log.streakCount)}!`;
        } else {
          type = 'STREAK_EXTENSION';
          message = `completed [H]${log.habitTitle}[/H] for ${dateFormatted}—extending ${pronoun} streak to [S:${log.streakCount}]${log.streakCount} days[/S]!`;
        }
      }
    } else if (log.status === 'failed' && (log.brokenStreakCount || 0) > 1) {
      type = 'STREAK_BROKEN';
      message = `failed [H]${log.habitTitle}[/H] for ${dateFormatted}, bringing ${pronoun} ${this.formatStreak(log.brokenStreakCount as number, true)} to an end.`;
    } else if (log.status === 'skipped' && log.streakCount > 1) {
      type = 'STREAK_MAINTAINED';
      message = `skipped [H]${log.habitTitle}[/H] for ${dateFormatted}; ${pronoun} ${this.formatStreak(log.streakCount)} remains intact.`;
    } else if (log.status === 'vacation' && log.streakCount > 1) {
      type = 'STREAK_MAINTAINED_VACATION';
      message = `took a vacation day for [H]${log.habitTitle}[/H] on ${dateFormatted}; ${pronoun} ${this.formatStreak(log.streakCount)} remains intact.`;
    }

    if (type) {
      return {
        id: log.id,
        type,
        user: {
          id: log.ownerId,
          name: log.ownerId === currentUserId ? 'You' : log.username,
          photoUrl: log.photoUrl
        },
        habit: {
          id: log.habitId,
          title: log.habitTitle
        },
        message,
        date: log.date,
        timestamp: log.updatedAt
      };
    }
    return null;
  }

  static narrateCommitment(c: any, currentUserId: string): FeedItem {
    const dateFormatted = format(parseISO(c.date), 'MMM d');
    return {
      id: `commitment-${c.id}`,
      type: 'COMMITMENT',
      user: {
        id: c.ownerId,
        name: c.ownerId === currentUserId ? 'You' : c.username,
        photoUrl: c.photoUrl
      },
      habit: {
        id: c.id,
        title: c.habitTitle
      },
      message: `committed to a new habit: [H]${c.habitTitle}[/H] on ${dateFormatted}.`,
      date: c.date,
      timestamp: c.updatedAt
    };
  }

  static narrateShare(se: any, currentUserId: string, habitTitles: Record<string, string>): FeedItem {
    const dateFormatted = format(parseISO(se.date), 'MMM d');
    const habitIds = (se.habitIds || []).map(String);
    const habits = habitIds.map((hid: string) => ({
      id: hid,
      title: habitTitles[hid] || 'Unknown Habit'
    }));

    const isOwner = se.ownerId === currentUserId;
    const recipientLabel = se.recipientId === currentUserId ? 'you' : se.recipientUsername;
    const recipientFormatted = `[U:${se.recipientId}]${recipientLabel}[/U]`;

    let message: string;
    const habitText = habits.length === 1 ? `[H]${habits[0].title}[/H]` : `${habits.length} habits`;

    if (se.isGroupedAction) {
      message = `shared ${habitText} with ${se.recipientCount} friends on ${dateFormatted}.`;
    } else {
      message = `shared ${habitText} with ${recipientFormatted} on ${dateFormatted}.`;
    }

    return {
      id: `share-${se.id}`,
      type: 'SHARE',
      user: {
        id: se.ownerId,
        name: isOwner ? 'You' : se.username,
        photoUrl: se.photoUrl
      },
      habit: habits.length === 1 ? habits[0] : { id: null, title: habits.map((h: any) => h.title).join(', ') },
      habits,
      message,
      date: se.date,
      timestamp: se.updatedAt
    };
  }
}
