<template>
  <div class="relative">
    <!-- Tab Navigation -->
    <div class="px-4 sm:px-0 sticky top-[57px] z-40 bg-black pt-2 pb-2 sm:mt-2">
      <div class="flex p-1 bg-zinc-925 border border-zinc-800 rounded-xl relative">
        <button 
          @click="activeTab = 'activity'"
          class="flex-1 py-2.5 text-[11px] font-bold tracking-widest uppercase rounded-lg transition-all relative z-10 cursor-pointer"
          :class="activeTab === 'activity' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'"
        >
          Activity
        </button>
        <button 
          @click="activeTab = 'friends'"
          class="flex-1 py-2.5 text-[11px] font-bold tracking-widest uppercase rounded-lg transition-all relative z-10 cursor-pointer flex items-center justify-center gap-2"
          :class="activeTab === 'friends' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'"
        >
          Friends
          <span v-if="pendingIncoming.length > 0 && activeTab !== 'friends'" class="flex w-2 h-2 bg-rose-500 rounded-full"></span>
        </button>
        <!-- Sliding Indicator -->
        <div 
          class="absolute top-1 bottom-1 w-[calc(50%-6px)] bg-zinc-800 rounded-lg transition-all duration-300 ease-out z-0 shadow-sm"
          :class="activeTab === 'activity' ? 'left-1' : 'left-[calc(50%+2px)]'"
        ></div>
      </div>
    </div>

    <!-- Activity Feed Tab -->
    <div v-if="activeTab === 'activity'" v-motion-fade class="space-y-6">
      <div v-if="feedLoading" class="flex justify-center p-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>

      <div v-else-if="!feed || feed.length === 0" class="bg-zinc-925/80 backdrop-blur-sm sm:rounded-2xl rounded-none border-y border-x-0 sm:border border-zinc-800/80 p-10 text-center shadow-2xl flex flex-col items-center">
        <div class="w-16 h-16 bg-zinc-950 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-800">
          <Activity class="w-8 h-8 text-zinc-500" />
        </div>
        <h2 class="text-lg font-bold text-white mb-2">No Activity Yet</h2>
        <p class="text-zinc-500 text-sm max-w-sm mx-auto leading-relaxed">
          Follow friends and share habits to see their progress here!
        </p>
      </div>

      <div v-else class="space-y-2 px-0 sm:px-0">
        <div v-for="(group, date, index) in groupedFeed" :key="date" class="space-y-0">
          <h3 class="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 px-4 sm:px-1 pb-2" :class="index === 0 ? 'mt-2' : 'mt-4'">
            {{ formatFeedDate(String(date)) }}
          </h3>
          
          <div class="space-y-0">
            <div 
              v-for="(item, itemIndex) in group" 
              :key="item.id"
              @click="item.habit?.id ? openHabitDetails(item.habit.id) : (String(item.user.id) !== String(user?.id) ? navigateTo(`/friends/${item.user.id}?from=${activeTab}`) : null)"
              class="group bg-zinc-925/50 hover:bg-zinc-900/80 border-b border-zinc-800/50 last:border-b-0 sm:border-x sm:border-b sm:border-zinc-800/50 p-4 transition-all duration-300 cursor-pointer flex items-center gap-4 shadow-sm"
              :class="[
                itemIndex === 0 ? 'sm:rounded-t-2xl sm:border-t' : '',
                itemIndex === group.length - 1 ? 'sm:rounded-b-2xl' : ''
              ]"
            >
              <!-- Avatar -->
              <UserAvatar 
                @click="String(item.user.id) !== String(user?.id) ? ($event.stopPropagation(), navigateTo(`/friends/${item.user.id}?from=${activeTab}`)) : null"
                :src="item.user.photoUrl" 
                container-class="w-10 h-10 bg-zinc-950 border border-zinc-800 transition-transform cursor-pointer"
                :class="{ 'active:scale-95': String(item.user.id) !== String(user?.id) }"
                icon-class="w-5 h-5 text-zinc-700"
              />

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <div class="text-sm leading-relaxed min-w-0 break-words">
                  <span 
                    @click="String(item.user.id) !== String(user?.id) ? ($event.stopPropagation(), navigateTo(`/friends/${item.user.id}?from=${activeTab}`)) : null"
                    class="font-bold text-zinc-100 transition-colors cursor-pointer mr-1.5"
                    :class="{ 'hover:text-zinc-400': String(item.user.id) !== String(user?.id) }"
                  >
                    {{ item.user.name }}
                  </span>
                  <span class="text-zinc-400" v-html="formatMessage(item.message)" @click="handleMessageClick">
                  </span>
                </div>
                <div class="flex items-center gap-2 mt-1">

                  <span class="text-[10px] font-bold uppercase tracking-wider text-zinc-500 break-words">
                    {{ item.habit.title }}
                  </span>
                </div>
              </div>


            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'friends'" class="space-y-3">
      <div v-if="isLoading" class="flex justify-center p-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
      <template v-else>
        <!-- Incoming Requests Accordion -->
      <div v-if="pendingIncoming.length > 0" v-motion-fade class="bg-zinc-925/80 backdrop-blur-sm sm:rounded-2xl rounded-none border-y border-x-0 sm:border border-zinc-800/80 overflow-hidden shadow-2xl">
      <button @click="isRequestsExpanded = !isRequestsExpanded" 
        class="w-full flex items-center justify-between p-6 hover:bg-white/5 transition-colors cursor-pointer group"
      >
        <div class="flex items-center gap-3">
          <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-500 group-hover:text-zinc-300 transition-colors">
            Friend Requests
          </h2>
          <span class="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-rose-500/20">
            {{ pendingIncoming.length }}
          </span>
        </div>
        <ChevronDown class="w-4 h-4 text-zinc-600 transition-transform duration-300" :class="{ 'rotate-180': isRequestsExpanded }" />
      </button>

      <div v-show="isRequestsExpanded" class="sm:px-6 px-0 pb-6 pt-2">
        <div class="gap-0 flex flex-col max-h-[380px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          <div v-for="req in pendingIncoming" :key="req.id" class="flex items-center justify-between bg-transparent border-none p-4 hover:bg-white/5 transition-colors rounded-none md:rounded-xl">
            <NuxtLink :to="`/friends/${req.initiatorId}?from=${activeTab}`" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <UserAvatar 
                :src="profilesMap[req.initiatorId]?.photourl" 
                container-class="w-10 h-10 bg-zinc-950"
                icon-class="w-5 h-5 text-zinc-600"
              />
              <div>
                <div class="font-semibold text-zinc-200 text-sm">{{ profilesMap[req.initiatorId]?.username || 'Unknown' }}</div>
              </div>
            </NuxtLink>
            <div class="flex gap-2">
              <button @click="acceptRequest(req.id)" class="p-2 bg-white hover:bg-zinc-200 text-black rounded-lg transition-colors cursor-pointer"><Check class="w-4 h-4" /></button>
              <button @click="declineRequest(req.id)" class="p-2 bg-zinc-925 hover:bg-zinc-800 text-zinc-400 rounded-lg transition-colors cursor-pointer"><XIcon class="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Combined Social Sections -->
    <div v-motion-fade class="bg-zinc-925/80 backdrop-blur-sm sm:rounded-2xl rounded-none shadow-2xl border-y border-x-0 sm:border border-zinc-800/80 overflow-hidden">
      <!-- Add Friend -->
      <div class="sm:p-6 sm:pb-0 py-6 pb-0">
        <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-2 px-6 sm:px-0">Add Friend</h2>
        <form @submit.prevent="handleSearch" class="flex gap-3 px-6 sm:px-0">
          <div class="relative w-full max-w-md">
            <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input v-model="searchQuery" type="text" placeholder="Search by username..."
              class="w-full pl-10 pr-4 py-2.5 bg-black border border-zinc-925 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 text-white placeholder-zinc-600 text-sm transition-all" />
          </div>
        </form>

        <div v-if="searchResults.length > 0" class="mt-4 gap-0 flex flex-col max-h-[380px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent pb-4">
          <div v-for="res in searchResults" :key="res.id" class="flex items-center justify-between bg-transparent border-none p-4 hover:bg-white/5 transition-colors rounded-none md:rounded-xl">
            <NuxtLink :to="`/friends/${res.id}?from=${activeTab}`" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <UserAvatar 
                :src="res.photourl" 
                container-class="w-10 h-10 bg-zinc-950"
                icon-class="w-5 h-5 text-zinc-600"
              />
              <div>
                <div class="font-semibold text-zinc-200 text-sm">{{ res.username }}</div>
              </div>
            </NuxtLink>
            <span v-if="getRelationship(res.id)" class="text-xs font-semibold text-zinc-500 bg-zinc-925 px-3 py-1.5 rounded-full">
              {{ getRelationship(res.id) === 'accepted' ? 'Friends' : 'Pending' }}
            </span>
            <button v-else @click="confirmSendRequest(res)" class="flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-200 text-black rounded-xl transition-colors font-semibold text-sm cursor-pointer">
              <UserPlus class="w-4 h-4" /> Add
            </button>
          </div>
        </div>
      </div>

      <!-- Friends List -->
      <div class="sm:p-6 py-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 sm:pr-1 px-6 sm:px-0">
          <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-500">My Friends</h2>
          <div class="relative w-full sm:max-w-[240px]">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              v-model="friendsSearchQuery"
              type="text" 
              placeholder="Filter friends..." 
              class="w-full pl-10 pr-4 py-2.5 bg-black border border-zinc-925 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 text-white placeholder-zinc-600 text-sm transition-all"
            />
          </div>
        </div>
        
        <p v-if="displayFriends.length === 0" class="text-zinc-600 text-sm italic px-6 sm:px-0">No friends yet. Search for people above!</p>
        <p v-else-if="filteredDisplayFriends.length === 0" class="text-zinc-600 text-sm italic px-6 sm:px-0">No friends found matching your filter.</p>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-0 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          <div 
            v-for="f in filteredDisplayFriends" :key="f.id"
            @click="handleFriendClick(f)"
            class="flex items-center gap-4 p-4 bg-transparent border-none transition-all group cursor-pointer hover:bg-white/5 rounded-none md:rounded-xl"
          >
            <UserAvatar 
              :src="profilesMap[getFriendId(f)]?.photourl" 
              container-class="w-12 h-12 bg-zinc-950"
              icon-class="w-6 h-6 text-zinc-600"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <div class="font-semibold text-zinc-200 truncate transition-colors text-sm" :class="{ 'group-hover:text-zinc-400': f.status === 'accepted' }">
                  {{ profilesMap[getFriendId(f)]?.username || 'Unknown' }}
                </div>
                <span v-if="f.status === 'pending'" class="text-[10px] font-bold uppercase tracking-widest text-zinc-600 bg-zinc-925 px-2 py-0.5 rounded-md shrink-0">
                  Pending
                </span>
              </div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <button 
                v-if="f.status === 'accepted'"
                @click.stop="handleToggleFavorite(f)" 
                class="p-2 transition-all cursor-pointer rounded-xl"
                :class="isFriendshipFavorite(f) ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-600 hover:text-amber-400 hover:bg-amber-400/5'"
                title="Favorite"
              >
                <Star class="w-4 h-4" :class="{ 'fill-amber-400': isFriendshipFavorite(f) }" />
              </button>
              <button 
                @click.stop="confirmUnfriend(f)" 
                class="p-2 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                :title="f.status === 'pending' ? 'Cancel Request' : 'Unfriend'"
              >
                <XIcon class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
</div>

    <!-- Unfriend Confirmation Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showUnfriendModal" class="fixed inset-0 z-[110] flex flex-col items-center justify-start overflow-y-auto p-4 sm:py-8">
          <div class="fixed inset-0 bg-black/90 backdrop-blur-md" @click="showUnfriendModal = false"></div>
          <div class="relative my-auto w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
            <div class="w-16 h-16 bg-zinc-925 rounded-full flex items-center justify-center mx-auto mb-4">
              <User class="w-8 h-8 text-rose-500" />
            </div>
            <h2 class="text-xl font-bold text-white mb-2">{{ friendshipToUnfriend?.status === 'pending' ? 'Cancel Request?' : 'Unfriend?' }}</h2>
            <p class="text-zinc-500 mb-8 text-sm">
              {{ friendshipToUnfriend?.status === 'pending' 
                ? `Cancel your friend request to ${unfriendDisplayName}?`
                : `Are you sure you want to unfriend ${unfriendDisplayName}?` 
              }}
            </p>
            <div class="flex flex-col gap-3">
              <button @click="executeUnfriend" class="w-full px-5 py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-rose-500/20 cursor-pointer">
                {{ friendshipToUnfriend?.status === 'pending' ? 'Cancel Request' : 'Unfriend' }}
              </button>
              <button @click="showUnfriendModal = false" class="w-full px-5 py-3 bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Add Friend Confirmation Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showAddModal" class="fixed inset-0 z-[110] flex flex-col items-center justify-start overflow-y-auto p-4 sm:py-8">
          <div class="fixed inset-0 bg-black/90 backdrop-blur-md" @click="showAddModal = false"></div>
          <div class="relative my-auto w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
            <div class="w-16 h-16 bg-zinc-925 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus class="w-8 h-8 text-white" />
            </div>
            <h2 class="text-xl font-bold text-white mb-2">Send Request?</h2>
            <p class="text-zinc-500 mb-8 text-sm">
              Send a friend request to <span class="text-zinc-200 font-medium">{{ userToRequest?.username }}</span>?
            </p>
            <div class="flex flex-col gap-3">
              <button @click="executeSendRequest" class="w-full px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer">
                Send Request
              </button>
              <button @click="showAddModal = false" class="w-full px-5 py-3 bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Share Habits Modal (Post-Request) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showShareModal" 
          class="fixed inset-0 z-[110] flex flex-col items-center justify-start overflow-y-auto sm:py-8 py-0"
        >
          <div class="fixed inset-0 bg-black/90 backdrop-blur-md" @click="showShareModal = false"></div>
          <div 
            ref="modalContent"
            class="relative my-auto w-full h-full sm:h-auto sm:max-w-md max-w-none bg-zinc-925 border-x-0 sm:border border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl p-8 overflow-y-auto transition-all duration-300"
          >
            <div class="text-center mb-6">
              <div class="w-16 h-16 bg-zinc-925 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check class="w-8 h-8 text-white" />
              </div>
              <h2 class="text-xl font-bold text-white mb-2">{{ shareModalTitle }}</h2>
              <p class="text-zinc-500 text-sm">
                Which habits would you like to share with <span class="text-zinc-200 font-medium">{{ userBeingSharedWith?.username }}</span>?
              </p>
            </div>
            
            <!-- Selection Controls -->
            <div class="flex items-center justify-between mb-3 px-1">
              <label class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">My habits</label>
              <button 
                @click="toggleSelectAllHabits"
                title="Select/Unselect All"
                class="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <CheckSquare class="w-4 h-4" />
              </button>
            </div>

            <div class="max-h-[320px] overflow-y-auto pr-2 space-y-2 mb-8 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              <div v-for="habit in myHabits" :key="habit.id" 
                @click="toggleHabitSelection(habit.id)"
                class="flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group"
                :class="selectedHabitIds.includes(habit.id) ? 'bg-white/5 border-white/20' : 'bg-black border-zinc-900 hover:border-zinc-700'"
              >
                <div class="flex-1 text-sm text-zinc-200 font-medium truncate min-w-0">{{ habit.title }}</div>
                <div class="w-5 h-5 rounded-md border flex items-center justify-center transition-all"
                  :class="selectedHabitIds.includes(habit.id) ? 'bg-white border-white text-black' : 'border-zinc-700 group-hover:border-zinc-500'"
                >
                  <Check v-if="selectedHabitIds.includes(habit.id)" class="w-3 h-3" />
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-3">
              <button @click="executeBatchShare" class="w-full px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer">
                {{ selectedHabitIds.length > 0 ? `Share ${selectedHabitIds.length} habits` : 'Continue' }}
              </button>
              <button @click="showShareModal = false" class="w-full px-5 py-3 bg-transparent hover:bg-zinc-925 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    <!-- View Habit Details Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showHabitModal && selectedHabit" 
          class="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto sm:py-8 py-0"
        >
          <!-- Backdrop -->
          <div class="fixed inset-0 bg-black/80 backdrop-blur-md" @click="showHabitModal = false"></div>
          
          <!-- Modal Content -->
          <div 
            ref="habitModalContent"
            class="relative my-auto w-full h-full sm:h-auto sm:max-w-md max-w-none bg-zinc-925 border-x-0 sm:border border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl p-8 overflow-y-auto transition-all duration-300"
          >
            <div v-if="habitLoading" class="flex justify-center p-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
            
            <template v-else>
              <div class="flex items-center gap-1 mb-6 -ml-2">
                <button @click="showHabitModal = false" class="p-2 text-zinc-500 hover:text-white transition-all cursor-pointer flex-shrink-0">
                  <ChevronLeft class="w-6 h-6" />
                </button>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 min-w-0">
                    <h2 class="text-xl font-bold text-white truncate leading-none min-w-0">{{ selectedHabit.title }}</h2>
                    <!-- Streak Badge -->
                    <div 
                      v-if="(selectedHabit.currentStreak ?? 0) >= 2"
                      class="flex items-center gap-1 px-2 py-0.5 bg-black border rounded-full shrink-0"
                      :class="[
                        isFaded(selectedHabit) ? 'opacity-30' : 'opacity-100',
                        getStreakTheme(selectedHabit.currentStreak ?? 0).border
                      ]"
                    >
                      <span 
                        class="text-[9px] font-black tracking-tight"
                        :class="getStreakTheme(selectedHabit.currentStreak ?? 0).text"
                      >
                        x{{ selectedHabit.currentStreak }} STREAK
                      </span>
                      <Flame 
                        v-if="(selectedHabit.currentStreak ?? 0) >= 7"
                        class="w-2.5 h-2.5" 
                        :class="[
                          getStreakTheme(selectedHabit.currentStreak ?? 0).text,
                          getStreakTheme(selectedHabit.currentStreak ?? 0).fill
                        ]"
                      />
                    </div>
                  </div>
                  <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    <span class="capitalize">{{ selectedHabit.frequencyPeriod }}</span><template v-if="selectedHabit.frequencyPeriod !== 'daily'">, {{ selectedHabit.frequencyCount }} {{ selectedHabit.frequencyCount === 1 ? 'time' : 'times' }}</template>
                  </div>
                </div>
              </div>

              <p v-if="selectedHabit.description" class="text-zinc-400 text-sm mb-4 italic break-words whitespace-pre-wrap">
                {{ selectedHabit.description }}
              </p>
              <div v-else class="mb-6"></div>

              <!-- Monthly Calendar View -->
              <div class="space-y-4">
                <div class="flex items-center justify-between px-2">
                  <h3 class="text-sm font-bold uppercase tracking-widest text-white">
                    {{ format(currentCalendarDate, 'MMMM yyyy') }}
                  </h3>
                  <div class="flex gap-2">
                    <button type="button" @click="prevMonth" class="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">
                      <ChevronLeft class="w-4 h-4" />
                    </button>
                    <button type="button" @click="nextMonth" class="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">
                      <ChevronRight class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div class="bg-black rounded-2xl p-4 border border-zinc-800 relative overflow-hidden">
                  <!-- Loading Overlay -->
                  <Transition
                    enter-active-class="transition duration-200 ease-out"
                    enter-from-class="opacity-0"
                    enter-to-class="opacity-100"
                    leave-active-class="transition duration-300 ease-in"
                    leave-from-class="opacity-100"
                    leave-to-class="opacity-0"
                  >
                    <div v-if="calendarLoading" class="absolute inset-0 z-10 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    </div>
                  </Transition>
                  <div class="grid grid-cols-7 gap-y-4 gap-x-1">
                    <!-- Day Headers -->
                    <div v-for="dayName in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="dayName" class="text-[10px] text-center font-black uppercase tracking-tighter text-zinc-600 mb-1">
                      {{ dayName }}
                    </div>

                    <!-- Calendar Grid -->
                    <div v-for="(day, i) in calendarDays" :key="i" class="flex flex-col items-center gap-1">
                      <div
                        class="w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 relative"
                        :class="[
                          (day.getMonth() !== currentCalendarDate.getMonth() || isFutureDay(day)) ? 'opacity-30 border-transparent' : '',
                          getStatus(selectedHabit.id, day) === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
                          getStatus(selectedHabit.id, day) === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
                          getStatus(selectedHabit.id, day) === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
                          'border-dashed border-zinc-800 bg-transparent'
                        ]"
                      >
                        <Check v-if="getStatus(selectedHabit.id, day) === 'completed'" class="w-3 h-3 text-white" />
                        <XIcon v-else-if="getStatus(selectedHabit.id, day) === 'failed'" class="w-3 h-3 text-white" />
                        <span v-else-if="getStatus(selectedHabit.id, day) === 'skipped'" class="w-3 h-0.5 bg-white rounded-full"></span>
                      </div>
                      <div class="text-[9px] font-bold" :class="[
                        day.getMonth() === currentCalendarDate.getMonth() ? 'text-white' : 'text-zinc-600',
                        day.getMonth() !== currentCalendarDate.getMonth() ? 'opacity-30' : ''
                      ]">
                        {{ format(day, 'd') }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="mt-5">
                <button
                  @click="showHabitModal = false"
                  class="w-full py-3 px-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-all cursor-pointer shadow-sm"
                >
                  Close
                </button>
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'social' });
import { Search, UserPlus, UserMinus, Check, X as XIcon, User, Trash2, ChevronDown, CheckSquare, Activity, Star, ChevronLeft, ChevronRight, Flame } from 'lucide-vue-next';
import { format, parseISO, isToday, addDays, startOfMonth, endOfMonth, eachDayOfInterval, subDays, isAfter, startOfDay, subMonths, addMonths } from 'date-fns';
import { useSocial } from '../composables/useSocial';
import { useToast } from '../composables/useToast';

definePageMeta({ middleware: 'auth' });

const { user } = useAuth();
const { showToast } = useToast();
const route = useRoute();
const lastPath = useState('social_prev_path', () => '');
const router = useRouter();

// Track previous path for conditional refresh logic
const unhook = router.beforeEach((to, from) => {
  lastPath.value = from.fullPath;
});
onUnmounted(() => unhook());

const activeTab = computed({
  get: () => (route.query.tab as 'activity' | 'friends') || 'activity',
  set: (val) => navigateTo({ query: { ...route.query, tab: val } } as any, { replace: true })
});

interface UserProfile { id: string; email: string; username: string; photourl?: string; }
interface Friendship { 
  id: string; 
  participants: string[]; 
  initiatorId: string; 
  receiverId: string; 
  status: 'pending' | 'accepted'; 
  initiatorFavorite?: boolean;
  receiverFavorite?: boolean;
}

const searchQuery = ref('');
const friendsSearchQuery = ref('');
const isRequestsExpanded = ref(false);
const searchResults = ref<UserProfile[]>([]);
const { 
  friendships, 
  profilesMap, 
  refresh: refreshSocial, 
  init: initSocial, 
  cleanup: cleanupSocial,
  toggleFavorite,
  isLoading
} = useSocial();
const showUnfriendModal = ref(false);
const friendshipToUnfriend = ref<Friendship | null>(null);
const unfriendDisplayName = ref('');
const showAddModal = ref(false);
const userToRequest = ref<UserProfile | null>(null);
const showShareModal = ref(false);
const myHabits = ref<any[]>([]);
const selectedHabitIds = ref<string[]>([]);
const userBeingSharedWith = ref<UserProfile | null>(null);
const shareModalTitle = ref('Request Sent!');

const favoritedAtStart = ref<Set<string>>(new Set());

// --- Habit Details Modal Logic ---
const showHabitModal = ref(false);
const habitLoading = ref(false);
const selectedHabit = ref<any>(null);
const selectedHabitLogs = ref<any[]>([]);
const currentCalendarDate = ref(new Date());
const calendarLoading = ref(false);

const openHabitDetails = async (habitId: string) => {
  habitLoading.value = true;
  try {
    const data = await $fetch<any>(`/api/social/habit-details`, { query: { habitId } });
    selectedHabit.value = data.habit;
    selectedHabitLogs.value = data.logs;
    currentCalendarDate.value = new Date();
    showHabitModal.value = true;
  } catch (err: any) {
    console.error('Error fetching habit details:', err);
    if (err.statusCode === 404) {
      showToast('This habit is no longer shared with you', 'failed');
    }
  } finally {
    habitLoading.value = false;
  }
};

const calendarDays = computed(() => {
  const start = startOfMonth(currentCalendarDate.value);
  const end = endOfMonth(currentCalendarDate.value);
  const daysInMonth = eachDayOfInterval({ start, end });
  const firstDay = start.getDay();
  const paddingStart = Array.from({ length: firstDay }, (_, i) => subDays(start, firstDay - i));
  const lastDay = end.getDay();
  const paddingEnd = Array.from({ length: 6 - lastDay }, (_, i) => addDays(end, i + 1));
  return [...paddingStart, ...daysInMonth, ...paddingEnd];
});

const prevMonth = () => currentCalendarDate.value = subMonths(currentCalendarDate.value, 1);
const nextMonth = () => currentCalendarDate.value = addMonths(currentCalendarDate.value, 1);
const isFutureDay = (day: Date) => isAfter(startOfDay(day), startOfDay(new Date()));

const getStatus = (habitId: string, day: Date) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  return selectedHabitLogs.value.find(l => l.habitid === habitId && l.date === dateStr)?.status;
};

const isFaded = (habit: any) => {
  if (!habit || !habit.streakAnchorDate) return false;
  const anchor = startOfDay(parseISO(habit.streakAnchorDate));
  const yesterday = startOfDay(subDays(new Date(), 1));
  return isAfter(yesterday, anchor);
};

const getStreakTheme = (count: number) => {
  if (count >= 30) return { border: 'border-yellow-400/50 shadow-lg shadow-yellow-400/10', text: 'text-yellow-400', fill: 'fill-yellow-400/80' };
  if (count >= 7) return { border: 'border-violet-400/50 shadow-lg shadow-violet-400/10', text: 'text-violet-400', fill: 'fill-violet-400/80' };
  return { border: 'border-emerald-500/50', text: 'text-emerald-500', fill: 'fill-emerald-500/80' };
};

// --- Activity Feed Logic ---
const feed = ref<any[]>([]);
const feedLoading = ref(false);

const loadFeed = async () => {
  if (activeTab.value !== 'activity') return;
  feedLoading.value = true;
  try {
    feed.value = await $fetch<any[]>('/api/social/feed' as any);
  } catch (err) {
    console.error('Error fetching feed:', err);
  } finally {
    feedLoading.value = false;
  }
};

const handleMessageClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  const userId = target.getAttribute('data-user-id');
  if (userId) {
    event.stopPropagation();
    if (userId !== String(user.value?.id)) {
      navigateTo(`/friends/${userId}?from=${activeTab.value}`);
    }
  }
};

const groupedFeed = computed(() => {
  if (!feed.value) return {};
  return feed.value.reduce((acc: any, item: any) => {
    const date = item.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {});
});

const formatFeedDate = (dateStr: string) => {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Today';
  if (isToday(addDays(d, 1))) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
};

const formatMessage = (msg: string) => {
  if (!msg) return '';
  // Escape HTML to prevent injection
  let content = msg
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // 1. Process Habits [H]...[/H] -> Sky Blue
  content = content.replace(/\[H\](.*?)\[\/H\]/g, '<strong class="text-blue-500 font-bold">$1</strong>');
  
  // 2. Process Usernames [U:id]...[/U] -> Bold White + Clickable (Interactive only if not current user)
  content = content.replace(/\[U:(.*?)\](.*?)\[\/U\]/g, (match, id, label) => {
    const isMe = id === String(user.value?.id);
    if (isMe) {
      return `<span class="font-bold text-zinc-100">${label}</span>`;
    }
    return `<span class="font-bold text-zinc-100 hover:text-zinc-400 transition-colors cursor-pointer" data-user-id="${id}">${label}</span>`;
  });
  
  // Legacy support for [U]...[/U] without ID
  content = content.replace(/\[U\](.*?)\[\/U\]/g, '<strong class="text-zinc-100 font-bold">$1</strong>');
  
  // 3. Process Streaks [S:count]...[/S] -> Dynamic Color
  content = content.replace(/\[S:(\d+)\](.*?)\[\/S\]/g, (_, countStr, text) => {
    const count = parseInt(countStr);
    let colorClass = 'text-emerald-500'; // Default < 7 days (Green)
    if (count >= 30) colorClass = 'text-yellow-400'; // 30+ days (Gold)
    else if (count >= 7) colorClass = 'text-violet-400'; // 7+ days (Purple)
    
    return `<strong class="${colorClass} font-bold">${text}</strong>`;
  });

  return content;
};

// Refresh sort snapshot when entering the friends tab
watch(activeTab, (newTab, oldTab) => {
  if (newTab === 'activity') {
    loadFeed();
  }
  if (newTab === 'friends' && oldTab !== 'friends') {
    const myId = String(user.value?.id);
    const favs = friendships.value
      .filter((f: any) => f.status === 'accepted' && (String(f.initiatorId) === myId ? f.initiatorFavorite : f.receiverFavorite))
      .map((f: any) => f.id);
    favoritedAtStart.value = new Set(favs);
  }
});

// --- Dynamic Log Fetching ---
watch(currentCalendarDate, async (newDate) => {
  if (showHabitModal.value && selectedHabit.value) {
    const start = format(startOfMonth(newDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(newDate), 'yyyy-MM-dd');
    calendarLoading.value = true;
    try {
      const data = await $fetch<any>('/api/social/habit-details', { 
        query: { 
          habitId: selectedHabit.value.id,
          startDate: start,
          endDate: end
        } 
      });
      if (data.logs) {
        data.logs.forEach((newLog: any) => {
          const idx = selectedHabitLogs.value.findIndex(l => l.id === newLog.id);
          if (idx >= 0) {
            selectedHabitLogs.value[idx] = newLog;
          } else {
            selectedHabitLogs.value.push(newLog);
          }
        });
      }
    } catch (err) {
      console.error('Failed to fetch historical social logs:', err);
    } finally {
      calendarLoading.value = false;
    }
  }
});
// ----------------------------

const isAnyModalOpen = ref(false);
watch([showUnfriendModal, showAddModal, showShareModal, showHabitModal], (vals) => {
  isAnyModalOpen.value = vals.some(v => v);
});
useModalHistory(isAnyModalOpen, () => {
  showUnfriendModal.value = false;
  showAddModal.value = false;
  showShareModal.value = false;
  showHabitModal.value = false;
});

const pendingIncoming = computed(() => {
  if (!user.value?.id) return [];
  const myId = String(user.value.id);
  return friendships.value.filter((f: any) => f.status === 'pending' && String(f.receiverId) === myId);
});

const pendingOutgoing = computed(() => {
  if (!user.value?.id) return [];
  const myId = String(user.value.id);
  return friendships.value.filter((f: any) => f.status === 'pending' && String(f.initiatorId) === myId);
});

const acceptedFriends = computed(() => {
  return friendships.value.filter((f: any) => f.status === 'accepted');
});

const displayFriends = computed(() => {
  const combined = [...acceptedFriends.value, ...pendingOutgoing.value];
  if (!user.value?.id) return combined;
  const myId = String(user.value.id);
  
  return combined
    .filter((f: any) => {
      const friendId = getFriendId(f);
      return friendId && friendId !== myId;
    })
    .sort((a, b) => {
      const aFav = favoritedAtStart.value.has(a.id);
      const bFav = favoritedAtStart.value.has(b.id);
      
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;

      const nameA = profilesMap.value[getFriendId(a)]?.username || '';
      const nameB = profilesMap.value[getFriendId(b)]?.username || '';
      return nameA.localeCompare(nameB);
    });
});

const filteredDisplayFriends = computed(() => {
  if (!friendsSearchQuery.value.trim()) return displayFriends.value;
  const q = friendsSearchQuery.value.toLowerCase().trim();
  return displayFriends.value.filter((f: any) => {
    const username = profilesMap.value[getFriendId(f)]?.username.toLowerCase() || '';
    return username.includes(q);
  });
});
const getFriendId = (f: Friendship) => {
  if (!user.value?.id) return '';
  const myId = String(user.value.id);
  return f.participants?.find(p => String(p) !== myId) ?? '';
};
const getRelationship = (targetId: string) => friendships.value.find((f: any) => f.participants?.includes(targetId))?.status;

const isFriendshipFavorite = (f: Friendship) => {
  if (!user.value?.id) return false;
  const myId = String(user.value.id);
  return String(f.initiatorId) === myId ? f.initiatorFavorite : f.receiverFavorite;
};

const handleFriendClick = (f: Friendship) => {
  navigateTo(`/friends/${getFriendId(f)}?from=${activeTab.value}` as any);
};

// Modal Adaptive Logic
// --- Modal State Management ---
const modalContent = ref<HTMLElement | null>(null);
const habitModalContent = ref<HTMLElement | null>(null);

const loadFriendships = async () => {
  await refreshSocial();
};

onMounted(() => {
  initSocial();
  loadFeed();
});

onUnmounted(() => {
});

onActivated(async () => {
  // 1. Restore scroll position
  await nextTick();
  requestAnimationFrame(() => {
    if (savedScrollY.value > 0) {
      window.scrollTo({ top: savedScrollY.value, behavior: 'instant' });
    }
  });

  // 2. Conditional Refresh
  // We refresh if we're coming from anywhere EXCEPT a friend's profile (to preserve state on back-nav)
  const isFromProfile = lastPath.value.includes('/friends/');
  
  if (!isFromProfile) {
    await loadFriendships();
    if (activeTab.value === 'activity') {
      loadFeed();
    }
    
    // Also update the stable favorites snapshot for friends list sorting
    const myId = String(user.value?.id);
    const favs = friendships.value
      .filter((f: any) => f.status === 'accepted' && (String(f.initiatorId) === myId ? f.initiatorFavorite : f.receiverFavorite))
      .map((f: any) => f.id);
    favoritedAtStart.value = new Set(favs);
  }
});

// Preserve scroll position across KeepAlive navigation (fallback for router savedPosition)
const savedScrollY = ref(0);

onDeactivated(() => {
  savedScrollY.value = window.scrollY;
});

const handleSearch = async () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }
  searchResults.value = await $fetch<UserProfile[]>('/api/social/search', { query: { username: searchQuery.value.trim() } });
};

let searchTimeout: any;
watch(searchQuery, (val) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(handleSearch, 300);
});

const confirmSendRequest = (u: UserProfile) => {
  userToRequest.value = u;
  showAddModal.value = true;
};

const executeSendRequest = async () => {
  if (!userToRequest.value) return;
  const target = userToRequest.value;
  await $fetch('/api/social/friends', { method: 'POST', body: { targetUserId: target.id } });
  await loadFriendships();
  
  // Setup for share modal
  userBeingSharedWith.value = target;
  const habitsData = await $fetch<any[]>('/api/habits');
  myHabits.value = habitsData;
  selectedHabitIds.value = [];
  
  showAddModal.value = false;
  userToRequest.value = null;
  searchResults.value = [];
  searchQuery.value = '';
  
  // Open share modal if user has habits
  if (habitsData.length > 0) {
    shareModalTitle.value = 'Request Sent!';
    showShareModal.value = true;
  }
};

const toggleHabitSelection = (id: string) => {
  const index = selectedHabitIds.value.indexOf(id);
  if (index === -1) selectedHabitIds.value.push(id);
  else selectedHabitIds.value.splice(index, 1);
};

const toggleSelectAllHabits = () => {
  if (selectedHabitIds.value.length === myHabits.value.length) {
    selectedHabitIds.value = [];
  } else {
    selectedHabitIds.value = myHabits.value.map((h: any) => h.id);
  }
};

const executeBatchShare = async () => {
  if (!userBeingSharedWith.value) return;
  await $fetch('/api/social/share-habits', { 
    method: 'POST', 
    body: { 
      targetUserId: userBeingSharedWith.value.id, 
      habitIds: selectedHabitIds.value,
      user_date: format(new Date(), 'yyyy-MM-dd')
    } 
  });
  showShareModal.value = false;
};

const acceptRequest = async (fid: string) => {
  const friendship = friendships.value.find((f: any) => f.id === fid);
  if (!friendship) return;
  
  const initiatorId = friendship.initiatorId;
  const initiatorProfile = profilesMap.value[initiatorId];

  await $fetch(`/api/social/requests/${fid}`, { method: 'PUT' });
  await loadFriendships();

  // Setup for share modal
  if (initiatorProfile) {
    userBeingSharedWith.value = initiatorProfile;
    const habitsData = await $fetch<any[]>('/api/habits');
    myHabits.value = habitsData;
    selectedHabitIds.value = [];
    
    if (habitsData.length > 0) {
      shareModalTitle.value = 'Request Accepted!';
      showShareModal.value = true;
    }
  }
};

const declineRequest = async (fid: string) => {
  await $fetch(`/api/social/requests/${fid}`, { method: 'DELETE' });
  await loadFriendships();
};

const confirmUnfriend = (f: Friendship) => {
  friendshipToUnfriend.value = f;
  unfriendDisplayName.value = profilesMap.value[getFriendId(f)]?.username || 'Unknown';
  showUnfriendModal.value = true;
};

const executeUnfriend = async () => {
  if (!friendshipToUnfriend.value) return;
  const fid = friendshipToUnfriend.value.id;
  
  // Close modal first to avoid flickering when data reloads
  showUnfriendModal.value = false;
  
  await $fetch(`/api/social/requests/${fid}`, { method: 'DELETE' });
  await loadFriendships();
  
  // Clear reference after data is reloaded
  friendshipToUnfriend.value = null;
  unfriendDisplayName.value = '';
};
const handleToggleFavorite = async (f: Friendship) => {
  const current = isFriendshipFavorite(f);
  await toggleFavorite(f.id, !current);
};
</script>
