// Triggering deployment test build
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const noop = resolve(__dirname, 'node_modules/unenv/dist/runtime/mock/noop.mjs');

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
  },

  // Temporarily disabling compatibilityVersion 4 to see if it fixes the bundler crash
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()]
  }
})
