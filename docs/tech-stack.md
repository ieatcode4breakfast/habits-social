# Technical Stack: Habits Social

This document is the source of truth for the current application stack and the operational rules that keep deployments safe.

# Part A: Technical Stack

## 1. Application Runtime

- **Framework**: Nuxt 4 with Vue 3 (Composition API with `<script setup>`).
- **Server Engine**: Nitro (file-based API routes under `server/api/`).
- **Runtime Targets**: Node.js (v22) for local tooling and Cloudflare Workerd for deployed server runtime.
- **Language**: TypeScript with `strict: true`.
- **Production Build Command**: `npm run build`.
- **Type Safety Command**: `npm run check` (runs `nuxi typecheck` and `vitest typecheck`).

## 2. Hosting and Deployment

- **App Hosting**: Cloudflare Workers via Wrangler (preset `cloudflare-module`, compat flag `nodejs_compat`).
- **CI/CD**: GitHub Actions (`.github/workflows/deploy.yml`) on pushes to `staging` and `main`.
- **Staging Worker**: `habits-social-staging`.
- **Staging Domain**: `habits-social-staging.mycooltools.workers.dev`.
- **Production Worker**: `habits-social-live`.
- **Production Domains**: `habitssocial.com` and `www.habitssocial.com`.
- **Static Assets**: served from `.output/public` through the Cloudflare Workers assets binding.

## 3. Database

- **Database**: PostgreSQL (15 tables total; see `server/db/schema.ts`).
- **Host**: Neon Serverless Postgres (Asia-Southeast-1 region).
- **ORM and Query Builder**: Drizzle ORM.
- **Schema Validation**: Drizzle Zod (generates Zod schemas from Drizzle table definitions).
- **Migration Tool**: Drizzle Kit (`generate`, `migrate`, `check`).
- **Database Driver**: `@neondatabase/serverless`.
- **Schema Source**: `server/db/schema.ts`.
- **Migration Directory**: `server/db/migrations`.
- **Drizzle Config**: `drizzle.config.ts`.
- **Migration Ledger**: Drizzle reads `drizzle.__drizzle_migrations`.

### Database Tables

`users`, `password_reset_tokens`, `habits`, `habit_logs`, `buckets`, `bucket_habits`, `bucket_logs`, `share_events`, `friendships`, `user_blocks`, `sync_deletions`, `chat_conversations`, `chat_participants`, `chat_messages`, `push_subscriptions`

## 4. Database Branches

- **Production**: live production data.
- **Staging**: staging environment used to prove application code and migrations before production release.
- **Production Copy**: temporary safety branch created from production before risky repair or migration work.

Do not treat a Neon branch as automatically migrated. Each branch has its own schema state and must be checked or migrated explicitly.

## 5. Secrets and Environment Variables

- **Cloudflare runtime secrets** belong in Cloudflare Worker secrets.
- **GitHub deployment secrets** are used by GitHub Actions for deployment and migration steps.
- **Database URLs** must not be committed.
- **Local `.env`** is for local development and operator tooling only; it is ignored by Git.
- **Production and staging database URLs** should be scoped separately in GitHub secrets.

Required deployment secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `STAGING_DATABASE_URL`
- `PRODUCTION_DATABASE_URL`
- `JWT_SECRET` — signs session auth tokens (HS256).
- `REALTIME_JWT_SECRET` — signs Worker-issued WebSocket tokens. Used as `NUXT_REALTIME_JWT_SECRET` in the Nuxt runtime config.
- `PARTYKIT_NOTIFY_SECRET` — signs Worker-to-PartyKit notification requests. Used as `NUXT_PARTYKIT_NOTIFY_SECRET` in the Nuxt runtime config.
- `GOOGLE_CLIENT_ID` — Google OAuth 2.0 client ID. Exposed to the client via `runtimeConfig.public.googleClientId` (also settable as `NUXT_PUBLIC_GOOGLE_CLIENT_ID` for build-time injection).
- `RESEND_API_KEY` — API key for Resend transactional email delivery.
- `RESEND_FROM_EMAIL` — sender address for outgoing emails (default: `Habits Social <noreply@habitssocial.com>`).
- `APP_URL` — canonical application URL used in email links and redirects.

## 6. Realtime and Chat

- **Realtime Server**: PartyKit (WebSocket-based invalidation broadcaster; does not carry message data over the socket).
- **PartyKit Package**: `partykit`.
- **Client Socket Package**: `partysocket` (auto-reconnect WebSocket client).
- **Realtime Events**: `chat.changed`, `friends.changed` (invalidation signals only; clients refetch data via REST).
- **Staging PartyKit Host**: `habits-social-realtime-staging.ieatcode4breakfast.partykit.dev`.
- **Production PartyKit Host**: `habits-social-realtime-production.ieatcode4breakfast.partykit.dev`.
- **Realtime Public Flags**: `NUXT_PUBLIC_REALTIME_ENABLED=true` and `NUXT_PUBLIC_PARTYKIT_HOST=<environment PartyKit host>` must be set at build time so the generated Cloudflare `_headers` file includes the matching `https://` and `wss://` PartyKit origins in `connect-src`.
- **Realtime Auth**: JWT-based token flow (HS256, 15-minute expiry, 14-minute auto-refresh) via `POST /api/realtime/token`. The `REALTIME_JWT_SECRET` signs Worker-issued WebSocket tokens, and `PARTYKIT_NOTIFY_SECRET` signs Worker-to-PartyKit notification requests using HMAC-SHA256 with a timestamp. These must be rotated and synced separately for staging and production.
- **PartyKit Project Names**: staging deploys to `habits-social-realtime-staging`; production deploys to `habits-social-realtime-production`. Because `partykit.json` defaults to the staging project, production deploys must pass `--name habits-social-realtime-production` explicitly.
- **Chat Persistence**: PostgreSQL tables `chat_conversations`, `chat_participants`, `chat_messages` defined in `server/db/schema.ts`.

## 7. Frontend and Local Data

- **Styling**: Tailwind CSS 4 (via `@tailwindcss/vite` plugin; dark/light theme via CSS custom properties; Inter font family).
- **Icons**: Lucide Vue Next.
- **UI Utilities**: Floating UI (popover/positioning).
- **Animations**: VueUse Motion (declarative Vue animations).
- **Composables**: VueUse (`@vueuse/core`, `@vueuse/integrations`, `@vueuse/nuxt`) for reactive utilities like `useNetwork`.
- **Drag and Drop**: SortableJS for habit and bucket reordering.
- **SEO**: `@nuxtjs/seo` (meta tags, Open Graph, sitemap, JSON-LD; uses `@unhead/vue` for head management).
- **Date Manipulation**: `date-fns` for parsing, date difference calculations, and streak computations.
- **Local Offline Storage**: Dexie (IndexedDB wrapper) for offline habit and bucket data.
- **PWA Support**: `@vite-pwa/nuxt` (auto-update registration, Workbox service worker with runtime caching strategies: `NetworkOnly` for API routes, `CacheFirst` for `/_nuxt/` assets with 30-day cache expiry).
- **Image Processing**: Jimp (used by `scripts/generate-icons.js` to generate PWA icon assets).

## 8. Authentication and Authorization

### 8.1 Session Management

- **Token Format**: Stateless JWT (HS256) issued by `jose`.
- **Token Storage**: HTTP-only cookie named `auth_token` (`sameSite: 'lax'`, `secure: true` in production; 7-day max age). Also accepted via `Authorization: Bearer` header.
- **Token Lifetime**: 7-day expiry with sliding renewal at 50% lifetime (tokens are reissued when more than 3.5 days old).
- **Session Versioning**: The `users.sessionVersion` column invalidates all existing tokens when incremented (e.g., on password change). Every token embeds the session version that was current at issuance time.
- **Token Verification**: `getUserFromEvent()` checks the cookie first, then falls back to the `Authorization` header.
- **Auth Middleware**: `app/middleware/auth.ts` protects client-side routes; `requireAuth()` protects server-side API handlers.

### 8.2 Local Authentication (Email/Password)

- **Registration**: `POST /api/auth/register` — validates email, username, and password via Zod; hashes password with `bcrypt-ts` (cost factor 10); creates user; issues session token.
- **Login**: `POST /api/auth/login` — looks up user by lowercased email; verifies password hash; issues session token. Uses a dummy hash comparison (`DUMMY_HASH`) on missing-user codepaths to mitigate timing-based user-enumeration attacks.
- **Password Reset**: `POST /api/auth/forgot-password` generates a SHA-256 hashed reset token (15-minute TTL, stored in `password_reset_tokens` table) and sends it via email. `POST /api/auth/reset-password` verifies the reset token hash and updates the user's password, then increments `sessionVersion` to invalidate all existing sessions.
- **Logout**: `POST /api/auth/logout` clears the `auth_token` cookie.
- **Current User**: `GET /api/auth/me` returns the authenticated user profile.

### 8.3 Google OAuth 2.0 Authentication

- **Provider**: Google Identity Services (OAuth 2.0).
- **Client ID**: The `GOOGLE_CLIENT_ID` environment variable is exposed to the frontend via `runtimeConfig.public.googleClientId` and also served at `GET /api/auth/google-client-id`.
- **ID Token Verification**: Google ID tokens are verified server-side using `jose` against Google's public JWKS endpoint (`https://www.googleapis.com/oauth2/v3/certs`). The `verifyGoogleIdToken()` utility in `server/utils/auth.ts` performs audience validation, expiry checking, and signature verification.
- **Sign-In Flow (first step)**: The client sends the Google credential (ID token) to `POST /api/auth/google`. The server verifies the token to extract the verified email and photo URL.
  - **Existing user**: If the email matches a user in the database, the server auto-verifies their email (if not already verified), issues a full session token, sets the auth cookie, and returns `{ signupRequired: false, token, id, email, username, photoUrl }`.
  - **New user**: If no matching user exists, the server generates a temporary signup token (a 15-minute JWT containing the verified email and photo URL) via `generateSignupToken()` and returns `{ signupRequired: true, signupToken, email, photoUrl }`.
- **Registration Flow (second step)**: The client collects a username and password from the new Google user and sends them along with the temporary `signupToken` to `POST /api/auth/register-google`. The server verifies the signup token, checks that the email and username are not already taken, creates the user with the verified email (pre-marked as verified), and issues a full session token.
- **Rate Limiting**: Both Google auth endpoints are subject to the same rate limiting as local auth (5 requests per 15 minutes per email identifier, 50 requests per 15 minutes per IP).

## 9. Email Delivery

- **Provider**: Resend (transactional email API).
- **API Endpoint**: `https://api.resend.com/emails`.
- **Sender**: `Habits Social <noreply@habitssocial.com>` (configurable via `RESEND_FROM_EMAIL` / `resendFromEmail`).
- **Current Usage**: Password reset emails only (`sendPasswordResetEmail` in server utilities).
- **Secrets**: `RESEND_API_KEY` and `RESEND_FROM_EMAIL` must be set in deployment environments.

## 10. Validation and Data Integrity

- **Runtime Validation**: Zod 4 (all API request bodies are validated with Zod schemas before processing).
- **Schema-Derived Validation**: Drizzle Zod generates Zod insert/select schemas directly from Drizzle table definitions.
- **Shared Validation Primitives**: `server/utils/schemaPrimitives.ts` defines reusable Zod schemas (e.g., `zPassword` with minimum length and complexity rules).
- **Rate Limiting**: In-memory store via Nitro storage (`authRateLimit`, `chatRateLimit`). Auth endpoints: 5 requests per 15 minutes per identifier, 50 requests per 15 minutes per IP.

## 11. Testing

- **Unit and Integration Tests**: Vitest (70+ test files named `*.spec.ts`).
- **Vue Component Testing**: `@vue/test-utils` with `@nuxt/test-utils` for Nuxt-aware test setup.
- **Type Checks**: `nuxi typecheck` and Vitest typecheck (combined via `npm run check`).
- **DOM Test Environment**: Happy DOM (lightweight browser-like environment).
- **IndexedDB Test Mock**: `fake-indexeddb` (mocks IndexedDB for Dexie-dependent tests).
- **Browser/E2E Tests**: Playwright (chromium, firefox, webkit; HTML reporter output to `playwright-report/`).
- **Test UI**: `@vitest/ui` (interactive test dashboard via `npm run test:ui`).

For database schema work, focus on:

- migration generation,
- migration consistency checks,
- service/API tests that prove the new schema behavior,
- security boundary tests for ownership and authorization.

Do not add browser tests for a database migration unless the specific user-facing workflow needs browser-level coverage.

# Part B: Workflow Instructions

## 12. Database Migration Workflow

This is the normal solo-dev and AI-agent workflow:

1. Build changes on the `staging` branch.
2. If database shape changes, edit `server/db/schema.ts`.
3. Generate a migration file with:

   ```bash
   npx drizzle-kit generate
   ```

4. Commit the generated SQL migration from `server/db/migrations` together with the code change.
5. Push to `staging`.
6. GitHub Actions runs type checks, builds the app, runs `npx drizzle-kit migrate` against the staging database, then deploys staging.
7. Test staging.
8. Promote `staging` to `main`.
9. GitHub Actions runs the same migrations against production, then deploys production.

The intended day-to-day experience is: AI handles schema edits and migration generation; CI handles applying migrations; the developer tests staging and approves production promotion.

## 13. Strict Migration Rules

These rules are mandatory for all AI agents and automation:

- Never run `drizzle-kit push` against staging or production.
- Never manually edit staging or production schema during normal feature work.
- Never change `server/db/schema.ts` without also generating and committing the matching migration file.
- Never deploy production code that requires a database column, table, index, or constraint that production does not already have or receive in the same deployment pipeline.
- Run `npx drizzle-kit check` before committing migration changes when the migration history has been touched.
- Manual SQL against staging or production is reserved for incident repair and must be followed by a read-only verification.

## 14. Safe Rollout Pattern

For additive changes, one deployment is usually acceptable:

1. Add nullable columns, new tables, new indexes, or compatible constraints.
2. Deploy code that uses them after the migration succeeds.

For risky or destructive changes, use a multi-step rollout:

1. Add the new schema while old code still works.
2. Backfill or migrate data if needed.
3. Deploy code that reads/writes the new schema.
4. Later remove old columns, tables, or code paths after production has safely moved off them.

Never remove or rename a production column in the same deploy where old production code might still read it.

## 15. Production Promotion Checklist

Before promoting staging to production:

1. Confirm staging deployed successfully.
2. Confirm `npm run check` passes.
3. Confirm any new migration files are committed.
4. Confirm staging behavior works.
5. Promote to `main`.
6. Let CI migrate production before deploying production code.
7. If CI migration fails, stop and inspect the database state before retrying.

## 16. Incident Recovery Rule

When staging or production schema becomes desynchronized:

1. Stop production promotion.
2. Create a Neon branch from the affected database before repair.
3. Run read-only schema checks first.
4. Apply the smallest SQL repair possible.
5. Verify columns, indexes, constraints, and `drizzle.__drizzle_migrations`.
6. Only then retry CI.

---

Last updated: 2026-06-20
