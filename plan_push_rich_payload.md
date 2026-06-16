# Plan: Rich Push Notification Payloads

## Project Context

- **Stack:** Nuxt 3 + Nitro, Cloudflare Workers (`nodejs_compat` v1), Drizzle ORM, Neon Postgres
- **Push infrastructure:** subscription flow, VAPID key resolution (`getVapidConfig()`), `waitUntil` lifecycle hook, `@block65/webcrypto-web-push` for delivery — all working
- **Current payload:** static — `title: "New message on Habits Social"`, `body: "Open Inbox to view it."`, `url: "/inbox"`

## Goal

Make push notifications show:
- **Title:** the sender's display name
- **Body:** context line + message preview (single line, colon-separated, no quotes)
- **Tap target:** opens inbox directly to the sender's conversation

### Body format by scenario

| Scenario | `activityType` | Example body |
|----------|----------------|--------------|
| Reply to a log event | any `narrateLog` type (e.g. `STREAK_MILESTONE`) | `Sent a message about an activity: completed Cooking for Jun 16.` |
| Reply to a habit commit | `COMMITMENT` | `Sent a message about a habit: committed to Cooking today.` |
| Plain chat message | `undefined` | `Hey, how are you doing?` |
| Empty body, no activity | `undefined`, body empty | `Sent a message` |

### Activity type categories (from `SocialNarratorService.narrateLog` and `narrateCommitment`)

**"about an activity":** `INITIAL_COMPLETION`, `STREAK_STARTED`, `STREAK_CONTINUED`, `STREAK_MILESTONE`, `ANNUAL_ANNIVERSARY`, `POST_YEAR_MILESTONE`, `POST_YEAR_EXTENSION`, `STREAK_EXTENSION`, `STREAK_BROKEN`, `STREAK_MAINTAINED`, `STREAK_MAINTAINED_VACATION`, `INITIAL_SKIP`, `INITIAL_FAILURE`, `INITIAL_VACATION`

**"about a habit":** `COMMITMENT`

**No context:** no `replyToActivity` at all

---

## File Changes

### 1. `server/services/push.service.ts`

#### New import (add to existing imports at top, alongside `import * as schema from '../db/schema'`)

```ts
import { users } from '../db/schema';
```

(Warning: `users` may already be imported via `* as schema`. If so, reference `schema.users` instead. Do NOT double-import.)

#### New helper functions — add between `PUSH_TIMEOUT_MS` and the `PushService` class

```ts
function stripNarratorMarkup(text: string): string {
  return text.replace(/\[H\]|\[\/H\]|\[S:\d+\]|\[\/S\]/g, '');
}

function truncatePushBody(body: string, maxLen = 80): string {
  const firstLine = body.split('\n')[0]?.trim() || '';
  if (!firstLine) return 'Sent a message';
  if (firstLine.length <= maxLen) return firstLine;
  return firstLine.slice(0, maxLen - 3).trimEnd() + '...';
}
```

#### Updated `notifyUser()` signature

```ts
static async notifyUser(
  db: DBConnection,
  recipientId: string,
  senderId: string,
  messageBody: string,
  activityType?: string,
  activityMessage?: string,
): Promise<void>
```

#### New logic — insert after early returns, replace existing `messageData` block

Current code to replace (roughly lines 158-174):
```ts
const details = getPushConfiguredOrThrow();

const messageData: Record<string, string> = {
  type: 'chat.message',
  title: 'New message on Habits Social',
  body: 'Open Inbox to view it.',
  url: '/inbox',
};
```

Replace with:
```ts
const details = getPushConfiguredOrThrow();

// Fetch sender's display name for the notification title
let senderName = 'Someone';
try {
  const [sender] = await db.select({ username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.id, senderId));
  if (sender?.username) senderName = sender.username;
} catch { /* non-critical: use fallback */ }

// Build the notification body
const preview = messageBody.trim()
  ? truncatePushBody(messageBody)
  : activityMessage
    ? truncatePushBody(stripNarratorMarkup(activityMessage))
    : 'Sent a message';

const prefix = activityType
  ? (activityType === 'COMMITMENT' ? 'Sent a message about a habit' : 'Sent a message about an activity')
  : null;

const notificationBody = prefix ? `${prefix}: ${preview}` : preview;

const messageData: Record<string, string> = {
  type: 'chat.message',
  title: senderName,
  body: notificationBody,
  url: `/inbox?replyToFriend=${senderId}`,
};
```

**Existing code unchanged:** The `sendOne` loop (`buildPushPayload` + `fetch` + error handling), `findActiveSubscriptions`, `upsertSubscription`, `disableSubscription`, `disableSubscriptionByEndpoint`, `hasBlock`, `getVapidConfig`, `getPushConfiguredOrThrow`.

---

### 2. `server/services/chat.service.ts`

**Line 240** — change the `PushService.notifyUser()` call:

```ts
// Before:
const pushPromise = PushService.notifyUser(db, otherParticipantId, senderId).catch((error: unknown) => {

// After:
const pushPromise = PushService.notifyUser(
  db, otherParticipantId, senderId, body,
  replyToActivity?.type,
  replyToActivity?.message,
).catch((error: unknown) => {
```

`replyToActivity` is already an optional parameter on `sendMessage()` (line 186). No other changes needed in this file.

---

### 3. `server/tests/push.service.spec.ts`

#### Updated `notifyUser()` calls

Every `PushService.notifyUser(db, userB.id, userA.id)` must become `PushService.notifyUser(db, userB.id, userA.id, 'Hello!')`.

Affected lines (approximate): 115, 126, 133, 139, 145, 152, 159, 178 — search for `notifyUser(db,` in the file and add `, 'Hello!'` as 4th argument to each call.

#### Updated payload assertion (the "should send payload without message body or sender profile" test)

```ts
const message = call[0] as { data: Record<string, string>; options: { ttl: number } };
expect(message.data.title).toBe(userA.username);
expect(message.data.body).toBe('Hello!');
expect(message.data.url).toBe(`/inbox?replyToFriend=${userA.id}`);
expect(message.data.type).toBe('chat.message');
```

The `userA` object has a `.username` property (comes from `createTestUser` in `test.utils.ts`).

#### New tests — add to the `notifyUser` describe block (after the existing "should handle multiple subscriptions" test)

```ts
it('should include activity context line when replyToActivity is a log type', async () => {
  await PushService.notifyUser(db, userB.id, userA.id, '', 'STREAK_MILESTONE', 'hit a [S:5]5-day streak[/S] by completing [H]Cooking[/H]');
  const call = mockedBuildPushPayload.mock.calls[0]![0] as { data: Record<string, string>; options: { ttl: number } };
  expect(call.data.body).toBe('Sent a message about an activity: hit a 5-day streak by completing Cooking');
  expect(call.data.title).toBe(userA.username);
  expect(call.data.url).toBe(`/inbox?replyToFriend=${userA.id}`);
});

it('should include habit context line when replyToActivity is COMMITMENT', async () => {
  await PushService.notifyUser(db, userB.id, userA.id, 'Great idea!', 'COMMITMENT', 'committed to [H]Cooking[/H]');
  const call = mockedBuildPushPayload.mock.calls[0]![0] as { data: Record<string, string>; options: { ttl: number } };
  expect(call.data.body).toBe('Sent a message about a habit: Great idea!');
  expect(call.data.title).toBe(userA.username);
});

it('should use activity message as fallback when messageBody is empty', async () => {
  await PushService.notifyUser(db, userB.id, userA.id, '', 'STREAK_STARTED', 'started a streak by completing [H]Cooking[/H] for Jun 16.');
  const call = mockedBuildPushPayload.mock.calls[0]![0] as { data: Record<string, string>; options: { ttl: number } };
  expect(call.data.body).toBe('Sent a message about an activity: started a streak by completing Cooking for Jun 16.');
});

it('should use Sent a message fallback when both body and activity are empty', async () => {
  await PushService.notifyUser(db, userB.id, userA.id, '', undefined, undefined);
  const call = mockedBuildPushPayload.mock.calls[0]![0] as { data: Record<string, string>; options: { ttl: number } };
  expect(call.data.body).toBe('Sent a message');
});
```

---

### 4. No changes needed

| File | Reason |
|------|--------|
| `public/push-sw.js` | `notificationclick` handler already opens `data.url` via `clients.openWindow()`. The new `/inbox?replyToFriend=<senderId>` URL is correctly handled. |
| `app/pages/inbox.vue` | `handleReplyQuery()` runs on `onMounted` (line 1644) and `onActivated` (line 1667), reads `route.query.replyToFriend`, calls `selectFriend()` to open the conversation. Already wired up. |
| `app/composables/useChatNotifications.ts` | Frontend subscription logic — unchanged. |
| `server/api/push/*` | API endpoints — unchanged. |
| `server/api/chat/conversations/by-friend/[friendId]/messages.post.ts` | Already passes `replyToActivity` from body validation to `ChatService.sendMessage()` (line 48). |

---

## URL Flow (tap notification → open chat)

```
1. Notification delivered with url: "/inbox?replyToFriend=<senderId>"
2. User taps notification
3. push-sw.js notificationclick → clients.openWindow(urlToOpen)
4. inbox.vue mounts → onMounted → handleReplyQuery()
   → finds sender in friends list (calls refreshSocial() if needed)
   → calls selectFriend(sender)
   → opens conversation directly, loads messages
   → clears ?replyToFriend from URL bar (line 1618-1620)
5. User is now in the chat conversation with the sender
```

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Sender's user record deleted | Username falls back to `"Someone"` |
| DB error fetching username | Caught, falls back to `"Someone"`, delivery proceeds |
| `messageBody` empty, `activityMessage` has markup | Markup stripped via regex, then truncated |
| `messageBody` empty, no `replyToActivity` | Falls back to `"Sent a message"` |
| `replyToActivity` exists but `type` is unknown | Falls to `"about an activity"` (default branch in ternary) |
| Message > 80 chars | Truncated at 77 chars + `...` |
| Multi-line message | Only first line shown |
| User unfriended sender before tapping notification | `handleReplyQuery` silently fails to find friend, inbox opens normally with conversation list |
| `COMMITMENT` type with non-empty user body | Body takes priority over activity message (user's text is shown) |

---

## Verification

```bash
npm run test:types
npx vitest run server/tests/push.service.spec.ts server/tests/push.api.spec.ts
```

Expected: 35 existing tests pass + 4 new tests pass = 39 total. No type errors.

---

## Manual Test After Deploy

1. Deploy to staging
2. **Device B** (mobile or separate browser): go to Inbox → Enable push → grant permission → app to background
3. **Device A:** send a plain chat message to Device B → notification shows sender name + message
4. **Device A:** tap "Chat about this activity" on a feed item, send (no text) → notification shows `Sent a message about an activity: ...`
5. **Device A:** reply to a habit commitment card → notification shows `Sent a message about a habit: ...`
6. Tap any notification → inbox opens directly to the chat with that sender
