<template>
  <div class="space-y-3">
    <!-- Header -->
    <div v-motion-slide-visible-once-left class="px-4 sm:px-0 flex items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-white mb-1">My Habits</h1>
        <p class="text-zinc-400">Track your habits this week</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="habits.length > 1"
          @click="showReorderModal = true"
          class="w-11 sm:w-28 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-semibold rounded-xl transition-all cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-95 border border-zinc-700/60"
          title="Reorder"
        >
          <ArrowUpDown class="w-4 h-4" />
          <span class="hidden sm:inline">Reorder</span>
        </button>
        <button 
          @click="showModal = true" 
          class="w-11 sm:w-28 py-2.5 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-95"
          title="Add Habit"
        >
          <Plus class="w-4 h-4" />
          <span class="hidden sm:inline">Add</span>
        </button>
      </div>
    </div>

    <!-- Habit List (Single Card) -->
    <div v-motion-fade class="bg-zinc-925/80 backdrop-blur-md sm:rounded-2xl rounded-none shadow-2xl border-y border-x-0 sm:border border-zinc-800/80 divide-y divide-zinc-800/80 overflow-x-auto custom-scrollbar">
      <div v-if="habits.length === 0" class="p-10 text-center text-zinc-500 italic text-sm">
        No habits yet. Add one above!
      </div>
      
      <div 
        v-for="habit in habits" :key="habit.id"
        :data-habit-id="habit.id"
        draggable="true"
        @dragstart="onDragStart($event, habit.id)"
        @dragover.prevent="onDragOver($event, habit.id)"
        @drop.prevent="onDrop($event, habit.id)"
        @dragend="onDragEnd"
        @click="openEditModal(habit)"
        class="relative p-4 pt-14 sm:pt-4 group transition-all flex flex-wrap items-center justify-between gap-x-8 gap-y-4 cursor-pointer hover:bg-zinc-800/40"
        :class="[
          draggingId === habit.id ? 'opacity-30' : 'opacity-100',
          dragOverId === habit.id ? 'ring-2 ring-inset ring-white/20 bg-zinc-800/50' : ''
        ]"
      >
        <!-- Floating Streak Badge -->
        <div 
          v-if="(streakInfoMap.get(habit.id)?.count ?? 0) >= 2"
          class="absolute top-3 left-0 sm:top-2 flex items-center gap-1.5 px-3 py-1 bg-black border border-l-0 rounded-r-full rounded-l-none z-20 transition-all duration-500"
          :class="[
            streakInfoMap.get(habit.id)?.faded ? 'opacity-30' : 'opacity-100',
            getStreakTheme(streakInfoMap.get(habit.id)?.count ?? 0).border
          ]"
        >
          <span 
            class="text-[10px] font-black tracking-tight"
            :class="getStreakTheme(streakInfoMap.get(habit.id)?.count ?? 0).text"
          >
            x{{ streakInfoMap.get(habit.id)?.count }} STREAK
          </span>
          <Flame 
            v-if="(streakInfoMap.get(habit.id)?.count ?? 0) >= 7"
            class="w-3.5 h-3.5" 
            :class="[
              getStreakTheme(streakInfoMap.get(habit.id)?.count ?? 0).text,
              getStreakTheme(streakInfoMap.get(habit.id)?.count ?? 0).fill
            ]"
          />
        </div>

        <div class="flex items-center gap-3 min-w-[200px] flex-1">
          <!-- Grip Handle Removed -->
          <div class="text-left flex items-start gap-2 relative">
            <h3 class="font-bold text-zinc-200 leading-tight break-all group-hover:text-white transition-colors">{{ habit.title }}</h3>
          </div>
        </div>
        
        <!-- Checkboxes & Actions Section -->
        <div class="flex-1 min-w-[320px] flex justify-center sm:justify-end items-end gap-4">
          <div class="flex justify-evenly items-end w-full max-w-lg">
            <div v-for="(day, i) in days" :key="i" class="flex flex-col items-center gap-2">
              <div class="text-[10px] uppercase tracking-tighter text-zinc-500 font-black">
                {{ format(day, 'EEE') }}
              </div>
              
              <button
                @click.stop="toggleLog(habit, day)"
                class="w-9 h-9 rounded-lg flex items-center justify-center transition-all border-2 cursor-pointer relative"
                :class="[
                  getStatus(habit.id, day) === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
                  getStatus(habit.id, day) === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
                  getStatus(habit.id, day) === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
                  'bg-transparent hover:bg-zinc-925 border-dashed border-zinc-800'
                ]"
              >
                <Check v-if="getStatus(habit.id, day) === 'completed'" class="w-4 h-4 text-white" />
                <X v-else-if="getStatus(habit.id, day) === 'failed'" class="w-4 h-4 text-white" />
                <Minus v-else-if="getStatus(habit.id, day) === 'skipped'" class="w-4 h-4 text-white" />
              </button>

              <div class="text-[10px] font-bold" :class="isToday(day) ? 'text-white' : 'text-zinc-500'">
                {{ format(day, 'd') }}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>


    <!-- Add Habit Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showModal" 
          class="fixed inset-0 z-[100] flex items-center justify-center sm:p-4 p-0"
          :class="{ 'modal-parent-adaptive': isHeightOverflowing }"
        >
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="showModal = false"></div>
          
          <!-- Modal Content -->
          <div 
            ref="modalContent"
            class="relative w-full h-full sm:h-auto sm:max-w-md max-w-none bg-zinc-925 border-x-0 sm:border border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl p-8 overflow-y-auto transition-all duration-300"
            :class="{ 'modal-adaptive-height': isHeightOverflowing }"
          >
            <h2 class="text-2xl font-bold text-white mb-6">New Habit</h2>
            
            <form @submit.prevent="addHabit" class="space-y-6">
              <div class="space-y-2">
                <label class="text-xs font-bold uppercase tracking-widest text-zinc-500">Habit Name</label>
                <input
                  v-model="newTitle"
                  type="text"
                  placeholder="e.g. Morning Meditation"
                  required
                  maxlength="50"
                  autofocus
                  class="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 text-white placeholder-zinc-700 transition-all"
                />
              </div>

              <!-- Description -->
              <div class="space-y-2">
                <label class="text-xs font-bold uppercase tracking-widest text-zinc-500">Description</label>
                <div class="relative">
                  <textarea
                    v-model="newDescription"
                    rows="2"
                    maxlength="300"
                    placeholder=""
                    @input="autoExpand"
                    class="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 text-white placeholder-zinc-700 transition-all resize-none overflow-hidden"
                  ></textarea>
                  <div class="absolute -bottom-5 right-1 text-[10px] font-bold text-zinc-600">
                    {{ newDescription.length }}/300
                  </div>
                </div>
              </div>

              <!-- Frequency Group -->
              <div class="flex items-start gap-3">
                <!-- Left: Label + Selector -->
                <div class="flex flex-col gap-2">
                  <label class="text-xs font-bold uppercase tracking-widest text-zinc-500 h-4 flex items-center">I will do this</label>
                  <select
                    v-model="newFrequencyPeriod"
                    class="w-32 h-10 px-3 py-2 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-600 text-white appearance-none cursor-pointer text-sm"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <!-- Right: Stepper + Times -->
                <template v-if="newFrequencyPeriod !== 'daily'">
                  <div class="flex items-start gap-3">
                    <div class="flex items-center gap-3">
                      <div class="flex flex-col items-center">
                        <button type="button" @click="adjustFrequency(true, 1)" class="h-4 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                          <ChevronUp class="w-3 h-3" />
                        </button>
                        <div class="pt-2 pb-1">
                          <input
                            v-model.number="newFrequencyCount"
                            type="number"
                            @blur="newFrequencyCount = newFrequencyPeriod === 'weekly' ? Math.max(1, Math.min(7, newFrequencyCount)) : Math.max(1, Math.min(31, newFrequencyCount))"
                            class="w-10 h-10 bg-black border border-zinc-800 rounded-lg text-center text-sm font-medium text-white focus:outline-none focus:ring-1 focus:ring-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                        <button type="button" @click="adjustFrequency(true, -1)" class="h-4 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                          <ChevronDown class="w-3 h-3" />
                        </button>
                      </div>
                      <span class="text-zinc-500 text-sm">{{ newFrequencyCount === 1 ? 'time' : 'times' }}</span>
                    </div>
                  </div>
                </template>
              </div>

              <!-- Share To -->
              <div v-if="friends.length > 0" class="space-y-3">
                <label class="text-xs font-bold uppercase tracking-widest text-zinc-500">Share to</label>
                <div class="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  <label v-for="friend in friends" :key="friend.id" class="flex items-center justify-between p-3 bg-black border border-zinc-925 rounded-xl cursor-pointer hover:border-zinc-800 transition-colors">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 bg-zinc-925 rounded-full flex items-center justify-center overflow-hidden">
                        <img v-if="friend.photourl" :src="friend.photourl" class="w-full h-full object-cover" />
                        <User v-else class="w-4 h-4 text-zinc-600" />
                      </div>
                      <span class="text-sm font-semibold text-zinc-200">{{ friend.username || 'Unknown' }}</span>
                    </div>
                    <div 
                      class="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                      :class="[
                        newSharedWith.includes(friend.id) 
                          ? 'bg-zinc-700 shadow-lg shadow-zinc-700/20' 
                          : 'bg-zinc-925'
                      ]"
                    >
                      <Check v-if="newSharedWith.includes(friend.id)" class="w-3.5 h-3.5 text-zinc-100" />
                    </div>
                    <input type="checkbox" :value="friend.id" v-model="newSharedWith" class="hidden" />
                  </label>
                </div>
              </div>

              <div class="flex gap-3 pt-4">
                <button
                  type="button"
                  @click="showModal = false"
                  class="flex-1 px-5 py-3 bg-transparent hover:bg-zinc-925 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="flex-1 px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer"
                >
                  Add Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Edit Habit Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showEditModal" 
          class="fixed inset-0 z-[100] flex items-center justify-center sm:p-4 p-0"
          :class="{ 'modal-parent-adaptive': isHeightOverflowing }"
        >
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="showEditModal = false"></div>
          
          <!-- Modal Content -->
          <div 
            ref="modalContent"
            class="relative w-full h-full sm:h-auto sm:max-w-lg max-w-none bg-zinc-925 border-x-0 sm:border border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl p-8 overflow-y-auto transition-all duration-300"
            :class="{ 'modal-adaptive-height': isHeightOverflowing }"
          >
            <div class="flex items-start justify-between mb-6">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <h2 class="text-2xl font-bold text-white truncate leading-none">{{ editTitle }}</h2>
                  <!-- Streak Badge -->
                  <div 
                    v-if="(streakInfoMap.get(editingHabit?.id || '')?.count ?? 0) >= 2"
                    class="flex items-center gap-1 px-2 py-0.5 bg-black border rounded-full shrink-0"
                    :class="[
                      streakInfoMap.get(editingHabit?.id || '')?.faded ? 'opacity-30' : 'opacity-100',
                      getStreakTheme(streakInfoMap.get(editingHabit?.id || '')?.count ?? 0).border
                    ]"
                  >
                    <span 
                      class="text-[9px] font-black tracking-tight"
                      :class="getStreakTheme(streakInfoMap.get(editingHabit?.id || '')?.count ?? 0).text"
                    >
                      x{{ streakInfoMap.get(editingHabit?.id || '')?.count }} STREAK
                    </span>
                    <Flame 
                      v-if="(streakInfoMap.get(editingHabit?.id || '')?.count ?? 0) >= 7"
                      class="w-2.5 h-2.5" 
                      :class="[
                        getStreakTheme(streakInfoMap.get(editingHabit?.id || '')?.count ?? 0).text,
                        getStreakTheme(streakInfoMap.get(editingHabit?.id || '')?.count ?? 0).fill
                      ]"
                    />
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button @click="showDeleteModal = true" class="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-925 rounded-xl transition-all cursor-pointer">
                  <Trash2 class="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div class="space-y-6">
              <div class="space-y-2">
                <label class="text-xs font-bold uppercase tracking-widest text-zinc-500">Habit Name</label>
                <input
                  v-model="editTitle"
                  type="text"
                  required
                  maxlength="50"
                  class="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 text-white placeholder-zinc-700 transition-all"
                />
              </div>

              <!-- Description -->
              <div class="space-y-2">
                <label class="text-xs font-bold uppercase tracking-widest text-zinc-500">Description</label>
                <div class="relative">
                  <textarea
                    ref="editDescriptionRef"
                    v-model="editDescription"
                    rows="2"
                    maxlength="300"
                    placeholder=""
                    @input="autoExpand"
                    class="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 text-white placeholder-zinc-700 transition-all resize-none overflow-hidden"
                  ></textarea>
                  <div class="absolute -bottom-5 right-1 text-[10px] font-bold text-zinc-600">
                    {{ editDescription.length }}/300
                  </div>
                </div>
              </div>

              <!-- Frequency Group -->
              <div class="flex items-start gap-3">
                <!-- Left: Label + Selector -->
                <div class="flex flex-col gap-2">
                  <label class="text-xs font-bold uppercase tracking-widest text-zinc-500 h-4 flex items-center">I will do this</label>
                  <select
                    v-model="editFrequencyPeriod"
                    class="w-32 h-10 px-3 py-2 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-600 text-white appearance-none cursor-pointer text-sm"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <!-- Right: Stepper + Times -->
                <template v-if="editFrequencyPeriod !== 'daily'">
                  <div class="flex items-start gap-3">
                    <div class="flex items-center gap-3">
                      <div class="flex flex-col items-center">
                        <button type="button" @click="adjustFrequency(false, 1)" class="h-4 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                          <ChevronUp class="w-3 h-3" />
                        </button>
                        <div class="pt-2 pb-1">
                          <input
                            v-model.number="editFrequencyCount"
                            type="number"
                            @blur="editFrequencyCount = editFrequencyPeriod === 'weekly' ? Math.max(1, Math.min(7, editFrequencyCount)) : Math.max(1, Math.min(31, editFrequencyCount))"
                            class="w-10 h-10 bg-black border border-zinc-800 rounded-lg text-center text-sm font-medium text-white focus:outline-none focus:ring-1 focus:ring-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                        <button type="button" @click="adjustFrequency(false, -1)" class="h-4 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                          <ChevronDown class="w-3 h-3" />
                        </button>
                      </div>
                      <span class="text-zinc-500 text-sm">{{ editFrequencyCount === 1 ? 'time' : 'times' }}</span>
                    </div>
                  </div>
                </template>
              </div>

              <!-- Monthly Calendar View -->
              <div class="space-y-4">
                <div class="flex items-center justify-between px-2">
                  <h3 class="text-sm font-bold uppercase tracking-widest text-white">
                    {{ format(currentCalendarDate, 'MMMM yyyy') }}
                  </h3>
                  <div class="flex gap-2">
                    <button type="button" @click="prevMonth" class="p-2 hover:bg-zinc-925 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">
                      <ChevronLeft class="w-4 h-4" />
                    </button>
                    <button type="button" @click="nextMonth" class="p-2 hover:bg-zinc-925 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">
                      <ChevronRight class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div class="bg-black rounded-2xl p-4 border border-zinc-925">
                  <div class="grid grid-cols-7 gap-y-4 gap-x-1">
                    <!-- Day Headers -->
                    <div v-for="dayName in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="dayName" class="text-[10px] text-center font-black uppercase tracking-tighter text-zinc-600 mb-1">
                      {{ dayName }}
                    </div>

                    <!-- Calendar Grid -->
                    <div v-for="(day, i) in calendarDays" :key="i" class="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        @click="day.getMonth() === currentCalendarDate.getMonth() && !isFutureDay(day) && toggleLog(editingHabit!, day)"
                        :disabled="day.getMonth() !== currentCalendarDate.getMonth() || isFutureDay(day)"
                        class="w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 relative"
                        :class="[
                          (day.getMonth() !== currentCalendarDate.getMonth() || isFutureDay(day)) ? 'opacity-30 cursor-not-allowed border-transparent' : 'cursor-pointer',
                          getStatus(editingHabit!.id, day) === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
                          getStatus(editingHabit!.id, day) === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
                          getStatus(editingHabit!.id, day) === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
                          'border-dashed border-zinc-800 bg-transparent hover:bg-zinc-925'
                        ]"
                      >
                        <Check v-if="getStatus(editingHabit!.id, day) === 'completed'" class="w-3 h-3 text-white" />
                        <X v-else-if="getStatus(editingHabit!.id, day) === 'failed'" class="w-3 h-3 text-white" />
                        <span v-else-if="getStatus(editingHabit!.id, day) === 'skipped'" class="w-3 h-0.5 bg-white rounded-full"></span>
                      </button>
                      <div class="text-[9px] font-bold" :class="[
                        isToday(day) ? 'text-white' : 'text-zinc-600',
                        (day.getMonth() !== currentCalendarDate.getMonth() || isFutureDay(day)) ? 'opacity-30' : ''
                      ]">
                        {{ format(day, 'd') }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Share To -->
              <div v-if="friends.length > 0" class="space-y-3 mt-8">
                <div class="flex items-center gap-2 pr-2">
                  <label class="text-xs font-bold uppercase tracking-widest text-zinc-500">Share to</label>
                  <button 
                    @click="reachedConfirmViaDone = false; isEditingSharing ? (showSharingConfirmModal = true) : (isEditingSharing = true)"
                    class="text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer bg-zinc-925/50 px-2 py-0.5 rounded-md border border-zinc-800"
                  >
                    <template v-if="!isEditingSharing">
                      <Edit2 class="w-3 h-3" /> Edit
                    </template>
                    <template v-else>
                      <Save class="w-3 h-3" /> Confirm
                    </template>
                  </button>
                  <div class="ml-auto">
                    <button 
                      v-if="isEditingSharing"
                      @click="toggleSelectAll"
                      title="Select/Unselect All"
                      class="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                    >
                      <CheckSquare class="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div 
                  class="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar transition-all duration-300"
                  :class="!isEditingSharing ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'"
                >
                  <label v-for="friend in friends" :key="friend.id" class="flex items-center justify-between p-3 bg-black border border-zinc-925 rounded-xl transition-colors" :class="isEditingSharing ? 'cursor-pointer hover:border-zinc-800' : 'cursor-default'">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 bg-zinc-925 rounded-full flex items-center justify-center overflow-hidden">
                        <img v-if="friend.photourl" :src="friend.photourl" class="w-full h-full object-cover" />
                        <User v-else class="w-4 h-4 text-zinc-600" />
                      </div>
                      <span class="text-sm font-semibold text-zinc-200">{{ friend.username || 'Unknown' }}</span>
                    </div>
                    <div 
                      class="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                      :class="[
                        editSharedWithWorking.includes(friend.id) 
                          ? 'bg-zinc-700 shadow-lg shadow-zinc-700/20' 
                          : 'bg-zinc-925'
                      ]"
                    >
                      <Check v-if="editSharedWithWorking.includes(friend.id)" class="w-3.5 h-3.5 text-zinc-100" />
                    </div>
                    <input type="checkbox" :value="friend.id" v-model="editSharedWithWorking" class="hidden" />
                  </label>
                </div>
              </div>

              <div class="pt-4">
                <button
                  type="button"
                  @click="handleDoneClick"
                  class="w-full px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showDeleteModal" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="showDeleteModal = false"></div>
          
          <!-- Modal Content -->
          <div class="relative w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
            <div class="w-16 h-16 bg-zinc-925 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 class="w-8 h-8 text-zinc-400" />
            </div>
            <h2 class="text-xl font-bold text-white mb-2">Delete Habit?</h2>
            <p class="text-zinc-500 mb-8 text-sm">
              This will permanently remove "<span class="text-zinc-200 font-medium">{{ editingHabit?.title }}</span>" and all its progress. This action cannot be undone.
            </p>
            
            <div class="flex flex-col gap-3">
              <button
                @click="handleDelete"
                class="w-full px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer"
              >
                Delete Permanently
              </button>
              <button
                @click="showDeleteModal = false"
                class="w-full px-5 py-3 bg-transparent hover:bg-zinc-925 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer"
              >
                Keep Habit
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Sharing Confirmation Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showSharingConfirmModal" class="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="showSharingConfirmModal = false"></div>
          <div class="relative w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
            <div class="w-16 h-16 bg-zinc-925 rounded-full flex items-center justify-center mx-auto mb-4">
              <User class="w-8 h-8 text-zinc-400" />
            </div>
            <h2 class="text-xl font-bold text-white mb-2">Update Sharing?</h2>
            <p class="text-zinc-500 mb-8 text-sm">
              This will update who can see your progress for this habit.
            </p>
            <div class="flex flex-col gap-3">
              <button
                @click="confirmSharingSave"
                class="w-full px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer"
              >
                Confirm Changes
              </button>
              <button
                @click="cancelSharingSave"
                class="w-full px-5 py-3 bg-transparent hover:bg-zinc-925 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Reorder Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showReorderModal" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 p-0">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="showReorderModal = false"></div>

          <!-- Modal Content -->
          <div class="relative w-full sm:max-w-sm bg-zinc-925 border-t sm:border border-zinc-800 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col" style="max-height: 80vh">
            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 shrink-0">
              <div>
                <h2 class="text-base font-bold text-white">Reorder Habits</h2>
                <p class="text-[11px] text-zinc-500 mt-0.5">Drag to rearrange</p>
              </div>
              <button
                @click="showReorderModal = false"
                class="px-4 py-2 bg-white hover:bg-zinc-200 text-black text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                Done
              </button>
            </div>

            <!-- Compact habit list -->
            <div class="overflow-y-auto flex-1 p-2">
              <div
                v-for="habit in habits"
                :key="habit.id"
                :data-habit-id="habit.id"
                draggable="true"
                @dragstart="onDragStart($event, habit.id)"
                @dragover.prevent="onDragOver($event, habit.id)"
                @drop.prevent="onDrop($event, habit.id)"
                @dragend="onDragEnd"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all select-none"
                :class="[
                  draggingId === habit.id ? 'opacity-30' : 'opacity-100',
                  dragOverId === habit.id ? 'bg-zinc-700/60 ring-1 ring-white/20' : 'hover:bg-zinc-800/60'
                ]"
              >
                <div
                  class="touch-none shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
                  :class="isDragging ? 'cursor-grabbing' : 'cursor-grab'"
                  @touchstart.prevent="onGripTouchStart($event, habit.id)"
                >
                  <GripVertical class="w-4 h-4" />
                </div>
                <span class="text-sm font-semibold text-zinc-200 truncate flex-1">{{ habit.title }}</span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { Plus, Trash2, Check, X, Minus, ChevronLeft, ChevronRight, User, ChevronUp, ChevronDown, Edit2, Save, CheckSquare, GripVertical, ArrowUpDown, Flame } from 'lucide-vue-next';
import { format, subDays, isToday, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isAfter, startOfDay, addDays, isSameWeek, isSameMonth, getDaysInMonth } from 'date-fns';
import type { Habit, HabitLog } from '~/composables/useHabitsApi';

definePageMeta({ middleware: 'auth' });

const api = useHabitsApi();
const { user } = useAuth();

const habits = ref<Habit[]>([]);
const logs = ref<HabitLog[]>([]);
const friends = ref<any[]>([]);

const newTitle = ref('');
const newDescription = ref('');
const newFrequencyCount = ref(1);
const newFrequencyPeriod = ref<'daily' | 'weekly' | 'monthly'>('daily');
const newSharedWith = ref<string[]>([]);
const showModal = ref(false);
const showReorderModal = ref(false);

const showEditModal = ref(false);
const showDeleteModal = ref(false);
const editingHabit = ref<Habit | null>(null);
const editTitle = ref('');
const editDescription = ref('');
const editFrequencyCount = ref(1);
const editFrequencyPeriod = ref<'daily'|'weekly'|'monthly'>('daily');
const editSharedWith = ref<string[]>([]);
const editSharedWithWorking = ref<string[]>([]);
const isEditingSharing = ref(false);
const showSharingConfirmModal = ref(false);
const reachedConfirmViaDone = ref(false);
const editDescriptionRef = ref<HTMLTextAreaElement | null>(null);
const currentCalendarDate = ref(new Date());

const autoExpand = (e: Event | HTMLElement) => {
  const el = (e instanceof Event ? e.target : e) as HTMLTextAreaElement;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
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

const today = new Date();
const isFutureDay = (day: Date) => isAfter(startOfDay(day), startOfDay(today));
const days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));
const startDate = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
const endDate = format(endOfMonth(addMonths(today, 1)), 'yyyy-MM-dd');

const streakInfoMap = computed(() => {
  const map = new Map<string, { count: number, faded: boolean }>();
  for (const habit of habits.value) {
    const logMap = new Map<string, string>();
    for (const l of logs.value) {
      if (l.habitid === habit.id) {
        logMap.set(l.date, l.status);
      }
    }

    let currentDay = new Date();
    let streakCount = 0;
    let foundAnchor = false;
    let faded = false;
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    for (let i = 0; i < 365; i++) {
      const dateStr = format(currentDay, 'yyyy-MM-dd');
      const status = logMap.get(dateStr);

      if (!foundAnchor) {
        if (status === 'completed' || status === 'failed' || status === 'skipped') {
          foundAnchor = true;
          if (dateStr !== todayStr) {
            faded = true;
          }
        }
      }

      if (foundAnchor) {
        if (status === 'completed') {
          streakCount++;
        } else if (status === 'skipped') {
          // freeze
        } else {
          break;
        }
      }
      currentDay = subDays(currentDay, 1);
    }
    map.set(habit.id, { count: streakCount, faded });
  }
  return map;
});

const getStreakTheme = (count: number) => {
  if (count >= 30) return { 
    border: 'border-yellow-400/50 shadow-lg shadow-yellow-400/10', 
    text: 'text-yellow-400', 
    fill: 'fill-yellow-400/80' 
  };
  if (count >= 7) return { 
    border: 'border-violet-400/50 shadow-lg shadow-violet-400/10', 
    text: 'text-violet-400', 
    fill: 'fill-violet-400/80' 
  };
  return { 
    border: 'border-emerald-500/50', 
    text: 'text-emerald-500', 
    fill: 'fill-emerald-500/80' 
  };
};

const load = async () => {
  const [h, l, socialData] = await Promise.all([
    api.getHabits(), 
    api.getLogs(startDate, endDate),
    $fetch<any>('/api/social/friends')
  ]);
  habits.value = h;
  logs.value = l;

  const profilesMap = new Map(socialData.profiles.map((p: any) => [p.id, p]));
  friends.value = socialData.friendships
    .filter((f: any) => f.status === 'accepted')
    .map((f: any) => {
      const myId = user.value?.id ? String(user.value.id) : null;
      if (!myId) return null;
      const friendId = f.participants.find((p: string) => String(p) !== myId) || '';
      return profilesMap.get(friendId);
    })
    .filter(Boolean);
};



const getStatus = (habitId: string, day: Date) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  return logs.value.find(l => l.habitid === habitId && l.date === dateStr)?.status;
};

const toggleLog = async (habit: Habit, day: Date) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  const currentStatus = getStatus(habit.id, day);

  // Use modal values if currently editing this habit to enforce rules immediately
  const isEditingThis = showEditModal.value && editingHabit.value?.id === habit.id;
  const frequencyPeriod = isEditingThis ? editFrequencyPeriod.value : habit.frequencyPeriod;
  const frequencyCount = isEditingThis ? editFrequencyCount.value : (habit.frequencyCount || 1);

  let nextStatus: 'completed' | 'failed' | 'skipped' | null = null;
  if (frequencyPeriod === 'daily') {
    if (!currentStatus) nextStatus = 'completed';
    else if (currentStatus === 'completed') nextStatus = 'failed';
    else nextStatus = null;
  } else if (frequencyPeriod === 'weekly') {
    const maxSkips = 7 - (frequencyCount || 1);
    const usedSkips = logs.value.filter(l => 
      l.habitid === habit.id && 
      l.status === 'skipped' && 
      isSameWeek(new Date(l.date), day, { weekStartsOn: 0 })
    ).length;

    if (!currentStatus) nextStatus = 'completed';
    else if (currentStatus === 'completed') nextStatus = 'failed';
    else if (currentStatus === 'failed') {
      nextStatus = usedSkips < maxSkips ? 'skipped' : null;
    } else {
      nextStatus = null;
    }
  } else if (frequencyPeriod === 'monthly') {
    const maxSkips = Math.max(0, getDaysInMonth(day) - (frequencyCount || 1));
    const usedSkips = logs.value.filter(l => 
      l.habitid === habit.id && 
      l.status === 'skipped' && 
      isSameMonth(new Date(l.date), day)
    ).length;

    if (!currentStatus) nextStatus = 'completed';
    else if (currentStatus === 'completed') nextStatus = 'failed';
    else if (currentStatus === 'failed') {
      nextStatus = usedSkips < maxSkips ? 'skipped' : null;
    } else {
      nextStatus = null;
    }
  } else {
    if (!currentStatus) nextStatus = 'completed';
    else if (currentStatus === 'completed') nextStatus = 'failed';
    else if (currentStatus === 'failed') nextStatus = 'skipped';
    else if (currentStatus === 'skipped') nextStatus = null;
  }

  if (nextStatus) {
    const log = await api.upsertLog({ habitid: habit.id, date: dateStr, status: nextStatus, sharedwith: habit.sharedwith });
    const idx = logs.value.findIndex(l => l.habitid === habit.id && l.date === dateStr);
    if (idx >= 0) logs.value[idx] = log;
    else logs.value.push(log);
  } else {
    await api.deleteLog(habit.id, dateStr);
    logs.value = logs.value.filter(l => !(l.habitid === habit.id && l.date === dateStr));
  }
};

const addHabit = async () => {
  if (!newTitle.value.trim()) return;
  const habit = await api.createHabit({ 
    title: newTitle.value.trim(), 
    description: newDescription.value.trim(),
    frequencyCount: newFrequencyCount.value,
    frequencyPeriod: newFrequencyPeriod.value,
    sharedwith: newSharedWith.value,
    color: '#6366f1' 
  });
  habits.value.push(habit);
  newTitle.value = '';
  newDescription.value = '';
  newFrequencyCount.value = 1;
  newFrequencyPeriod.value = 'daily';
  newSharedWith.value = [];
  showModal.value = false;
};

let isInitializingEdit = false;

const openEditModal = (habit: Habit) => {
  isInitializingEdit = true;
  editingHabit.value = habit;
  editTitle.value = habit.title;
  editDescription.value = habit.description || '';
  editFrequencyCount.value = habit.frequencyCount || 1;
  editFrequencyPeriod.value = habit.frequencyPeriod || 'daily';
  editSharedWith.value = [...(habit.sharedwith || [])];
  editSharedWithWorking.value = [...(habit.sharedwith || [])];
  isEditingSharing.value = false;
  currentCalendarDate.value = new Date();
  showEditModal.value = true;
  
  nextTick(() => {
    isInitializingEdit = false;
    isDirty.value = false;
    if (editDescriptionRef.value) {
      autoExpand(editDescriptionRef.value);
    }
  });
};

const prevMonth = () => currentCalendarDate.value = subMonths(currentCalendarDate.value, 1);
const nextMonth = () => currentCalendarDate.value = addMonths(currentCalendarDate.value, 1);

const toggleSelectAll = () => {
  if (editSharedWithWorking.value.length === friends.value.length) {
    editSharedWithWorking.value = [];
  } else {
    editSharedWithWorking.value = friends.value.map(f => f.id);
  }
};

const handleDoneClick = () => {
  if (isEditingSharing.value) {
    reachedConfirmViaDone.value = true;
    showSharingConfirmModal.value = true;
  } else {
    showEditModal.value = false;
  }
};

const adjustFrequency = (isNew: boolean, delta: number) => {
  if (isNew) {
    const max = newFrequencyPeriod.value === 'weekly' ? 7 : 31;
    newFrequencyCount.value = Math.max(1, Math.min(max, newFrequencyCount.value + delta));
  } else {
    const max = editFrequencyPeriod.value === 'weekly' ? 7 : 31;
    editFrequencyCount.value = Math.max(1, Math.min(max, editFrequencyCount.value + delta));
  }
};

// ── Drag-and-drop reorder ────────────────────────────────────────────────────
const draggingId = ref<string | null>(null);
const dragOverId = ref<string | null>(null);
const isDragging = ref(false);

// Desktop — HTML5 drag events
const onDragStart = (e: DragEvent, id: string) => {
  draggingId.value = id;
  isDragging.value = true;
  e.dataTransfer!.effectAllowed = 'move';
};

const onDragOver = (e: DragEvent, id: string) => {
  e.preventDefault();
  if (draggingId.value && draggingId.value !== id) dragOverId.value = id;
};

const onDrop = (e: DragEvent, targetId: string) => {
  e.preventDefault();
  if (!draggingId.value || draggingId.value === targetId) return;
  applyReorder(draggingId.value, targetId);
};

const onDragEnd = () => {
  draggingId.value = null;
  dragOverId.value = null;
  isDragging.value = false;
};

// Mobile — touch events (attached to the grip handle)
const onGripTouchStart = (e: TouchEvent, id: string) => {
  draggingId.value = id;
  isDragging.value = true;

  const onTouchMove = (ev: TouchEvent) => {
    ev.preventDefault();
    const touch = ev.touches[0];
    if (!touch) return;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const row = el?.closest('[data-habit-id]') as HTMLElement | null;
    if (row) {
      const hid = row.dataset.habitId;
      if (hid && hid !== draggingId.value) dragOverId.value = hid;
    }
  };

  const onTouchEnd = () => {
    if (draggingId.value && dragOverId.value && draggingId.value !== dragOverId.value) {
      applyReorder(draggingId.value, dragOverId.value);
    }
    draggingId.value = null;
    dragOverId.value = null;
    isDragging.value = false;
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  };

  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
};

const applyReorder = (fromId: string, toId: string) => {
  const fromIdx = habits.value.findIndex(h => h.id === fromId);
  const toIdx   = habits.value.findIndex(h => h.id === toId);
  if (fromIdx === -1 || toIdx === -1) return;
  const list = [...habits.value];
  const [moved] = list.splice(fromIdx, 1) as [Habit];
  list.splice(toIdx, 0, moved);
  habits.value = list;
  scheduleReorderSave();
};

let reorderTimeout: ReturnType<typeof setTimeout> | null = null;
const scheduleReorderSave = () => {
  if (reorderTimeout) clearTimeout(reorderTimeout);
  reorderTimeout = setTimeout(() => {
    api.reorderHabits(habits.value.map(h => h.id));
  }, 500);
};
// ─────────────────────────────────────────────────────────────────────────────

let autosaveTimeout: NodeJS.Timeout | null = null;
const isDirty = ref(false);

watch(showEditModal, (isOpen) => {
  if (!isOpen && isDirty.value) {
    updateHabit();
  }
});

watch(
  [editTitle, editDescription, editFrequencyCount, editFrequencyPeriod],
  () => {
    if (showEditModal.value && editingHabit.value && !isInitializingEdit) {
      isDirty.value = true;
      if (autosaveTimeout) clearTimeout(autosaveTimeout);
      autosaveTimeout = setTimeout(() => {
        updateHabit();
      }, 750);
    }
  },
  { deep: true }
);

const updateHabit = async () => {
  if (!editingHabit.value || !editTitle.value.trim()) return;
  isDirty.value = false;
  if (autosaveTimeout) {
    clearTimeout(autosaveTimeout);
    autosaveTimeout = null;
  }
  const updated = await api.updateHabit(editingHabit.value.id, { 
    title: editTitle.value.trim(),
    description: editDescription.value.trim(),
    frequencyCount: editFrequencyCount.value,
    frequencyPeriod: editFrequencyPeriod.value,
    sharedwith: editSharedWith.value,
  });
  const idx = habits.value.findIndex(h => h.id === editingHabit.value?.id);
  if (idx >= 0) {
    habits.value[idx] = updated;
  }
};

const confirmSharingSave = async () => {
  editSharedWith.value = [...editSharedWithWorking.value];
  await updateHabit();
  showSharingConfirmModal.value = false;
  if (reachedConfirmViaDone.value) {
    showEditModal.value = false;
  }
  isEditingSharing.value = false;
};

const cancelSharingSave = () => {
  showSharingConfirmModal.value = false;
  if (reachedConfirmViaDone.value) {
    showEditModal.value = false;
  }
};

const handleDelete = async () => {
  if (!editingHabit.value) return;
  await api.deleteHabit(editingHabit.value.id);
  habits.value = habits.value.filter(h => h.id !== editingHabit.value?.id);
  showDeleteModal.value = false;
  showEditModal.value = false;
};

const removeHabit = async (id: string) => {
  await api.deleteHabit(id);
  habits.value = habits.value.filter(h => h.id !== id);
};

// ── Modal Overflow Logic ─────────────────────────────────────────────────────
const modalContent = ref<HTMLElement | null>(null);
const isHeightOverflowing = ref(false);

const checkHeightOverflow = () => {
  if (!modalContent.value) return;
  // Use a slight buffer (32px) for a more comfortable transition
  isHeightOverflowing.value = modalContent.value.scrollHeight > (window.innerHeight - 32);
};

// Check on modal open, and when relevant content changes
watch([showModal, showEditModal, editDescription, newDescription, editFrequencyPeriod], async (newVal) => {
  const isAnyOpen = Array.isArray(newVal) ? newVal.slice(0, 2).some(v => v) : false;
  if (isAnyOpen) {
    await nextTick();
    checkHeightOverflow();
    // Double check after transitions
    setTimeout(checkHeightOverflow, 350);
  } else {
    isHeightOverflowing.value = false;
  }
});

onUnmounted(() => {
  unsubscribeOwnHabits();
  window.removeEventListener('resize', checkHeightOverflow);
  window.removeEventListener('popstate', handlePopState);
  if (typeof document !== 'undefined') {
    document.body.classList.remove('overflow-hidden');
  }
});

// ── Back Button / History API Logic ──────────────────────────────────────────
const isAnyModalOpen = computed(() => 
  showModal.value || showEditModal.value || showDeleteModal.value || showSharingConfirmModal.value || showReorderModal.value
);

let modalStatePushed = false;

const handlePopState = () => {
  if (isAnyModalOpen.value) {
    showModal.value = false;
    showEditModal.value = false;
    showDeleteModal.value = false;
    showSharingConfirmModal.value = false;
    showReorderModal.value = false;
    modalStatePushed = false;
  }
};

watch(isAnyModalOpen, (isOpen, oldOpen) => {
  if (typeof window === 'undefined') return;
  
  if (isOpen && !oldOpen) {
    window.history.pushState({ modal: true }, '');
    modalStatePushed = true;
  } else if (!isOpen && oldOpen && modalStatePushed) {
    if (window.history.state?.modal) {
      window.history.back();
    }
    modalStatePushed = false;
  }
});

const { subscribeToFriendHabits } = useRealtime();
let unsubscribeOwnHabits = () => {};

onMounted(() => {
  load();
  if (user.value?.id) {
    unsubscribeOwnHabits = subscribeToFriendHabits(String(user.value.id), () => {
      load();
    });
  }
  window.addEventListener('resize', checkHeightOverflow);
  window.addEventListener('popstate', handlePopState);
});
// ─────────────────────────────────────────────────────────────────────────────

// ── Scroll Lock ──────────────────────────────────────────────────────────────
watch(
  [showModal, showEditModal, showDeleteModal, showSharingConfirmModal, showReorderModal],
  (newVal) => {
    if (typeof document === 'undefined') return;
    const isAnyOpen = newVal.some(v => v);
    if (isAnyOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
  }
);
// ─────────────────────────────────────────────────────────────────────────────
</script>
