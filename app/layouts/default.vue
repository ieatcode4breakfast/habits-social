<template>
  <div class="min-h-[100dvh] text-zinc-100 flex flex-col transition-colors duration-300">
    <header class="sticky top-0 z-50 px-4 py-3 bg-black/50 backdrop-blur-md border-b border-white/5">
      <div class="max-w-5xl mx-auto flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2 group">
          <div class="w-8 h-8 rounded-full bg-transparent flex items-center justify-center shadow-md shadow-white/10 group-hover:shadow-white/20 transition-shadow overflow-hidden">
            <img src="/icons/icon-192.png" class="w-full h-full object-cover scale-[1.35] transform-gpu" alt="Logo" />
          </div>
          <span class="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-200 to-zinc-400">
            Habits Social
          </span>
        </NuxtLink>

        <div v-if="user" class="flex items-center gap-0">
          <nav class="hidden md:flex items-center gap-1">
            <NuxtLink to="/" class="nav-link" :class="{ 'nav-link-active': $route.path === '/' }">Dashboard</NuxtLink>
            <NuxtLink to="/social" class="nav-link flex items-center gap-2" :class="{ 'nav-link-active': $route.path === '/social' }">
              Social
              <span v-if="pendingCount > 0 && $route.path !== '/social'" class="flex w-2 h-2 bg-rose-500 rounded-full"></span>
            </NuxtLink>
          </nav>
          <div class="w-px h-6 bg-zinc-800 hidden md:block mx-2 shrink-0"></div>
          <button 
            @click="openProfileModal"
            class="flex items-center gap-2 group text-sm font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer px-1 py-1 rounded-lg hover:bg-zinc-900"
          >
            <div class="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex-shrink-0">
              <img v-if="user.photourl" :src="user.photourl" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center">
                <UserIcon class="w-3.5 h-3.5 text-zinc-500" />
              </div>
            </div>
            Hi, {{ user.username }}!
          </button>
          <div class="w-px h-6 bg-zinc-800 mx-2 shrink-0"></div>
          <button @click="logout" class="pr-2 py-2 pl-0 text-zinc-500 hover:text-white hover:bg-zinc-925 rounded-lg transition-colors flex items-center justify-center cursor-pointer" title="Logout">
            <LogOut class="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>

    <main class="flex-1 w-full max-w-5xl mx-auto px-0 sm:px-6 lg:px-8 py-8 pb-20 md:py-12">
      <slot />
    </main>
    <!-- Mobile Bottom Navigation -->
    <nav v-if="user" class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-t border-white/5 px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
      <div class="flex items-center justify-around gap-8">
        <NuxtLink to="/" class="flex flex-col items-center gap-1 group transition-colors" :class="$route.path === '/' ? 'text-white' : 'text-zinc-500'">
          <div class="p-1 rounded-lg transition-colors" :class="$route.path === '/' ? 'bg-white/10' : 'group-hover:bg-white/5'">
            <LayoutDashboard class="w-6 h-6" />
          </div>
          <span class="text-[10px] font-bold uppercase tracking-widest">Dashboard</span>
        </NuxtLink>
        <NuxtLink to="/social" class="flex flex-col items-center gap-1 group transition-colors relative" :class="$route.path === '/social' ? 'text-white' : 'text-zinc-500'">
          <div class="p-1 rounded-lg transition-colors" :class="$route.path === '/social' ? 'bg-white/10' : 'group-hover:bg-white/5'">
            <Users class="w-6 h-6" />
          </div>
          <!-- Badge -->
          <div v-if="pendingCount > 0 && $route.path !== '/social'" class="absolute top-0 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-black"></div>
          <span class="text-[10px] font-bold uppercase tracking-widest">Social</span>
        </NuxtLink>
      </div>
    </nav>

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
        <div v-if="showProfileModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
    
    <!-- Global Toast Notification -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-4 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="isVisible" class="fixed bottom-24 md:bottom-12 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-4 py-2.5 bg-zinc-900/90 border border-white/10 rounded-full backdrop-blur-xl shadow-2xl ring-1 ring-white/5 pointer-events-none">
          <div class="flex items-center justify-center w-6 h-6 rounded-lg" :class="{
            'bg-emerald-500/20 text-emerald-500': type === 'completed',
            'bg-rose-500/20 text-rose-500': type === 'failed',
            'bg-zinc-500/20 text-zinc-400': type === 'skipped',
            'bg-zinc-800/50 text-zinc-600': type === 'cleared'
          }">
            <CheckIcon v-if="type === 'completed'" class="w-4 h-4" />
            <XIcon v-else-if="type === 'failed'" class="w-4 h-4" />
            <MinusIcon v-else-if="type === 'skipped'" class="w-4 h-4" />
          </div>
          <span class="text-sm font-bold tracking-tight text-white pr-2">{{ message }}</span>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { LogOut, LayoutDashboard, Users, User as UserIcon, Mail, Lock, X as XIcon, Loader2, Eye, EyeOff, Check as CheckIcon, Minus as MinusIcon, RefreshCw } from 'lucide-vue-next';

const { user, fetchUser } = useAuth();
const { pendingCount, init: initSocial, cleanup: cleanupSocial, logoutCleanup } = useSocial();
const { isVisible, message, type } = useToast();

useSeoMeta({
  title: 'Dashboard - HabitsSocial',
  ogTitle: 'HabitsSocial',
  description: 'Track and build better habits with your friends on HabitsSocial.',
  ogDescription: 'Track and build better habits with your friends on HabitsSocial.',
  ogImage: '/icons/icon-512.png',
  twitterCard: 'summary_large_image',
})

onMounted(() => {
  if (user.value) {
    initSocial();
  }
});

onUnmounted(() => {
  cleanupSocial();
});

const router = useRouter();

// Profile Modal State
const showProfileModal = ref(false);
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
  // Using more colorful styles and vibrant backgrounds
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
  if (hasUnsavedChanges.value) {
    showUnsavedChangesModal.value = true;
  } else {
    showProfileModal.value = false;
  }
};

const discardChangesAndClose = () => {
  showUnsavedChangesModal.value = false;
  showProfileModal.value = false;
};

useModalHistory(showProfileModal, handleProfileCloseAttempt);
useModalHistory(showAvatarModal);
useModalHistory(showConfirmModal);
useModalHistory(showUnsavedChangesModal);

const openProfileModal = () => {
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

  showProfileModal.value = true;
};

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
    showProfileModal.value = false;
  } catch (err: any) {
    profileError.value = err.data?.message || 'Failed to update profile';
  } finally {
    isUpdating.value = false;
  }
};

const route = useRoute();

const logout = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' });
  logoutCleanup();
  await fetchUser();
  router.push('/login');
};
</script>

<style scoped>
.nav-link {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.5rem;
  color: #71717a;
  transition: color 150ms, background-color 150ms;
}
.nav-link:hover {
  color: white;
  background-color: rgba(39, 39, 42, 0.5);
}
.nav-link-active { color: white; background-color: rgba(63, 63, 70, 0.5); }
</style>
