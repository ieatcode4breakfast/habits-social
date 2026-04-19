import React, { useEffect, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Search, UserPlus, Check, X, User } from "lucide-react";
import { Link } from "react-router-dom";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL: string;
}

interface Friendship {
  id: string;
  participants: string[];
  initiatorId: string;
  receiverId: string;
  status: "pending" | "accepted";
}

export const Social = () => {
  const { user } = useAuth();
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [friendsProfiles, setFriendsProfiles] = useState<Record<string, UserProfile>>({});
  
  const loadFriendships = async () => {
    if (!user) return;
    const q = query(collection(db, "friendships"), where("participants", "array-contains", user.uid));
    const snap = await getDocs(q);
    const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as Friendship));
    setFriendships(loaded);

    // Load profiles for participants
    const uidsToLoad = new Set<string>();
    loaded.forEach(f => {
      uidsToLoad.add(f.participants[0]);
      uidsToLoad.add(f.participants[1]);
    });
    uidsToLoad.delete(user.uid);

    const profiles: Record<string, UserProfile> = {};
    for (const uid of uidsToLoad) {
      if (!uid) continue;
      // Note: for production, use 'in' queries grouped by 10/30.
      const qUser = query(collection(db, "users"), where("__name__", "==", uid));
      const uSnap = await getDocs(qUser);
      if (!uSnap.empty) {
        profiles[uid] = { id: uSnap.docs[0].id, ...uSnap.docs[0].data() } as UserProfile;
      }
    }
    setFriendsProfiles(profiles);
  };

  useEffect(() => {
    loadFriendships();
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim() || !user) return;
    
    // Exact email match for finding friends
    const q = query(collection(db, "users"), where("email", "==", searchEmail.trim()));
    const snap = await getDocs(q);
    setSearchResults(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)).filter(u => u.id !== user.uid));
  };

  const sendRequest = async (targetUserId: string) => {
    if (!user) return;
    // Sort array so friendship Id is deterministic
    const p = [user.uid, targetUserId].sort();
    const friendshipId = `${p[0]}_${p[1]}`;
    
    await setDoc(doc(db, "friendships", friendshipId), {
      participants: p,
      initiatorId: user.uid,
      receiverId: targetUserId,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    loadFriendships();
    setSearchResults([]);
    setSearchEmail("");
  };

  const acceptRequest = async (fid: string) => {
    await updateDoc(doc(db, "friendships", fid), {
      status: "accepted",
      updatedAt: serverTimestamp()
    });
    loadFriendships();
  };

  const removeFriend = async (fid: string) => {
    await deleteDoc(doc(db, "friendships", fid));
    loadFriendships();
  };

  if (!user) return null;

  const pendingIncoming = friendships.filter(f => f.status === "pending" && f.receiverId === user.uid);
  const acceptedFriends = friendships.filter(f => f.status === "accepted");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-gray-900 mb-2">Social</h1>
        <p className="text-[16px] text-gray-500 font-normal">Connect with friends and view their progress</p>
      </div>

      {pendingIncoming.length > 0 && (
        <div className="bg-white border text-sm border-gray-200 rounded-[16px] p-4">
          <h2 className="text-[14px] font-[600] uppercase tracking-[0.05em] text-gray-500 mb-4">Friend Requests</h2>
          <div className="space-y-3">
            {pendingIncoming.map(req => {
              const profile = friendsProfiles[req.initiatorId];
              if (!profile) return null;
              return (
                <div key={req.id} className="flex items-center justify-between bg-white border border-gray-100 p-4 rounded-[12px]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                      {profile.photoURL ? <img src={profile.photoURL} alt="photo" referrerPolicy="no-referrer" /> : <User className="w-5 h-5 text-gray-500" />}
                    </div>
                    <div>
                      <div className="font-[600] text-gray-900 text-[16px]">{profile.displayName}</div>
                      <div className="text-gray-500 text-xs">{profile.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => acceptRequest(req.id)} className="p-2 bg-[#10B981] hover:bg-[#059669] text-white rounded-[10px] transition-colors border-2 border-[#10B981]">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => removeFriend(req.id)} className="p-2 bg-white hover:bg-gray-50 text-gray-400 border border-gray-200 rounded-[10px] transition-colors hover:text-gray-900">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Friend */}
      <div className="bg-white border border-gray-200 rounded-[16px] p-4 md:p-6">
        <h2 className="text-[14px] font-[600] uppercase tracking-[0.05em] text-gray-500 mb-4">Add Friend</h2>
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="Friend's email address"
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 flex-grow focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-sm text-gray-900 placeholder:font-normal"
            />
          </div>
          <button type="submit" className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-[10px] transition-colors font-medium text-[14px]">
            Search
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-3">
            {searchResults.map(res => {
              const sorted = [user.uid, res.id].sort();
              const fid = `${sorted[0]}_${sorted[1]}`;
              const existing = friendships.find(f => f.id === fid);
              
              return (
                <div key={res.id} className="flex items-center justify-between bg-white border border-gray-200 p-4 rounded-[12px]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                      {res.photoURL ? <img src={res.photoURL} alt="photo" referrerPolicy="no-referrer" /> : <User className="w-5 h-5 text-gray-500" />}
                    </div>
                    <div>
                      <div className="font-[600] text-gray-900 text-[16px]">{res.displayName}</div>
                      <div className="text-gray-500 text-xs">{res.email}</div>
                    </div>
                  </div>
                  {existing ? (
                    <span className="text-[12px] font-[600] text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                      {existing.status === "accepted" ? "Friends" : "Pending"}
                    </span>
                  ) : (
                    <button onClick={() => sendRequest(res.id)} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-[10px] transition-colors font-medium text-sm">
                      <UserPlus className="w-4 h-4" />
                      Add
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Friends List */}
      <div className="bg-white border border-gray-200 rounded-[16px] p-4 md:p-6">
        <h2 className="text-[14px] font-[600] uppercase tracking-[0.05em] text-gray-500 mb-4 px-1">My Friends</h2>
        {acceptedFriends.length === 0 ? (
          <p className="text-gray-500 text-sm px-1">No friends added yet. Search by email to connect!</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {acceptedFriends.map(f => {
              const friendId = f.participants.find(p => p !== user.uid)!;
              const profile = friendsProfiles[friendId];
              if (!profile) return null;

              return (
                <Link
                  key={f.id}
                  to={`/friends/${friendId}`}
                  className="flex items-center gap-4 bg-white p-4 rounded-[12px] border border-gray-200 hover:border-indigo-300 transition-all group"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                    {profile.photoURL ? <img src={profile.photoURL} alt="photo" referrerPolicy="no-referrer" /> : <User className="w-6 h-6 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-[600] text-[16px] text-gray-900 truncate group-hover:text-indigo-600 transition-colors">{profile.displayName}</div>
                    <div className="text-gray-500 text-[13px] truncate">{profile.email}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
