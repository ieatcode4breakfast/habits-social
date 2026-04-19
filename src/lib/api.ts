import { collection, query, where, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { format } from "date-fns";

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
  const q = query(collection(db, "habits"), where("ownerId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Habit));
};

export const createHabit = async (userId: string, data: Partial<Habit>) => {
  const docRef = doc(collection(db, "habits"));
  await setDoc(docRef, {
    ownerId: userId,
    title: data.title || "New Habit",
    description: data.description || "",
    color: data.color || "#3b82f6",
    sharedWith: data.sharedWith || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateHabit = async (habitId: string, data: Partial<Habit>) => {
  const docRef = doc(db, "habits", habitId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteHabit = async (habitId: string) => {
  // First, delete related logs
  const q = query(collection(db, "habitLogs"), where("habitId", "==", habitId));
  const snap = await getDocs(q);
  const batchDeletes = snap.docs.map(d => deleteDoc(d.ref));
  await Promise.all(batchDeletes);
  
  // Then delete the habit
  await deleteDoc(doc(db, "habits", habitId));
};

export const getHabitLogs = async (userId: string) => {
  const q = query(collection(db, "habitLogs"), where("ownerId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as HabitLog));
};

export const getFriendHabits = async (friendId: string, currentUserId: string) => {
  const q = query(collection(db, "habits"), where("ownerId", "==", friendId), where("sharedWith", "array-contains", currentUserId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Habit));
};

export const getFriendHabitLogs = async (friendId: string, currentUserId: string) => {
  const q = query(collection(db, "habitLogs"), where("ownerId", "==", friendId), where("sharedWith", "array-contains", currentUserId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as HabitLog));
};

export const toggleHabitLog = async (userId: string, habit: Habit, date: string, currentStatus?: string) => {
  // First see if it exists
  const q = query(collection(db, "habitLogs"), where("ownerId", "==", userId), where("habitId", "==", habit.id), where("date", "==", date));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    if (currentStatus === "completed") return; // Nothing to do if targeting completed when it doesn't exist? Wait, toggle means we want to CREATE it as completed.
    const docRef = doc(collection(db, "habitLogs"));
    await setDoc(docRef, {
      habitId: habit.id,
      ownerId: userId,
      date,
      status: "completed",
      sharedWith: habit.sharedWith,
      updatedAt: serverTimestamp()
    });
  } else {
    // Exists, toggle or delete
    const logDoc = snap.docs[0];
    if (logDoc.data().status === "completed") {
      // Toggle to something else or delete. Let's say delete to unclutter for skipping unless explicitly skipped
      await deleteDoc(logDoc.ref);
    } else {
      await updateDoc(logDoc.ref, {
        status: "completed",
        sharedWith: habit.sharedWith,
        updatedAt: serverTimestamp()
      });
    }
  }
};

export const syncHabitLogsSharedWith = async (habit: Habit) => {
  // If habit share changes, we must update all its logs
  const q = query(collection(db, "habitLogs"), where("habitId", "==", habit.id));
  const snap = await getDocs(q);
  const batchUpdates = snap.docs.map(d => updateDoc(d.ref, {
    sharedWith: habit.sharedWith,
    updatedAt: serverTimestamp()
  }));
  await Promise.all(batchUpdates);
};
