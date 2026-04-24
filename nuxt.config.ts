import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@vueuse/motion/nuxt'],
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'fallback-secret-for-dev',
  },
  css: ['~/assets/css/main.css'],
  nitro: {
    preset: 'cloudflare-pages',
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
