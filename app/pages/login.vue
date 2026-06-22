<template>
  <div class="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative">
    <ClientOnly>
      <button @click="toggleThemeMode" class="fixed top-4 right-4 p-2 rounded-lg hover:bg-surface-solid transition-colors z-50" :title="themeToggleTitle">
        <MoonIcon v-if="isLightMode" class="w-5 h-5 text-fg" />
        <SunIcon v-else class="w-5 h-5 text-fg" />
      </button>
    </ClientOnly>
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="flex flex-col items-center mb-8">
        <div class="w-12 h-12 rounded-lg bg-transparent flex items-center justify-center mb-3">
          <img src="/icons/icon-192.png" class="w-full h-full object-contain" alt="Logo" />
        </div>
        <h1 class="text-2xl font-bold text-fg tracking-tight">Habits Social</h1>
        <p class="text-fg-subtle text-sm mt-1">A social habit tracking app.</p>
      </div>

      <!-- Card -->
      <div class="bg-surface-raised/80 backdrop-blur-xl rounded-2xl border border-border-muted overflow-hidden">
        <!-- Main Form (Login / Signup) -->
        <div>
          <!-- Tabs -->
          <div class="flex border-b border-surface-raised">
            <button
              @click="tab = 'login'"
              class="flex-1 py-4 text-sm font-semibold transition-colors cursor-pointer"
              :class="tab === 'login'
                ? 'text-fg border-b-2 border-fg'
                : 'text-fg-subtle hover:text-fg-muted'"
            >
              Log In
            </button>
            <button
              @click="tab = 'signup'"
              class="flex-1 py-4 text-sm font-semibold transition-colors cursor-pointer"
              :class="tab === 'signup'
                ? 'text-fg border-b-2 border-fg'
                : 'text-fg-subtle hover:text-fg-muted'"
            >
              Sign Up
            </button>
          </div>

          <div class="p-6 sm:p-8">
            <h2 class="text-xl font-bold text-fg mb-1">
              {{ tab === 'login' ? 'Log In' : 'Create Account' }}
            </h2>
            <p class="text-sm text-fg-subtle">
              {{ tab === 'login' ? 'Enter your credentials to continue.' : 'Sign up to start tracking your habits.' }}
            </p>

            <form @submit.prevent="handleSubmit" class="space-y-4">

              <!-- Username -->
              <div v-if="tab === 'signup'" class="relative" v-motion-slide-top>
                <User class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
                <input
                  v-model="username"
                  type="text"
                  placeholder="Username"
                  required
                  minlength="3"
                  maxlength="20"
                  class="w-full pl-10 pr-4 py-3 bg-surface-inset border border-border-muted rounded-xl text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-all text-sm"
                />
              </div>

              <!-- Email / Username -->
              <div class="relative">
                <component :is="tab === 'login' ? User : Mail" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
                <input
                  v-model="email"
                  :type="tab === 'login' ? 'text' : 'email'"
                  :placeholder="tab === 'login' ? 'Email or Username' : 'Email'"
                  required
                  class="w-full pl-10 pr-4 py-3 bg-surface-inset border border-border-muted rounded-xl text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-all text-sm"
                />
              </div>

              <!-- Password -->
              <div class="relative">
                <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Password"
                  required
                  minlength="8"
                  maxlength="128"
                  class="w-full pl-10 pr-12 py-3 bg-surface-inset border border-border-muted rounded-xl text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-all text-sm"
                />
                <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg-muted cursor-pointer">
                  <Eye v-if="!showPassword" class="w-4 h-4" />
                  <EyeOff v-else class="w-4 h-4" />
                </button>
              </div>
              <div v-if="tab === 'login'" class="flex justify-end -mt-1">
                <NuxtLink to="/forgot-password" class="text-xs font-semibold text-fg-subtle hover:text-fg-muted transition-colors">
                  Forgot password?
                </NuxtLink>
              </div>

              <!-- Confirm Password -->
              <div v-if="tab === 'signup'" class="relative" v-motion-slide-top>
                <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
                <input
                  v-model="confirmPassword"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Confirm Password"
                  required
                  maxlength="128"
                  class="w-full pl-10 pr-12 py-3 bg-surface-inset border border-border-muted rounded-xl text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-all text-sm"
                />
                <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg-muted cursor-pointer">
                  <Eye v-if="!showPassword" class="w-4 h-4" />
                  <EyeOff v-else class="w-4 h-4" />
                </button>
              </div>

              <!-- Error -->
              <p v-if="error" class="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-sm text-center font-medium">{{ error }}</p>

              <!-- Actions -->
              <div class="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  @click="email = ''; username = ''; password = ''; confirmPassword = ''; error = ''"
                  class="flex-1 py-3 text-sm font-semibold text-fg-muted bg-transparent hover:bg-surface-raised rounded-xl transition-colors cursor-pointer"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  :disabled="loading"
                  class="flex-1 py-3 text-sm font-semibold text-action-primary-fg bg-action-primary hover:bg-action-primary-hover disabled:opacity-50 rounded-xl transition-colors cursor-pointer shadow-lg shadow-fg-inverted/10"
                >
                  {{ loading ? 'Please wait...' : (tab === 'login' ? 'Log In' : 'Sign Up') }}
                </button>
              </div>
            </form>

            <!-- Legal Disclaimer -->
            <p class="text-[11px] text-fg-subtle text-center mt-6">
              By continuing, you agree to our
              <NuxtLink to="/help-center/terms-of-service" class="underline hover:text-fg-muted transition-colors">Terms of Service</NuxtLink>
              and acknowledge our
              <NuxtLink to="/help-center/privacy-policy" class="underline hover:text-fg-muted transition-colors">Privacy Policy</NuxtLink>.
            </p>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Mail, Lock, Eye, EyeOff, User, Sun as SunIcon, Moon as MoonIcon } from 'lucide-vue-next';
import { cacheAuthUser, type CachedAuthUser } from '~/utils/cachedAuth';
import { useThemeMode } from '~/composables/useThemeMode';

const { isLightMode, themeToggleTitle, toggleThemeMode } = useThemeMode();

definePageMeta({ 
  layout: false,
  middleware: 'auth'
});

const { user } = useAuth();
const { showToast } = useToast();

type AuthSuccessUser = CachedAuthUser & {
  token?: string;
};

useSeoMeta({
  title: 'Log In or Sign Up - Habits Social',
  ogTitle: 'Habits Social - Join the Community',
  description: 'Join Habits Social to track your habits, stay accountable with friends, and build a better routine.',
  ogDescription: 'Join Habits Social to track your habits, stay accountable with friends, and build a better routine.',
});

const tab = ref<'login' | 'signup'>('login');
const email = ref('');
const username = ref('');
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const loading = ref(false);
const error = ref('');

const handleSubmit = async () => {
  loading.value = true;
  error.value = '';

  if (tab.value === 'signup') {
    if (username.value.length < 3 || username.value.length > 20) {
      error.value = 'Username must be between 3 and 20 characters.';
      loading.value = false;
      return;
    }
    if (password.value.length < 8 || password.value.length > 128) {
      error.value = 'Password must be between 8 and 128 characters long.';
      loading.value = false;
      return;
    }
    if (password.value !== confirmPassword.value) {
      error.value = 'Passwords do not match.';
      loading.value = false;
      return;
    }
  }

  try {
    const endpoint = tab.value === 'login' ? '/api/auth/login' : '/api/auth/register';
    const { data } = await $fetch<{ data: AuthSuccessUser }>(endpoint, { 
      method: 'POST',
      body: { 
        [endpoint === '/api/auth/login' ? 'identifier' : 'email']: email.value, 
        username: username.value,
        password: password.value
      }
    });

    if (data.token) {
      user.value = data;
      if (import.meta.client) cacheAuthUser(localStorage, data);
      if (tab.value === 'signup') {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('just-signed-up', 'true');
        }
      }
      showToast(tab.value === 'login' ? 'Logged in successfully!' : 'Account created successfully!');
      await navigateTo('/habits', { replace: true });
    }
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || 'Something went wrong.';
    loading.value = false;
  }
};

</script>
