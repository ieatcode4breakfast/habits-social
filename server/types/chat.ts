import type { InferSelectModel } from 'drizzle-orm';
import * as schema from '../db/schema';

export type ChatConversation = InferSelectModel<typeof schema.chatConversations>;
export type ChatMessage = InferSelectModel<typeof schema.chatMessages>;
export type ChatParticipant = InferSelectModel<typeof schema.chatParticipants>;

export interface ConversationListItem {
  id: string;
  lastMessageAt: Date | null;
  user1Id: string | null;
  user2Id: string | null;
  unreadCount: number;
}

export interface PaginatedMessages {
  messages: ChatMessage[];
  hasMore: boolean;
  cursor?: string;
}
