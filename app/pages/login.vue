<template>
  <div class="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
    <div class="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 dark:opacity-40 animate-pulse"></div>
      <div class="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 dark:opacity-40 animate-pulse" style="animation-delay: 2s;"></div>
    </div>

    <div v-motion-pop class="w-full max-w-md bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20 dark:border-slate-800/50 relative z-10">
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
            class="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-900 dark:text-white placeholder-slate-400"
            placeholder="Email address"
          >
        </div>
        <button 
          type="submit" 
          :disabled="loading"
          class="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 disabled:opacity-50"
        >
          {{ loading ? 'Sending...' : 'Continue with Email' }}
        </button>
      </form>

      <div class="mt-8">
        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-slate-200 dark:border-slate-800"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-3 bg-white/60 dark:bg-slate-900/60 text-slate-500">Or continue with</span>
          </div>
        </div>

        <div class="mt-6">
          <button 
            @click="handleGuestLogin"
            :disabled="loading"
            class="w-full flex items-center justify-center gap-2 py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <UserCircle class="w-5 h-5" />
            Continue as Guest
          </button>
        </div>
      </div>
      
      <p v-if="message" class="mt-4 text-center text-sm text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-500/10 py-2 rounded-lg">
        {{ message }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Activity, UserCircle } from 'lucide-vue-next';

definePageMeta({
  layout: 'default' // Or false if you don't want the header here
});

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const router = useRouter()

const email = ref('')
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
    const { error } = await supabase.auth.signInWithOtp({
      email: email.value,
      options: { emailRedirectTo: window.location.origin }
    })
    if (error) throw error
    message.value = 'Check your email for the login link!'
  } catch (error: any) {
    message.value = error.message || 'Error occurred during login.'
  } finally {
    loading.value = false
  }
}

const handleGuestLogin = async () => {
  loading.value = true
  try {
    const { error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    // Let the watcher push to '/'
  } catch (error: any) {
    message.value = error.message || 'Error occurred.'
    loading.value = false
  }
}
</script>
