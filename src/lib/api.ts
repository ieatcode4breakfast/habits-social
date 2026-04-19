import { supabase } from "./supabase";

export interface Habit {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  color: string;
  sharedWith: string[];
}

export interface HabitLog {
  id: string;
  habitId: string;
  ownerId: string;
  date: string;
  status: "completed" | "skipped" | "failed";
  sharedWith: string[];
}

export const getMyHabits = async (userId: string) => {
  const { data, error } = await supabase.from("habits").select("*").eq("ownerId", userId);
  if (error) throw error;
  return data as Habit[];
};

export const createHabit = async (userId: string, data: Partial<Habit>) => {
  const { data: newHabit, error } = await supabase.from("habits").insert({
    ownerId: userId,
    title: data.title || "New Habit",
    description: data.description || "",
    color: data.color || "#3b82f6",
    sharedWith: data.sharedWith || [],
  }).select("id").single();
  
  if (error) throw error;
  return newHabit.id;
};

export const updateHabit = async (habitId: string, data: Partial<Habit>) => {
  const { error } = await supabase.from("habits").update({
    ...data,
    updatedAt: new Date().toISOString()
  }).eq("id", habitId);
  
  if (error) throw error;
};

export const deleteHabit = async (habitId: string) => {
  // Related logs will be deleted via Postgres ON DELETE CASCADE
  // Since we defined `REFERENCES habits(id) ON DELETE CASCADE` on `habitLogs.habitId`
  const { error } = await supabase.from("habits").delete().eq("id", habitId);
  if (error) throw error;
};

export const getHabitLogs = async (userId: string) => {
  const { data, error } = await supabase.from("habitLogs").select("*").eq("ownerId", userId);
  if (error) throw error;
  return data as HabitLog[];
};

export const getFriendHabits = async (friendId: string, currentUserId: string) => {
  // Use Postgres array "contains" `cs` to check if array contains currentUserId
  const { data, error } = await supabase.from("habits")
    .select("*")
    .eq("ownerId", friendId)
    .contains("sharedWith", [currentUserId]);
    
  if (error) throw error;
  return data as Habit[];
};

export const getFriendHabitLogs = async (friendId: string, currentUserId: string) => {
  const { data, error } = await supabase.from("habitLogs")
    .select("*")
    .eq("ownerId", friendId)
    .contains("sharedWith", [currentUserId]);
    
  if (error) throw error;
  return data as HabitLog[];
};

export const toggleHabitLog = async (userId: string, habit: Habit, date: string, currentStatus?: string) => {
  const { data: logs, error: fetchError } = await supabase.from("habitLogs")
    .select("*")
    .eq("ownerId", userId)
    .eq("habitId", habit.id)
    .eq("date", date);

  if (fetchError) throw fetchError;

  if (!logs || logs.length === 0) {
    if (currentStatus === "completed") return; // Toggle to completed when it doesn't exist
    const { error: insertError } = await supabase.from("habitLogs").insert({
      habitId: habit.id,
      ownerId: userId,
      date,
      status: "completed",
      sharedWith: habit.sharedWith
    });
    if (insertError) throw insertError;
  } else {
    const logDoc = logs[0];
    if (logDoc.status === "completed") {
      // Toggle to delete
      const { error: deleteError } = await supabase.from("habitLogs").delete().eq("id", logDoc.id);
      if (deleteError) throw deleteError;
    } else {
      const { error: updateError } = await supabase.from("habitLogs").update({
        status: "completed",
        sharedWith: habit.sharedWith,
        updatedAt: new Date().toISOString()
      }).eq("id", logDoc.id);
      if (updateError) throw updateError;
    }
  }
};

export const syncHabitLogsSharedWith = async (habit: Habit) => {
  const { error } = await supabase.from("habitLogs")
    .update({
      sharedWith: habit.sharedWith,
      updatedAt: new Date().toISOString()
    })
    .eq("habitId", habit.id);

  if (error) throw error;
};
