# Chat System V1

## Overview
A secure, friendship-locked messaging system built with Drizzle ORM and Nuxt/Nitro.

## Data Model

### `chat_conversations`
Metadata for user pairs. Conversations are decoupled from friendships to preserve history.
- `id`: UUID (Primary Key)
- `user1_id`: UUID (Foreign Key to users, set null on delete)
- `user2_id`: UUID (Foreign Key to users, set null on delete)
- `last_message_at`: Timestamp
- `created_at`: Timestamp
- `updated_at`: Timestamp
- **Index**: Unique unordered pair index on `(user1_id, user2_id)`.

### `chat_participants`
Junction table for membership and read state.
- `conversation_id`: UUID (Foreign Key to conversations, cascade on delete)
- `user_id`: UUID (Foreign Key to users, cascade on delete)
- `last_read_at`: Timestamp (Used for unread count calculation)

### `chat_messages`
Actual message content and tombstones.
- `id`: UUID (Primary Key)
- `conversation_id`: UUID (Foreign Key to conversations, cascade on delete)
- `sender_id`: UUID (Foreign Key to users, set null on delete)
- `body`: Text (Cleared if deleted/tombstoned)
- `deleted_at`: Timestamp
- `created_at`: Timestamp

## Core Logic

### Access Control
- **Friendship Locked**: Any read/write access to a conversation requires an active 'accepted' friendship between the participants.
- **Exceptions**: If a participant deletes their account, the remaining participant retains **read-only** access to the history.
- **Inbox Visibility**: Conversations only appear in `GET /api/chat/conversations` if an active friendship exists or the other user is deleted. Unfriending removes the chat from the active inbox.
- **Unauthorized Mutation**: `markAsRead` and `deleteMessage` now verify active friendship status to prevent stale or malicious mutations in locked chats.

### Unread Counts
Calculated dynamically by comparing `chat_messages.created_at` with `chat_participants.last_read_at` for messages where the caller is not the sender.

### Message Pagination
Deterministic cursor-based pagination using a base64 encoded string of `createdAt|id`.

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/chat/conversations` | Lists active/archived conversations with unread counts. |
| `GET` | `/api/chat/conversations/:id/messages` | Paginated message history for a conversation. |
| `POST` | `/api/chat/conversations/by-friend/:friendId/messages` | Sends a message via friend ID (auto-creates conversation). |
| `POST` | `/api/chat/conversations/:id/read` | Marks all messages in a conversation as read. |
| `DELETE` | `/api/chat/messages/:id` | Tombstones a specific message (sender only, friendship required). |
| `POST` | `/api/chat/socket-token` | Mints a JWT for real-time socket authentication. |

## Security

### Rate Limiting
- **Limit**: 5 messages per 60 seconds per user per target (friend/conversation).
- **Isolation**: Messaging in one conversation does not block messaging in others.
- **Durability**: Backed by `CHAT_KV` in production (Cloudflare KV).
- **Fail-Closed**: If the rate limit storage fails, access is denied.

### Frontend Security (XSS)
- **Inert Storage**: The backend stores all message bodies as raw, inert strings. No server-side sanitization or character stripping is performed to preserve data integrity (e.g., code snippets, emoji).
- **Frontend Responsibility**: The Vue frontend **MUST** use escaped interpolations (e.g., `{{ message.body }}`) or `v-text`. Use of `v-html` on message bodies is strictly forbidden to prevent XSS.

### IDOR Protection
All endpoints verify that the authenticated user is a valid participant of the requested conversation and that an active friendship exists.

### Tombstoning
- **Message Delete**: Body is cleared, `deleted_at` is set.
- **Account Deletion**: All user messages are tombstoned (body cleared, `sender_id` nulled) to preserve conversation flow for the other participant while removing personal data.

## Verification
- **Validation**: Strict Zod schemas for all payloads and UUIDs.
- **Type Safety**: Full coverage with `npx nuxi typecheck`.
- **Tests**: Comprehensive suite in `server/tests/chat.*.spec.ts`.
