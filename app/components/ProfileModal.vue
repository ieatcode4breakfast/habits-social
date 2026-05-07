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
        <div v-if="modelValue" class="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto sm:py-8 py-0">
          <div class="fixed inset-0 bg-black/80 backdrop-blur-md touch-none" @click="handleProfileCloseAttempt"></div>
          
          <div class="relative my-auto w-full h-full sm:h-auto sm:max-w-md max-w-none bg-zinc-925 border-x-0 sm:border border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl overflow-hidden transition-all duration-300 flex flex-col">
            
            <!-- Sticky Header -->
            <div class="sticky top-0 z-10 bg-zinc-925 px-4 sm:px-8 py-4 sm:py-6 border-b border-zinc-800/80 flex items-center gap-1 shrink-0">
              <button @click="handleProfileCloseAttempt" class="p-2 -ml-2 text-zinc-500 hover:text-white transition-all cursor-pointer flex-shrink-0">
                <ChevronLeft class="w-6 h-6" />
              </button>
              <div class="flex-1 min-w-0">
                <h2 class="text-lg font-bold text-white truncate leading-none">Edit Profile</h2>
              </div>
            </div>

            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-8 sm:py-6">
              <form id="profileForm" @submit.prevent="triggerProfileUpdate" class="space-y-4">
                <!-- Avatar Selection -->
                <AvatarPicker 
                  v-model="profileForm.photoUrl" 
                  label="Avatar"
                />

                <div class="space-y-1.5">
                  <label class="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Username</label>
                  <div class="relative group">
                    <UserIcon class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-white transition-colors" />
                    <input 
                      v-model="profileForm.username"
                      type="text"
                      required
                      placeholder="Username"
                      @input="profileError = ''"
                      class="w-full bg-black border rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-700 focus:outline-none focus:ring-2 transition-all text-sm"
                      :class="[
                        profileError && (profileError.includes('username') || profileError.includes('taken')) 
                          ? 'border-rose-500/50 focus:ring-rose-500/10 focus:border-rose-500' 
                          : 'border-zinc-800 focus:ring-white/10 focus:border-zinc-700'
                      ]"
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
                      @input="profileError = ''"
                      class="w-full bg-black border rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-700 focus:outline-none focus:ring-2 transition-all text-sm"
                      :class="[
                        profileError && profileError.includes('email')
                          ? 'border-rose-500/50 focus:ring-rose-500/10 focus:border-rose-500' 
                          : 'border-zinc-800 focus:ring-white/10 focus:border-zinc-700'
                      ]"
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
                      @input="profileError = ''"
                      class="w-full bg-black border rounded-xl py-3 pl-10 pr-12 text-white placeholder-zinc-700 focus:outline-none focus:ring-2 transition-all text-sm"
                      :class="[
                        profileError && profileError.includes('Password')
                          ? 'border-rose-500/50 focus:ring-rose-500/10 focus:border-rose-500' 
                          : 'border-zinc-800 focus:ring-white/10 focus:border-zinc-700'
                      ]"
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
                      @input="profileError = ''"
                      class="w-full bg-black border rounded-xl py-3 pl-10 pr-12 text-white placeholder-zinc-700 focus:outline-none focus:ring-2 transition-all text-sm"
                      :class="[
                        profileError && profileError.includes('match')
                          ? 'border-rose-500/50 focus:ring-rose-500/10 focus:border-rose-500' 
                          : 'border-zinc-800 focus:ring-white/10 focus:border-zinc-700'
                      ]"
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
              </form>
            </div>

            <!-- Fixed Footer -->
            <div class="px-8 py-4 border-t border-zinc-800 bg-zinc-925/80 backdrop-blur-md flex gap-3">
              <button
                type="button"
                @click="handleProfileCloseAttempt"
                class="flex-1 px-5 py-3 bg-transparent hover:bg-zinc-925 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="profileForm"
                :disabled="isUpdating"
                class="flex-1 px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                <template v-if="isUpdating">
                  <div class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                  Saving...
                </template>
                <template v-else>
                  Save
                </template>
              </button>
            </div>
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
        <div v-if="showUnsavedChangesModal" class="fixed inset-0 z-[130] flex flex-col items-center justify-start overflow-y-auto p-4 sm:py-8">
          <div class="fixed inset-0 bg-black/95 backdrop-blur-sm touch-none" @click="showUnsavedChangesModal = false"></div>
          
          <div class="relative my-auto w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
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
                class="w-full py-4 bg-rose-500 text-white font-bold rounded-2xl hover:bg-rose-600 transition-all cursor-pointer whitespace-nowrap"
              >
                Yes, Discard Changes
              </button>
              <button 
                @click="showUnsavedChangesModal = false"
                class="w-full py-4 bg-zinc-900 text-zinc-400 font-bold rounded-2xl hover:bg-zinc-800 hover:text-white transition-all cursor-pointer whitespace-nowrap"
              >
                Continue Editing
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
        <div v-if="showConfirmModal" class="fixed inset-0 z-[120] flex flex-col items-center justify-start overflow-y-auto p-4 sm:py-8">
          <div class="fixed inset-0 bg-black/95 backdrop-blur-sm touch-none" @click="showConfirmModal = false"></div>
          
          <div class="relative my-auto w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
            <UserAvatar 
              :src="profileForm.photoUrl" 
              container-class="w-24 h-24 rounded-3xl bg-white/5 border-2 border-zinc-800 mx-auto mb-6"
              icon-class="w-10 h-10 text-zinc-500"
            />
            
            <h3 class="text-xl font-bold text-white mb-2">Update Profile?</h3>
            <p class="text-zinc-500 text-sm mb-8 leading-relaxed">
              Are you sure you want to save these changes?
            </p>

            <div class="flex flex-col gap-3">
              <button 
                @click="confirmProfileUpdate"
                :disabled="isUpdating"
                class="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Loader2 v-if="isUpdating" class="w-4 h-4 animate-spin" />
                {{ isUpdating ? 'Saving...' : 'Yes, Update Profile' }}
              </button>
              <button 
                @click="showConfirmModal = false"
                class="w-full py-4 bg-zinc-900 text-zinc-400 font-bold rounded-2xl hover:bg-zinc-800 hover:text-white transition-all cursor-pointer whitespace-nowrap"
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
import { User as UserIcon, Mail, Lock, ChevronLeft, Loader2, Eye, EyeOff, RefreshCw } from 'lucide-vue-next';

const props = defineProps<{
  modelValue: boolean
}>();

const emit = defineEmits(['update:modelValue']);

const { user, fetchUser } = useAuth();
const { showToast } = useToast();

// Internal visibility ref linked to prop
const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

// Profile Modal State
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
  photoUrl: ''
});

const initialProfileSnapshot = ref<any>(null);

const hasUnsavedChanges = computed(() => {
  if (!initialProfileSnapshot.value) return false;
  return (
    profileForm.username !== initialProfileSnapshot.value.username ||
    profileForm.email !== initialProfileSnapshot.value.email ||
    profileForm.password !== '' ||
    profileForm.confirmPassword !== '' ||
    profileForm.photoUrl !== initialProfileSnapshot.value.photoUrl
  );
});

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
      photoUrl: profileForm.photoUrl
    };
  }
});

useModalHistory(isOpen, handleProfileCloseAttempt);

const triggerProfileUpdate = () => {
  // Username validation
  if (profileForm.username.length < 3 || profileForm.username.length > 20) {
    profileError.value = 'Username must be between 3 and 20 characters';
    return;
  }

  // Password validation (only if provided)
  if (profileForm.password) {
    if (profileForm.password.length < 8) {
      profileError.value = 'Password must be at least 8 characters long';
      return;
    }
    if (profileForm.password !== profileForm.confirmPassword) {
      profileError.value = 'Passwords do not match';
      return;
    }
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
        photoUrl: profileForm.photoUrl
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
