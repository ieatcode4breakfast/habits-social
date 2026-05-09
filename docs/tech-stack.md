# Technical Stack: Habits Social

This document outlines the current technical architecture and dependencies for the Habits Social platform.

## 1. Core Framework & Runtime
- **Frontend/Full-stack**: [Nuxt 4](https://nuxt.com/) (Vue.js 3 Meta-framework)
- **Backend Engine**: [Nitro](https://nitro.unjs.io/) (Configured for Cloudflare Workers/Pages)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict mode)
- **Runtime**: Node.js / Cloudflare Workerd
- **Deployment**: [Cloudflare Pages](https://pages.cloudflare.com/)

## 2. Database & Data Management
- **Primary Database**: [PostgreSQL](https://www.postgresql.org/)
- **Hosting**: [Neon](https://neon.tech/) (Serverless Postgres)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/) (Primary query builder and schema management)
- **Database Driver**: `@neondatabase/serverless`
- **Client-side Storage**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper for offline/local data)
- **Validation**: [Zod](https://zod.dev/) (Schema validation and type inference)

## 3. Styling & UI
- **CSS Framework**: [Tailwind CSS 4](https://tailwindcss.com/) (Vite-integrated)
- **Icons**: [Lucide Vue Next](https://lucide.dev/)
- **Animations**: [@vueuse/motion](https://motion.vueuse.org/)
- **UI Utilities**: [@floating-ui/vue](https://floating-ui.com/)

## 4. Capabilities & Services
- **PWA**: [@vite-pwa/nuxt](https://vite-pwa-org.netlify.app/frameworks/nuxt) (Offline support and service workers)
- **Real-time Updates**: [Pusher](https://pusher.com/) (Server-side `pusher`, Client-side `pusher-js`)
- **Date Management**: [date-fns](https://date-fns.org/)
- **Authentication**: 
  - `jose` (JWT handling)
  - `bcrypt-ts` (Hashing)
- **SEO**: `@nuxtjs/seo`

## 5. Testing & Quality Assurance
- **Unit & Integration**: [Vitest](https://vitest.dev/)
- **E2E Testing**: [Playwright](https://playwright.dev/)
- **Test Utilities**: 
  - `@nuxt/test-utils`
  - `happy-dom` (DOM simulation)
  - `fake-indexeddb` (Mocking Dexie/IndexedDB for unit tests)

---
*Last Updated: 2026-05-09*

