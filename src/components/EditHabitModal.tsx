import React, { useState, useEffect } from "react";
import { Habit, updateHabit, syncHabitLogsSharedWith } from "../lib/api";
import { UserProfile } from "../pages/Social"; // Note: might need to export UserProfile from a types file or fetch it here. We'll duplicate the interface for now.
import { supabase } from "../lib/supabase";
import { X, Save, Trash2 } from "lucide-react";

interface Friendship {
  participants: string[];
  status: string;
}

export const EditHabitModal = ({
  habit,
  userId,
  onClose,
  onSave,
  onDelete
}: {
  habit: Habit;
  userId: string;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
}) => {
  const [title, setTitle] = useState(habit.title);
  const [description, setDescription] = useState(habit.description || "");
  const [color, setColor] = useState(habit.color);
  const [sharedWith, setSharedWith] = useState<string[]>(habit.sharedWith || []);
  
  const [friends, setFriends] = useState<{ id: string; email: string; displayName: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadFriends = async () => {
      const { data: acc, error } = await supabase.from('friendships')
        .select('*')
        .contains('participants', [userId])
        .eq('status', 'accepted');
        
      if (error || !acc) return;
      
      const friendIds = new Set<string>();
      acc.forEach(f => {
        friendIds.add(f.participants[0]);
        friendIds.add(f.participants[1]);
      });
      friendIds.delete(userId);

      if (friendIds.size === 0) {
        setFriends([]);
        return;
      }

      const { data: usersData } = await supabase.from('users')
        .select('*')
        .in('id', Array.from(friendIds));

      if (usersData) {
        setFriends(usersData as any[]);
      }
    };
    loadFriends();
  }, [userId]);

  const toggleShare = (fid: string) => {
    if (sharedWith.includes(fid)) {
      setSharedWith(sharedWith.filter(id => id !== fid));
    } else {
      setSharedWith([...sharedWith, fid]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const updated = { ...habit, title, description, color, sharedWith };
    await updateHabit(habit.id, { title, description, color, sharedWith });
    // Also sync the logs so they have the new sharedWith
    await syncHabitLogsSharedWith(updated);
    setLoading(false);
    onSave();
  };

  const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#6366f1", "#ec4899"];

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Edit Habit</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <form onSubmit={handleSave} className="p-4 md:p-6 overflow-y-auto space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
              <div className="flex gap-2 flex-wrap">
                {colors.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                    style={{ backgroundColor: c, border: color === c ? '2px solid #1e293b' : 'none' }}
                  >
                    {color === c && <div className="w-3 h-3 bg-white rounded-full" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="block text-sm font-medium text-slate-700 mb-2">Share with friends</label>
              {friends.length === 0 ? (
                <div className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  You haven't added any friends yet. Add friends on the Social tab.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 border scrollbar-thin scrollbar-thumb-slate-200 p-2 rounded-lg border-slate-100 bg-slate-50/50">
                  {friends.map(f => (
                    <label key={f.id} className="flex items-center gap-3 p-2 hover:bg-slate-100 rounded-md cursor-pointer transition-colors border border-transparent">
                      <input
                        type="checkbox"
                        checked={sharedWith.includes(f.id)}
                        onChange={() => toggleShare(f.id)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <span className="text-sm font-medium text-slate-800">{f.displayName}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-2 px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
