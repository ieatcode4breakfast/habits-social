import tailwindcss from '@tailwindcss/vite';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@vueuse/motion/nuxt'],
  ssr: true,
  nitro: {
    preset: 'cloudflare-module',
    routeRules: {
      '/': { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } },
      '/api/**': { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } },
    }
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET || 'fallback-secret-for-dev',
    pusherAppId: process.env.PUSHER_APP_ID,
    pusherSecret: process.env.PUSHER_SECRET,
    public: {
      pusherKey: process.env.PUSHER_KEY,
      pusherCluster: process.env.PUSHER_CLUSTER,
    }
  },

  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()]
  }
})
