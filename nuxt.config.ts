import tailwindcss from '@tailwindcss/vite';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@vueuse/motion/nuxt'],
  ssr: true,
  
  nitro: {
    preset: 'cloudflare',
    node: true
  },

  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'fallback-secret-for-dev',
  },

  // Temporarily disabling compatibilityVersion 4 to see if it fixes the bundler crash
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()]
  }
})
