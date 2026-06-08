import { subDays, startOfDay, parseISO, isAfter, differenceInDays } from 'date-fns';

/**
 * Determines if a date is within the markable window.
 */
export const MARKABLE_DAY_WINDOW = 7;

export const isMarkable = (day: Date, referenceDate: Date = new Date()) => {
  const today = referenceDate;
  const diff = differenceInDays(startOfDay(today), startOfDay(day));
  return diff >= 0 && diff < MARKABLE_DAY_WINDOW;
};

/**
 * Returns a consistent theme based on the streak count.
 */
export const getStreakTheme = (count: number) => {
  if (count >= 30) return { 
    border: 'border-yellow-400/50 shadow-lg shadow-yellow-400/10', 
    text: 'text-yellow-400', 
    fill: 'fill-yellow-400/80' 
  };
  if (count >= 7) return { 
    border: 'border-violet-400/50 shadow-lg shadow-violet-400/10', 
    text: 'text-violet-400', 
    fill: 'fill-violet-400/80' 
  };
  return { 
    border: 'border-emerald-500/50', 
    text: 'text-emerald-500', 
    fill: 'fill-emerald-500/80' 
  };
};

/**
 * Determines if a streak should be visually faded (e.g., if missed yesterday).
 * Accepts either a string date or an object with a streakAnchorDate property.
 */
export function isStreakFaded(
  item: string | { streakAnchorDate?: string | null } | null,
  referenceDate: Date = new Date()
) {
  if (!item) return false;
  const dateStr = typeof item === 'string' ? item : item.streakAnchorDate;
  if (!dateStr) return false;
  
  const anchor = startOfDay(parseISO(dateStr));
  const yesterday = startOfDay(subDays(referenceDate, 1));
  return isAfter(yesterday, anchor);
}

/**
 * Auto-expands a textarea height based on content.
 */
export const autoExpandTextarea = (e: Event | HTMLElement) => {
  const el = (e instanceof Event ? e.target : e) as HTMLTextAreaElement;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};
