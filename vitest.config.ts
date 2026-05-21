import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    setupFiles: ['dotenv/config', './test/setup.ts'],
    environment: 'happy-dom',
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**'],
    include: ['**/*.spec.ts'],
    typecheck: {
      enabled: true,
    },
  }
})
