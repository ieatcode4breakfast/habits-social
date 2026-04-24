<template>
  <div class="min-h-screen text-zinc-100 flex flex-col transition-colors duration-300">
    <header class="sticky top-0 z-50 px-4 py-3 bg-black/50 backdrop-blur-md border-b border-white/5">
      <div class="max-w-5xl mx-auto flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2 group">
          <div class="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-md shadow-white/10 group-hover:shadow-white/20 transition-shadow overflow-hidden">
            <img src="/icons/icon-192.png" class="w-full h-full object-cover scale-[1.35] transform-gpu" alt="Logo" />
          </div>
          <span class="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-200 to-zinc-400">
            Habits Social
          </span>
        </NuxtLink>

        <div v-if="user" class="flex items-center gap-0">
          <nav class="hidden md:flex items-center gap-1">
            <NuxtLink to="/" class="nav-link" :class="{ 'nav-link-active': $route.path === '/' }">Dashboard</NuxtLink>
            <NuxtLink to="/social" class="nav-link" :class="{ 'nav-link-active': $route.path === '/social' }">Social</NuxtLink>
          </nav>
          <div class="w-px h-6 bg-zinc-800 hidden md:block mx-2 shrink-0"></div>
          <button 
            @click="openProfileModal"
            class="text-sm font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer px-1 py-1 rounded-lg hover:bg-zinc-900"
          >
            Hi, {{ user.username }}!
          </button>
          <div class="w-px h-6 bg-zinc-800 mx-2 shrink-0"></div>
          <button @click="logout" class="pr-2 py-2 pl-0 text-zinc-500 hover:text-white hover:bg-zinc-925 rounded-lg transition-colors flex items-center justify-center cursor-pointer" title="Logout">
            <LogOut class="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>

    <main class="flex-1 w-full max-w-5xl mx-auto px-0 sm:px-6 lg:px-8 py-8 pb-24 md:py-12">
      <slot />
    </main>
    <!-- Mobile Bottom Navigation -->
    <nav v-if="user" class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-t border-white/5 px-6 py-3 pb-[env(safe-area-inset-bottom,1.5rem)]">
      <div class="flex items-center justify-around gap-8">
        <NuxtLink to="/" class="flex flex-col items-center gap-1 group transition-colors" :class="$route.path === '/' ? 'text-white' : 'text-zinc-500'">
          <div class="p-1 rounded-lg transition-colors" :class="$route.path === '/' ? 'bg-white/10' : 'group-hover:bg-white/5'">
            <LayoutDashboard class="w-6 h-6" />
          </div>
          <span class="text-[10px] font-bold uppercase tracking-widest">Dashboard</span>
        </NuxtLink>
        <NuxtLink to="/social" class="flex flex-col items-center gap-1 group transition-colors" :class="$route.path === '/social' ? 'text-white' : 'text-zinc-500'">
          <div class="p-1 rounded-lg transition-colors" :class="$route.path === '/social' ? 'bg-white/10' : 'group-hover:bg-white/5'">
            <Users class="w-6 h-6" />
          </div>
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
          <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="showProfileModal = false"></div>
          
          <div class="relative w-full max-w-md bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 overflow-y-auto">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h2 class="text-2xl font-bold text-white">Edit Profile</h2>
                <p class="text-zinc-500 text-sm">Update your account settings</p>
              </div>
              <button @click="showProfileModal = false" class="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all cursor-pointer">
                <X class="w-5 h-5" />
              </button>
            </div>

            <form @submit.prevent="handleUpdateProfile" class="space-y-4">


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
                  @click="showProfileModal = false"
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
                  {{ isUpdating ? 'Saving...' : 'Save Changes' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { LogOut, LayoutDashboard, Users, User as UserIcon, Mail, Lock, X, Loader2, Eye, EyeOff } from 'lucide-vue-next';

const { user, fetchUser } = useAuth();
const router = useRouter();

// Profile Modal State
const showProfileModal = ref(false);
const isUpdating = ref(false);
const showPassword = ref(false);
const profileError = ref('');
const profileForm = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: ''
});

const openProfileModal = () => {
  if (!user.value) return;
  profileForm.username = user.value.username || '';
  profileForm.email = user.value.email || '';
  profileForm.password = '';
  profileForm.confirmPassword = '';
  profileError.value = '';
  showProfileModal.value = true;
};

const handleUpdateProfile = async () => {
  if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
    profileError.value = 'Passwords do not match';
    return;
  }

  isUpdating.value = true;
  profileError.value = '';
  try {
    await $fetch('/api/auth/profile', {
      method: 'PUT',
      body: profileForm
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
