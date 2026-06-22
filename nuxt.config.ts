import { readdirSync } from 'node:fs';
import { join, parse } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { buildContentSecurityPolicy, buildNativeContentSecurityPolicy } from './utils/securityHeaders';
import { getThemeModeBootstrapScript } from './app/utils/theme';

const contentSecurityPolicy = buildContentSecurityPolicy({
  realtimeEnabled: process.env.NUXT_PUBLIC_REALTIME_ENABLED,
  partykitHost: process.env.NUXT_PUBLIC_PARTYKIT_HOST,
});

// ponytail: HABITS_BUILD === 'native' selects a single-process build mode (ssr:false, no PWA, static nitro preset, embedded prod hosts). Ceiling: single-process env switch; no matrix builds.
const isNativeBuild = process.env.HABITS_BUILD === 'native';

// Dynamically discover help-center articles so new .md files need no config update.
const helpCenterDir = join(process.cwd(), 'content', 'help-center');
const helpCenterRoutes = readdirSync(helpCenterDir)
  .filter((name) => name.endsWith('.md'))
  .map((name) => `/help-center/${parse(name).name}`);

// ponytail: conditional spread preserves contextual typing from defineNuxtConfig, avoiding widened types

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  modules: [
    '@nuxt/content',
    '@vueuse/nuxt',
    '@vueuse/motion/nuxt',
    '@nuxtjs/seo',
    ...(process.env.NODE_ENV !== 'test' && !isNativeBuild ? ['@vite-pwa/nuxt'] : [])
  ],
  ...(!isNativeBuild ? {
    pwa: {
      registerType: 'autoUpdate',
      manifest: {
        id: '/',
        name: process.env.APP_NAME || 'Habits Social',
        short_name: process.env.APP_NAME || 'Habits Social',
        description: 'Track habits, build streaks, and stay accountable with friends.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/?source=pwa',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.png?v=2',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-512.png?v=2',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-maskable-512.png?v=2',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
      },
      workbox: {
        importScripts: ['/push-sw.js'],
        navigateFallback: '/',
        navigateFallbackDenylist: [/^\/api\//, /^\/login$/, /^\/forgot-password$/, /^\/reset-password$/],
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/_nuxt/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'nuxt-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          }
        ],
      },
      devOptions: {
        enabled: false,
      },
    },
  } : {}),
  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      meta: isNativeBuild
        ? [{ 'http-equiv': 'Content-Security-Policy', content: buildNativeContentSecurityPolicy({ partykitHost: process.env.NUXT_PUBLIC_PARTYKIT_HOST, apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL }) }]
        : [],
      script: [
        { innerHTML: getThemeModeBootstrapScript() },
      ],
    }
  },
  site: {
    url: 'https://www.habitssocial.com',
    name: 'Habits Social',
    description: 'The social platform for building better habits through accountability and community.',
    defaultLocale: 'en',
  },
  ssr: !isNativeBuild,
  typescript: {
    strict: true
  },
  nitro: {
    preset: isNativeBuild ? 'static' : 'cloudflare-module',
    ...(!isNativeBuild ? { prerender: { routes: helpCenterRoutes } } : {}),
    ignore: [
      'api/_v1/**',
      'api/v2/_tests/**',
      'api/v2/_types/**',
    ],
    routeRules: {
      '/help-center': { redirect: '/help-center/welcome' },
      '/_nuxt/**': { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
      '/**': {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Vary': 'Cookie',
          'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
          'Content-Security-Policy': contentSecurityPolicy
        }
      }
    },
    storage: {
      authRateLimit: {
        driver: 'memory'
      },
      chatRateLimit: {
        driver: 'memory'
      },
      generalRateLimit: {
        driver: 'memory'
      }
    }
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    realtimeJwtSecret: process.env.REALTIME_JWT_SECRET,
    partykitNotifySecret: process.env.PARTYKIT_NOTIFY_SECRET,
    resendApiKey: process.env.RESEND_API_KEY,
    resendFromEmail: process.env.RESEND_FROM_EMAIL || 'Habits Social <noreply@habitssocial.com>',
    appUrl: process.env.APP_URL || process.env.NUXT_PUBLIC_APP_URL || 'https://www.habitssocial.com',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
    vapidSubject: process.env.VAPID_SUBJECT || 'mailto:noreply@habitssocial.com',
    public: {
      appName: process.env.APP_NAME || 'Habits Social',
      realtimeEnabled: process.env.NUXT_PUBLIC_REALTIME_ENABLED === 'true',
      partykitHost: process.env.NUXT_PUBLIC_PARTYKIT_HOST || '',
      vapidPublicKey: process.env.NUXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '',
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || '',
      pwaEnabled: !isNativeBuild && process.env.NODE_ENV !== 'test',
      build: process.env.HABITS_BUILD || 'web',
    }
  },

  css: ['~/assets/css/main.css', 'driver.js/dist/driver.css'],
  vite: {
    plugins: [tailwindcss()],
    define: {
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'true'
    }
  }
})
