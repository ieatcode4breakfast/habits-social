<template>
  <div>
    <!-- Edit Profile Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="modelValue" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="handleProfileCloseAttempt"></div>
          
          <div class="relative w-full max-w-md bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 overflow-y-auto">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h2 class="text-2xl font-bold text-white">Edit Profile</h2>
                <p class="text-zinc-500 text-sm">Update your account settings</p>
              </div>
              <button @click="handleProfileCloseAttempt" class="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all cursor-pointer">
                <XIcon class="w-5 h-5" />
              </button>
            </div>

            <form @submit.prevent="triggerProfileUpdate" class="space-y-4">
              <!-- Avatar Selection Preview -->
              <div class="space-y-4 flex flex-col items-center pb-2">
                <label class="text-xs font-bold text-zinc-500 uppercase tracking-widest">Profile Avatar</label>
                
                <div class="flex flex-col items-center gap-4">
                  <div class="relative">
                    <div class="w-24 h-24 rounded-3xl bg-black border-2 border-zinc-800 overflow-hidden shadow-inner flex items-center justify-center">
                      <img v-if="profileForm.photourl" :src="profileForm.photourl" class="w-full h-full object-cover" />
                      <UserIcon v-else class="w-10 h-10 text-zinc-800" />
                    </div>
                  </div>

                  <button 
                    type="button" 
                    @click="openAvatarModal"
                    class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2"
                  >
                    <RefreshCw class="w-3.5 h-3.5" />
                    Change Avatar
                  </button>
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Username</label>
                <div class="relative group">
                  <UserIcon class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-white transition-colors" />
                  <input 
                    v-model="profileForm.username"
                    type="text"
                    required
                    placeholder="Username"
                    class="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-zinc-700 transition-all text-sm"
                  />
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Email Address</label>
                <div class="relative group">
                  <Mail class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-white transition-colors" />
                  <input 
                    v-model="profileForm.email"
                    type="email"
                    required
                    placeholder="email@example.com"
                    class="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-zinc-700 transition-all text-sm"
                  />
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">New Password (Optional)</label>
                <div class="relative group">
                  <Lock class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-white transition-colors" />
                  <input 
                    v-model="profileForm.password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="••••••••"
                    class="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-10 pr-12 text-white placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-zinc-700 transition-all text-sm"
                  />
                  <button 
                    type="button"
                    @click="showPassword = !showPassword"
                    class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-600 hover:text-white transition-colors cursor-pointer"
                  >
                    <Eye v-if="!showPassword" class="w-4 h-4" />
                    <EyeOff v-else class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Confirm New Password</label>
                <div class="relative group">
                  <Lock class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-white transition-colors" />
                  <input 
                    v-model="profileForm.confirmPassword"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="••••••••"
                    class="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-10 pr-12 text-white placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-zinc-700 transition-all text-sm"
                  />
                  <button 
                    type="button"
                    @click="showPassword = !showPassword"
                    class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-600 hover:text-white transition-colors cursor-pointer"
                  >
                    <Eye v-if="!showPassword" class="w-4 h-4" />
                    <EyeOff v-else class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div v-if="profileError" class="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-sm text-center font-medium">
                {{ profileError }}
              </div>

              <div class="pt-4 flex gap-3">
                <button 
                  type="button"
                  @click="handleProfileCloseAttempt"
                  class="flex-1 py-3 px-4 bg-zinc-900 text-white font-semibold rounded-xl hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  :disabled="isUpdating"
                  class="flex-1 py-3 px-4 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Loader2 v-if="isUpdating" class="w-4 h-4 animate-spin" />
                  {{ isUpdating ? 'Saving...' : 'Save' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Unsaved Changes Warning Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showUnsavedChangesModal" class="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/95 backdrop-blur-2xl" @click="showUnsavedChangesModal = false"></div>
          
          <div class="relative w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
            <div class="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/20 mx-auto mb-6 flex items-center justify-center">
              <RefreshCw class="w-8 h-8 text-amber-500" />
            </div>
            
            <h3 class="text-xl font-bold text-white mb-2">Unsaved Changes</h3>
            <p class="text-zinc-500 text-sm mb-8 leading-relaxed">
              You have unsaved changes. Are you sure you want to discard them and exit?
            </p>

            <div class="flex flex-col gap-3">
              <button 
                @click="discardChangesAndClose"
                class="w-full py-4 bg-rose-500 text-white font-bold rounded-2xl hover:bg-rose-600 transition-all cursor-pointer"
              >
                Yes, Discard Changes
              </button>
              <button 
                @click="showUnsavedChangesModal = false"
                class="w-full py-4 bg-zinc-900 text-zinc-400 font-bold rounded-2xl hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
              >
                Continue Editing
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Avatar Selection Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showAvatarModal" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/90 backdrop-blur-xl" @click="showAvatarModal = false"></div>
          
          <div class="relative w-full max-w-lg bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8">
            <div class="flex items-center justify-between mb-8">
              <div>
                <h2 class="text-2xl font-bold text-white">Choose Avatar</h2>
                <p class="text-zinc-500 text-sm">Pick a style that fits you</p>
              </div>
              <div class="flex items-center gap-2">
                <button 
                  @click="generateAvatars"
                  class="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all cursor-pointer flex items-center gap-2 text-sm font-bold"
                >
                  <RefreshCw class="w-4 h-4" />
                  Refresh
                </button>
                <button @click="showAvatarModal = false" class="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all cursor-pointer">
                  <XIcon class="w-5 h-5" />
                </button>
              </div>
            </div>

            <div class="grid grid-cols-3 sm:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <!-- Clear/Default Option -->
              <button 
                @click="selectAvatar('')"
                class="aspect-square rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex flex-col items-center justify-center hover:border-white transition-all cursor-pointer group relative overflow-hidden"
              >
                <div class="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                  <UserIcon class="w-5 h-5 text-zinc-500" />
                </div>
                <span class="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Default</span>
                <div class="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors"></div>
              </button>

              <button 
                v-for="(avatar, index) in suggestedAvatars" 
                :key="index"
                @click="selectAvatar(avatar)"
                class="aspect-square rounded-2xl bg-zinc-950 border-2 border-zinc-800 overflow-hidden hover:border-white transition-all cursor-pointer group relative"
              >
                <img :src="avatar" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div class="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors"></div>
              </button>
            </div>

            <div class="mt-8">
              <button 
                @click="showAvatarModal = false"
                class="w-full py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Confirm Profile Update Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showConfirmModal" class="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/95 backdrop-blur-2xl" @click="showConfirmModal = false"></div>
          
          <div class="relative w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
            <div class="w-24 h-24 rounded-3xl bg-white/5 border-2 border-zinc-800 mx-auto mb-6 overflow-hidden flex items-center justify-center">
              <img :src="profileForm.photourl" class="w-full h-full object-cover" />
            </div>
            
            <h3 class="text-xl font-bold text-white mb-2">Update Profile?</h3>
            <p class="text-zinc-500 text-sm mb-8 leading-relaxed">
              Are you sure you want to save these changes?
            </p>

            <div class="flex flex-col gap-3">
              <button 
                @click="confirmProfileUpdate"
                :disabled="isUpdating"
                class="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Loader2 v-if="isUpdating" class="w-4 h-4 animate-spin" />
                {{ isUpdating ? 'Saving...' : 'Yes, Update Profile' }}
              </button>
              <button 
                @click="showConfirmModal = false"
                class="w-full py-4 bg-zinc-900 text-zinc-400 font-bold rounded-2xl hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { User as UserIcon, Mail, Lock, X as XIcon, Loader2, Eye, EyeOff, RefreshCw } from 'lucide-vue-next';

const props = defineProps<{
  modelValue: boolean
}>();

const emit = defineEmits(['update:modelValue']);

const { user, fetchUser } = useAuth();

// Internal visibility ref linked to prop
const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

// Profile Modal State
const showAvatarModal = ref(false);
const showConfirmModal = ref(false);
const showUnsavedChangesModal = ref(false);
const isUpdating = ref(false);
const showPassword = ref(false);
const profileError = ref('');
const profileForm = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  photourl: ''
});

const initialProfileSnapshot = ref<any>(null);

const hasUnsavedChanges = computed(() => {
  if (!initialProfileSnapshot.value) return false;
  return (
    profileForm.username !== initialProfileSnapshot.value.username ||
    profileForm.email !== initialProfileSnapshot.value.email ||
    profileForm.password !== '' ||
    profileForm.confirmPassword !== '' ||
    profileForm.photourl !== initialProfileSnapshot.value.photourl
  );
});

const suggestedAvatars = ref<string[]>([]);

const generateAvatars = () => {
  const styles = ['avataaars', 'big-smile', 'bottts-neutral', 'notionists-neutral'];
  const bgColors = [
    'b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 
    'f1f4f9', 'e2e8f0', 'fce7f3', 'ffedd5', 'dcfce7'
  ];
  
  const newAvatars = [];
  for (let i = 0; i < 12; i++) {
    const style = styles[Math.floor(Math.random() * styles.length)];
    const seed = Math.random().toString(36).substring(7);
    const bg = bgColors[Math.floor(Math.random() * bgColors.length)];
    newAvatars.push(`https://api.dicebear.com/9.x/${style}/svg?seed=${seed}&backgroundColor=${bg}`);
  }
  suggestedAvatars.value = newAvatars;
};

const handleProfileCloseAttempt = () => {
  if (isUpdating.value) return false;
  if (hasUnsavedChanges.value) {
    showUnsavedChangesModal.value = true;
    return false;
  }
  isOpen.value = false;
  return true;
};

const discardChangesAndClose = () => {
  showUnsavedChangesModal.value = false;
  initialProfileSnapshot.value = null;
  isOpen.value = false;
};

// Initialize form when opened
watch(() => props.modelValue, (open) => {
  if (open) {
    if (!user.value) return;
    profileForm.username = user.value.username || '';
    profileForm.email = user.value.email || '';
    profileForm.password = '';
    profileForm.confirmPassword = '';
    profileForm.photourl = user.value.photourl || '';
    profileError.value = '';

    initialProfileSnapshot.value = {
      username: profileForm.username,
      email: profileForm.email,
      photourl: profileForm.photourl
    };
  }
});

useModalHistory(isOpen, handleProfileCloseAttempt);
useModalHistory(showAvatarModal);

const openAvatarModal = () => {
  generateAvatars();
  showAvatarModal.value = true;
};

const selectAvatar = (url: string) => {
  profileForm.photourl = url;
  showAvatarModal.value = false;
};

const triggerProfileUpdate = () => {
  if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
    profileError.value = 'Passwords do not match';
    return;
  }
  profileError.value = '';
  showConfirmModal.value = true;
};

const confirmProfileUpdate = async () => {
  showConfirmModal.value = false;
  await handleUpdateProfile();
};

const handleUpdateProfile = async () => {
  isUpdating.value = true;
  profileError.value = '';
  try {
    await $fetch('/api/auth/profile', {
      method: 'PUT',
      body: {
        username: profileForm.username,
        email: profileForm.email,
        password: profileForm.password || undefined,
        photourl: profileForm.photourl
      }
    });
    await fetchUser();
    initialProfileSnapshot.value = null;
    isOpen.value = false;
  } catch (err: any) {
    profileError.value = err.data?.message || 'Failed to update profile';
  } finally {
    isUpdating.value = false;
  }
};
</script>
