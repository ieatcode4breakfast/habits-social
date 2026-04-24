import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@vueuse/motion/nuxt'],
  runtimeConfig: {
    mongodbUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET || 'fallback-secret-for-dev',
  },
  css: ['~/assets/css/main.css'],
  nitro: {
    experimental: {
      nodeJsCompat: true,
    },
    alias: {
      'mongodb-client-encryption': 'unenv/mock/proxy',
      aws4: 'unenv/mock/proxy',
      kerberos: 'unenv/mock/proxy',
      '@aws-sdk/credential-providers': 'unenv/mock/proxy',
      snappy: 'unenv/mock/proxy',
      socks: 'unenv/mock/proxy',
      'os-dns-native': 'unenv/mock/proxy',
      '@mongodb-js/zstd': 'unenv/mock/proxy',
      'bson-ext': 'unenv/mock/proxy',
      'gcp-metadata': 'unenv/mock/proxy',
    },
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
