import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'happy-dom',
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**'],
    include: ['**/*.spec.ts'],
    env: {
      // Inline some defaults if needed, but we want the real .env
    }
  }
})
