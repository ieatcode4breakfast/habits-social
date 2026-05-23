# Chat System V1

## Overview
A secure, friendship-locked messaging system built with Drizzle ORM and Nuxt/Nitro. Supports real-time notifications, activity reply cards, and per-user conversation clearing.

## Data Model

### `chat_conversations`
Metadata for user pairs. Conversations are decoupled from friendships to preserve history.
- `id`: UUID (Primary Key)
- `user1_id`: UUID (Foreign Key to users, set null on delete)
- `user2_id`: UUID (Foreign Key to users, set null on delete)
- `last_message_at`: Timestamp
- `created_at`: Timestamp
- `updated_at`: Timestamp
- **Indexes**:
  - Unique unordered pair index on `(LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id))` — **partial**: only where both IDs are non-null.
  - `last_message_at` index for efficient conversation list sorting.

### `chat_participants`
Junction table for membership, read state, and per-user visibility boundaries.
- `conversation_id`: UUID (Foreign Key to conversations, cascade on delete)
- `user_id`: UUID (Foreign Key to users, cascade on delete)
- `last_read_at`: Timestamp (Used for unread count calculation)
- `cleared_at`: Timestamp, nullable (When set, only messages created after this timestamp are visible to this user. Used for per-user conversation clearing.)
- **Primary Key**: Composite `(conversation_id, user_id)`.

### `chat_messages`
Actual message content, activity reply context, and tombstones.
- `id`: UUID (Primary Key)
- `conversation_id`: UUID (Foreign Key to conversations, cascade on delete)
- `sender_id`: UUID (Foreign Key to users, set null on delete)
- `body`: Text (Cleared if deleted/tombstoned)
- `reply_to_activity`: JSONB, nullable (Stores a snapshot of a social activity feed item when the message was sent as a reply from the activity feed. Validated against `feedItemSchema`.)
- `deleted_at`: Timestamp
- `created_at`: Timestamp
- **Index**: `(conversation_id, created_at)` for efficient paginated message retrieval.

## Core Logic

### Access Control
- **Friendship Locked**: Any read/write access to a conversation requires an active 'accepted' friendship between the participants.
- **Exceptions**: If a participant deletes their account, the remaining participant retains **read-only** access to the history. Write operations (sending messages, deleting messages) are blocked.
- **Inbox Visibility**: Conversations only appear in `GET /api/chat/conversations` if **all** of the following are true:
  1. An active friendship exists, or the other user has been deleted.
  2. At least one message exists that is visible to the caller (i.e., created after their `cleared_at`, if set).
- **Mutation Access Levels**:
  - `markAsRead`: Requires `read` access — works even if the other user is deleted.
  - `deleteMessage`: Requires `write` access — blocked if the other user is deleted, since the friendship context no longer exists for mutation.
  - `clearConversation`: Requires membership only (participant check, no friendship check). Sets `cleared_at` on the caller's participant row.

### Unread Counts
Calculated dynamically by comparing `chat_messages.created_at` with `chat_participants.last_read_at` for messages where the caller is not the sender. Only counts messages visible to the caller (created after `cleared_at`, if set).

### Message Pagination
Deterministic cursor-based pagination using a base64 encoded string of `createdAt|id`. Messages created before the caller's `cleared_at` are excluded from results.

### Activity Replies
Messages can optionally carry a `replyToActivity` payload — a snapshot of a social feed item (habit completion, streak milestone, etc.). The service validates that the activity's owner is one of the two conversation participants to prevent spoofed visual cards.

### Conversation Clearing
Per-user soft-clear that sets `cleared_at` on the caller's participant row and advances `last_read_at` to now. This hides all prior messages from the caller's view without affecting the other participant's history. The conversation reappears if new messages are sent after the clear.

### Realtime Notifications
`sendMessage` and `deleteMessage` trigger a `chat.changed` push notification to both conversation participants via `realtimeNotifier.notifyUsersRealtime`. Notification failures are logged as warnings but do not block the operation.

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/chat/conversations` | Lists active conversations with unread counts and last message preview. |
| `GET` | `/api/chat/conversations/:id/messages` | Paginated message history for a conversation. Supports `limit` (1–100, default 50) and `cursor` query params. |
| `POST` | `/api/chat/conversations/by-friend/:friendId/messages` | Sends a message via friend ID (auto-creates conversation). Accepts `body` and optional `replyToActivity`. |
| `POST` | `/api/chat/conversations/:id/read` | Marks all messages in a conversation as read. |
| `POST` | `/api/chat/conversations/:id/clear` | Clears a conversation for the caller only. Sets `cleared_at` to hide prior messages. |
| `DELETE` | `/api/chat/messages/:id` | Tombstones a specific message (sender only, `write` access required). |
| `POST` | `/api/chat/socket-token` | Mints a short-lived JWT (1 hour, HS256) for real-time socket authentication. |

## Security

### Rate Limiting
All limits use a 60-second sliding window.

| Operation | Limit | Scope | Used By |
| :--- | :--- | :--- | :--- |
| Send / Delete message | 60 / 60s | Per user, per target (friend or conversation) | `checkChatRateLimit` |
| Read operations | 100 / 60s | Per user, global | `checkChatReadRateLimit` |
| Conversation clear | 20 / 60s | Per user, global | `checkChatClearRateLimit` |
| Socket token mint | 5 / 60s | Per user, global | `checkChatTokenRateLimit` |

- **Isolation**: Messaging in one conversation does not block messaging in others.
- **Storage**: Backed by Nitro's `useStorage('chatRateLimit')` (resolves to Cloudflare KV via `CHAT_KV` binding in production).
- **Fail-Closed**: If the rate limit storage fails, access is denied (500).

### Frontend Security (XSS)
- **Inert Storage**: The backend stores all message bodies as raw, inert strings. No server-side sanitization or character stripping is performed to preserve data integrity (e.g., code snippets, emoji).
- **Frontend Responsibility**: The Vue frontend **MUST** use escaped interpolations (e.g., `{{ message.body }}`) or `v-text`. Use of `v-html` on message bodies is strictly forbidden to prevent XSS.

### IDOR Protection
All endpoints verify that the authenticated user is a valid participant of the requested conversation and that an active friendship exists (or the other user is deleted, for read-only paths).

### Tombstoning
- **Message Delete**: Body is cleared, `deleted_at` is set. Requires `write` access (active friendship).
- **Account Deletion**: All user messages are tombstoned (body cleared, `sender_id` nulled) to preserve conversation flow for the other participant while removing personal data.

## Verification
- **Validation**: Strict Zod schemas for all payloads and UUIDs (`chatMessageSchema`, `conversationIdSchema`, `friendIdSchema`, `messageIdSchema`).
- **Type Safety**: Full coverage with `npx nuxi typecheck`.
- **Tests**: Comprehensive suite across 6 spec files:
  - `chat.service.spec.ts` — Core service logic
  - `chat.api.spec.ts` — API endpoint integration
  - `chat.security.spec.ts` — Access control and IDOR
  - `chat.lifecycle.spec.ts` — Conversation lifecycle (create, clear, tombstone)
  - `chat.activity-reply.spec.ts` — Activity reply card validation
  - `chat.validation.spec.ts` — Zod schema enforcement
