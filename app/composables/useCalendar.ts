import { ref, computed } from 'vue';
import { startOfMonth, endOfMonth, eachDayOfInterval, subDays, addDays, subMonths, addMonths } from 'date-fns';

/**
 * Headless composable for managing calendar grid logic.
 */
export function useCalendar(initialDate = new Date()) {
  const currentDate = ref(initialDate);

  const days = computed(() => {
    const start = startOfMonth(currentDate.value);
    const end = endOfMonth(currentDate.value);
    const daysInMonth = eachDayOfInterval({ start, end });
    
    // Padding for the start of the week (Sunday-based)
    const firstDay = start.getDay();
    const paddingStart = Array.from({ length: firstDay }, (_, i) => subDays(start, firstDay - i));
    
    // Padding for the end of the week
    const lastDay = end.getDay();
    const paddingEnd = Array.from({ length: 6 - lastDay }, (_, i) => addDays(end, i + 1));
    
    return [...paddingStart, ...daysInMonth, ...paddingEnd];
  });

  const prevMonth = () => {
    currentDate.value = subMonths(currentDate.value, 1);
  };

  const nextMonth = () => {
    currentDate.value = addMonths(currentDate.value, 1);
  };

  return {
    currentDate,
    days,
    prevMonth,
    nextMonth
  };
}
