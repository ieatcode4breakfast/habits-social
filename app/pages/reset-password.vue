<template>
  <div class="min-h-screen flex flex-col items-center justify-center px-4 py-8">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="flex flex-col items-center mb-8">
        <div class="w-14 h-14 bg-transparent rounded-full flex items-center justify-center shadow-lg shadow-white/10 mb-4 overflow-hidden">
          <img src="/icons/icon-192.png" class="w-full h-full object-cover scale-[1.35] transform-gpu" alt="Logo" />
        </div>
        <h1 class="text-2xl font-bold text-white tracking-tight">Habits Social</h1>
      </div>

      <!-- Card -->
      <div class="bg-zinc-925/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden">
        <div class="p-6 sm:p-8">
          <NuxtLink
            to="/login"
            class="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
          >
            <ArrowLeft class="w-4 h-4" />
            Back to login
          </NuxtLink>

          <!-- State 1: Missing Token -->
          <div v-if="!token" class="space-y-5 text-center" aria-live="polite">
            <div class="flex items-center justify-center w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 mx-auto">
              <AlertCircle class="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <h2 class="text-xl font-bold text-white mb-2">Invalid Reset Link</h2>
              <p class="text-sm text-zinc-500 leading-6 text-left mt-2">
                This password reset link is invalid or has expired. Please request a new link to reset your password.
              </p>
            </div>
            <NuxtLink
              to="/forgot-password"
              class="block w-full py-3 text-center text-sm font-semibold text-black bg-white hover:bg-zinc-200 rounded-xl transition-colors cursor-pointer shadow-lg shadow-white/10"
            >
              Request new link
            </NuxtLink>
          </div>

          <!-- State 2: Reset Successful -->
          <div v-else-if="submitted" class="space-y-5 text-center" aria-live="polite">
            <div class="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 mx-auto">
              <CheckCircle2 class="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 class="text-xl font-bold text-white mb-2">Password Reset</h2>
              <p class="text-sm text-zinc-500 leading-6 text-left mt-2">
                Your password has been successfully reset. You can now log in to your account with your new password.
              </p>
            </div>
            <NuxtLink
              to="/login"
              class="block w-full py-3 text-center text-sm font-semibold text-black bg-white hover:bg-zinc-200 rounded-xl transition-colors cursor-pointer shadow-lg shadow-white/10"
            >
              Go to login
            </NuxtLink>
          </div>

          <!-- State 3: Reset Form -->
          <form v-else class="space-y-4" @submit.prevent="handleSubmit">
            <div>
              <h2 class="text-xl font-bold text-white mb-1 text-center">Reset Password</h2>
              <p class="text-sm text-zinc-500 text-left mt-1">
                Enter your new secure password below to update your account credentials.
              </p>
            </div>

            <!-- New Password -->
            <div class="relative">
              <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="New Password"
                required
                minlength="8"
                maxlength="72"
                class="w-full pl-10 pr-12 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-all text-sm"
              />
              <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer">
                <Eye v-if="!showPassword" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>

            <!-- Confirm Password -->
            <div class="relative">
              <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Confirm Password"
                required
                minlength="8"
                maxlength="72"
                class="w-full pl-10 pr-12 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-all text-sm"
              />
              <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer">
                <Eye v-if="!showPassword" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>

            <p v-if="error" class="text-sm text-red-400 bg-red-950/50 px-3 py-2 rounded-lg text-center">{{ error }}</p>

            <button
              type="submit"
              :disabled="loading"
              class="w-full py-3 text-sm font-semibold text-black bg-white hover:bg-zinc-200 disabled:opacity-50 rounded-xl transition-colors cursor-pointer shadow-lg shadow-white/10"
            >
              {{ loading ? 'Resetting...' : 'Reset password' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, CheckCircle2, Lock, Eye, EyeOff, AlertCircle } from 'lucide-vue-next';

interface ResetPasswordResponse {
  data: {
    message: string;
  };
}

definePageMeta({
  layout: false,
  middleware: 'auth'
});

useSeoMeta({
  title: 'Reset Password - Habits Social',
  ogTitle: 'Reset Password - Habits Social',
  description: 'Enter your new secure credentials to reset your account password.',
  ogDescription: 'Enter your new secure credentials to reset your account password.',
});

const route = useRoute();
const token = ref((route.query.token as string) || '');
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const loading = ref(false);
const submitted = ref(false);
const error = ref('');

const { showToast } = useToast();

const handleSubmit = async () => {
  if (!token.value) {
    error.value = 'Reset token is missing.';
    return;
  }

  if (password.value.length < 8 || password.value.length > 72) {
    error.value = 'Password must be between 8 and 72 characters.';
    return;
  }

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    await $fetch<ResetPasswordResponse>('/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: token.value,
        password: password.value
      }
    });
    submitted.value = true;
    showToast('Password has been reset successfully!');
  } catch (unknownError: unknown) {
    const fetchError = unknownError as {
      data?: { statusMessage?: string };
      statusMessage?: string;
    };
    error.value = fetchError.data?.statusMessage || fetchError.statusMessage || 'Unable to reset password.';
  } finally {
    loading.value = false;
  }
};
</script>
