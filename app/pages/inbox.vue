<template>
  <div class="relative h-[calc(100dvh-57px)] md:h-auto md:min-h-[calc(100dvh-120px)] flex flex-col md:flex-row bg-black/60 backdrop-blur-xl sm:rounded-2xl border border-zinc-800/80 overflow-hidden shadow-2xl md:mt-2 md:mb-2 md:bg-transparent md:backdrop-blur-none md:border-transparent md:overflow-visible md:shadow-none md:gap-2">
    
    <!-- Sidebar Pane: Conversations List -->
    <div 
      v-show="!activeFriend || !isMobile"
      class="w-full md:w-80 shrink-0 flex flex-col bg-zinc-950/40 md:rounded-2xl md:border md:border-zinc-800/80 md:bg-black/60 md:backdrop-blur-xl md:shadow-2xl md:overflow-hidden"
      :class="{ 'h-full': isMobile }"
    >
      <!-- Sidebar Header -->
      <div class="px-4 pt-2 py-2 border-b border-zinc-800/80 flex items-end justify-between gap-4 bg-zinc-925/40 backdrop-blur-md shrink-0">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 bg-zinc-925 rounded-xl shadow-lg flex items-center justify-center border border-zinc-800">
            <MessageCircle class="w-6 h-6 text-zinc-400" />
          </div>
          <div>
            <h1 class="text-base font-bold tracking-tight text-white">Inbox</h1>
            <p class="text-zinc-400 text-xs">{{ conversations.length }} chat{{ conversations.length === 1 ? '' : 's' }}</p>
          </div>
        </div>
        
        <button 
          @click="showNewChatModal = true"
          class="p-2 bg-white hover:bg-zinc-200 text-black rounded-lg transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center"
          title="New Conversation"
        >
          <SquarePen class="w-4 h-4" />
        </button>
      </div>

      <!-- Conversations Scroll List -->
      <div
        ref="conversationsScrollContainer"
        class="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-900/60 p-2 space-y-1 will-change-transform transition-colors duration-300"
        :style="conversationsPullStyle"
      >
        <div v-if="conversationsLoading" class="flex justify-center py-10">
          <div class="h-6 w-6 rounded-full border-b-2 border-white animate-spin"></div>
        </div>
        
        <template v-else>
          <div v-if="conversations.length === 0" class="py-12 px-4 text-center">
            <p class="text-sm text-zinc-500 italic">No conversations yet.</p>
            <button 
              @click="showNewChatModal = true"
              class="mt-3 text-sm text-white/80 hover:text-white font-semibold underline underline-offset-4 cursor-pointer"
            >
              Start chatting with a friend
            </button>
          </div>

          <button
            v-for="conv in conversations" 
            :key="conv.id"
            @click="selectConversation(conv)"
            class="w-full text-left p-3 rounded-xl transition-all duration-200 flex items-center gap-3 group relative cursor-pointer outline-none border border-transparent"
            :class="[
              activeConversationId === conv.id 
                ? 'bg-white/10 border-white/5 shadow-md shadow-black/25' 
                : 'hover:bg-zinc-900/50'
            ]"
          >
            <!-- Friend Avatar -->
            <div class="relative shrink-0">
              <div 
                class="w-10 h-10 rounded-full flex items-center justify-center border font-bold text-xs uppercase shadow-sm transition-all"
                :class="[
                  activeConversationId === conv.id
                    ? 'bg-white text-black border-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 group-hover:border-zinc-700'
                ]"
              >
                <img 
                  v-if="getFriendProfile(conv)?.photoUrl" 
                  :src="getFriendProfile(conv)?.photoUrl" 
                  class="w-full h-full rounded-full object-cover"
                  alt="Avatar"
                />
                <span v-else>{{ getFriendProfile(conv)?.username?.charAt(0) || '?' }}</span>
              </div>
            </div>

            <!-- Friend Name / Last Active Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline justify-between gap-1">
                <span 
                  class="text-sm font-bold truncate transition-colors"
                  :class="activeConversationId === conv.id ? 'text-white' : 'text-zinc-300 group-hover:text-white'"
                >
                  {{ getFriendProfile(conv)?.username || 'Deleted User' }}
                </span>
                
                <span v-if="conv.lastMessageAt" class="text-[10px] text-zinc-500 shrink-0 font-medium">
                  {{ formatTime(conv.lastMessageAt) }}
                </span>
              </div>
              
              <div class="flex items-center justify-between gap-1 mt-0.5">
                <span class="text-[10px] text-zinc-500 truncate font-medium">
                  {{ getFriendProfile(conv) ? 'Click to view messages' : 'Conversation archived' }}
                </span>
                
                <!-- Unread Badge -->
                <span 
                  v-if="conv.unreadCount > 0"
                  class="h-4 min-w-[16px] px-1 bg-white text-black text-[9px] font-black tracking-tight rounded-full flex items-center justify-center shrink-0 shadow-lg border border-black/10 scale-105"
                >
                  {{ conv.unreadCount }}
                </span>
              </div>
            </div>
          </button>
        </template>
      </div>
    </div>

    <!-- Main Pane: Chat History & Input -->
    <div 
      v-show="activeFriend || !isMobile"
      class="flex-1 flex flex-col min-h-0 md:h-[calc(100dvh-120px)] bg-zinc-950/20 relative md:rounded-2xl md:border md:border-zinc-800/80 md:bg-black/60 md:backdrop-blur-xl md:shadow-2xl md:overflow-hidden"
    >
      <!-- Chat Header + Messages + Input (only when a conversation is active) -->
      <template v-if="activeFriend">
        <!-- Chat Header -->
        <div class="sticky top-0 z-40 px-4 py-2 flex items-end justify-between gap-4 bg-black md:bg-black shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <button 
              v-if="isMobile" 
              @click="deselectConversation"
              class="inline-flex items-center justify-center p-1 -ml-1 text-zinc-500 hover:text-white transition-all flex-shrink-0 cursor-pointer"
              title="Back to list"
            >
              <ChevronLeft class="w-6 h-6" />
            </button>

            <div class="relative shrink-0">
              <div class="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-xs uppercase text-zinc-300">
                <img 
                  v-if="activeFriend.photoUrl" 
                  :src="activeFriend.photoUrl" 
                  class="w-full h-full rounded-full object-cover"
                  alt="Avatar"
                />
                <span v-else>{{ activeFriend.username.charAt(0) }}</span>
              </div>
            </div>

            <div class="min-w-0">
              <h2 class="text-sm font-bold text-white truncate leading-tight">{{ activeFriend.username }}</h2>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button 
              @click="refreshConversation"
              class="p-2 hover:bg-zinc-850 rounded-lg text-zinc-400 hover:text-white transition-all cursor-pointer flex items-center justify-center"
              title="Refresh conversation"
              :disabled="messagesLoading || isRefreshingConversation"
            >
              <div v-if="isRefreshingConversation" class="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin"></div>
              <RotateCw v-else class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Messages Stream Scroll Area -->
        <div 
          ref="scrollContainer"
          class="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col-reverse gap-2"
          @scroll="handleScroll"
        >
          <!-- Loading Indicator -->
          <div v-if="messagesLoading && messages.length === 0" class="flex-1 flex items-center justify-center">
            <div class="h-8 w-8 rounded-full border-b-2 border-white animate-spin"></div>
          </div>

          <template v-else>
            <!-- Message Bubbles -->
            <div 
              v-for="msg in messages" 
              :key="msg.id"
              class="flex items-end gap-2 group/msg max-w-[85%] md:max-w-[70%]"
              :class="msg.senderId === user?.id ? 'self-end flex-row-reverse' : 'self-start'"
            >
              <!-- Message Bubble -->
              <div 
                class="rounded-2xl px-3.5 py-2.5 text-sm shadow-md relative break-words select-text font-normal leading-relaxed"
                :class="[
                  msg.senderId === user?.id
                    ? 'bg-zinc-100 text-zinc-950 rounded-br-sm'
                    : 'bg-zinc-900 border border-zinc-800/80 text-zinc-100 rounded-bl-sm'
                ]"
              >
                <!-- Tombstone Deleted State -->
                <span v-if="msg.deletedAt" class="text-zinc-500 italic select-none">This message was deleted.</span>
                <span v-else>{{ msg.body }}</span>
                
                <!-- Message Timestamp inside bubble -->
                <span 
                  class="block text-[10px] mt-1 text-right select-none font-bold tracking-tight shrink-0"
                  :class="msg.senderId === user?.id ? 'text-zinc-600' : 'text-zinc-500'"
                >
                  {{ formatTime(msg.createdAt) }}
                </span>
              </div>

              <!-- Delete Button (Only own messages & not deleted already) -->
              <button 
                v-if="msg.senderId === user?.id && !msg.deletedAt"
                @click="confirmDeleteMessage(msg.id)"
                class="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1.5 hover:bg-zinc-850 rounded-lg text-zinc-500 hover:text-rose-500 cursor-pointer duration-200 shrink-0 self-center"
                title="Delete Message"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>

            <!-- Pagination Indicator: Load More -->
            <div v-if="hasMore" class="w-full flex justify-center py-2 shrink-0">
              <button 
                @click="loadOlderMessages" 
                class="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-[10px] font-bold text-zinc-400 hover:text-white rounded-lg transition-all border border-zinc-800/60 active:scale-95 cursor-pointer flex items-center gap-1.5"
                :disabled="loadingMore"
              >
                <div v-if="loadingMore" class="h-3 w-3 rounded-full border-b-2 border-white animate-spin"></div>
                <span>Load older messages</span>
              </button>
            </div>
          </template>
        </div>

        <!-- Input Send Panel -->
        <div class="z-40 p-2 bg-black md:bg-black shrink-0">
          <div class="flex items-end gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 focus-within:border-zinc-700 transition-colors shadow-inner relative">
            <textarea
              ref="messageTextareaRef"
              v-model="messageBody"
              placeholder="Type your message..."
              class="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-none resize-none max-h-28 min-h-[20px] overflow-y-auto font-normal leading-normal self-center align-middle"
              rows="1"
              maxlength="1000"
              @input="syncMessageTextareaHeight"
              @keydown.enter.exact.prevent="handleEnterKey"
            ></textarea>

            <div class="flex items-center gap-3 shrink-0 self-end">
              <!-- Character Counter -->
              <span 
                class="text-[9px] font-bold tracking-tight select-none"
                :class="messageBody.length >= 900 ? 'text-rose-400' : 'text-zinc-500'"
              >
                {{ messageBody.length }}/1000
              </span>

              <button 
                @click="sendMessage"
                class="p-2 bg-white hover:bg-zinc-200 text-black rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:hover:bg-white disabled:active:scale-100 cursor-pointer flex items-center justify-center"
                :disabled="!canSend"
              >
                <div v-if="sending" class="h-3.5 w-3.5 rounded-full border-2 border-black/20 border-t-black animate-spin"></div>
                <Send v-else class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- Large Fallback Placeholder (when no friend/chat is open) -->
      <template v-else>
        <div class="flex-1 flex flex-col items-center justify-center p-8 text-center select-none bg-zinc-950/20">
          <div class="w-16 h-16 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-center text-zinc-400 mb-4 shadow-xl relative animate-float">
            <div class="absolute inset-0 bg-white/5 rounded-2xl filter blur-sm -z-10 animate-pulse"></div>
            <MessageCircle class="w-7 h-7 text-zinc-400" />
          </div>
          <p class="text-zinc-400 text-sm max-w-[280px] leading-relaxed">
            Chat securely with friends, keep each other accountable, and achieve your habit goals together.
          </p>
          <button 
            @click="showNewChatModal = true"
            class="mt-6 px-4 py-2 bg-white hover:bg-zinc-200 text-black text-sm font-bold rounded-xl shadow-lg shadow-white/5 transition-all duration-200 active:scale-95 cursor-pointer"
          >
            Start a new chat
          </button>
        </div>
      </template>
    </div>

    <!-- New Chat Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div 
          v-if="showNewChatModal"
          class="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          @click.self="showNewChatModal = false"
        >
          <div class="w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden select-none">
            
            <!-- Modal Header -->
            <div class="p-4 border-b border-zinc-800/60 flex items-center justify-between">
              <h3 class="text-sm font-bold text-white">Select a Friend</h3>
              <button 
                @click="showNewChatModal = false"
                class="p-1 hover:bg-zinc-850 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            <!-- Modal Content/Friends List -->
            <div class="flex-1 overflow-y-auto p-2 space-y-1">
              <div v-if="friends.length === 0" class="py-12 text-center text-zinc-500 italic text-sm">
                No active friends yet. Invite them in the Activity section!
              </div>
              
              <button
                v-for="friend in friends"
                :key="friend.id"
                @click="selectFriend(friend)"
                class="w-full text-left p-3 rounded-xl hover:bg-zinc-900/60 transition-colors flex items-center gap-3 cursor-pointer outline-none border border-transparent"
              >
                <div class="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-xs uppercase text-zinc-300 shrink-0">
                  <img 
                    v-if="friend.photoUrl" 
                    :src="friend.photoUrl" 
                    class="w-full h-full rounded-full object-cover"
                    alt="Avatar"
                  />
                  <span v-else>{{ friend.username.charAt(0) }}</span>
                </div>
                
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-bold text-white truncate">{{ friend.username }}</div>
                  <div class="text-[9px] text-zinc-500 font-semibold tracking-tight uppercase mt-0.5">Active Friend</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { 
  MessageCircle, 
  SquarePen, 
  Trash2, 
  Send, 
  X, 
  ChevronLeft, 
  RotateCw 
} from 'lucide-vue-next';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useSocial, type UserProfile } from '~/composables/useSocial';
import { useAuth } from '~/composables/useAuth';
import { useToast } from '~/composables/useToast';
import { autoExpandTextarea } from '~/utils/ui';

definePageMeta({ middleware: 'auth' });

useSeoMeta({
  title: 'Inbox - HabitsSocial',
  description: 'Connect and chat securely with your friends on HabitsSocial.',
});

const { user } = useAuth();
const { friends, profilesMap, init: initSocial, refresh: refreshSocial } = useSocial();
const { showToast } = useToast();

// List States
const conversations = ref<any[]>([]);
const activeConversationId = ref<string | null>(null);
const activeFriend = ref<UserProfile | null>(null);
const messages = ref<any[]>([]);
const conversationsScrollContainer = ref<HTMLElement | null>(null);

// Loading states
const conversationsLoading = ref(false);
const messagesLoading = ref(false);
const isRefreshingConversation = ref(false);
const loadingMore = ref(false);
const sending = ref(false);

// Input states
const messageBody = ref('');
const hasMore = ref(false);
const nextCursor = ref<string | null>(null);

// Modal/Responsive toggles
const showNewChatModal = ref(false);
const isMobile = ref(false);

// Refs
const scrollContainer = ref<HTMLElement | null>(null);
const messageTextareaRef = ref<HTMLTextAreaElement | null>(null);

// Computed validators
const canSend = computed(() => {
  const trimmed = messageBody.value.trim();
  return trimmed.length > 0 && trimmed.length <= 1000 && !sending.value;
});

const syncMessageTextareaHeight = () => {
  if (messageTextareaRef.value) {
    autoExpandTextarea(messageTextareaRef.value);
  }
};

const refreshConversation = async () => {
  if (!activeConversationId.value || messagesLoading.value || isRefreshingConversation.value) return;

  isRefreshingConversation.value = true;
  try {
    await loadMessages();
  } finally {
    isRefreshingConversation.value = false;
  }
};

// Load Conversations list from backend
const loadConversations = async (silent = false, preserveLoading = false) => {
  if (!silent) conversationsLoading.value = true;
  try {
    const data = await $fetch<any[]>('/api/chat/conversations');
    conversations.value = data || [];
  } catch (error: any) {
    console.error('[Inbox] Failed to load conversations:', error);
    showToast('Failed to load conversations', 'failed');
  } finally {
    if (!preserveLoading) {
      conversationsLoading.value = false;
    }
  }
};

const refreshConversations = async () => {
  conversationsLoading.value = true;
  try {
    await Promise.all([
      loadConversations(true, true),
      refreshSocial()
    ]);
  } finally {
    conversationsLoading.value = false;
  }
};

const { isPulling: isPullingConversations, isRefreshing: isRefreshingConversations } = usePullToRefresh(
  refreshConversations,
  80,
  { scrollContainer: conversationsScrollContainer }
);

const conversationsPullStyle = computed(() => {
  const useTransition = !isPullingConversations.value && !conversationsLoading.value && !isRefreshingConversations.value;
  return {
    transform: 'translateY(var(--pull-distance, 0px))',
    transition: useTransition ? 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none'
  };
});

// Get profile details of the conversation's partner
const getFriendProfile = (conv: any) => {
  if (!user.value?.id) return null;
  const otherId = conv.user1Id === user.value.id ? conv.user2Id : conv.user1Id;
  return profilesMap.value[otherId] || null;
};

// Select a specific conversation from list
const selectConversation = async (conv: any) => {
  const profile = getFriendProfile(conv);
  if (!profile) {
    showToast('Cannot chat with inactive users', 'failed');
    return;
  }
  activeFriend.value = profile;
  activeConversationId.value = conv.id;
  messages.value = [];
  
  await loadMessages();
  
  // Mark as read after load
  if (conv.unreadCount > 0) {
    try {
      await $fetch(`/api/chat/conversations/${conv.id}/read`, { method: 'POST' });
      conv.unreadCount = 0;
    } catch (e) {
      console.warn('[Inbox] Failed to mark as read', e);
    }
  }
};

// Select a friend from the New Conversation Modal
const selectFriend = async (friend: UserProfile) => {
  showNewChatModal.value = false;
  activeFriend.value = friend;
  
  // Check if we already have an active conversation with this friend
  const existingConv = conversations.value.find(conv => {
    const otherId = conv.user1Id === user.value?.id ? conv.user2Id : conv.user1Id;
    return otherId === friend.id;
  });

  if (existingConv) {
    await selectConversation(existingConv);
  } else {
    activeConversationId.value = null;
    messages.value = [];
  }
};

const deselectConversation = () => {
  activeFriend.value = null;
  activeConversationId.value = null;
  messages.value = [];
};

// Load messages in the active conversation
const loadMessages = async (cursor: string | null = null) => {
  if (!activeConversationId.value) return;
  
  const isPaginating = !!cursor;
  if (isPaginating) {
    loadingMore.value = true;
  } else {
    messagesLoading.value = true;
  }

  try {
    const query: Record<string, any> = { limit: 50 };
    if (cursor) query.cursor = cursor;

    const data = await $fetch<any>(`/api/chat/conversations/${activeConversationId.value}/messages`, { query });
    
    if (isPaginating) {
      messages.value = [...messages.value, ...(data.messages || [])];
    } else {
      messages.value = data.messages || [];
      // Scroll to bottom
      nextTick(() => {
        scrollToBottom();
      });
    }

    hasMore.value = data.hasMore;
    nextCursor.value = data.cursor || null;
  } catch (error: any) {
    console.error('[Inbox] Failed to load messages:', error);
    showToast('Failed to load messages', 'failed');
  } finally {
    messagesLoading.value = false;
    loadingMore.value = false;
  }
};

// Load older messages (pagination)
const loadOlderMessages = () => {
  if (hasMore.value && nextCursor.value && !loadingMore.value) {
    loadMessages(nextCursor.value);
  }
};

// Send message to the selected friend
const sendMessage = async () => {
  if (!canSend.value || !activeFriend.value) return;
  
  const text = messageBody.value.trim();
  sending.value = true;

  try {
    const response = await $fetch<any>(`/api/chat/conversations/by-friend/${activeFriend.value.id}/messages`, {
      method: 'POST',
      body: { body: text }
    });

    // Append to messages stream
    messages.value = [response, ...messages.value];
    messageBody.value = '';
    await nextTick();
    syncMessageTextareaHeight();
    
    // Set active conversation ID if it wasn't set (first message)
    if (!activeConversationId.value) {
      activeConversationId.value = response.conversationId;
    }

    nextTick(() => {
      scrollToBottom();
    });

    // Refresh conversations list silently
    await loadConversations(true);
  } catch (error: any) {
    console.error('[Inbox] Failed to send message:', error);
    if (error.statusCode === 429) {
      showToast('Rate limit exceeded. Please wait a moment.', 'failed');
    } else {
      showToast('Failed to send message', 'failed');
    }
  } finally {
    sending.value = false;
  }
};

// Delete a specific message
const confirmDeleteMessage = async (messageId: string) => {
  try {
    await $fetch(`/api/chat/messages/${messageId}`, { method: 'DELETE' });
    
    // Local updates
    const msgIndex = messages.value.findIndex(m => m.id === messageId);
    if (msgIndex !== -1) {
      messages.value[msgIndex] = {
        ...messages.value[msgIndex],
        body: '',
        deletedAt: new Date().toISOString()
      };
    }
    showToast('Message deleted', 'completed');
  } catch (error: any) {
    console.error('[Inbox] Failed to delete message:', error);
    showToast('Failed to delete message', 'failed');
  }
};

// Enter key submit helper
const handleEnterKey = () => {
  if (canSend.value) {
    sendMessage();
  }
};

// Time Formatter
const formatTime = (dateStr: string | Date) => {
  if (!dateStr) return '';
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    return formatDistanceToNow(date, { addSuffix: true })
      .replace('about ', '')
      .replace('less than a minute ago', 'just now');
  } catch {
    return '';
  }
};

// Scroll layout helpers
const scrollToBottom = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = 0; // Since flex-col-reverse keeps bottom as scrollTop = 0
  }
};

const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement;
  // In flex-col-reverse, scrollTop starts at 0 (bottom) and decreases to negative values as you scroll UP.
  // Or in some browsers it goes positive from 0 to scrollHeight - clientHeight.
  // Let's check scroll progress for infinite scroll:
  const isAtTop = Math.abs(target.scrollTop) + target.clientHeight >= target.scrollHeight - 10;
  if (isAtTop && hasMore.value && !loadingMore.value) {
    loadOlderMessages();
  }
};

// Mobile responsiveness tracking
const checkViewport = () => {
  isMobile.value = window.innerWidth < 768;
};

onMounted(async () => {
  checkViewport();
  window.addEventListener('resize', checkViewport);
  
  // Hydrate global social profiles first
  initSocial();
  
  await loadConversations();
});

onUnmounted(() => {
  window.removeEventListener('resize', checkViewport);
});
</script>

<style scoped>
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}

/* Custom Scrollbar for premium dark feel */
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 99px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
