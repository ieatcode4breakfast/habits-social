# Codebase Review

## 🔴 CRITICAL ISSUES (Must fix before deployment)

*None remaining.*

---

## 🟡 WARNINGS (Highly recommended to address)

### 1. Missing Rate Limiting on Authentication Endpoints - DEFERRED
- **Location:** `server/api/auth/login.post.ts` & `server/api/auth/register.post.ts`
- **Explanation:** There is no application-level rate limiting on the authentication routes. While you've implemented an excellent defense against timing attacks (`await compare(password, DUMMY_HASH)`), your endpoints are currently exposed to credential stuffing, brute-forcing, and mass bot registrations.
- **Fix:** Implement a rate limiting middleware specifically for `/api/auth/*` routes, utilizing Redis or a similar fast-access store, to restrict the number of login/register attempts per IP or identifier within a standard rolling window (e.g., 5 attempts per 15 minutes).

---


## 🔵 NITPICKS & BEST PRACTICES (Optional polish)

### 1. "Magic Strings" for Default Values - DEFERRED
- **Location:** `server/utils/validation.ts` and `server/api/habits/index.ts`
- **Explanation:** Default fallback values like the hex color `'#6366f1'` or the maximum habit limits (`30`) are hardcoded directly into your API routes and Zod schemas. If the design language changes, you will have to hunt down multiple occurrences.
- **Fix:** Extract these into a shared constants file (`utils/constants.ts`) as `DEFAULT_HABIT_COLOR` and `MAX_HABITS_PER_USER` so both the backend schemas and frontend UI can import the exact same source of truth.

### 2. Asynchronous Console Logging on Fire-and-Forget Promises - DEFERRED
- **Location:** `app/composables/useHabitsApi.ts`
- **Explanation:** `sync().catch(err => console.error(...))` executes safely in the background, but if Nuxt runs this context on the server during SSR (unlikely but possible based on your wrapper), floating promises can cause memory leaks or unhandled rejections. 
- **Fix:** Ensure fire-and-forget triggers explicitly verify `import.meta.client` before execution.

### 3. Bypassing Type Safety in Nuxt Context - DEFERRED
- **Location:** `server/api/auth/login.post.ts` (and others)
- **Explanation:** `const useDB = (event.context as any).useDB || _useDB;` circumvents TypeScript. It functions perfectly but degrades developer experience and safety.
- **Fix:** Augment the Nitro `H3EventContext` type in a declaration file (`d.ts`) so you can remove the `any` cast and get full autocomplete for injected dependencies.

### 4. Hardcoded Security Cache-Control Headers - DEFERRED
- **Location:** `server/api/habitlogs/index.ts`
- **Explanation:** Setting `Cache-Control` to `no-cache, no-store...` manually in the handler is good practice for private data, but doing it inside individual route handlers is error-prone and easily forgotten for new endpoints.
- **Fix:** Move this logic into a server middleware (e.g., `server/middleware/securityHeaders.ts`) that applies strict cache-control headers globally to all `/api/*` endpoints to ensure sensitive JSON is never cached.

### 5. Hardcoded Magic Numbers for Cookies - DEFERRED
- **Location:** `server/api/auth/login.post.ts`
- **Explanation:** `maxAge: 60 * 60 * 24 * 7` (7 days) is hardcoded for the authentication cookie.
- **Fix:** Extract this into a shared constant (e.g., `AUTH_COOKIE_MAX_AGE_SECONDS`) so it can be imported both here and wherever your `jwt.sign` configuration lives. This guarantees that the cookie and the JWT naturally expire at the exact same time without relying on synchronized "magic numbers."

### 6. Overwritten Where Clauses in Drizzle
- **Location:** `server/utils/streaks.ts`, inside `recalculateHabitStreak` - DEFERRED
- **Explanation:** The code calls `logsQuery.where(...)` and then optionally calls `logsQuery.where(...)` again if `queryStartDate` exists. In Drizzle ORM, subsequent `.where()` calls completely *overwrite* the previous clause rather than appending to it. While the code currently works because it manually re-declares the entire logical condition in the second call, it is highly fragile and confusing.
- **Fix:** Use Drizzle's `and()` to append conditions dynamically.

### 7. Limit Fallback Ignores Explicit Zeros - DEFERRED
- **Location:** `server/api/social/feed.get.ts`
- **Explanation:** `Number(query.limit) || 20` evaluates to `20` if `query.limit` is explicitly sent as `0`. If a valid UI use case ever involves fetching exactly `0` items (e.g., just checking for connectivity or headers), the API forces it to `20`.
- **Fix:** Use the nullish coalescing operator `??` or explicitly check for `undefined` if you want to permit `0`.