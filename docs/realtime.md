# Realtime and Chat Runbook

This document is the source of truth for Habits Social realtime chat. It covers the chat data model, the PartyKit websocket bridge, environment setup, deployment order, verification, and incident recovery.

Last updated: 2026-05-24

## 1. Current Architecture

Realtime is intentionally small:

1. The app stores chat and friendship state in PostgreSQL.
2. Mutations such as sending a message or changing a friendship write to PostgreSQL first.
3. After the database write succeeds, the Worker sends a signed best-effort notification to PartyKit.
4. PartyKit broadcasts a tiny invalidation event to each connected user room.
5. The browser receives the invalidation event and refetches the real data from the app APIs.

PartyKit does not store chat messages, friendship data, or user profile data. It only broadcasts invalidation events.

Supported realtime events:

| Event | Meaning | Client action |
| :--- | :--- | :--- |
| `chat.changed` | A chat message was sent, deleted, read, or the chat list needs refresh. | Refresh chat inbox and active conversation snapshot. |
| `friends.changed` | Friendship/social state changed. | Refresh social/friend data and lock the active chat if needed. |

## 2. Environments

| Environment | Cloudflare Worker | Public app URL | PartyKit project | PartyKit host |
| :--- | :--- | :--- | :--- | :--- |
| Staging | `habits-social-staging` | `https://habits-social-staging.mycooltools.workers.dev` | `habits-social-realtime-staging` | `habits-social-realtime-staging.ieatcode4breakfast.partykit.dev` |
| Production | `habits-social-live` | `https://www.habitssocial.com` | `habits-social-realtime-production` | `habits-social-realtime-production.ieatcode4breakfast.partykit.dev` |

Important distinction:

- Wrangler uses `--env production` for the production Cloudflare Worker.
- PartyKit does not use the app's Wrangler environment. PartyKit must be targeted by project name with `--name habits-social-realtime-staging` or `--name habits-social-realtime-production`.
- `partykit.json` defaults to the staging PartyKit project. Production PartyKit deploys must always pass `--name habits-social-realtime-production`.

## 3. Required Environment Variables and Secrets

### Public build/runtime variables

These values are public and are safe to appear in generated client files.

| Environment | Variable | Value |
| :--- | :--- | :--- |
| Staging | `NUXT_PUBLIC_REALTIME_ENABLED` | `true` |
| Staging | `NUXT_PUBLIC_PARTYKIT_HOST` | `habits-social-realtime-staging.ieatcode4breakfast.partykit.dev` |
| Production | `NUXT_PUBLIC_REALTIME_ENABLED` | `true` |
| Production | `NUXT_PUBLIC_PARTYKIT_HOST` | `habits-social-realtime-production.ieatcode4breakfast.partykit.dev` |

These must be present at build time because `nuxt.config.ts` builds the Content Security Policy into `.output/public/_headers`.

Cause and effect:

- If the Worker runtime variable is correct but the build-time variable was empty, the app may fetch tokens but the browser will block the websocket because the generated CSP does not allow the PartyKit host.
- If `NUXT_PUBLIC_REALTIME_ENABLED=false` or `NUXT_PUBLIC_PARTYKIT_HOST=""`, `/api/realtime/token` intentionally returns `404 Realtime disabled` before auth. That is the hard kill switch.

### Worker secrets

These values must be Cloudflare Worker secrets, not committed files.

| Secret | Used by | Purpose |
| :--- | :--- | :--- |
| `NUXT_REALTIME_JWT_SECRET` | Cloudflare Worker | Signs short-lived websocket auth tokens returned by `/api/realtime/token`. |
| `NUXT_PARTYKIT_NOTIFY_SECRET` | Cloudflare Worker | Signs Worker-to-PartyKit notification POSTs. |

Fallback names exist in code for compatibility:

- `REALTIME_JWT_SECRET`
- `PARTYKIT_NOTIFY_SECRET`

Use the `NUXT_` names for Cloudflare Worker secrets.

### PartyKit environment variables

These values must be set on the matching PartyKit project.

| Variable | Used by | Purpose |
| :--- | :--- | :--- |
| `REALTIME_JWT_SECRET` | PartyKit | Verifies websocket connection tokens minted by the Worker. |
| `PARTYKIT_NOTIFY_SECRET` | PartyKit | Verifies signed notification POSTs from the Worker. |

The Worker `NUXT_REALTIME_JWT_SECRET` and PartyKit `REALTIME_JWT_SECRET` must have the same value for the same environment.

The Worker `NUXT_PARTYKIT_NOTIFY_SECRET` and PartyKit `PARTYKIT_NOTIFY_SECRET` must have the same value for the same environment.

Do not reuse staging secrets in production. Do not reuse production secrets in staging.

## 4. Source Files

| Area | File |
| :--- | :--- |
| Client websocket setup and retry behavior | `app/composables/useRealtimeInvalidation.ts` |
| Token API | `server/api/realtime/token.post.ts` |
| Token rate limit | `server/utils/realtimeRateLimit.ts` |
| Worker-to-PartyKit notifier | `server/utils/realtimeNotifier.ts` |
| Event schema and HMAC signing | `utils/realtime.ts` |
| PartyKit server | `party/server.ts` |
| CSP builder | `utils/securityHeaders.ts` |
| Cloudflare Worker config | `wrangler.toml` |
| CI deploy config | `.github/workflows/deploy.yml` |
| PartyKit project default | `partykit.json` |

## 5. Token Flow

Endpoint:

```text
POST /api/realtime/token
```

Response behavior:

| Condition | Response | Why it matters |
| :--- | :--- | :--- |
| Realtime disabled or no PartyKit host | `404 Realtime disabled` | Permanent page-session kill switch. The client stops trying until reload. |
| User is not authenticated | `401 Unauthorized` | Normal logged-out behavior. This proves realtime is enabled but auth is required. |
| Authenticated but realtime JWT secret is missing | `500 Realtime configuration missing` | Server misconfiguration. The code fails before token rate-limit work. |
| Authenticated but over token limit | `429` with `Retry-After` | Temporary throttling. Client backs off instead of hammering. |
| Authenticated and configured | `200 { token }` | Token is a 15-minute HS256 JWT containing `{ userId, roomId }`. |

The token is valid only for the authenticated user's own room. PartyKit rejects a token if `payload.userId` or `payload.roomId` does not match the room ID.

## 6. Client Websocket Behavior

The client uses `PartySocket` with:

- `host`: `runtimeConfig.public.partykitHost`
- `room`: current authenticated user ID
- `query`: async token fetch from `/api/realtime/token`

Retry behavior:

- Token failures pause token fetches for 30 seconds.
- `404 Realtime disabled` sets an in-page permanent disable flag, because that means the deployment intentionally disabled realtime.
- `500`, `503`, `429`, websocket hiccups, and transient network failures are not permanent. They are allowed to recover.
- The client refreshes the token by reconnecting every 14 minutes, before the 15-minute token expiration.
- On websocket open, the client refreshes chat and social snapshots to close any gap from offline time or reconnect delay.

Cause and effect:

- If the first websocket attempt fails because the network hiccups, realtime should retry and recover. It should not stay dead unless the token endpoint returned `404`.
- If PartyKit is misconfigured and rejects every websocket, the client backs off token fetches but PartySocket may still retry connections. That is why the token endpoint and PartyKit secrets must be verified before enabling production.

### Local PartyKit Development

For local realtime, set the public PartyKit host in `.env`:

```env
NUXT_PUBLIC_REALTIME_ENABLED=true
NUXT_PUBLIC_PARTYKIT_HOST=localhost:1999
```

Then start the local dev runtime:

```powershell
npm run dev
```

`npm run dev` starts Nuxt and, when `NUXT_PUBLIC_PARTYKIT_HOST` is `localhost:<port>` or `127.0.0.1:<port>`, also starts local PartyKit. `REALTIME_JWT_SECRET` and `PARTYKIT_NOTIFY_SECRET` must be present in `.env`. The local PartyKit server reads them through `--with-env`, and Nuxt uses the same values to mint websocket tokens and sign notification POSTs.

Local hosts are accepted only outside `NODE_ENV=production`. Production CSP and notification validation remain restricted to `*.partykit.dev` hosts.

## 7. Worker-to-PartyKit Notification Flow

The Worker notifies PartyKit through `notifyUsersRealtimeBestEffort`.

For each recipient:

1. Validate the recipient list. The max is 2 users because chat/friendship events are pairwise.
2. Serialize the event body as JSON.
3. Add a millisecond timestamp.
4. Sign `${timestamp}.${body}` with HMAC-SHA256 using `NUXT_PARTYKIT_NOTIFY_SECRET`.
5. POST to `https://<PARTYKIT_HOST>/party/<USER_ID>` for deployed PartyKit, or `http://localhost:1999/party/<USER_ID>` for local PartyKit.
6. PartyKit verifies the timestamp, signature, JSON schema, and event size.
7. PartyKit broadcasts the serialized event to all sockets in that user's room.

Limits:

- Notification timeout: 1500 ms.
- Notification body max size: 256 bytes.
- Broadcast event max size: 64 bytes.
- Signature timestamp max skew: 5 minutes.

Notification failures are logged as warnings and do not block the original database mutation. This is deliberate. If PartyKit has a temporary outage, users can still send messages; the receiver may need a normal refresh to see them.

## 8. Chat Data Model

### `chat_conversations`

Metadata for user pairs. Conversations are decoupled from friendships to preserve history.

- `id`: UUID primary key.
- `user1_id`: UUID foreign key to users, set null on delete.
- `user2_id`: UUID foreign key to users, set null on delete.
- `last_message_at`: timestamp.
- `created_at`: timestamp.
- `updated_at`: timestamp.
- Unique unordered pair index on `(LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id))`, partial only where both IDs are non-null.
- `last_message_at` index for efficient conversation list sorting.

### `chat_participants`

Junction table for membership, read state, and per-user visibility boundaries.

- `conversation_id`: UUID foreign key to conversations, cascade on delete.
- `user_id`: UUID foreign key to users, cascade on delete.
- `last_read_at`: timestamp used for unread count calculation.
- `cleared_at`: nullable timestamp. When set, only messages created after this timestamp are visible to this user.
- Primary key: `(conversation_id, user_id)`.

### `chat_messages`

Message content, activity reply context, and tombstones.

- `id`: UUID primary key.
- `conversation_id`: UUID foreign key to conversations, cascade on delete.
- `sender_id`: UUID foreign key to users, set null on delete.
- `body`: text. Cleared if deleted or tombstoned.
- `reply_to_activity`: JSONB, nullable. Stores a validated snapshot of a social activity feed item.
- `deleted_at`: timestamp.
- `created_at`: timestamp.
- Index: `(conversation_id, created_at)` for paginated message retrieval.

## 9. Chat Access Control

- Any read/write access to a conversation requires an active `accepted` friendship between the participants.
- If a participant deletes their account, the remaining participant keeps read-only history access.
- Write operations such as sending and deleting messages are blocked when the other user is deleted.
- Conversations appear in `GET /api/chat/conversations` only when an active friendship exists or the other user has been deleted, and at least one visible message exists.
- `clearConversation` requires membership only. It updates only the caller's `cleared_at`.

IDOR protection, meaning protection against accessing another user's object by guessing an ID, is enforced on every chat endpoint by checking the authenticated user's conversation membership and friendship state.

## 10. Chat API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/chat/conversations` | Lists active conversations with unread counts and last message preview. |
| `GET` | `/api/chat/conversations/:id/messages` | Paginated message history for a conversation. Supports `limit` and `cursor`. |
| `POST` | `/api/chat/conversations/by-friend/:friendId/messages` | Sends a message via friend ID and auto-creates the conversation if needed. |
| `POST` | `/api/chat/conversations/:id/read` | Marks all messages in a conversation as read. |
| `POST` | `/api/chat/conversations/:id/clear` | Clears a conversation for the caller only. |
| `DELETE` | `/api/chat/messages/:id` | Tombstones a specific sender-owned message. |
| `POST` | `/api/realtime/token` | Mints a short-lived PartyKit websocket token. |

Do not use `/api/chat/socket-token` for the current realtime system. The current endpoint is `/api/realtime/token`.

## 11. Rate Limiting

All current chat and realtime rate limits use Nitro memory storage via `nuxt.config.ts`:

```ts
storage: {
  authRateLimit: {
    driver: 'memory'
  },
  chatRateLimit: {
    driver: 'memory'
  }
}
```

Current limits:

| Operation | Limit | Scope | Utility |
| :--- | :--- | :--- | :--- |
| Send/delete message | 60 per 60 seconds | Per user and target | `checkChatRateLimit` |
| Chat read operations | 100 per 60 seconds | Per user global | `checkChatReadRateLimit` |
| Conversation clear | 20 per 60 seconds | Per user global | `checkChatClearRateLimit` |
| Realtime token mint | 5 per 60 seconds | Per user global | `checkRealtimeTokenRateLimit` |

Important:

- These limits are no longer backed by Cloudflare KV.
- Do not reintroduce KV-backed writes for this small app without a specific abuse case and an explicit cost/risk review.
- If a rate limit does write to a persistent backend in the future, client retry behavior must be audited first. Otherwise a broken websocket can generate repeated token calls, repeated rate-limit writes, quota exhaustion, and user-visible failures.

## 12. Content Security Policy

The browser will only connect to PartyKit if `_headers` contains the environment's PartyKit host in `connect-src`.

Expected staging CSP fragment:

```text
connect-src 'self' https://habits-social-realtime-staging.ieatcode4breakfast.partykit.dev wss://habits-social-realtime-staging.ieatcode4breakfast.partykit.dev;
```

Expected production CSP fragment:

```text
connect-src 'self' https://habits-social-realtime-production.ieatcode4breakfast.partykit.dev wss://habits-social-realtime-production.ieatcode4breakfast.partykit.dev;
```

The GitHub Actions workflow must assert the correct PartyKit host exists in `.output/public/_headers` for each branch.

Cause and effect:

- If CSP omits PartyKit, the browser blocks the websocket even when secrets and token minting are correct.
- If CSP includes the wrong environment host, staging may work while production fails, or production may connect to the wrong PartyKit project.

## 13. Standard Setup and Deployment

### Staging restore or rotation

Use staging-only secrets and the staging PartyKit project:

```powershell
$jwtBytes = New-Object byte[] 32
$notifyBytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($jwtBytes)
$rng.GetBytes($notifyBytes)
$rng.Dispose()
$realtimeJwtSecret = [Convert]::ToBase64String($jwtBytes)
$notifySecret = [Convert]::ToBase64String($notifyBytes)

$realtimeJwtSecret | npx wrangler secret put NUXT_REALTIME_JWT_SECRET
$notifySecret | npx wrangler secret put NUXT_PARTYKIT_NOTIFY_SECRET

$realtimeJwtSecret | npx partykit env add REALTIME_JWT_SECRET --name habits-social-realtime-staging
$notifySecret | npx partykit env add PARTYKIT_NOTIFY_SECRET --name habits-social-realtime-staging

npx partykit deploy --name habits-social-realtime-staging --var "REALTIME_JWT_SECRET=$realtimeJwtSecret" "PARTYKIT_NOTIFY_SECRET=$notifySecret"
```

Build and deploy staging Worker:

```powershell
$env:NUXT_PUBLIC_REALTIME_ENABLED = 'true'
$env:NUXT_PUBLIC_PARTYKIT_HOST = 'habits-social-realtime-staging.ieatcode4breakfast.partykit.dev'
npm run build
Select-String -Path '.output\public\_headers' -Pattern 'habits-social-realtime-staging.ieatcode4breakfast.partykit.dev'
npx wrangler deploy
```

### Production restore or rotation

Use production-only secrets and the production PartyKit project:

```powershell
$jwtBytes = New-Object byte[] 32
$notifyBytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($jwtBytes)
$rng.GetBytes($notifyBytes)
$rng.Dispose()
$realtimeJwtSecret = [Convert]::ToBase64String($jwtBytes)
$notifySecret = [Convert]::ToBase64String($notifyBytes)

$realtimeJwtSecret | npx wrangler secret put NUXT_REALTIME_JWT_SECRET --env production
$notifySecret | npx wrangler secret put NUXT_PARTYKIT_NOTIFY_SECRET --env production

$realtimeJwtSecret | npx partykit env add REALTIME_JWT_SECRET --name habits-social-realtime-production
$notifySecret | npx partykit env add PARTYKIT_NOTIFY_SECRET --name habits-social-realtime-production

npx partykit deploy --name habits-social-realtime-production --var "REALTIME_JWT_SECRET=$realtimeJwtSecret" "PARTYKIT_NOTIFY_SECRET=$notifySecret"
```

Build and deploy production Worker:

```powershell
$env:NUXT_PUBLIC_REALTIME_ENABLED = 'true'
$env:NUXT_PUBLIC_PARTYKIT_HOST = 'habits-social-realtime-production.ieatcode4breakfast.partykit.dev'
npm run build
Select-String -Path '.output\public\_headers' -Pattern 'habits-social-realtime-production.ieatcode4breakfast.partykit.dev'
npx wrangler deploy --env production
```

Deployment order:

1. Set Worker secrets.
2. Set PartyKit environment variables.
3. Deploy PartyKit with the explicit project name and matching `--var` values.
4. Build the Worker with the correct public realtime env vars.
5. Confirm `_headers` contains the correct PartyKit host.
6. Deploy the Worker.
7. Run live verification.

Do not deploy the Worker with realtime enabled before PartyKit has matching secrets. That creates a state where browsers can mint tokens but PartyKit rejects websocket connections.

## 14. Live Verification

### CSP check

Staging:

```powershell
curl.exe -s -I https://habits-social-staging.mycooltools.workers.dev/ | findstr /I "content-security-policy"
```

Production:

```powershell
curl.exe -s -I https://www.habitssocial.com/ | findstr /I "content-security-policy"
```

Expected: the correct environment PartyKit host appears as both `https://` and `wss://`.

### Token endpoint check

Staging:

```powershell
curl.exe -s -i -X POST https://habits-social-staging.mycooltools.workers.dev/api/realtime/token -H "Content-Type: application/json" --data "{}"
```

Production:

```powershell
curl.exe -s -i -X POST https://www.habitssocial.com/api/realtime/token -H "Content-Type: application/json" --data "{}"
```

Expected unauthenticated response when realtime is enabled:

```text
401 Unauthorized
```

If the response is `404 Realtime disabled`, the public realtime flags are disabled or missing.

### PartyKit notify-secret check

Staging:

```powershell
curl.exe -s -i -X POST https://habits-social-realtime-staging.ieatcode4breakfast.partykit.dev/party/probe -H "Content-Type: application/json" -H "x-realtime-timestamp: 0" -H "x-realtime-signature: bad-signature" --data "{\"event\":{\"type\":\"chat.changed\"}}"
```

Production:

```powershell
curl.exe -s -i -X POST https://habits-social-realtime-production.ieatcode4breakfast.partykit.dev/party/probe -H "Content-Type: application/json" -H "x-realtime-timestamp: 0" -H "x-realtime-signature: bad-signature" --data "{\"event\":{\"type\":\"chat.changed\"}}"
```

Expected response:

```text
400 Invalid realtime notification
```

Meaning:

- `400` means the PartyKit notify secret exists and the bad signature was rejected.
- `500 Realtime notification secret missing` means `PARTYKIT_NOTIFY_SECRET` is missing on that PartyKit project.

### End-to-end synthetic check

The strongest verification is:

1. Register two temporary users.
2. Create and accept a friendship.
3. Mint a token for user B through `/api/realtime/token`.
4. Open `wss://<PARTYKIT_HOST>/parties/main/<USER_B_ID>?token=<TOKEN>`.
5. Send a chat message from user A to user B.
6. Confirm user B receives `{"type":"chat.changed"}`.
7. Delete both temporary users.
8. Verify no temporary users remain in production.

This check mutates production briefly. Only run it deliberately, and always delete the temporary users afterward.

## 15. Troubleshooting Matrix

| Symptom | Most likely cause | Confirm with | Fix |
| :--- | :--- | :--- | :--- |
| `/api/realtime/token` returns `404 Realtime disabled` | `NUXT_PUBLIC_REALTIME_ENABLED=false` or PartyKit host empty in runtime config. | `curl` token endpoint. | Set public flags, rebuild, redeploy Worker. |
| Browser CSP error blocks PartyKit websocket | `_headers` was built without the PartyKit host. | Inspect root response CSP or `.output/public/_headers`. | Build with correct `NUXT_PUBLIC_PARTYKIT_HOST`, redeploy Worker. |
| Token endpoint returns `500 Realtime configuration missing` | Worker missing realtime JWT secret. | Authenticated token request. | Set `NUXT_REALTIME_JWT_SECRET` on the correct Worker environment. |
| PartyKit websocket returns `401` | PartyKit missing `REALTIME_JWT_SECRET` or token expired/invalid. | Websocket probe with freshly minted token. | Sync `REALTIME_JWT_SECRET` to the correct PartyKit project and redeploy PartyKit. |
| PartyKit websocket returns `403` | Token user/room mismatch. | Check room ID equals authenticated user ID. | Connect to room `<current user id>` only. |
| PartyKit notify POST returns `500 Realtime notification secret missing` | PartyKit missing `PARTYKIT_NOTIFY_SECRET`. | Bad-signature POST probe. | Set `PARTYKIT_NOTIFY_SECRET` on the correct PartyKit project and redeploy. |
| PartyKit notify POST returns `400 Invalid realtime notification` | Signature or payload rejected. | Bad-signature POST returns this by design. | If real app notifications also fail, sync notify secrets between Worker and PartyKit. |
| Repeated `429` from token endpoint | Client is repeatedly requesting tokens. | Browser console and Worker logs. | Confirm client backoff, PartyKit host/CSP, and websocket auth. |
| Staging works but production fails | Production Worker, build-time CSP, or PartyKit project not configured the same way as staging. | Compare `wrangler.toml`, workflow branch path, Worker secrets, PartyKit env vars. | Rotate and sync production-only secrets, deploy production PartyKit by explicit name, rebuild production Worker. |

## 16. Emergency Kill Switch

To stop realtime quickly:

1. Set the affected environment's `NUXT_PUBLIC_REALTIME_ENABLED=false`.
2. Set `NUXT_PUBLIC_PARTYKIT_HOST=""`.
3. Rebuild the Worker so `_headers` removes PartyKit from CSP.
4. Redeploy the Worker.

Expected result:

- `/api/realtime/token` returns `404 Realtime disabled` before auth.
- The client treats `404` as permanent for that page session and stops token attempts.
- Normal chat API requests still work; users may need manual refresh to see new messages.

Do not delete PartyKit projects or secrets as the first kill-switch move. That turns a controlled disable into mixed 401/500 websocket noise.

## 17. Tests

Focused realtime tests:

```powershell
npx vitest run server/tests/realtime.token.spec.ts server/tests/realtime.notifier.spec.ts app/composables/useRealtimeInvalidation.spec.ts utils/securityHeaders.spec.ts
```

Full type safety check:

```powershell
npm run check
```

Current test responsibilities:

| Test file | Responsibility |
| :--- | :--- |
| `server/tests/realtime.token.spec.ts` | Disabled behavior, auth behavior, missing secret guardrail, token signing, rate limit ordering. |
| `server/tests/realtime.notifier.spec.ts` | Signed notification behavior and best-effort failure handling. |
| `app/composables/useRealtimeInvalidation.spec.ts` | Client startup, token failure backoff, 404 kill switch, temporary failure retry behavior. |
| `utils/securityHeaders.spec.ts` | CSP allowlist behavior for configured PartyKit hosts and fail-closed behavior for invalid hosts. |

Docs-only changes do not require new tests. Any code change touching token flow, PartyKit auth, notification signing, CSP, or retry behavior must update or add tests in the files above.

## 18. Rules To Prevent Another Realtime Incident

- Never enable realtime in a Worker until the matching PartyKit project has both secrets set.
- Never assume Wrangler `--env production` affects PartyKit. It does not.
- Never deploy production PartyKit without `--name habits-social-realtime-production`.
- Never rely on runtime vars alone for CSP. Build-time `NUXT_PUBLIC_PARTYKIT_HOST` must be correct.
- Never use KV-backed rate-limit writes for realtime token attempts without a clear abuse case and retry audit.
- Never make `500`, `503`, `429`, or websocket hiccups permanently disable realtime on the client. Only `404 Realtime disabled` is permanent for the page session.
- Never push staging and production to the same PartyKit host.
- Never rotate one side of a shared secret without rotating/syncing the matching side.
- Always verify with CSP, unauth token, PartyKit bad-signature, and end-to-end websocket/chat probes after changing realtime infrastructure.
