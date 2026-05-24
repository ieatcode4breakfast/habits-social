import tailwindcss from '@tailwindcss/vite';
import { buildContentSecurityPolicy } from './utils/securityHeaders';

const contentSecurityPolicy = buildContentSecurityPolicy({
  realtimeEnabled: process.env.NUXT_PUBLIC_REALTIME_ENABLED,
  partykitHost: process.env.NUXT_PUBLIC_PARTYKIT_HOST,
});

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  modules: [
    '@vueuse/nuxt',
    '@vueuse/motion/nuxt',
    '@nuxtjs/seo',
    ...(process.env.NODE_ENV !== 'test' ? ['@vite-pwa/nuxt'] : [])
  ],
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Habits Social',
      short_name: 'Habits Social',
      theme_color: '#000000',
      background_color: '#000000',
      display: 'standalone',
      start_url: '/?source=pwa',
      icons: [
        {
          src: 'favicon-rounded.svg',
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any'
        },
        {
          src: 'favicon-rounded.svg',
          sizes: '512x512',
          type: 'image/svg+xml',
          purpose: 'maskable'
        }
      ],
    },
    workbox: {
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
              maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
            },
          },
        }
      ],
    },
    devOptions: {
      enabled: false, // Disabled in dev to prevent caching issues during active development
    },
  },
  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover',
    }
  },
  site: {
    url: 'https://www.habitssocial.com',
    name: 'Habits Social',
    description: 'The social platform for building better habits through accountability and community.',
    defaultLocale: 'en',
  },
  ssr: true,
  typescript: {
    strict: true
  },
  nitro: {
    preset: 'cloudflare-module',
    ignore: [
      'api/_v1/**',
      'api/v2/_tests/**',
      'api/v2/_types/**',
    ],
    routeRules: {
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
      }
    }
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    realtimeJwtSecret: process.env.REALTIME_JWT_SECRET,
    partykitNotifySecret: process.env.PARTYKIT_NOTIFY_SECRET,
    public: {
      appName: process.env.APP_NAME || 'Habits Social',
      realtimeEnabled: process.env.NUXT_PUBLIC_REALTIME_ENABLED === 'true',
      partykitHost: process.env.NUXT_PUBLIC_PARTYKIT_HOST || '',
    }
  },

  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()]
  }
})
