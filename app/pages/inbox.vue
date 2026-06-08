<template>
  <div class="inbox-shell relative h-[calc(100dvh-57px)] md:h-[calc(100dvh-80px)] flex flex-col md:flex-row bg-black/60 backdrop-blur-xl sm:-mx-6 md:mx-0 md:rounded-2xl border border-zinc-800/80 border-x-0 border-t-0 overflow-hidden shadow-2xl md:mt-2 md:mb-2 md:bg-transparent md:backdrop-blur-none md:border-transparent md:overflow-visible md:shadow-none md:gap-2">
    
    <!-- Sidebar Pane: Conversations List -->
    <div 
      v-show="!activeFriend || !isMobile"
      class="inbox-list-panel w-full md:w-80 shrink-0 flex flex-col bg-zinc-950/40 md:rounded-2xl md:border md:border-zinc-800/80 md:bg-black/60 md:backdrop-blur-xl md:shadow-2xl md:overflow-hidden"
      :class="{ 'h-full': isMobile }"
    >
      <!-- Sidebar Header -->
      <div class="inbox-chat-chrome px-4 pt-2 py-2 flex items-end justify-between gap-4 bg-black shrink-0 md:bg-zinc-925/40 md:backdrop-blur-md md:border-b md:border-zinc-800/80">
        <div class="flex items-center gap-3">
          <MessageCircle class="w-7 h-7 text-zinc-400 shrink-0" />
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
        <div v-if="conversationsLoading || !viewportReady" class="flex justify-center py-10">
          <div class="h-6 w-6 rounded-full border-b-2 border-white animate-spin"></div>
        </div>
        
        <template v-else>
          <div v-if="conversations.length === 0" class="py-12 px-4 text-center">
            <div v-if="isMobile" class="flex flex-col items-center justify-center min-h-[calc(100dvh-180px)] text-center select-none">
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
            <p v-else class="text-sm text-zinc-500 italic">No conversations yet.</p>
          </div>

          <button
            v-for="conv in conversations" 
            :key="conv.id"
            @click="switchToConversation(conv)"
            class="w-full text-left p-3 rounded-xl transition-all duration-200 flex items-center gap-3 group relative cursor-pointer outline-none border border-transparent"
            :class="[
              activeConversationId === conv.id 
                ? 'inbox-conversation-active bg-white/10 border-white/5 shadow-md shadow-black/25' 
                : 'hover:bg-zinc-900/50'
            ]"
          >
            <!-- Friend Avatar -->
            <div class="relative shrink-0">
              <div 
                class="w-10 h-10 flex items-center justify-center font-bold text-xs uppercase transition-all"
                :class="[
                  activeConversationId === conv.id
                    ? 'text-black'
                    : 'text-zinc-300'
                ]"
              >
                <img 
                  v-if="getFriendProfile(conv)?.photoUrl" 
                  :src="getFriendProfile(conv)?.photoUrl" 
                  class="w-full h-full rounded-full object-cover shadow-sm"
                  alt="Avatar"
                />
                <div 
                  v-else 
                  class="w-full h-full rounded-full flex items-center justify-center shadow-sm"
                  :class="[
                    activeConversationId === conv.id
                      ? 'bg-white'
                      : 'bg-zinc-900'
                  ]"
                >
                  <span>{{ getFriendProfile(conv)?.username?.charAt(0) || '?' }}</span>
                </div>
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
                <span
                  class="text-[10px] truncate min-w-0"
                  :class="conv.unreadCount > 0 ? 'text-zinc-200 font-bold' : 'text-zinc-500 font-medium'"
                >
                  {{ getConversationPreview(conv) }}
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
      v-show="activeFriend || (viewportReady && !isMobile)"
      class="inbox-chat-panel flex-1 flex flex-col min-h-0 md:h-full bg-zinc-950/20 relative md:rounded-2xl md:border md:border-zinc-800/80 md:bg-black/60 md:backdrop-blur-xl md:shadow-2xl md:overflow-hidden"
    >
      <!-- Chat Header + Messages + Input (only when a conversation is active) -->
      <template v-if="activeFriend">
        <!-- Chat Header -->
        <div class="inbox-chat-chrome sticky top-0 z-40 px-4 py-2 flex items-center justify-between gap-4 bg-black md:bg-black shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <button 
              v-if="isMobile" 
              @click="deselectConversation"
              class="inline-flex items-center justify-center p-1 -ml-1 text-zinc-500 hover:text-white transition-all flex-shrink-0 cursor-pointer"
              title="Back to list"
            >
              <ChevronLeft class="w-6 h-6" />
            </button>

            <div 
              @click="navigateTo(`/friends/${activeFriend.id}?from=inbox`)"
              class="flex items-center gap-3 cursor-pointer group"
            >
              <UserAvatar
                :src="activeFriend.photoUrl"
                container-class="w-9 h-9 bg-zinc-900 border border-zinc-800 transition-transform group-active:scale-95 group-hover:opacity-80"
                icon-class="w-4 h-4 text-zinc-500"
              />

              <div class="min-w-0">
                <h2 class="text-sm font-bold text-white truncate leading-tight group-hover:text-zinc-300 transition-colors">{{ activeFriend.username }}</h2>
              </div>
            </div>
          </div>

          <button 
            @click="showClearChatModal = true"
            class="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-rose-500 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
            title="Delete Chat"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>

        <!-- Messages Stream Scroll Area -->
        <div 
          ref="scrollContainer"
          class="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-2"
          @scroll="handleScroll"
        >
          <!-- Loading Indicator -->
          <div v-if="messagesLoading && messages.length === 0" class="flex-1 flex items-center justify-center">
            <div class="h-8 w-8 rounded-full border-b-2 border-white animate-spin"></div>
          </div>

          <template v-else>
            <!-- Infinite Scroll Loading Indicator -->
            <div v-if="loadingMore" class="w-full flex justify-center py-4 shrink-0 transition-all duration-300">
              <div class="h-5 w-5 rounded-full border-b-2 border-zinc-500 animate-spin"></div>
            </div>

            <!-- Message Bubbles -->
            <div 
              v-for="(msg, index) in reversedMessages" 
              :key="msg.id"
              class="flex items-end gap-2 group/msg relative"
              :class="[
                msg.senderId === user?.id
                  ? 'w-full max-w-[calc(100%-36px)]'
                  : (msg.replyToActivity && !msg.deletedAt ? 'w-full' : 'max-w-[85%] md:max-w-[70%]'),
                msg.senderId === user?.id 
                  ? 'self-end flex-row-reverse'
                  : 'self-start'
              ]"
            >
              <!-- Avatar slot keeps grouped message rows aligned, hidden for current user -->
              <div v-if="msg.senderId !== user?.id" class="w-7 h-7 shrink-0">
                <div
                  v-if="shouldShowMessageAvatar(msg, index)"
                  data-testid="message-avatar"
                  @click="navigateTo(`/friends/${msg.senderId}?from=inbox`)"
                  class="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-black uppercase text-zinc-300 overflow-hidden shadow-sm cursor-pointer transition-transform active:scale-95 hover:opacity-80"
                >
                  <img
                    v-if="getMessageAvatarUrl(msg)"
                    :src="getMessageAvatarUrl(msg)"
                    class="w-full h-full object-cover"
                    alt="Avatar"
                  />
                  <span v-else>{{ getMessageAvatarInitial(msg) }}</span>
                </div>
              </div>

              <!-- Message Bubble -->
              <div 
                class="inbox-message-bubble rounded-2xl text-sm shadow-md relative break-words select-text font-normal leading-relaxed"
                :class="[
                  msg.senderId === user?.id
                    ? 'inbox-message-bubble-own bg-zinc-100 text-zinc-950'
                    : 'inbox-message-bubble-friend bg-zinc-900 border border-zinc-800/80 text-zinc-100',
                  msg.senderId === user?.id ? 'rounded-br-sm' : 'rounded-bl-sm',
                  msg.replyToActivity && !msg.deletedAt 
                    ? 'p-1 w-full flex-1 min-w-[280px] sm:min-w-[320px] flex flex-col' 
                    : (msg.senderId === user?.id ? 'px-3.5 py-2.5 min-w-[50px] max-w-[85%] md:max-w-[70%]' : 'px-3.5 py-2.5 min-w-[50px]')
                ]"
              >
                <!-- Visual Activity Reply Card (Embedded permanently inside message with permanent dark background) -->
                <div 
                  v-if="msg.replyToActivity && !msg.deletedAt" 
                  class="p-3 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 flex flex-col gap-2 select-none w-full"
                  :class="hasReplyActivityHabit(msg.replyToActivity) ? 'cursor-pointer hover:bg-zinc-900/80 transition-colors active:scale-[0.99]' : ''"
                  :role="hasReplyActivityHabit(msg.replyToActivity) ? 'button' : undefined"
                  :tabindex="hasReplyActivityHabit(msg.replyToActivity) ? 0 : undefined"
                  :title="hasReplyActivityHabit(msg.replyToActivity) ? 'View habit details' : undefined"
                  @click="openReplyActivityHabit(msg.replyToActivity)"
                  @keydown.enter.prevent="openReplyActivityHabit(msg.replyToActivity)"
                  @keydown.space.prevent="openReplyActivityHabit(msg.replyToActivity)"
                >
                  <!-- Card Header: User Avatar + Name + Action Message -->
                  <div class="flex items-center gap-2 w-full">
                    <div class="flex items-center gap-2 min-w-0">
                      <UserAvatar 
                        :src="msg.replyToActivity.user.photoUrl" 
                        container-class="w-6 h-6"
                        icon-class="w-3 h-3 text-zinc-700"
                      />
                      <span class="text-[11px] leading-tight font-black text-white truncate">
                        {{ msg.replyToActivity.user.name }}
                      </span>
                    </div>
                    <div
                      class="text-[11px] leading-tight min-w-0 break-words text-zinc-300 flex-1"
                      :class="msg.replyToActivity.type === 'HABIT_REPLY' ? 'text-right' : ''"
                    >
                      <span v-if="msg.replyToActivity.type !== 'HABIT_REPLY'" class="font-black text-white mr-1"></span>
                      <span class="text-zinc-500" v-html="formatActivityMessageInline(msg.replyToActivity.message)"></span>
                    </div>
                  </div>

                  <!-- Card Body: Weekly status grid if available (Takes up whole width naturally) -->
                  <HabitLogVisualizer 
                    v-if="msg.replyToActivity.weeklyStatus"
                    :title="msg.replyToActivity.habit.title"
                    :streakCount="msg.replyToActivity.streakCount"
                    :streak-anchor-date="msg.replyToActivity.streakAnchorDate"
                    :frequency-text="msg.replyToActivity.frequencyText"
                    :reference-date="today"
                    :weeklyStatus="msg.replyToActivity.weeklyStatus"
                    compact
                  />
                </div>

                <div
                  v-if="msg.replyToActivity && !msg.deletedAt"
                  class="w-fit max-w-[85%] md:max-w-[70%] flex flex-col"
                  :class="msg.senderId === user?.id ? 'self-end' : 'self-start'"
                >
                  <!-- Tombstone Deleted State / Message Body -->
                  <div 
                    v-if="msg.deletedAt" 
                    class="text-zinc-500 italic select-none px-2.5 pt-2 pb-1"
                  >
                    This message was deleted.
                  </div>
                  <div 
                    v-else 
                    class="whitespace-pre-wrap px-2.5 pt-2 pb-1"
                  >
                    {{ msg.body }}
                  </div>
                  
                  <!-- Message Actions inside bubble -->
                  <div
                    class="flex items-center gap-1 px-2.5 pb-1"
                    :class="msg.senderId === user?.id ? 'justify-end' : 'justify-start'"
                  >
                    <span 
                      class="block text-[10px] select-none font-bold tracking-tight shrink-0"
                      :class="msg.senderId === user?.id ? 'text-zinc-600' : 'text-zinc-500'"
                    >
                      {{ formatTime(msg.createdAt) }}
                    </span>
                    <button
                      v-if="canQuickDeleteMessage(msg)"
                      @click.stop="requestDeleteMessage(msg)"
                      class="p-0.5 -mr-0.5 text-zinc-500 hover:text-rose-500 transition-colors cursor-pointer rounded"
                      title="Delete message"
                    >
                      <Trash2 class="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <template v-else>
                  <!-- Tombstone Deleted State / Message Body -->
                  <div 
                    v-if="msg.deletedAt" 
                    class="text-zinc-500 italic select-none"
                  >
                    This message was deleted.
                  </div>
                  <div 
                    v-else 
                    class="whitespace-pre-wrap"
                  >
                    {{ msg.body }}
                  </div>
                  
                  <!-- Message Actions inside bubble -->
                  <div
                    class="flex items-center gap-1 mt-1"
                    :class="msg.senderId === user?.id ? 'justify-end' : 'justify-start'"
                  >
                    <span 
                      class="block text-[10px] select-none font-bold tracking-tight shrink-0"
                      :class="msg.senderId === user?.id ? 'text-zinc-600' : 'text-zinc-500'"
                    >
                      {{ formatTime(msg.createdAt) }}
                    </span>
                    <button
                      v-if="canQuickDeleteMessage(msg)"
                      @click.stop="requestDeleteMessage(msg)"
                      class="p-0.5 -mr-0.5 text-zinc-500 hover:text-rose-500 transition-colors cursor-pointer rounded"
                      title="Delete message"
                    >
                      <Trash2 class="w-3 h-3" />
                    </button>
                  </div>
                </template>
              </div>

            </div>

          </template>
        </div>

        <!-- Input Send Panel -->
        <div class="inbox-chat-chrome z-40 p-2 bg-black md:bg-black shrink-0 flex flex-col gap-2">
          <!-- Static Reply Context Card Preview (IG Story style) -->
          <div 
            v-if="replyActivityContext" 
            class="bg-zinc-925 border border-zinc-800 rounded-xl p-3 flex flex-col gap-2 shadow-xl relative select-none ml-[44px] mr-2"
          >
            <!-- Close Button -->
            <button 
              @click="clearReplyContext"
              class="absolute top-2 right-2 p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Cancel reply"
            >
              <X class="w-3.5 h-3.5" />
            </button>

            <!-- Card Header: User Avatar + Name + Action Message -->
            <div class="flex items-center gap-2 pr-6">
              <div class="flex items-center gap-2 min-w-0">
                <UserAvatar 
                  :src="replyActivityContext.user.photoUrl" 
                  container-class="w-6 h-6"
                  icon-class="w-3 h-3 text-zinc-700"
                />
                <span class="text-[11px] leading-tight font-black text-white truncate">
                  {{ replyActivityContext.user.name }}
                </span>
              </div>
              <div
                class="text-[11px] leading-tight min-w-0 truncate text-zinc-300 flex-1"
                :class="replyActivityContext.type === 'HABIT_REPLY' ? 'text-right' : ''"
              >
                <span v-html="formatActivityMessageInline(replyActivityContext.message)"></span>
              </div>
            </div>

            <!-- Card Body: Weekly status grid if available -->
            <HabitLogVisualizer 
              v-if="replyActivityContext.weeklyStatus"
              :title="replyActivityContext.habit.title"
              :streakCount="replyActivityContext.streakCount"
              :streak-anchor-date="replyActivityContext.streakAnchorDate"
              :frequency-text="replyActivityContext.frequencyText"
              :reference-date="today"
              :weeklyStatus="replyActivityContext.weeklyStatus"
              compact
            />
          </div>

          <div class="flex items-end gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 focus-within:border-zinc-700 transition-colors shadow-inner relative">
            <textarea
              ref="messageTextareaRef"
              v-model="messageBody"
              placeholder="Type your message..."
              class="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-none resize-none max-h-28 min-h-[20px] overflow-y-auto font-normal leading-normal self-center align-middle"
              rows="1"
              maxlength="5000"
              @input="syncMessageTextareaHeight"
              @keydown.enter.exact.prevent="handleEnterKey"
              @paste="handleMessagePaste"
              @keydown="handleMessageKeydown"
            ></textarea>

            <div class="flex items-center gap-3 shrink-0 self-end">
              <button 
                @click="sendMessage"
                class="p-2 bg-white hover:bg-zinc-200 text-black rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:hover:bg-white disabled:active:scale-100 cursor-pointer flex items-center justify-center"
                :disabled="!canSend"
              >
                <Send class="w-3.5 h-3.5" />
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
            <div class="px-3 pt-2 pb-1">
              <input
                v-model="friendSearchQuery"
                type="text"
                placeholder="Filter friends..."
                class="w-full bg-zinc-900 border border-zinc-800 text-white text-sm rounded-xl px-4 py-2 focus:outline-none focus:border-zinc-700 transition-colors"
              />
            </div>

            <div class="flex-1 overflow-y-auto p-2 space-y-1">
              <div v-if="friends.length === 0" class="py-12 text-center text-zinc-500 italic text-sm">
                You don't have any friends yet. Go to the
                <button type="button" @click="goToFriendsSection" class="text-zinc-200 hover:text-white underline underline-offset-2 transition-colors cursor-pointer">
                  Friends
                </button>
                section to add them.
              </div>
              <div v-else-if="filteredFriends.length === 0" class="py-12 text-center text-zinc-500 italic text-sm">
                No friends found matching your filter.
              </div>
              
              <button
                v-for="friend in filteredFriends"
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
                  <div class="flex items-center gap-1.5">
                    <div class="text-sm font-bold text-white truncate">{{ friend.username }}</div>
                    <Star v-if="friend.isFavorite" class="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Clear Chat Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showClearChatModal" class="fixed inset-0 z-[150] flex flex-col items-center justify-start overflow-y-auto p-4 sm:py-8">
          <div class="fixed inset-0 bg-black/80 backdrop-blur-md touch-none" @click="showClearChatModal = false"></div>
          
          <div class="relative my-auto w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center select-none">
            <div class="w-16 h-16 bg-zinc-900 border border-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 class="w-8 h-8 text-zinc-400" />
            </div>
            
            <h2 class="text-xl font-bold text-white mb-2">Delete Chat?</h2>
            
            <p class="text-zinc-500 mb-8 text-sm">
              Your friend will still see the messages. Once your copy is deleted, it can no longer be undone.
            </p>
            
            <div class="flex gap-3 mt-2">
              <button 
                @click="showClearChatModal = false"
                class="flex-1 px-5 py-3 bg-transparent hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap"
                :disabled="isClearingChat"
              >
                Cancel
              </button>
              <button 
                @click="clearChat"
                class="flex-1 px-5 py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                :disabled="isClearingChat"
              >
                <template v-if="isClearingChat">
                  <div class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Deleting...
                </template>
                <template v-else>
                  Delete Chat
                </template>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Message Confirmation Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="messagePendingDelete" class="fixed inset-0 z-[150] flex flex-col items-center justify-start overflow-y-auto p-4 sm:py-8">
          <div class="fixed inset-0 bg-black/80 backdrop-blur-md touch-none" @click="messagePendingDelete = null"></div>
          
          <div class="relative my-auto w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center select-none">
            <div class="w-16 h-16 bg-zinc-900 border border-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 class="w-8 h-8 text-zinc-400" />
            </div>
            
            <h2 class="text-xl font-bold text-white mb-2">Delete Message?</h2>
            
            <p class="text-zinc-500 mb-8 text-sm">
              This deletes the message for both you and your friend. Once deleted, it cannot be undone.
            </p>
            
            <div class="flex gap-3 mt-2">
              <button 
                @click="messagePendingDelete = null"
                class="flex-1 px-5 py-3 bg-transparent hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap"
                :disabled="isDeletingMessage"
              >
                Cancel
              </button>
              <button 
                @click="deletePendingMessage"
                class="flex-1 px-5 py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                :disabled="isDeletingMessage"
              >
                <template v-if="isDeletingMessage">
                  <div class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Deleting...
                </template>
                <template v-else>
                  Delete
                </template>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <HabitDetailsModal
      v-model="showHabitModal"
      :habit="selectedHabit"
      :logs="selectedHabitLogs"
      :loading="calendarLoading"
      @month-changed="handleInboxHabitMonthChanged"
    />

  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'inbox' });
import { 
  MessageCircle, 
  SquarePen, 
  Trash2, 
  Send, 
  X, 
  ChevronLeft,
  Star
} from 'lucide-vue-next';
import { format, formatDistanceToNow, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { useSocial, type UserProfile } from '~/composables/useSocial';
import { useAuth } from '~/composables/useAuth';
import { useToast } from '~/composables/useToast';
import { useChatInbox, type ChatInboxConversation } from '~/composables/useChatInbox';
import { autoExpandTextarea } from '~/utils/ui';
import { formatActivityMessageInline } from '~/utils/feed';

definePageMeta({ middleware: 'auth' });

useSeoMeta({
  title: 'Inbox - Habits Social',
  description: 'Connect and chat securely with your friends on Habits Social.',
});

const { user } = useAuth();
const route = useRoute();
const router = useRouter();
const { friends, profilesMap, init: initSocial, refresh: refreshSocial } = useSocial();
const { showToast } = useToast();
const { isOnline } = useNetwork();
const { today } = useStableToday();
const {
  conversations,
  isLoading: conversationsLoading,
  refresh: refreshChatInbox,
  markConversationReadLocally,
  updateOptimisticPreview
} = useChatInbox();

const requireOnlineAction = (): boolean => {
  if (isOnline.value) return true;
  showToast('This action needs an internet connection.', 'failed');
  return false;
};

interface ActivityReplyCard {
  id: string;
  type: string;
  user: {
    id: string;
    name: string;
    photoUrl?: string | null;
  };
  habit: {
    id?: string | null;
    title: string;
  };
  habits?: {
    id?: string | null;
    title: string;
  }[];
  message: string;
  date: string;
  timestamp: string | Date;
  weeklyStatus?: {
    date: string;
    status: string | undefined;
  }[];
  streakCount?: number;
  streakAnchorDate?: string | null;
  frequencyText?: string;
}

interface InboxHabit {
  id: string;
  title: string;
  description?: string | null;
  currentStreak?: number | null;
  skipsPeriod?: string | null;
  skipsCount?: number | null;
  [key: string]: unknown;
}

interface InboxHabitLog {
  id: string;
  habitId: string;
  date: string;
  status?: string | null;
  [key: string]: unknown;
}

interface HabitDetailsResponse {
  data: {
    habit: InboxHabit;
    logs: InboxHabitLog[];
  };
}

const replyActivityContext = useState<ActivityReplyCard | null>('chat-reply-activity-context', () => null);
const MESSAGE_QUICK_DELETE_MS = 5 * 60 * 1000;

const clearReplyContext = () => {
  replyActivityContext.value = null;
};

interface InboxMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  body: string;
  replyToActivity?: ActivityReplyCard | null;
  deletedAt: string | Date | null;
  createdAt: string | Date;
  isOptimistic?: boolean;
}

interface PaginatedMessagesResponse {
  messages: InboxMessage[];
  hasMore: boolean;
  cursor?: string | null;
}

const getErrorStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') return undefined;
  const record = error as Record<string, unknown>;
  return typeof record.statusCode === 'number' ? record.statusCode : undefined;
};

const activeConversationId = ref<string | null>(null);
const activeFriend = ref<UserProfile | null>(null);
const messages = ref<InboxMessage[]>([]);
const reversedMessages = computed(() => [...messages.value].reverse());
const conversationsScrollContainer = ref<HTMLElement | null>(null);
const sharedActiveConversationId = useState<string | null>('realtime-active-conversation-id', () => null);
const activeChatLocked = useState<boolean>('realtime-active-chat-locked', () => false);
const chatRefreshSequence = useState<number>('realtime-chat-refresh-sequence', () => 0);
const showHabitModal = ref(false);
const selectedHabit = ref<InboxHabit | null>(null);
const selectedHabitLogs = ref<InboxHabitLog[]>([]);
const calendarLoading = ref(false);

const getReplyActivityHabitId = (activity: ActivityReplyCard | null | undefined): string | null => {
  const habitId = activity?.habit?.id;
  return typeof habitId === 'string' && habitId.length > 0 ? habitId : null;
};

const hasReplyActivityHabit = (activity: ActivityReplyCard | null | undefined): boolean => {
  return getReplyActivityHabitId(activity) !== null;
};

const openReplyActivityHabit = async (activity: ActivityReplyCard | null | undefined) => {
  if (!requireOnlineAction()) return;
  const habitId = getReplyActivityHabitId(activity);
  if (!habitId) return;

  calendarLoading.value = true;
  showHabitModal.value = false;
  selectedHabit.value = null;
  selectedHabitLogs.value = [];

  try {
    const { data } = await $fetch<HabitDetailsResponse>('/api/social/habit-details', { query: { habitId } });
    selectedHabit.value = data.habit;
    selectedHabitLogs.value = data.logs;
    showHabitModal.value = true;
  } catch (error: unknown) {
    console.error('[Inbox] Failed to fetch reply habit details:', error);
    if (getErrorStatus(error) === 404) {
      showToast('This habit is no longer shared with you', 'failed');
    }
  } finally {
    calendarLoading.value = false;
  }
};

const handleInboxHabitMonthChanged = async (newDate: Date) => {
  if (!requireOnlineAction()) return;
  if (!selectedHabit.value) return;

  const start = format(startOfMonth(newDate), 'yyyy-MM-dd');
  const end = format(endOfMonth(newDate), 'yyyy-MM-dd');
  calendarLoading.value = true;

  try {
    const { data } = await $fetch<HabitDetailsResponse>('/api/social/habit-details', {
      query: {
        habitId: selectedHabit.value.id,
        startDate: start,
        endDate: end
      }
    });

    data.logs.forEach((newLog) => {
      const existingIndex = selectedHabitLogs.value.findIndex((log) => log.id === newLog.id);
      if (existingIndex >= 0) {
        selectedHabitLogs.value[existingIndex] = newLog;
      } else {
        selectedHabitLogs.value.push(newLog);
      }
    });
  } catch (error: unknown) {
    console.error('[Inbox] Failed to fetch reply habit month:', error);
    if (getErrorStatus(error) === 404) {
      showToast('This habit is no longer shared with you', 'failed');
      showHabitModal.value = false;
    }
  } finally {
    calendarLoading.value = false;
  }
};

// Loading states
const messagesLoading = ref(false);
const loadingMore = ref(false);

// Input states
const messageBody = ref('');
const hasMore = ref(false);

// Per-conversation draft storage (keyed by friend ID) — preserves unsent messages
// and activity reply context when switching conversations or leaving and returning
const conversationDrafts = ref<Record<string, { body: string; replyActivity: ActivityReplyCard | null }>>({});

const saveCurrentDraft = () => {
  if (!activeFriend.value?.id) return;
  conversationDrafts.value[activeFriend.value.id] = {
    body: messageBody.value,
    replyActivity: replyActivityContext.value ? { ...replyActivityContext.value } : null
  };
};

const loadDraft = (friendId: string) => {
  const draft = conversationDrafts.value[friendId];
  if (draft) {
    messageBody.value = draft.body;
    replyActivityContext.value = draft.replyActivity ? { ...draft.replyActivity } : null;
  } else {
    messageBody.value = '';
    replyActivityContext.value = null;
  }
};

const clearCurrentDraft = () => {
  if (!activeFriend.value?.id) return;
  delete conversationDrafts.value[activeFriend.value.id];
};

// Intercept browser/mobile back while a chat is open → go to conversation list instead
const handlePopState = (event: PopStateEvent) => {
  if (event.state?.inboxChat && event.state?.friendId) {
    if (!activeFriend.value || activeFriend.value.id !== event.state.friendId) {
      restoreConversationFromHistory(event.state.friendId);
    }
  } else {
    if (activeFriend.value) {
      deselectConversation();
    }
  }
};

// Push a history state entry so the browser's back button
// navigates to a "conversation list" state rather than leaving /inbox entirely
const pushChatHistory = () => {
  if (activeFriend.value?.id) {
    history.pushState({
      ...history.state,
      inboxChat: true,
      friendId: activeFriend.value.id,
      conversationId: activeConversationId.value
    }, '');
  }
};

const nextCursor = ref<string | null>(null);
const friendSearchQuery = ref('');

// Modal/Responsive toggles
const showNewChatModal = ref(false);
const showClearChatModal = ref(false);
const isMobile = ref(false);
const viewportReady = ref(false);
const isClearingChat = ref(false);
const messagePendingDelete = ref<InboxMessage | null>(null);
const isDeletingMessage = ref(false);

const filteredFriends = computed(() => {
  let list = friends.value;
  if (friendSearchQuery.value.trim()) {
    const q = friendSearchQuery.value.toLowerCase().trim();
    list = friends.value.filter(friend => friend.username.toLowerCase().includes(q));
  }
  return [...list].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return (a.username || '').localeCompare(b.username || '');
  });
});

watch(showNewChatModal, (val) => {
  if (!val) {
    friendSearchQuery.value = '';
  }
});

const goToFriendsSection = async () => {
  if (!requireOnlineAction()) return;
  showNewChatModal.value = false;
  await navigateTo({ path: '/social', query: { tab: 'friends' } }, { replace: true });
};

// Refs
const scrollContainer = ref<HTMLElement | null>(null);
const messageTextareaRef = ref<HTMLTextAreaElement | null>(null);
const savedScrollTop = ref<number | null>(null);

// Computed validators
const canSend = computed(() => {
  const trimmed = messageBody.value.trim();
  return trimmed.length > 0 && trimmed.length <= 1000 && !activeChatLocked.value;
});

const syncMessageTextareaHeight = () => {
  if (messageTextareaRef.value) {
    autoExpandTextarea(messageTextareaRef.value);
  }
};

const handleMessagePaste = (event: ClipboardEvent) => {
  const pastedText = event.clipboardData?.getData('text') || '';
  const currentLength = messageBody.value.length;
  // Account for any selected text that will be replaced
  const selectionLength = window.getSelection()?.toString().length || 0;
  
  if (currentLength - selectionLength + pastedText.length > 5000) {
    showToast('You cannot exceed 5000 characters.', 'failed');
  }
};

const handleMessageKeydown = (event: KeyboardEvent) => {
  // Allow backspace, delete, arrows, and other control keys
  const isControlKey = event.key.length > 1 || event.ctrlKey || event.metaKey || event.altKey;
  if (!isControlKey && messageBody.value.length >= 5000) {
    showToast('You cannot exceed 5000 characters.', 'failed');
  }
};

const createOptimisticMessageId = (): string => {
  const webCrypto = globalThis.crypto;

  if (typeof webCrypto?.randomUUID === 'function') {
    return `optimistic-${webCrypto.randomUUID()}`;
  }

  if (typeof webCrypto?.getRandomValues === 'function') {
    const randomValues = new Uint32Array(2);
    webCrypto.getRandomValues(randomValues);
    return `optimistic-${Date.now().toString(36)}-${Array.from(randomValues, value => value.toString(36)).join('')}`;
  }

  return `optimistic-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};



// Load Conversations list from backend
const loadConversations = async (silent = false, preserveLoading = false) => {
  if (!isOnline.value) return;
  try {
    await refreshChatInbox(silent, preserveLoading);
  } catch (error: unknown) {
    console.error('[Inbox] Failed to load conversations:', error);
    showToast('Failed to load conversations', 'failed');
  }
};

const refreshConversations = async () => {
  if (!isOnline.value) return;
  try {
    await Promise.all([
      refreshChatInbox(false, true),
      refreshSocial()
    ]);
  } catch (error: unknown) {
    console.error('[Inbox] Failed to refresh conversations:', error);
    showToast('Failed to load conversations', 'failed');
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
const getFriendProfile = (conv: ChatInboxConversation) => {
  if (!user.value?.id) return null;
  const otherId = conv.user1Id === user.value.id ? conv.user2Id : conv.user1Id;
  return otherId ? profilesMap.value[otherId] || null : null;
};

const getConversationPreview = (conv: ChatInboxConversation) => {
  if (!getFriendProfile(conv)) return 'Conversation archived';
  if (conv.lastMessageDeletedAt) return 'This message was deleted.';

  const preview = conv.lastMessageBody?.trim();
  if (!preview) return 'No messages yet.';

  return conv.lastMessageSenderId === user.value?.id ? `You: ${preview}` : preview;
};

const markConversationRead = async (conversationId: string) => {
  if (!isOnline.value) return;
  try {
    await $fetch(`/api/chat/conversations/${conversationId}/read`, { method: 'POST' });
    markConversationReadLocally(conversationId);
  } catch (e) {
    console.warn('[Inbox] Failed to mark as read', e);
  }
};

// Pure conversation setup (no draft management — callers handle drafts)
const selectConversation = async (conv: ChatInboxConversation) => {
  const profile = getFriendProfile(conv);
  if (!profile) {
    showToast('Cannot chat with inactive users', 'failed');
    return;
  }
  activeFriend.value = profile;
  activeConversationId.value = conv.id;
  sharedActiveConversationId.value = conv.id;
  activeChatLocked.value = false;
  messages.value = [];
  savedScrollTop.value = null; // Clear scroll memory for new conversation
  
  await loadMessages();
  
  // Mark as read after load
  if (conv.unreadCount > 0) {
    await markConversationRead(conv.id);
  }
};

// Draft-aware conversation switch (used by sidebar click)
const switchToConversation = async (conv: ChatInboxConversation) => {
  saveCurrentDraft();
  await selectConversation(conv);
  loadDraft(activeFriend.value?.id || '');
  pushChatHistory();
};

const restoreConversationFromHistory = async (friendId: string) => {
  if (!isOnline.value) return;
  if (friends.value.length === 0) {
    await refreshSocial();
  }
  const friend = friends.value.find(f => f.id === friendId);
  if (!friend) return;
  
  showNewChatModal.value = false;
  saveCurrentDraft();
  
  activeFriend.value = friend;
  activeChatLocked.value = false;
  
  const existingConv = conversations.value.find(conv => {
    const otherId = conv.user1Id === user.value?.id ? conv.user2Id : conv.user1Id;
    return otherId === friend.id;
  });

  if (existingConv) {
    savedScrollTop.value = null; // Clear scroll memory
    await selectConversation(existingConv);
    loadDraft(friend.id);
  } else {
    activeConversationId.value = null;
    messages.value = [];
    sharedActiveConversationId.value = null;
    savedScrollTop.value = null; // Clear scroll memory
    loadDraft(friend.id);
  }
};

// Select a friend from the New Conversation Modal (draft-aware)
const selectFriend = async (friend: UserProfile) => {
  showNewChatModal.value = false;
  saveCurrentDraft();
  
  activeFriend.value = friend;
  activeChatLocked.value = false;
  
  // Check if we already have an active conversation with this friend
  const existingConv = conversations.value.find(conv => {
    const otherId = conv.user1Id === user.value?.id ? conv.user2Id : conv.user1Id;
    return otherId === friend.id;
  });

  if (existingConv) {
    savedScrollTop.value = null; // Clear scroll memory
    await selectConversation(existingConv);
    loadDraft(friend.id);
  } else {
    activeConversationId.value = null;
    messages.value = [];
    sharedActiveConversationId.value = null;
    savedScrollTop.value = null; // Clear scroll memory
    loadDraft(friend.id);
  }
  pushChatHistory();
};

const deselectConversation = () => {
  // Save draft before leaving so it's restored when returning
  saveCurrentDraft();
  const hadActiveFriend = !!activeFriend.value;
  activeFriend.value = null;
  activeConversationId.value = null;
  sharedActiveConversationId.value = null;
  activeChatLocked.value = false;
  messages.value = [];
  savedScrollTop.value = null; // Clear scroll memory
  // If called from the UI (not popstate), clean up the history state we pushed
  if (hadActiveFriend && window.history.state?.inboxChat) {
    window.history.back();
  }
};

// Load messages in the active conversation
const loadMessages = async (cursor: string | null = null, autoScroll = true) => {
  if (!isOnline.value) return;
  if (!activeConversationId.value) return;
  
  const isPaginating = !!cursor;
  if (isPaginating) {
    loadingMore.value = true;
  } else {
    messagesLoading.value = true;
  }

  try {
    const query: Record<string, string | number> = { limit: 50 };
    if (cursor) query.cursor = cursor;

    const data = await $fetch<PaginatedMessagesResponse>(`/api/chat/conversations/${activeConversationId.value}/messages`, { query });
    
    if (isPaginating) {
      // Append older messages — they go to the end of the array so they appear at the visual top when reversed
      const prevScrollHeight = scrollContainer.value?.scrollHeight ?? 0;
      messages.value = [...messages.value, ...(data.messages || [])];
      // Preserve scroll position after prepending: the new content pushes existing content down
      await nextTick();
      if (scrollContainer.value) {
        scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight - prevScrollHeight;
      }
    } else {
      messages.value = data.messages || [];
      if (autoScroll) {
        // Scroll to bottom after layout settles (async images, visualizers, etc.)
        await scrollToBottomSettled();
      }
    }

    hasMore.value = data.hasMore;
    nextCursor.value = data.cursor || null;
  } catch (error: unknown) {
    console.error('[Inbox] Failed to load messages:', error);
    showToast('Failed to load messages', 'failed');
  } finally {
    messagesLoading.value = false;
    loadingMore.value = false;
  }
};

// Load older messages (pagination)
const loadOlderMessages = async () => {
  if (hasMore.value && nextCursor.value && !loadingMore.value) {
    await loadMessages(nextCursor.value);
  }
};

const shouldShowMessageAvatar = (msg: InboxMessage, index: number) => {
  if (!msg.senderId) return false;

  // reversedMessages iterates oldest-first (top of scroll) to newest (bottom).
  // The "newer" message (visually below) is at the next index in reversedMessages.
  const newerMessage = reversedMessages.value[index + 1];
  return !newerMessage || newerMessage.senderId !== msg.senderId;
};

const getMessageAvatarUrl = (msg: InboxMessage) => {
  if (msg.senderId === user.value?.id) return user.value.photoUrl || '';
  if (msg.senderId === activeFriend.value?.id) return activeFriend.value.photoUrl || '';
  return '';
};

const getMessageAvatarInitial = (msg: InboxMessage) => {
  if (msg.senderId === user.value?.id) return user.value.username.charAt(0) || '?';
  if (msg.senderId === activeFriend.value?.id) return activeFriend.value.username.charAt(0) || '?';
  return '?';
};

// Send message to the selected friend
const sendMessage = async () => {
  if (!requireOnlineAction()) return;
  if (!canSend.value || !activeFriend.value || !user.value?.id) return;
  
  const text = messageBody.value.trim();
  const targetFriendId = activeFriend.value.id;
  const replyToActivity = replyActivityContext.value ? { ...replyActivityContext.value } : null;
  const optimisticMessageId = createOptimisticMessageId();
  const optimisticMessage: InboxMessage = {
    id: optimisticMessageId,
    conversationId: activeConversationId.value || `pending-${targetFriendId}`,
    senderId: user.value.id,
    body: text,
    replyToActivity,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    isOptimistic: true
  };

  messages.value = [optimisticMessage, ...messages.value];
  updateOptimisticPreview(targetFriendId, text, user.value.id, optimisticMessage.createdAt);
  messageBody.value = '';
  clearReplyContext();
  await nextTick();
  syncMessageTextareaHeight();
  await scrollToBottomSettled();

  try {
    const response = await $fetch<InboxMessage>(`/api/chat/conversations/by-friend/${targetFriendId}/messages`, {
      method: 'POST',
      body: { 
        body: text,
        replyToActivity: replyToActivity || undefined
      }
    });

    const optimisticIndex = messages.value.findIndex(message => message.id === optimisticMessageId);
    if (optimisticIndex !== -1) {
      messages.value[optimisticIndex] = response;
    }
    
    // Set active conversation ID if it wasn't set (first message)
    if (!activeConversationId.value && activeFriend.value?.id === targetFriendId) {
      activeConversationId.value = response.conversationId;
      sharedActiveConversationId.value = response.conversationId;
    }

    await scrollToBottomSettled();

    // Refresh conversations list silently
    await loadConversations(true);
    // Clear the draft for this conversation after successful send
    clearCurrentDraft();
  } catch (error: unknown) {
    messages.value = messages.value.filter(message => message.id !== optimisticMessageId);
    await loadConversations(true);
    if (activeFriend.value?.id === targetFriendId && messageBody.value.trim().length === 0) {
      messageBody.value = text;
      await nextTick();
      syncMessageTextareaHeight();
    }
    if (!replyActivityContext.value && replyToActivity) {
      replyActivityContext.value = replyToActivity;
    }

    console.error('[Inbox] Failed to send message:', error);
    if (getErrorStatus(error) === 429) {
      showToast('Rate limit exceeded. Please wait a moment.', 'failed');
    } else {
      showToast('Failed to send message', 'failed');
    }
  }
};

// Clear the entire chat history for the current user
const clearChat = async () => {
  if (!requireOnlineAction()) return;
  if (!activeConversationId.value || isClearingChat.value) return;
  
  isClearingChat.value = true;
  try {
    await $fetch(`/api/chat/conversations/${activeConversationId.value}/clear`, { method: 'POST' });
    
    showToast('Chat history cleared', 'completed');
    showClearChatModal.value = false;
    deselectConversation();
    await loadConversations(true); // Silently refresh inbox list to remove it
  } catch (error: unknown) {
    console.error('[Inbox] Failed to clear chat:', error);
    showToast('Failed to clear chat', 'failed');
  } finally {
    isClearingChat.value = false;
  }
};

const isWithinQuickDeleteWindow = (msg: InboxMessage): boolean => {
  const createdAt = new Date(msg.createdAt).getTime();
  if (!Number.isFinite(createdAt)) return false;
  return Date.now() - createdAt < MESSAGE_QUICK_DELETE_MS;
};

const canQuickDeleteMessage = (msg: InboxMessage): boolean => {
  return msg.senderId === user.value?.id && !msg.deletedAt && !msg.isOptimistic && isWithinQuickDeleteWindow(msg);
};

const requestDeleteMessage = async (msg: InboxMessage) => {
  if (!canQuickDeleteMessage(msg)) return;
  messagePendingDelete.value = msg;
};

const deletePendingMessage = async () => {
  if (!messagePendingDelete.value || isDeletingMessage.value) return;

  isDeletingMessage.value = true;
  const deleted = await confirmDeleteMessage(messagePendingDelete.value.id);
  if (deleted) {
    messagePendingDelete.value = null;
  }
  isDeletingMessage.value = false;
};

// Delete a specific message
const confirmDeleteMessage = async (messageId: string): Promise<boolean> => {
  if (!requireOnlineAction()) return false;
  try {
    await $fetch(`/api/chat/messages/${messageId}`, { method: 'DELETE' });
    
    // Local updates
    const msgIndex = messages.value.findIndex(m => m.id === messageId);
    const existingMessage = messages.value[msgIndex];
    if (msgIndex !== -1 && existingMessage) {
      messages.value[msgIndex] = {
        ...existingMessage,
        body: '',
        deletedAt: new Date().toISOString()
      };
    }
    showToast('Message deleted', 'completed');
    return true;
  } catch (error: unknown) {
    console.error('[Inbox] Failed to delete message:', error);
    showToast('Failed to delete message', 'failed');
    return false;
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
    const diffMs = Date.now() - date.getTime();

    if (Math.abs(diffMs) < 60_000) {
      return 'just now';
    }

    return formatDistanceToNow(date, { addSuffix: true })
      .replace('about ', '');
  } catch {
    return '';
  }
};

// Scroll layout helpers
const scrollToBottom = () => {
  if (!scrollContainer.value) return;
  // Maximum valid scrollTop is scrollHeight - clientHeight.
  // Setting a value beyond this triggers an overscroll bounce on iOS Safari,
  // which blocks new scroll gestures for 300-600ms.
  scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight - scrollContainer.value.clientHeight;
};

// Scroll to bottom after layout settles (waits for async content like images to render)
const scrollToBottomSettled = async () => {
  if (!scrollContainer.value) return;
  // First wait for Vue to finish DOM mutations (messages must be in the DOM)
  await nextTick();
  // Set correct scroll position (no overshoot — avoids triggering browser rubber-band)
  scrollToBottom();
  // Wait one frame for async content (avatars, HabitLogVisualizer) to (mostly) settle
  await new Promise(resolve => requestAnimationFrame(resolve));
  // Re-evaluate in case scrollHeight changed due to async image loads
  if (scrollContainer.value) {
    scrollToBottom();
  }
};

const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement;
  
  // Save the scroll position in real time
  if (activeConversationId.value) {
    savedScrollTop.value = target.scrollTop;
  }

  // flex-col layout: scrollTop starts at 0 (top/oldest) and increases to scrollHeight - clientHeight (bottom/newest).
  // Detect when user has scrolled near the top to load older messages.
  const isAtTop = target.scrollTop <= 10;
  if (isAtTop && hasMore.value && !loadingMore.value) {
    loadOlderMessages();
  }
};

// Mobile responsiveness tracking
const checkViewport = () => {
  isMobile.value = window.innerWidth < 768;
  viewportReady.value = true;
};

const handleReplyQuery = async () => {
  if (!isOnline.value) return;
  const queryFriendId = route.query.replyToFriend as string;
  if (queryFriendId) {
    if (friends.value.length === 0) {
      await refreshSocial();
    }
    const targetFriend = friends.value.find(f => f.id === queryFriendId);
    if (targetFriend) {
      // If there's an externally-set reply context (from social.vue's "Chat about this activity"),
      // pre-save it as a draft for the target friend so it survives through selectFriend's
      // saveCurrentDraft / loadDraft cycle and is not lost.
      if (replyActivityContext.value) {
        const existingDraft = conversationDrafts.value[targetFriend.id] || { body: '', replyActivity: null };
        conversationDrafts.value[targetFriend.id] = {
          body: existingDraft.body,
          replyActivity: { ...replyActivityContext.value }
        };
      }
      await selectFriend(targetFriend);
    }
    // Clear the query parameter so it doesn't re-trigger on back navigation
    const newQuery = { ...route.query };
    delete newQuery.replyToFriend;
    router.replace({ query: newQuery });
  }
};

onMounted(async () => {
  checkViewport();
  window.addEventListener('resize', checkViewport);
  window.addEventListener('popstate', handlePopState);
  window.addEventListener('reset-inbox', deselectConversation);
  
  if (!isOnline.value) return;

  // Hydrate global social profiles first
  initSocial();

  await loadConversations();
  
  if (window.history.state?.inboxChat && window.history.state?.friendId) {
    if (!activeFriend.value || activeFriend.value.id !== window.history.state.friendId) {
      await restoreConversationFromHistory(window.history.state.friendId);
    }
  }
  
  await handleReplyQuery();
});

onActivated(async () => {
  if (!isOnline.value) return;
  if (activeConversationId.value) {
    sharedActiveConversationId.value = activeConversationId.value;
    
    // Restore the saved scroll position or scroll to bottom if none exists
    await nextTick();
    if (scrollContainer.value) {
      if (savedScrollTop.value !== null) {
        scrollContainer.value.scrollTop = savedScrollTop.value;
        // Wait one paint frame to handle slow-rendering visualizers or avatars
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (scrollContainer.value && savedScrollTop.value !== null) {
          scrollContainer.value.scrollTop = savedScrollTop.value;
        }
      } else {
        await scrollToBottomSettled();
      }
    }
  }
  await handleReplyQuery();
});

onDeactivated(() => {
  sharedActiveConversationId.value = null;
});

onUnmounted(() => {
  window.removeEventListener('resize', checkViewport);
  window.removeEventListener('popstate', handlePopState);
  window.removeEventListener('reset-inbox', deselectConversation);
  sharedActiveConversationId.value = null;
});

watch(chatRefreshSequence, async () => {
  if (!isOnline.value) return;
  if (!activeConversationId.value) return;

  // Only auto-scroll to bottom if user was already near the bottom before refresh
  const container = scrollContainer.value;
  const wasNearBottom = container
    ? container.scrollTop + container.clientHeight >= container.scrollHeight - 50
    : true;

  await loadMessages(null, wasNearBottom);

  const activeConversation = conversations.value.find((conversation) => conversation.id === activeConversationId.value);
  if (activeConversation && activeConversation.unreadCount > 0) {
    await markConversationRead(activeConversation.id);
  }
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
