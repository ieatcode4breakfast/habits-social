# Technical Stack: Habits Social

This document is the source of truth for the current application stack and the operational rules that keep deployments safe.

# Part A: Technical Stack

## 1. Application Runtime

- **Framework**: Nuxt 4 with Vue 3.
- **Server Engine**: Nitro.
- **Runtime Targets**: Node.js for local tooling and Cloudflare Workerd for deployed server runtime.
- **Language**: TypeScript.
- **Production Build Command**: `npm run build`.
- **Type Safety Command**: `npm run check`.

## 2. Hosting and Deployment

- **App Hosting**: Cloudflare Workers via Wrangler.
- **Staging Worker**: `habits-social-staging`.
- **Production Worker**: `habits-social-live`.
- **Production Domains**: `habitssocial.com` and `www.habitssocial.com`.
- **Static Assets**: served from `.output/public` through the Cloudflare Workers assets binding.
- **Cloudflare KV Bindings**:
  - `AUTH_KV`
  - `CHAT_KV`
- **Deployment Workflow**: GitHub Actions deploys on pushes to `staging` and `main`.

## 3. Database

- **Database**: PostgreSQL.
- **Host**: Neon Serverless Postgres.
- **ORM and Query Builder**: Drizzle ORM.
- **Migration Tool**: Drizzle Kit.
- **Database Driver**: `@neondatabase/serverless`.
- **Schema Source**: `server/db/schema.ts`.
- **Migration Directory**: `server/db/migrations`.
- **Drizzle Config**: `drizzle.config.ts`.
- **Migration Ledger**: Drizzle reads `drizzle.__drizzle_migrations`.

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

## 6. Realtime and Chat

- **Realtime Server**: PartyKit.
- **PartyKit Package**: `partykit`.
- **Client Socket Package**: `partysocket`.
- **Staging PartyKit Host**: `habits-social-realtime-staging.ieatcode4breakfast.partykit.dev`.
- **Realtime Auth**: JWT-based token flow using server utilities.
- **Chat Persistence**: PostgreSQL tables defined in `server/db/schema.ts`.

## 7. Frontend and Local Data

- **Styling**: Tailwind CSS 4.
- **Icons**: Lucide Vue Next.
- **UI Utilities**: Floating UI.
- **Animations**: VueUse Motion.
- **Local Offline Storage**: Dexie over IndexedDB.
- **PWA Support**: `@vite-pwa/nuxt`.

## 8. Validation and Auth

- **Validation**: Zod and Drizzle Zod.
- **Password Hashing**: `bcrypt-ts`.
- **JWT Handling**: `jose`.

## 9. Testing

- **Unit and Integration Tests**: Vitest.
- **Type Checks**: `nuxi typecheck` and Vitest typecheck.
- **DOM Test Environment**: Happy DOM.
- **IndexedDB Test Mock**: `fake-indexeddb`.
- **Browser/E2E Tests**: Playwright.

For database schema work, focus on:

- migration generation,
- migration consistency checks,
- service/API tests that prove the new schema behavior,
- security boundary tests for ownership and authorization.

Do not add browser tests for a database migration unless the specific user-facing workflow needs browser-level coverage.

# Part B: Workflow Instructions

## 10. Database Migration Workflow

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

## 11. Strict Migration Rules

These rules are mandatory for all AI agents and automation:

- Never run `drizzle-kit push` against staging or production.
- Never manually edit staging or production schema during normal feature work.
- Never change `server/db/schema.ts` without also generating and committing the matching migration file.
- Never deploy production code that requires a database column, table, index, or constraint that production does not already have or receive in the same deployment pipeline.
- Run `npx drizzle-kit check` before committing migration changes when the migration history has been touched.
- Manual SQL against staging or production is reserved for incident repair and must be followed by a read-only verification.

## 12. Safe Rollout Pattern

For additive changes, one deployment is usually acceptable:

1. Add nullable columns, new tables, new indexes, or compatible constraints.
2. Deploy code that uses them after the migration succeeds.

For risky or destructive changes, use a multi-step rollout:

1. Add the new schema while old code still works.
2. Backfill or migrate data if needed.
3. Deploy code that reads/writes the new schema.
4. Later remove old columns, tables, or code paths after production has safely moved off them.

Never remove or rename a production column in the same deploy where old production code might still read it.

## 13. Production Promotion Checklist

Before promoting staging to production:

1. Confirm staging deployed successfully.
2. Confirm `npm run check` passes.
3. Confirm any new migration files are committed.
4. Confirm staging behavior works.
5. Promote to `main`.
6. Let CI migrate production before deploying production code.
7. If CI migration fails, stop and inspect the database state before retrying.

## 14. Incident Recovery Rule

When staging or production schema becomes desynchronized:

1. Stop production promotion.
2. Create a Neon branch from the affected database before repair.
3. Run read-only schema checks first.
4. Apply the smallest SQL repair possible.
5. Verify columns, indexes, constraints, and `drizzle.__drizzle_migrations`.
6. Only then retry CI.

---

Last updated: 2026-05-23
