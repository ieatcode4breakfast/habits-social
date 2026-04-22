export interface Habit {
  id: string;
  ownerid: string;
  title: string;
  description?: string;
  color: string;
  sharedwith: string[];
}

export interface HabitLog {
  id: string;
  habitid: string;
  ownerid: string;
  date: string;
  status: "completed" | "skipped" | "failed";
  sharedwith: string[];
}

export const useHabitsApi = () => {
  const getMyHabits = async (userId: string) => {
    return await $fetch<Habit[]>("/api/habits");
  };

  const createHabit = async (userId: string, data: Partial<Habit>) => {
    const newHabit = await $fetch<Habit>("/api/habits", {
      method: "POST",
      body: data
    });
    return newHabit.id;
  };

  const updateHabit = async (habitId: string, data: Partial<Habit>) => {
    await $fetch(`/api/habits/${habitId}`, {
      method: "PUT",
      body: data
    });
  };

  const deleteHabit = async (habitId: string) => {
    await $fetch(`/api/habits/${habitId}`, {
      method: "DELETE"
    });
  };

  const getHabitLogs = async (userId: string) => {
    return await $fetch<HabitLog[]>("/api/habitlogs", {
      query: { ownerId: userId }
    });
  };

  const toggleHabitLog = async (userId: string, habit: Habit, date: string, currentStatus?: string) => {
    await $fetch("/api/habitlogs", {
      method: "POST",
      body: {
        habitId: habit.id,
        date,
        currentStatus,
        sharedwith: habit.sharedwith
      }
    });
  };

  const getFriendHabits = async (friendId: string, currentUserId: string) => {
    return await $fetch<Habit[]>("/api/social/friend-data", {
      query: { friendId, type: 'habits' }
    });
  };

  const getFriendHabitLogs = async (friendId: string, currentUserId: string) => {
    return await $fetch<HabitLog[]>("/api/social/friend-data", {
      query: { friendId, type: 'logs' }
    });
  };

  return {
    getMyHabits,
    createHabit,
    updateHabit,
    deleteHabit,
    getHabitLogs,
    toggleHabitLog,
    getFriendHabits,
    getFriendHabitLogs
  };
};
