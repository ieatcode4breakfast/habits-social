import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../components/AuthProvider";
import { Habit, HabitLog, getFriendHabits, getFriendHabitLogs } from "../lib/api";
import { format, subDays } from "date-fns";
import { ArrowLeft, User } from "lucide-react";
import { supabase } from "../lib/supabase";

export const FriendView = () => {
  const { friendId } = useParams<{ friendId: string }>();
  const { user } = useAuth();
  
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Generate last 7 days
  const today = new Date();
  const days = Array.from({ length: 7 }).map((_, i) => subDays(today, 6 - i));

  useEffect(() => {
    const loadData = async () => {
      if (!user || !friendId) return;
      setLoading(true);
      try {
        const { data: uSnap } = await supabase.from('users').select('*').eq('id', friendId);
        if (uSnap && uSnap.length > 0) {
          setProfile(uSnap[0]);
        }

        const [h, l] = await Promise.all([
          getFriendHabits(friendId, user.id),
          getFriendHabitLogs(friendId, user.id)
        ]);
        setHabits(h);
        setLogs(l);
      } catch (e) {
        console.error("Failed to load friend's profile or habits", e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, friendId]);

  if (loading) return <div className="text-gray-500 dark:text-gray-400">Loading friend's habits...</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <Link to="/social" className="inline-flex items-center justify-center w-10 h-10 rounded-[12px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </Link>
        
        {profile && (
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
              {profile.photoURL ? <img src={profile.photoURL} alt="photo" referrerPolicy="no-referrer" /> : <User className="w-6 h-6 text-gray-500 dark:text-gray-400" />}
            </div>
            <div>
              <h1 className="text-[28px] font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-1">{profile.displayName}'s Habits</h1>
              <p className="text-gray-500 dark:text-gray-400 text-[16px]">Habits shared with you</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-[16px] overflow-x-auto tracking-tight text-[14px]">
        <table className="w-full text-left border-collapse min-w-max">
          <thead>
            <tr>
              <th className="p-4 border-b border-gray-200 dark:border-gray-800 font-medium text-gray-500 w-full min-w-[150px]">
                <div className="text-[14px] font-[600] uppercase tracking-[0.05em] text-gray-500 dark:text-gray-400">Shared Habits</div>
              </th>
              {days.map((day, i) => (
                <th key={i} className="p-4 border-b border-gray-200 dark:border-gray-800 text-center font-medium text-gray-500 min-w-[48px]">
                  <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{format(day, "E")}</div>
                  <div className="mt-1 text-gray-900 dark:text-gray-100 text-[16px]">{format(day, "d")}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {habits.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500 dark:text-gray-400">
                  {profile?.displayName} hasn't shared any habits with you yet.
                </td>
              </tr>
            ) : (
              habits.map((habit) => (
                <tr key={habit.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <td className="p-4 font-[600] text-gray-900 dark:text-gray-100 flex items-center gap-3 text-[16px]">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: habit.color }} />
                    {habit.title}
                  </td>
                  {days.map((day, i) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const isCompleted = logs.some(l => l.habitId === habit.id && l.date === dateStr && l.status === "completed");
                    return (
                      <td key={i} className="p-2 text-center pointer-events-none">
                        <div
                          className="w-10 h-10 rounded-[12px] mx-auto flex items-center justify-center transition-all border-2 border-transparent"
                          style={{
                            backgroundColor: isCompleted ? '#10B981' : '#F3F4F6', // changed uncompleted to F3F4F6
                            borderColor: isCompleted ? '#10B981' : 'transparent',
                            opacity: isCompleted ? 1 : 0.5
                          }}
                        >
                          <span style={{ color: isCompleted ? 'white' : 'transparent' }}>✓</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
