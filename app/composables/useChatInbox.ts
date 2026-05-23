import { computed } from 'vue';

export interface ChatInboxConversation {
  id: string;
  lastMessageAt: string | Date | null;
  lastMessageBody: string | null;
  lastMessageDeletedAt: string | Date | null;
  lastMessageSenderId: string | null;
  user1Id: string | null;
  user2Id: string | null;
  unreadCount: number;
}

let isInitialized = false;

export const useChatInbox = () => {
  const { user } = useAuth();
  const conversations = useState<ChatInboxConversation[]>('chat-inbox-conversations', () => []);
  const isLoading = useState<boolean>('chat-inbox-loading', () => false);

  const totalUnreadCount = computed(() =>
    conversations.value.reduce((total, conversation) => {
      const unreadCount = Number(conversation.unreadCount);
      return total + (Number.isFinite(unreadCount) && unreadCount > 0 ? unreadCount : 0);
    }, 0)
  );

  const refresh = async (silent = false, preserveLoading = false): Promise<void> => {
    if (!user.value) return;
    if (!silent) isLoading.value = true;

    try {
      const data = await $fetch<ChatInboxConversation[]>('/api/chat/conversations');
      conversations.value = Array.isArray(data) ? data : [];
    } catch (error: unknown) {
      console.error('[ChatInbox] Failed to refresh conversations', error);
      throw error;
    } finally {
      if (!preserveLoading) {
        isLoading.value = false;
      }
    }
  };

  const init = (): void => {
    if (import.meta.server || isInitialized || !user.value) return;
    isInitialized = true;

    void refresh(true).catch(() => {
      // refresh already logs the failure; init must not break app mounting.
    });
  };

  const markConversationReadLocally = (conversationId: string): void => {
    conversations.value = conversations.value.map((conversation) =>
      conversation.id === conversationId
        ? { ...conversation, unreadCount: 0 }
        : conversation
    );
  };

  const updateOptimisticPreview = (friendId: string, body: string, senderId: string, timestamp: Date | string): void => {
    let found = false;
    conversations.value = conversations.value.map((conv) => {
      if (conv.user1Id === friendId || conv.user2Id === friendId) {
        found = true;
        return {
          ...conv,
          lastMessageBody: body,
          lastMessageSenderId: senderId,
          lastMessageAt: timestamp,
          lastMessageDeletedAt: null,
        };
      }
      return conv;
    });

    if (!found) {
      conversations.value = [
        {
          id: `pending-${friendId}`,
          lastMessageAt: timestamp,
          lastMessageBody: body,
          lastMessageDeletedAt: null,
          lastMessageSenderId: senderId,
          user1Id: user.value?.id || '',
          user2Id: friendId,
          unreadCount: 0,
        },
        ...conversations.value
      ];
    } else {
      conversations.value.sort((a, b) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return timeB - timeA;
      });
    }
  };

  const logoutCleanup = (): void => {
    isInitialized = false;
    conversations.value = [];
    isLoading.value = false;
  };

  return {
    conversations,
    isLoading,
    totalUnreadCount,
    refresh,
    init,
    markConversationReadLocally,
    updateOptimisticPreview,
    logoutCleanup,
  };
};
