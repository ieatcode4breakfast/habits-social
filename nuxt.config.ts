import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@nuxtjs/supabase',
    '@vueuse/motion/nuxt' // VueUse motion for Nuxt
  ],
  supabase: {
    redirect: false // We will handle redirects explicitly
  },
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [
      tailwindcss()
    ]
  }
});
