<template>
  <div class="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative">
    <button @click="toggleThemeMode" class="fixed top-4 right-4 p-2 rounded-lg hover:bg-zinc-900 transition-colors z-50" :title="themeToggleTitle">
      <MoonIcon v-if="isLightMode" class="w-5 h-5 text-white" />
      <SunIcon v-else class="w-5 h-5 text-white" />
    </button>
    <div class="w-full max-w-md">
      <div class="flex flex-col items-center mb-8">
        <div class="w-14 h-14 bg-transparent rounded-full flex items-center justify-center shadow-lg shadow-white/10 mb-4 overflow-hidden">
          <img src="/icons/icon-192.png" class="w-full h-full object-cover scale-[1.35] transform-gpu" alt="Logo" />
        </div>
        <h1 class="text-2xl font-bold text-white tracking-tight">Habits Social</h1>
      </div>

      <div class="bg-zinc-925/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden">
        <div class="p-6 sm:p-8">
          <NuxtLink
            to="/login"
            class="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
          >
            <ArrowLeft class="w-4 h-4" />
            Back to login
          </NuxtLink>

          <div v-if="submitted" class="space-y-5" aria-live="polite">
            <div class="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 mx-auto">
              <CheckCircle2 class="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 class="text-xl font-bold text-white mb-2 text-center">Check your email</h2>
              <p class="text-sm text-zinc-500 leading-6 text-left mt-2">
                If an account exists for that email, password reset instructions have been sent.
              </p>
            </div>
            <button
              type="button"
              @click="resetForm"
              class="w-full py-3 text-sm font-semibold text-black bg-white hover:bg-zinc-200 rounded-xl transition-colors cursor-pointer shadow-lg shadow-white/10"
            >
              Try another email
            </button>
          </div>

          <form v-else class="space-y-4" @submit.prevent="handleSubmit">
            <div>
              <h2 class="text-xl font-bold text-white mb-1 text-center">Forgot password?</h2>
              <p class="text-sm text-zinc-500 text-left mt-1">
                Enter your email address and we'll send reset instructions.
              </p>
            </div>

            <div class="relative">
              <Mail class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                v-model="email"
                type="email"
                placeholder="Email"
                required
                maxlength="255"
                autocomplete="email"
                class="w-full pl-10 pr-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-all text-sm"
              />
            </div>

            <p v-if="error" class="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-sm text-center font-medium">{{ error }}</p>

            <button
              type="submit"
              :disabled="loading"
              class="w-full py-3 text-sm font-semibold text-black bg-white hover:bg-zinc-200 disabled:opacity-50 rounded-xl transition-colors cursor-pointer shadow-lg shadow-white/10"
            >
              {{ loading ? 'Sending...' : 'Send reset link' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, CheckCircle2, Mail, Sun as SunIcon, Moon as MoonIcon } from 'lucide-vue-next';
import { useThemeMode } from '~/composables/useThemeMode';

const { isLightMode, themeToggleTitle, toggleThemeMode } = useThemeMode();

interface ForgotPasswordResponse {
  data: {
    message: string;
  };
}

definePageMeta({
  layout: false,
  middleware: 'auth'
});

useSeoMeta({
  title: 'Forgot Password - Habits Social',
  ogTitle: 'Forgot Password - Habits Social',
  description: 'Request a secure password reset link for your Habits Social account.',
  ogDescription: 'Request a secure password reset link for your Habits Social account.',
});

const email = ref('');
const loading = ref(false);
const submitted = ref(false);
const error = ref('');

const resetForm = () => {
  email.value = '';
  error.value = '';
  submitted.value = false;
};

const handleSubmit = async () => {
  loading.value = true;
  error.value = '';

  try {
    await $fetch<ForgotPasswordResponse>('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: email.value.trim() }
    });
    submitted.value = true;
  } catch (unknownError: unknown) {
    const fetchError = unknownError as {
      data?: { statusMessage?: string };
      statusMessage?: string;
    };
    error.value = fetchError.data?.statusMessage || fetchError.statusMessage || 'Unable to send reset instructions.';
  } finally {
    loading.value = false;
  }
};
</script>
