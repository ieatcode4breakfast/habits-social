import { useEffect, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { Habit, HabitLog, getMyHabits, getHabitLogs, createHabit, toggleHabitLog, deleteHabit } from "../lib/api";
import { format, subDays } from "date-fns";
import { Plus, Settings2 } from "lucide-react";
import { cn } from "../lib/utils";
import { EditHabitModal } from "../components/EditHabitModal";

export const Dashboard = () => {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  // Generate last 7 days
  const today = new Date();
  const days = Array.from({ length: 7 }).map((_, i) => subDays(today, 6 - i));

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [h, l] = await Promise.all([getMyHabits(user.id), getHabitLogs(user.id)]);
      setHabits(h);
      setLogs(l);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleCreate = async () => {
    if (!user) return;
    const newHabitId = await createHabit(user.id, { title: "New Habit", color: "#3b82f6" });
    await loadData();
    const newHabit = habits.find(h => h.id === newHabitId) || { id: newHabitId, ownerId: user.id, title: "New Habit", color: "#3b82f6", sharedWith: [] } as Habit;
    setEditingHabit(newHabit);
  };

  const handleDelete = async (habitId: string) => {
    await deleteHabit(habitId);
    setEditingHabit(null);
    loadData();
  };

  const handleToggle = async (habit: Habit, date: Date) => {
    if (!user) return;
    const dateStr = format(date, "yyyy-MM-dd");
    const log = logs.find(l => l.habitId === habit.id && l.date === dateStr);
    
    // Optimistic update
    const newLogs = [...logs];
    if (log && log.status === "completed") {
      setLogs(newLogs.filter(l => l.id !== log.id));
    } else {
      if (log) log.status = "completed";
      else newLogs.push({ id: "temp", habitId: habit.id, ownerId: user.id, date: dateStr, status: "completed", sharedWith: habit.sharedWith });
      setLogs(newLogs);
    }

    try {
      await toggleHabitLog(user.id, habit, dateStr, log?.status);
      loadData();
    } catch (e) {
      console.error(e);
      loadData();
    }
  };

  if (loading) return <div className="text-gray-500 dark:text-gray-400">Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
            Hello, {user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0]} 👋
          </h1>
          <p className="text-[16px] text-gray-500 dark:text-gray-400 font-normal">Track your daily progress</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden md:inline">Add Habit</span>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-[16px] overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-max">
          <thead>
            <tr>
              <th className="p-4 border-b border-gray-200 dark:border-gray-800 font-medium text-gray-500 w-full min-w-[150px]">
                <div className="text-[14px] font-[600] uppercase tracking-[0.05em] text-gray-500 dark:text-gray-400">My Habits</div>
              </th>
              {days.map((day, i) => (
                <th key={i} className="p-4 border-b border-gray-200 dark:border-gray-800 text-center font-medium text-gray-500 min-w-[48px]">
                  <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{format(day, "E")}</div>
                  <div className="mt-1 text-gray-900 dark:text-gray-100 text-base">{format(day, "d")}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {habits.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No habits yet. Click "Add Habit" to get started!
                </td>
              </tr>
            ) : (
              habits.map((habit) => (
                <tr key={habit.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <td className="p-4 font-medium text-gray-900 dark:text-gray-100 group">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: habit.color }} />
                      <button onClick={() => setEditingHabit(habit)} className="hover:underline flex items-center gap-2 text-[16px] font-[600] text-gray-900 dark:text-gray-100">
                        {habit.title}
                        <Settings2 className="w-4 h-4 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </div>
                  </td>
                  {days.map((day, i) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const isCompleted = logs.some(l => l.habitId === habit.id && l.date === dateStr && l.status === "completed");
                    return (
                      <td key={i} className="p-2 text-center">
                        <button
                          onClick={() => handleToggle(habit, day)}
                          className={cn(
                            "w-10 h-10 rounded-[12px] transition-all mx-auto flex items-center justify-center border-2",
                            isCompleted
                              ? "border-transparent"
                              : "border-gray-200 dark:border-gray-700 text-white hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                          )}
                          style={{
                            backgroundColor: isCompleted ? '#10B981' : undefined,
                            borderColor: isCompleted ? '#10B981' : undefined,
                            color: isCompleted ? 'white' : 'transparent',
                          }}
                        >
                          ✓
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editingHabit && user && (
        <EditHabitModal
          habit={editingHabit}
          userId={user.id}
          onClose={() => setEditingHabit(null)}
          onSave={() => {
            setEditingHabit(null);
            loadData();
          }}
          onDelete={() => handleDelete(editingHabit.id)}
        />
      )}
    </div>
  );
};
