<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="flex flex-col items-center mb-8">
        <div class="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4">
          <Activity class="w-7 h-7 text-white" />
        </div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Habits</h1>
        <p class="text-slate-500 dark:text-slate-400 text-sm mt-1">Track together, grow together</p>
      </div>

      <!-- Card -->
      <div class="bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-800/50 overflow-hidden">
        <!-- Tabs -->
        <div class="flex border-b border-slate-200 dark:border-slate-800">
          <button
            @click="tab = 'login'"
            class="flex-1 py-4 text-sm font-semibold transition-colors cursor-pointer"
            :class="tab === 'login'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
          >
            Log In
          </button>
          <button
            @click="tab = 'signup'"
            class="flex-1 py-4 text-sm font-semibold transition-colors cursor-pointer"
            :class="tab === 'signup'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
          >
            Sign Up
          </button>
        </div>

        <div class="p-8">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-1">
            {{ tab === 'login' ? 'Log In' : 'Create Account' }}
          </h2>
          <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {{ tab === 'login' ? 'Enter your credentials to continue.' : 'Sign up to start tracking your habits.' }}
          </p>

          <form @submit.prevent="handleSubmit" class="space-y-4">
            <!-- Email -->
            <div class="relative">
              <Mail class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                v-model="email"
                type="email"
                placeholder="Email"
                required
                class="w-full pl-10 pr-4 py-3 bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
              />
            </div>

            <!-- Password -->
            <div class="relative">
              <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Password"
                required
                class="w-full pl-10 pr-12 py-3 bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
              />
              <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                <Eye v-if="!showPassword" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>

            <!-- Confirm Password -->
            <div v-if="tab === 'signup'" class="relative" v-motion-slide-top>
              <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Confirm Password"
                required
                class="w-full pl-10 pr-12 py-3 bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
              />
              <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                <Eye v-if="!showPassword" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>

            <!-- Error -->
            <p v-if="error" class="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">{{ error }}</p>

            <!-- Actions -->
            <div class="flex items-center gap-3 pt-2">
              <button
                type="button"
                @click="email = ''; password = ''; confirmPassword = ''; error = ''"
                class="flex-1 py-3 text-sm font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="loading"
                class="flex-1 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl transition-colors cursor-pointer shadow-lg shadow-indigo-500/20"
              >
                {{ loading ? 'Please wait...' : (tab === 'login' ? 'Log In' : 'Sign Up') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Activity, Mail, Lock, Eye, EyeOff } from 'lucide-vue-next';

definePageMeta({ layout: false });

const { user, fetchUser } = useAuth();
const router = useRouter();

watchEffect(() => { if (user.value) router.push('/'); });

const tab = ref<'login' | 'signup'>('login');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const loading = ref(false);
const error = ref('');

const handleSubmit = async () => {
  loading.value = true;
  error.value = '';

  if (tab.value === 'signup' && password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.';
    loading.value = false;
    return;
  }

  try {
    const endpoint = tab.value === 'login' ? '/api/auth/login' : '/api/auth/register';
    await $fetch(endpoint, { method: 'POST', body: { email: email.value, password: password.value } });
    await fetchUser();
    await navigateTo('/');
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || 'Something went wrong.';
  } finally {
    loading.value = false;
  }
};
</script>
