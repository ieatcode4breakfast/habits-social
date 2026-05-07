import tailwindcss from '@tailwindcss/vite';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: [
    '@vueuse/motion/nuxt',
    '@nuxtjs/seo'
  ],
  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0',
    }
  },
  site: {
    url: 'https://www.habitssocial.com',
    name: 'HabitsSocial',
    description: 'The social platform for building better habits through accountability and community.',
    defaultLocale: 'en',
  },
  ssr: true,
  nitro: {
    preset: 'cloudflare-module',
    ignore: [
      'api/_v1/**',
      'api/v2/_tests/**',
      'api/v2/_types/**',
    ],
    routeRules: {
      '/**': { 
        headers: { 
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Vary': 'Cookie'
        } 
      }
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
