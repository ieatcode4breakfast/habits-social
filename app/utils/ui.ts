import { subDays, startOfDay, parseISO, isAfter } from 'date-fns';

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
 */
export const isStreakFaded = (item: { streakAnchorDate?: string | null }) => {
  if (!item || !item.streakAnchorDate) return false;
  const anchor = startOfDay(parseISO(item.streakAnchorDate));
  const yesterday = startOfDay(subDays(new Date(), 1));
  return isAfter(yesterday, anchor);
};

/**
 * Auto-expands a textarea height based on content.
 */
export const autoExpandTextarea = (e: Event | HTMLElement) => {
  const el = (e instanceof Event ? e.target : e) as HTMLTextAreaElement;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};
