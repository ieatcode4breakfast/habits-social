<template>
  <div>
    <!-- Edit Profile Modal -->
    <ClientOnly>
      <Teleport to="body">
      <!-- Overlay -->
      <Transition
        enter-active-class="transition-none"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="modelValue"
          class="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md touch-none"
          @click="handleProfileCloseAttempt"
        ></div>
      </Transition>

      <!-- Content -->
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="modelValue" class="fixed inset-0 z-[100] pointer-events-none flex flex-col items-center justify-start overflow-y-auto sm:py-8 py-0">
          <div class="relative my-auto w-full h-full sm:h-auto sm:max-w-md max-w-none bg-surface-raised border-x-0 sm:border border-border-muted sm:rounded-3xl rounded-none overflow-hidden transition-all duration-300 flex flex-col pointer-events-auto">

            <!-- Sticky Header -->
            <div class="sticky top-0 z-10 bg-surface-raised px-4 sm:px-8 py-4 sm:py-6 border-b border-border-muted/80 flex items-center gap-1 shrink-0">
              <button @click="handleProfileCloseAttempt" class="p-2 -ml-2 text-fg-subtle hover:text-fg transition-all cursor-pointer flex-shrink-0">
                <ChevronLeft class="w-6 h-6" />
              </button>
              <div class="flex-1 min-w-0">
                <h2 class="text-lg font-bold text-fg truncate leading-none">Edit Profile</h2>
              </div>
            </div>

            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-8 sm:py-6">
              <!-- Offline Warning Banner -->
              <div v-if="!isOnline" class="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
                <WifiOff class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div class="space-y-1">
                  <p class="text-amber-500 text-sm font-bold leading-none">Connection Lost</p>
                  <p class="text-amber-500/70 text-xs leading-relaxed">Changes cannot be saved while offline.</p>
                </div>
              </div>

              <form id="profileForm" @submit.prevent="triggerProfileUpdate" class="space-y-4">
                <!-- Avatar Selection -->
                <AvatarPicker
                  v-model="profileForm.photoUrl"
                  label="Avatar"
                />

                <div class="space-y-1.5">
                  <label class="text-xs font-bold text-fg-subtle uppercase tracking-widest ml-1">Username</label>
                  <div class="relative group">
                    <UserIcon class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within:text-fg transition-colors" />
                    <input
                      v-model="profileForm.username"
                      type="text"
                      required
                      placeholder="Username"
                      @input="profileError = ''"
                      class="w-full bg-surface-inset border rounded-xl py-3 pl-10 pr-4 text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 transition-all text-sm"
                      :class="[
                        profileError && (profileError.includes('username') || profileError.includes('taken'))
                          ? 'border-rose-500/50 focus:ring-rose-500/10 focus:border-rose-500'
                          : 'border-border-muted focus:ring-fg/10 focus:border-border-strong'
                      ]"
                    />
                  </div>
                </div>

                <div class="space-y-1.5">
                  <label class="text-xs font-bold text-fg-subtle uppercase tracking-widest ml-1">Email Address</label>
                  <div class="relative group">
                    <Mail class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within:text-fg transition-colors" />
                    <input
                      v-model="profileForm.email"
                      type="email"
                      required
                      placeholder="email@example.com"
                      @input="profileError = ''"
                      class="w-full bg-surface-inset border rounded-xl py-3 pl-10 pr-4 text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 transition-all text-sm"
                      :class="[
                        profileError && profileError.includes('email')
                          ? 'border-rose-500/50 focus:ring-rose-500/10 focus:border-rose-500'
                          : 'border-border-muted focus:ring-fg/10 focus:border-border-strong'
                      ]"
                    />
                  </div>
                </div>

                <Transition
                  enter-active-class="transition duration-300 ease-out"
                  enter-from-class="opacity-0 -translate-y-2 max-h-0"
                  enter-to-class="opacity-100 translate-y-0 max-h-32"
                  leave-active-class="transition duration-200 ease-in"
                  leave-from-class="opacity-100 translate-y-0 max-h-32"
                  leave-to-class="opacity-0 -translate-y-2 max-h-0"
                >
                  <div v-if="profileForm.password.length > 0 || (initialProfileSnapshot && profileForm.email !== initialProfileSnapshot.email)" class="space-y-1.5 overflow-hidden">
                    <label class="text-xs font-bold text-amber-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                      <Lock class="w-3 h-3" />
                      Current Password Required
                    </label>
                    <div class="relative group">
                      <Lock class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within:text-fg transition-colors" />
                      <input
                        v-model="profileForm.currentPassword"
                        :type="showPassword ? 'text' : 'password'"
                        placeholder="Enter current password"
                        @input="profileError = ''"
                        class="w-full bg-surface-inset border border-amber-500/30 rounded-xl py-3 pl-10 pr-12 text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm"
                        :class="[
                          profileError && profileError.toLowerCase().includes('current password')
                            ? 'border-rose-500/50 focus:ring-rose-500/10 focus:border-rose-500'
                            : ''
                        ]"
                      />
                      <button
                        type="button"
                        @click="showPassword = !showPassword"
                        class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-fg-subtle hover:text-fg transition-colors cursor-pointer"
                      >
                        <Eye v-if="!showPassword" class="w-4 h-4" />
                        <EyeOff v-else class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Transition>

                <div class="space-y-1.5">
                  <label class="text-xs font-bold text-fg-subtle uppercase tracking-widest ml-1">New Password (Optional)</label>
                  <div class="relative group">
                    <Lock class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within:text-fg transition-colors" />
                    <input
                      v-model="profileForm.password"
                      :type="showPassword ? 'text' : 'password'"
                      placeholder="••••••••"
                      @input="profileError = ''"
                      class="w-full bg-surface-inset border rounded-xl py-3 pl-10 pr-12 text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 transition-all text-sm"
                      :class="[
                        profileError && profileError.includes('Password')
                          ? 'border-rose-500/50 focus:ring-rose-500/10 focus:border-rose-500'
                          : 'border-border-muted focus:ring-fg/10 focus:border-border-strong'
                      ]"
                    />
                    <button
                      type="button"
                      @click="showPassword = !showPassword"
                      class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-fg-subtle hover:text-fg transition-colors cursor-pointer"
                    >
                      <Eye v-if="!showPassword" class="w-4 h-4" />
                      <EyeOff v-else class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div class="space-y-1.5">
                  <label class="text-xs font-bold text-fg-subtle uppercase tracking-widest ml-1">Confirm New Password</label>
                  <div class="relative group">
                    <Lock class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within:text-fg transition-colors" />
                    <input
                      v-model="profileForm.confirmPassword"
                      :type="showPassword ? 'text' : 'password'"
                      placeholder="••••••••"
                      @input="profileError = ''"
                      class="w-full bg-surface-inset border rounded-xl py-3 pl-10 pr-12 text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 transition-all text-sm"
                      :class="[
                        profileError && profileError.includes('match')
                          ? 'border-rose-500/50 focus:ring-rose-500/10 focus:border-rose-500'
                          : 'border-border-muted focus:ring-fg/10 focus:border-border-strong'
                      ]"
                    />
                    <button
                      type="button"
                      @click="showPassword = !showPassword"
                      class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-fg-subtle hover:text-fg transition-colors cursor-pointer"
                    >
                      <Eye v-if="!showPassword" class="w-4 h-4" />
                      <EyeOff v-else class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <!-- Delete Account Link -->
                <div class="pt-2 pb-1 text-center">
                  <button
                    type="button"
                    @click="openDeleteWarning"
                    class="text-xs text-rose-500/60 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    Delete Account
                  </button>
                </div>

                <div v-if="profileError" class="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-sm text-center font-medium">
                  {{ profileError }}
                </div>
              </form>
            </div>

            <!-- Fixed Footer -->
            <div class="px-8 py-4 border-t border-border-muted bg-surface-raised/80 backdrop-blur-md flex gap-3">
              <button
                type="button"
                @click="handleProfileCloseAttempt"
                class="flex-1 px-5 py-3 bg-transparent hover:bg-surface-raised text-fg-muted hover:text-fg font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="profileForm"
                :disabled="isUpdating || !isOnline"
                class="flex-1 px-5 py-3 bg-action-primary hover:bg-action-primary-hover text-action-primary-fg font-semibold rounded-xl transition-all shadow-lg shadow-fg-inverted/5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
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
    </ClientOnly>

    <!-- Unsaved Changes Warning Modal -->
    <ClientOnly>
      <Teleport to="body">
        <!-- Overlay -->
        <Transition
          enter-active-class="transition-none"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="showUnsavedChangesModal"
            class="fixed inset-0 z-[130] bg-black/95 backdrop-blur-sm touch-none"
            @click="showUnsavedChangesModal = false"
          ></div>
        </Transition>

        <!-- Content -->
        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div v-if="showUnsavedChangesModal" class="fixed inset-0 z-[130] pointer-events-none flex flex-col items-center justify-start overflow-y-auto p-4 sm:py-8">
            <div class="relative my-auto w-full max-w-sm bg-surface-raised border border-border-muted rounded-3xl p-8 text-center pointer-events-auto">
            <div class="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/20 mx-auto mb-6 flex items-center justify-center">
              <RefreshCw class="w-8 h-8 text-amber-500" />
            </div>

            <h3 class="text-xl font-bold text-fg mb-2">Unsaved Changes</h3>
            <p class="text-fg-subtle text-sm mb-8 leading-relaxed">
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
                class="w-full py-4 bg-surface-solid text-fg-muted font-bold rounded-2xl hover:bg-surface-hover hover:text-fg transition-all cursor-pointer whitespace-nowrap"
              >
                Continue Editing
              </button>
            </div>
          </div>
        </div>
      </Transition>
      </Teleport>
    </ClientOnly>

    <!-- Confirm Profile Update Modal -->
    <ClientOnly>
      <Teleport to="body">
        <!-- Overlay -->
        <Transition
          enter-active-class="transition-none"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="showConfirmModal"
            class="fixed inset-0 z-[120] bg-black/95 backdrop-blur-sm touch-none"
            @click="showConfirmModal = false"
          ></div>
        </Transition>

        <!-- Content -->
        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div v-if="showConfirmModal" class="fixed inset-0 z-[120] pointer-events-none flex flex-col items-center justify-start overflow-y-auto p-4 sm:py-8">
            <div class="relative my-auto w-full max-w-sm bg-surface-raised border border-border-muted rounded-3xl p-8 text-center pointer-events-auto">
            <UserAvatar
              :src="profileForm.photoUrl"
              container-class="w-24 h-24 rounded-3xl bg-action-primary/5 border-2 border-border-muted mx-auto mb-6"
              icon-class="w-10 h-10 text-fg-subtle"
            />

            <h3 class="text-xl font-bold text-fg mb-2">Update Profile?</h3>
            <p class="text-fg-subtle text-sm mb-8 leading-relaxed">
              Are you sure you want to save these changes?
            </p>

            <div class="flex flex-col gap-3">
              <button
                @click="confirmProfileUpdate"
                :disabled="isUpdating"
                class="w-full py-4 bg-action-primary text-action-primary-fg font-bold rounded-2xl hover:bg-action-primary-hover transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Loader2 v-if="isUpdating" class="w-4 h-4 animate-spin" />
                {{ isUpdating ? 'Saving...' : 'Yes, Update Profile' }}
              </button>
              <button
                @click="showConfirmModal = false"
                class="w-full py-4 bg-surface-solid text-fg-muted font-bold rounded-2xl hover:bg-surface-hover hover:text-fg transition-all cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
      </Teleport>
    </ClientOnly>

    <!-- Delete Account Warning Modal -->
    <ClientOnly>
      <Teleport to="body">
        <!-- Overlay -->
        <Transition
          enter-active-class="transition-none"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="showDeleteWarning"
            class="fixed inset-0 z-[140] bg-black/95 backdrop-blur-sm touch-none"
            @click="showDeleteWarning = false"
          ></div>
        </Transition>

        <!-- Content -->
        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div v-if="showDeleteWarning" class="fixed inset-0 z-[140] pointer-events-none flex flex-col items-center justify-start overflow-y-auto p-4 sm:py-8">
            <div class="relative my-auto w-full max-w-sm bg-surface-raised border border-border-muted rounded-3xl p-8 text-center pointer-events-auto">
            <div class="w-16 h-16 rounded-2xl bg-rose-500/10 border-2 border-rose-500/20 mx-auto mb-6 flex items-center justify-center">
              <AlertTriangle class="w-8 h-8 text-rose-500" />
            </div>

            <h3 class="text-xl font-bold text-fg mb-2">Delete Your Account?</h3>
            <p class="text-fg-subtle text-sm mb-8 leading-relaxed">
              This action is irreversible. All your habits, logs, buckets, friendships, and messages will be permanently deleted. You will lose all your data.
            </p>

            <div class="flex flex-col gap-3">
              <button
                @click="closeDeleteWarningAndOpenPassword"
                class="w-full py-4 bg-rose-600 text-white font-bold rounded-2xl hover:bg-rose-500 transition-all cursor-pointer whitespace-nowrap"
              >
                Yes, Delete My Account
              </button>
              <button
                @click="showDeleteWarning = false"
                class="w-full py-4 bg-surface-solid text-fg-muted font-bold rounded-2xl hover:bg-surface-hover hover:text-fg transition-all cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
      </Teleport>
    </ClientOnly>

    <!-- Delete Account Password Modal -->
    <ClientOnly>
      <Teleport to="body">
        <!-- Overlay -->
        <Transition
          enter-active-class="transition-none"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="showDeletePassword"
            class="fixed inset-0 z-[150] bg-black/95 backdrop-blur-sm touch-none"
            @click="closeDeleteModals"
          ></div>
        </Transition>

        <!-- Content -->
        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div v-if="showDeletePassword" class="fixed inset-0 z-[150] pointer-events-none flex flex-col items-center justify-start overflow-y-auto p-4 sm:py-8">
            <div class="relative my-auto w-full max-w-sm bg-surface-raised border border-border-muted rounded-3xl p-8 text-center pointer-events-auto">
            <div class="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/20 mx-auto mb-6 flex items-center justify-center">
              <Lock class="w-8 h-8 text-amber-500" />
            </div>

            <h3 class="text-xl font-bold text-fg mb-2">Enter Your Password</h3>
            <p class="text-fg-subtle text-sm mb-6 leading-relaxed">
              For security, please enter your current password to confirm account deletion.
            </p>

            <div class="relative group mb-2 text-left">
              <Lock class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within:text-fg transition-colors" />
              <input
                v-model="deletePassword"
                :type="showDeletePasswordField ? 'text' : 'password'"
                placeholder="Current password"
                @input="deleteError = ''"
                @keyup.enter="confirmDeleteAccount"
                class="w-full bg-surface-inset border rounded-xl py-3 pl-10 pr-12 text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 transition-all text-sm"
                :class="[
                  deleteError
                    ? 'border-rose-500/50 focus:ring-rose-500/10 focus:border-rose-500'
                    : 'border-border-muted focus:ring-fg/10 focus:border-border-strong'
                ]"
              />
              <button
                type="button"
                @click="showDeletePasswordField = !showDeletePasswordField"
                class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-fg-subtle hover:text-fg transition-colors cursor-pointer"
              >
                <Eye v-if="!showDeletePasswordField" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>

            <div v-if="deleteError" class="mb-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-sm text-center font-medium">
              {{ deleteError }}
            </div>

            <div class="flex flex-col gap-3 mt-6">
              <button
                @click="confirmDeleteAccount"
                :disabled="!deletePassword || isDeleting"
                class="w-full py-4 bg-rose-600 text-white font-bold rounded-2xl hover:bg-rose-500 transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Loader2 v-if="isDeleting" class="w-4 h-4 animate-spin" />
                {{ isDeleting ? 'Deleting...' : 'Delete My Account' }}
              </button>
              <button
                @click="closeDeleteModals"
                class="w-full py-4 bg-surface-solid text-fg-muted font-bold rounded-2xl hover:bg-surface-hover hover:text-fg transition-all cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { User as UserIcon, Mail, Lock, ChevronLeft, Loader2, Eye, EyeOff, RefreshCw, WifiOff, AlertTriangle } from 'lucide-vue-next';
import { clearCachedAuthUser } from '~/utils/cachedAuth';
import { habitsApi } from '~/utils/apiClient';

const props = defineProps<{
  modelValue: boolean
}>();

const emit = defineEmits(['update:modelValue']);

const { user, fetchUser } = useAuth();
const { showToast } = useToast();
const { isOnline } = useNetwork();

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
  currentPassword: '',
  password: '',
  confirmPassword: '',
  photoUrl: ''
});

const initialProfileSnapshot = ref<any>(null);

// Delete Account State
const showDeleteWarning = ref(false);
const showDeletePassword = ref(false);
const showDeletePasswordField = ref(false);
const deletePassword = ref('');
const deleteError = ref('');
const isDeleting = ref(false);

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
    profileForm.currentPassword = '';
    profileForm.password = '';
    profileForm.confirmPassword = '';
    profileForm.photoUrl = user.value.photoUrl || '';
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

  const isEmailChanged = initialProfileSnapshot.value && profileForm.email !== initialProfileSnapshot.value.email;

  if (profileForm.password || isEmailChanged) {
    if (!profileForm.currentPassword) {
      profileError.value = 'Current password is required to update sensitive profile information';
      return;
    }
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
    const isUsernameChanged = initialProfileSnapshot.value && profileForm.username !== initialProfileSnapshot.value.username;
    const isEmailChanged = initialProfileSnapshot.value && profileForm.email !== initialProfileSnapshot.value.email;
    const isPhotoChanged = initialProfileSnapshot.value && profileForm.photoUrl !== initialProfileSnapshot.value.photoUrl;

    await habitsApi('/api/users/me', {
      method: 'PUT',
      body: {
        username: isUsernameChanged ? profileForm.username : undefined,
        email: isEmailChanged ? profileForm.email : undefined,
        currentPassword: profileForm.currentPassword || undefined,
        password: profileForm.password || undefined,
        photoUrl: isPhotoChanged ? profileForm.photoUrl : undefined
      }
    });
    await fetchUser();
    initialProfileSnapshot.value = null;
    isOpen.value = false;
  } catch (err: any) {
    profileError.value = err.data?.statusMessage || err.data?.message || 'Failed to update profile';
  } finally {
    isUpdating.value = false;
  }
};

// Delete Account Flow
const openDeleteWarning = () => {
  showDeleteWarning.value = true;
};

const closeDeleteWarningAndOpenPassword = () => {
  showDeleteWarning.value = false;
  deletePassword.value = '';
  deleteError.value = '';
  showDeletePassword.value = true;
};

const closeDeleteModals = () => {
  showDeleteWarning.value = false;
  showDeletePassword.value = false;
  deletePassword.value = '';
  deleteError.value = '';
  isDeleting.value = false;
};

const confirmDeleteAccount = async () => {
  if (!deletePassword.value || isDeleting.value) return;

  isDeleting.value = true;
  deleteError.value = '';

  try {
    await habitsApi('/api/users/me', {
      method: 'DELETE',
      body: { password: deletePassword.value }
    });

    showToast('Account deleted. Goodbye!', 'cleared');

    // Centralized cleanup: secure JWT, cached profile, Dexie, push, notifications
    const { logoutCleanup: runCleanup } = await import('~/utils/logoutCleanup');
    await runCleanup({
      clearDexie: true,
      unsubscribePush: true,
      clearNotifications: true,
    });

    user.value = null;

    showDeleteWarning.value = false;
    showDeletePassword.value = false;
    deletePassword.value = '';
    isOpen.value = false;

    await navigateTo('/login');
  } catch (err: any) {
    deleteError.value = err.data?.statusMessage || err.data?.message || 'Failed to delete account. Please try again.';
  } finally {
    isDeleting.value = false;
  }
};
</script>
