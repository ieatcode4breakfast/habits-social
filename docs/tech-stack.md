# Technical Stack: Habits Social

This document outlines the current technical architecture and dependencies for the Habits Social platform.

## 1. Core Framework & Runtime
- **Frontend/Full-stack**: [Nuxt 4](https://nuxt.com/) (Vue.js 3 Meta-framework)
- **Backend Engine**: [Nitro](https://nitro.unjs.io/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict mode)
- **Runtime**: Node.js

## 2. Database & Data Management
- **Primary Database**: [PostgreSQL](https://www.postgresql.org/)
- **Hosting**: [Neon](https://neon.tech/) (Serverless Postgres)
- **Database Driver**: `@neondatabase/serverless`
- **ORM/Query Builder**: **Raw SQL** (Currently transitioning/evaluating ORMs like **Drizzle**)
- **Client-side Storage**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper for offline/local data)
- **Validation**: [Zod](https://zod.dev/) (Schema validation and type inference)

## 3. Styling & UI
- **CSS Framework**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Icons**: [Lucide Vue Next](https://lucide.dev/)
- **Animations**: [@vueuse/motion](https://motion.vueuse.org/)
- **UI Utilities**: [@floating-ui/vue](https://floating-ui.com/)

## 4. Services & Utilities
- **Real-time Updates**: [Pusher](https://pusher.com/)
- **Date Management**: [date-fns](https://date-fns.org/)
- **Authentication**: 
  - `jose` (JWT handling)
  - `bcrypt-ts` (Hashing)
- **SEO**: `@nuxtjs/seo`

## 5. Testing & Quality Assurance
- **Unit & Integration**: [Vitest](https://vitest.dev/)
- **E2E Testing**: [Playwright](https://playwright.dev/)
- **Test Utilities**: `@nuxt/test-utils`

---
*Last Updated: 2026-05-08*
