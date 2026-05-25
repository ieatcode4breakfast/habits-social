<template>
  <div class="min-h-screen flex flex-col items-center justify-center px-4 py-8">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="flex flex-col items-center mb-8">
        <div class="w-14 h-14 bg-transparent rounded-full flex items-center justify-center shadow-lg shadow-white/10 mb-4 overflow-hidden">
          <img src="/icons/icon-192.png" class="w-full h-full object-cover scale-[1.35] transform-gpu" alt="Logo" />
        </div>
        <h1 class="text-2xl font-bold text-white tracking-tight">Habits Social</h1>
        <p class="text-zinc-500 text-sm mt-1">A social habit tracking app.</p>
      </div>

      <!-- Card -->
      <div class="bg-zinc-925/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden">
        <!-- Main Form (Login / Signup) -->
        <div v-show="!showGoogleSignup">
          <!-- Tabs -->
          <div class="flex border-b border-zinc-925">
            <button
              @click="tab = 'login'"
              class="flex-1 py-4 text-sm font-semibold transition-colors cursor-pointer"
              :class="tab === 'login'
                ? 'text-white border-b-2 border-white'
                : 'text-zinc-500 hover:text-zinc-300'"
            >
              Log In
            </button>
            <button
              @click="tab = 'signup'"
              class="flex-1 py-4 text-sm font-semibold transition-colors cursor-pointer"
              :class="tab === 'signup'
                ? 'text-white border-b-2 border-white'
                : 'text-zinc-500 hover:text-zinc-300'"
            >
              Sign Up
            </button>
          </div>

          <div class="p-6 sm:p-8">
            <h2 class="text-xl font-bold text-white mb-1">
              {{ tab === 'login' ? 'Log In' : 'Create Account' }}
            </h2>
            <p class="text-sm text-zinc-500 mb-6">
              {{ tab === 'login' ? 'Enter your credentials to continue.' : 'Sign up to start tracking your habits.' }}
            </p>

            <form @submit.prevent="handleSubmit" class="space-y-4">

              <!-- Username -->
              <div v-if="tab === 'signup'" class="relative" v-motion-slide-top>
                <User class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  v-model="username"
                  type="text"
                  placeholder="Username"
                  required
                  minlength="3"
                  maxlength="20"
                  class="w-full pl-10 pr-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-all text-sm"
                />
              </div>

              <!-- Email / Username -->
              <div class="relative">
                <component :is="tab === 'login' ? User : Mail" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  v-model="email"
                  :type="tab === 'login' ? 'text' : 'email'"
                  :placeholder="tab === 'login' ? 'Email or Username' : 'Email'"
                  required
                  class="w-full pl-10 pr-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-all text-sm"
                />
              </div>

              <!-- Password -->
              <div class="relative">
                <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Password"
                  required
                  minlength="8"
                  maxlength="128"
                  class="w-full pl-10 pr-12 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-all text-sm"
                />
                <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer">
                  <Eye v-if="!showPassword" class="w-4 h-4" />
                  <EyeOff v-else class="w-4 h-4" />
                </button>
              </div>

              <!-- Confirm Password -->
              <div v-if="tab === 'signup'" class="relative" v-motion-slide-top>
                <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  v-model="confirmPassword"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Confirm Password"
                  required
                  maxlength="128"
                  class="w-full pl-10 pr-12 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-all text-sm"
                />
                <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer">
                  <Eye v-if="!showPassword" class="w-4 h-4" />
                  <EyeOff v-else class="w-4 h-4" />
                </button>
              </div>

              <!-- Error -->
              <p v-if="error" class="text-sm text-red-400 bg-red-950/50 px-3 py-2 rounded-lg text-center">{{ error }}</p>

              <!-- Actions -->
              <div class="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  @click="email = ''; username = ''; password = ''; confirmPassword = ''; photourl = ''; error = ''"
                  class="flex-1 py-3 text-sm font-semibold text-zinc-400 bg-transparent hover:bg-zinc-925 rounded-xl transition-colors cursor-pointer"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  :disabled="loading"
                  class="flex-1 py-3 text-sm font-semibold text-black bg-white hover:bg-zinc-200 disabled:opacity-50 rounded-xl transition-colors cursor-pointer shadow-lg shadow-white/10"
                >
                  {{ loading ? 'Please wait...' : (tab === 'login' ? 'Log In' : 'Sign Up') }}
                </button>
              </div>
            </form>

            <!-- Google OAuth Divider -->
            <div class="relative flex py-5 items-center">
              <div class="flex-grow border-t border-zinc-800"></div>
              <span class="flex-shrink mx-4 text-zinc-500 text-xs uppercase tracking-wider">Or continue with</span>
              <div class="flex-grow border-t border-zinc-800"></div>
            </div>

            <!-- Google Button Container -->
            <div class="flex justify-center pb-2">
              <div id="google-btn" class="w-full max-w-[320px] h-[44px]"></div>
            </div>
          </div>
        </div>

        <!-- Complete Profile Dialog for Google Registrations -->
        <div v-show="showGoogleSignup">
          <div class="p-6 sm:p-8" v-motion-fade>
            <div class="flex flex-col items-center mb-6">
              <h2 class="text-xl font-bold text-white text-center">Complete Profile</h2>
              <p class="text-xs text-zinc-500 text-center mt-1">Choose a username and password to finalize your profile.</p>
            </div>

            <form @submit.prevent="handleGoogleSignupSubmit" class="space-y-4">
              <!-- Username -->
              <div class="relative">
                <User class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  v-model="googleUsername"
                  type="text"
                  placeholder="Username"
                  required
                  minlength="3"
                  maxlength="20"
                  class="w-full pl-10 pr-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-all text-sm"
                />
              </div>

              <!-- Password -->
              <div class="relative">
                <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  v-model="googlePassword"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Password"
                  required
                  minlength="8"
                  maxlength="128"
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
                  v-model="googleConfirmPassword"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Confirm Password"
                  required
                  maxlength="128"
                  class="w-full pl-10 pr-12 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-all text-sm"
                />
                <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer">
                  <Eye v-if="!showPassword" class="w-4 h-4" />
                  <EyeOff v-else class="w-4 h-4" />
                </button>
              </div>

              <!-- Error -->
              <p v-if="error" class="text-sm text-red-400 bg-red-950/50 px-3 py-2 rounded-lg text-center">{{ error }}</p>

              <!-- Actions -->
              <div class="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  @click="showGoogleSignup = false; error = ''; googlePassword = ''; googleConfirmPassword = ''"
                  class="flex-1 py-3 text-sm font-semibold text-zinc-400 bg-transparent hover:bg-zinc-925 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  :disabled="loading"
                  class="flex-1 py-3 text-sm font-semibold text-black bg-white hover:bg-zinc-200 disabled:opacity-50 rounded-xl transition-colors cursor-pointer shadow-lg shadow-white/10"
                >
                  {{ loading ? 'Finalizing...' : 'Complete Signup' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Mail, Lock, Eye, EyeOff, User } from 'lucide-vue-next';

definePageMeta({ 
  layout: false,
  middleware: 'auth'
});

const { user } = useAuth();
const { showToast } = useToast();
const router = useRouter();

useSeoMeta({
  title: 'Log In or Sign Up - Habits Social',
  ogTitle: 'Habits Social - Join the Community',
  description: 'Join Habits Social to track your habits, stay accountable with friends, and build a better routine.',
  ogDescription: 'Join Habits Social to track your habits, stay accountable with friends, and build a better routine.',
});

// Load Google Identity Services SDK securely
useHead({
  script: [
    { src: 'https://accounts.google.com/gsi/client', async: true, defer: true }
  ]
});

const tab = ref<'login' | 'signup'>('login');
const email = ref('');
const username = ref('');
const password = ref('');
const confirmPassword = ref('');
const photourl = ref('');
const showPassword = ref(false);
const loading = ref(false);
const error = ref('');

// Google Registration Flow State
const showGoogleSignup = ref(false);
const googleSignupEmail = ref('');
const googleSignupToken = ref('');
const googleSignupPhotoUrl = ref('');
const googleUsername = ref('');
const googlePassword = ref('');
const googleConfirmPassword = ref('');

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
    const { data } = await $fetch<{ data: any }>(endpoint, { 
      method: 'POST',
      body: { 
        [endpoint === '/api/auth/login' ? 'identifier' : 'email']: email.value, 
        username: username.value,
        password: password.value
      }
    });

    if (data.token) {
      user.value = data;
      if (tab.value === 'signup') {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('just-signed-up', 'true');
        }
      }
      showToast(tab.value === 'login' ? 'Logged in successfully!' : 'Account created successfully!');
      await navigateTo('/social', { replace: true });
    }
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || 'Something went wrong.';
    loading.value = false;
  }
};

// Google ID token callback handler
const handleGoogleCallback = async (response: any) => {
  loading.value = true;
  error.value = '';
  try {
    const res = await $fetch<{ data: any }>('/api/auth/google', {
      method: 'POST',
      body: { credential: response.credential }
    });

    if (res.data.signupRequired) {
      googleSignupEmail.value = res.data.email;
      googleSignupToken.value = res.data.signupToken;
      googleSignupPhotoUrl.value = res.data.photoUrl;
      googleUsername.value = res.data.email.split('@')[0] || '';
      showGoogleSignup.value = true;
    } else {
      user.value = res.data;
      showToast('Logged in successfully!');
      await navigateTo('/social', { replace: true });
    }
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || 'Google Sign-In failed.';
  } finally {
    loading.value = false;
  }
};

// Final Google Signup Completer
const handleGoogleSignupSubmit = async () => {
  if (googleUsername.value.length < 3 || googleUsername.value.length > 20) {
    error.value = 'Username must be between 3 and 20 characters.';
    return;
  }
  if (googlePassword.value.length < 8 || googlePassword.value.length > 128) {
    error.value = 'Password must be between 8 and 128 characters long.';
    return;
  }
  if (googlePassword.value !== googleConfirmPassword.value) {
    error.value = 'Passwords do not match.';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const res = await $fetch<{ data: any }>('/api/auth/register-google', {
      method: 'POST',
      body: {
        signupToken: googleSignupToken.value,
        username: googleUsername.value,
        password: googlePassword.value
      }
    });

    user.value = res.data;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('just-signed-up', 'true');
    }
    showToast('Account completed successfully!');
    await navigateTo('/social', { replace: true });
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || 'Profile finalization failed.';
  } finally {
    loading.value = false;
  }
};

// Initialize GIS on mount
onMounted(() => {
  const initGoogle = () => {
    if (typeof window !== 'undefined' && (window as any).google) {
      (window as any).google.accounts.id.initialize({
        client_id: useRuntimeConfig().public.googleClientId,
        callback: handleGoogleCallback,
      });

      const btnEl = document.getElementById('google-btn');
      if (btnEl) {
        const parentWidth = btnEl.parentElement?.clientWidth || 320;
        const responsiveWidth = Math.min(320, Math.max(200, parentWidth));
        
        (window as any).google.accounts.id.renderButton(btnEl, {
          theme: 'outline',
          size: 'large',
          width: responsiveWidth,
          logo_alignment: 'left',
          text: 'signin_with',
          shape: 'rectangular',
        });
      }
    } else {
      setTimeout(initGoogle, 100);
    }
  };
  initGoogle();
});
</script>
