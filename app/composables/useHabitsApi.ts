export interface Habit {
  id: string;
  ownerid: string;
  title: string;
  description: string;
  frequencyCount: number;
  frequencyPeriod: 'daily' | 'weekly' | 'monthly';
  color: string;
  sharedwith: string[];
}

export interface HabitLog {
  id: string;
  habitid: string;
  ownerid: string;
  date: string;
  status: 'completed' | 'skipped' | 'failed';
  sharedwith: string[];
}

export const useHabitsApi = () => {
  const getHabits = () => $fetch<Habit[]>('/api/habits');

  const createHabit = (data: Partial<Habit>) =>
    $fetch<Habit>('/api/habits', { method: 'POST', body: data });

  const updateHabit = (id: string, data: Partial<Habit>) =>
    $fetch<Habit>(`/api/habits/${id}`, { method: 'PUT', body: data });

  const deleteHabit = (id: string) =>
    $fetch(`/api/habits/${id}`, { method: 'DELETE' });

  const getLogs = (startDate: string, endDate: string) =>
    $fetch<HabitLog[]>('/api/habitlogs', { query: { startDate, endDate } });

  const upsertLog = (data: { habitid: string; date: string; status: string; sharedwith?: string[] }) =>
    $fetch<HabitLog>('/api/habitlogs', { method: 'POST', body: data });

  const getFriendHabits = (friendId: string) =>
    $fetch<{ habits: Habit[]; logs: HabitLog[] }>('/api/social/friend-data', { query: { friendId } });

  const deleteLog = (habitid: string, date: string) =>
    $fetch('/api/habitlogs', { method: 'DELETE', query: { habitid, date } });

  return { getHabits, createHabit, updateHabit, deleteHabit, getLogs, upsertLog, deleteLog, getFriendHabits };
};
