<template>
  <div class="min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative bg-slate-50 dark:bg-app-bg transition-colors duration-500 overflow-hidden">

    <div class="w-full max-w-md bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-8 rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-800/50 relative z-10">
      <div class="flex flex-col items-center mb-8 text-center">
        <div class="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-6 group hover:scale-105 transition-transform duration-300">
          <Activity class="w-8 h-8 text-white" />
        </div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">Track Together</h2>
        <p class="text-slate-500 dark:text-slate-400">Join friends and build lasting habits.</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="sr-only">Email address</label>
          <input 
            v-model="email"
            type="email" 
            required 
            class="w-full px-4 py-3 bg-white dark:bg-app-bg border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-900 dark:text-white placeholder-slate-400"
            placeholder="Email address"
          >
        </div>
        <div>
          <label class="sr-only">Password</label>
          <input 
            v-model="password"
            type="password" 
            required 
            class="w-full px-4 py-3 bg-white dark:bg-app-bg border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-900 dark:text-white placeholder-slate-400"
            placeholder="Password"
          >
        </div>
        <button 
          type="submit" 
          :disabled="loading"
          class="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 disabled:opacity-50 cursor-pointer"
        >
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>
      
      <p v-if="message" class="mt-4 text-center text-sm text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-500/10 py-2 rounded-lg">
        {{ message }}
      </p>
    </div>
  </div>
</template>

import { Activity } from 'lucide-vue-next';
import { useAuth } from '~/composables/useAuth';

definePageMeta({
  layout: false
});

const { user, fetchUser } = useAuth();
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const message = ref('')

// If already logged in, redirect
watchEffect(() => {
  if (user.value) {
    router.push('/')
  }
})

const handleLogin = async () => {
  loading.value = true
  message.value = ''
  try {
    // Attempt Login
    try {
      await $fetch('/api/auth/login', {
        method: 'POST',
        body: { email: email.value, password: password.value }
      });
      message.value = 'Success! Redirecting...'
      await fetchUser()
      await navigateTo('/')
      return
    } catch (signInErr: any) {
      if (signInErr.statusMessage === 'Invalid credentials' || signInErr.statusCode === 400 || signInErr.response?.status === 400) {
        // Assume user doesn't exist, try to register
        try {
          await $fetch('/api/auth/register', {
            method: 'POST',
            body: { email: email.value, password: password.value }
          });
          message.value = 'Account created! Logging you in...'
          await fetchUser()
          await new Promise(r => setTimeout(r, 800))
          await navigateTo('/')
          return
        } catch (signUpErr: any) {
           throw signUpErr;
        }
      } else {
        throw signInErr;
      }
    }
  } catch (error: any) {
    message.value = error.data?.statusMessage || error.statusMessage || error.message || 'Error occurred during login.'
  } finally {
    loading.value = false
  }
}
</script>
