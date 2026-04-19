import type { Database } from '~/types/supabase' // Optional if we had types generated

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
  // @ts-ignore - Supabase client types might not be perfectly inferred until after first build
  const supabase = useSupabaseClient()

  const getMyHabits = async (userId: string) => {
    const { data, error } = await supabase.from("habits").select("*").eq("ownerid", userId);
    if (error) throw error;
    return data as Habit[];
  };

  const createHabit = async (userId: string, data: Partial<Habit>) => {
    const { data: newHabit, error } = await supabase.from("habits").insert({
      ownerid: userId,
      title: data.title || "New Habit",
      description: data.description || "",
      color: data.color || "#3b82f6",
      sharedwith: data.sharedwith || [],
    }).select("id").single();
    
    if (error) throw error;
    return newHabit.id as string;
  };

  const updateHabit = async (habitId: string, data: Partial<Habit>) => {
    const { error } = await supabase.from("habits").update({
      ...data,
      updatedat: new Date().toISOString()
    }).eq("id", habitId);
    
    if (error) throw error;
  };

  const deleteHabit = async (habitId: string) => {
    const { error } = await supabase.from("habits").delete().eq("id", habitId);
    if (error) throw error;
  };

  const getHabitLogs = async (userId: string) => {
    const { data, error } = await supabase.from("habitlogs").select("*").eq("ownerid", userId);
    if (error) throw error;
    return data as HabitLog[];
  };

  const toggleHabitLog = async (userId: string, habit: Habit, date: string, currentStatus?: string) => {
    const { data: logs, error: fetchError } = await supabase.from("habitlogs")
      .select("*")
      .eq("ownerid", userId)
      .eq("habitid", habit.id)
      .eq("date", date);

    if (fetchError) throw fetchError;

    if (!logs || logs.length === 0) {
      if (currentStatus === "completed") return; 
      const { error: insertError } = await supabase.from("habitlogs").insert({
        habitid: habit.id,
        ownerid: userId,
        date,
        status: "completed",
        sharedwith: habit.sharedwith || []
      });
      if (insertError) throw insertError;
    } else {
      const logDoc = logs[0];
      if (logDoc.status === "completed") {
        const { error: deleteError } = await supabase.from("habitlogs").delete().eq("id", logDoc.id);
        if (deleteError) throw deleteError;
      } else {
        const { error: updateError } = await supabase.from("habitlogs").update({
          status: "completed",
          sharedwith: habit.sharedwith || [],
          updatedat: new Date().toISOString()
        }).eq("id", logDoc.id);
        if (updateError) throw updateError;
      }
    }
  };

  const getFriendHabits = async (friendId: string, currentUserId: string) => {
    const { data, error } = await supabase.from("habits")
      .select("*")
      .eq("ownerid", friendId)
      .contains("sharedwith", [currentUserId]);
      
    if (error) throw error;
    return data as Habit[];
  };

  const getFriendHabitLogs = async (friendId: string, currentUserId: string) => {
    const { data, error } = await supabase.from("habitlogs") // note lowercase table name consistency
      .select("*")
      .eq("ownerid", friendId)
      .contains("sharedwith", [currentUserId]);
      
    if (error) throw error;
    return data as HabitLog[];
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
