<template>
  <div class="space-y-1 relative">
    <!-- Header -->
    <div class="px-4 sm:px-0 flex items-end justify-between gap-4 sticky top-[57px] z-40 bg-black pt-2 pb-2 sm:mt-2">
      <div class="flex items-center gap-4">
        <UserAvatar 
          v-if="user"
          :src="user.photourl" 
          container-class="w-12 h-12 bg-zinc-925 rounded-2xl shadow-sm"
          icon-class="w-6 h-6 text-zinc-600"
        />
        <div>
          <h1 class="text-xl font-bold tracking-tight text-white mb-1">My habits</h1>
          <p class="text-zinc-400 text-xs">Track your habits this week</p>
        </div>
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
      <div v-if="loading" class="flex justify-center p-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
      <template v-else>
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
        <!-- Top Left Badges Container -->
        <div class="absolute top-3 left-0 sm:top-2 flex items-center gap-2 z-20 transition-all duration-500">
          <!-- Floating Streak Badge -->
          <div 
            v-if="(habit.currentStreak ?? 0) >= 2"
            class="flex items-center gap-1.5 px-3 py-1 bg-black border border-l-0 rounded-r-full rounded-l-none transition-all duration-500"
            :class="[
              isFaded(habit) ? 'opacity-30' : 'opacity-100',
              getStreakTheme(habit.currentStreak ?? 0).border
            ]"
          >
            <span 
              class="text-[10px] font-black tracking-tight"
              :class="getStreakTheme(habit.currentStreak ?? 0).text"
            >
              x{{ habit.currentStreak }} STREAK
            </span>
            <Flame 
              v-if="(habit.currentStreak ?? 0) >= 7"
              class="w-3.5 h-3.5" 
              :class="[
                getStreakTheme(habit.currentStreak ?? 0).text,
                getStreakTheme(habit.currentStreak ?? 0).fill
              ]"
            />
          </div>

          <!-- Frequency Progress Badge -->
          <div class="flex items-center px-2 py-1 bg-zinc-925 border border-zinc-800 rounded-lg text-[10px] font-bold tracking-tight text-zinc-400 shadow-sm" :class="{'ml-3': (habit.currentStreak ?? 0) < 2}">
            {{ getFrequencyText(habit) }}
          </div>
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
              
              <div class="relative">
                <button
                  @click.stop="openLogMenu(habit, day, $event)"
                  class="w-9 h-9 rounded-lg flex items-center justify-center transition-all border-2 cursor-pointer relative"
                  :class="[
                    getStatus(habit.id, day) === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
                    getStatus(habit.id, day) === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
                    getStatus(habit.id, day) === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
                    'bg-transparent hover:bg-zinc-925 border-dashed border-zinc-800'
                  ]"
                >
                  <Check v-if="getStatus(habit.id, day) === 'completed'" class="w-4 h-4 text-white" />
                  <XIcon v-else-if="getStatus(habit.id, day) === 'failed'" class="w-4 h-4 text-white" />
                  <Minus v-else-if="getStatus(habit.id, day) === 'skipped'" class="w-4 h-4 text-white" />
                </button>

                <!-- Status Dropdown -->
                <Teleport to="body">
                  <Transition
                    enter-active-class="transition duration-200 ease-out"
                    enter-from-class="opacity-0 scale-95 -translate-y-2"
                    enter-to-class="opacity-100 scale-100 translate-y-0"
                    leave-active-class="transition duration-150 ease-in"
                    leave-from-class="opacity-100 scale-100 translate-y-0"
                    leave-to-class="opacity-0 scale-95 -translate-y-2"
                  >
                    <div 
                      v-if="activeLogMenu && activeLogMenu.habitId === habit.id && isSameDay(activeLogMenu.date, day)"
                      class="fixed z-[200] bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-1.5 flex flex-col gap-1.5 -translate-x-1/2"
                      :style="{ 
                        top: `${menuPosition.top + 8}px`, 
                        left: `${menuPosition.left}px` 
                      }"
                      @click.stop
                    >
                      <button
                        v-for="opt in getLogOptions(habit, day)"
                        :key="opt.label"
                        @click.stop="setLogStatus(habit, day, opt.status)"
                        class="w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 cursor-pointer relative"
                        :class="opt.bgColor"
                        :title="opt.label"
                      >
                        <component :is="opt.icon" class="w-3.5 h-3.5" :class="opt.color" />
                      </button>
                    </div>
                  </Transition>
                </Teleport>
              </div>

              <div class="text-[10px] font-bold text-white">
                {{ format(day, 'd') }}
              </div>
            </div>
          </div>

        </div>

      </div>
      </template>
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
          class="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto sm:py-8 py-0"
        >
          <!-- Backdrop -->
          <div class="fixed inset-0 bg-black/80 backdrop-blur-md" @click="showModal = false"></div>
          
          <!-- Modal Content -->
          <div 
            ref="modalContent"
            class="relative my-auto w-full h-full sm:h-auto sm:max-w-md max-w-none bg-zinc-925 border-x-0 sm:border border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl overflow-hidden transition-all duration-300 flex flex-col"
          >
            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto p-8 pb-4">
              <h2 class="text-2xl font-bold text-white mb-6">New Habit</h2>
              
              <form id="addHabitForm" @submit.prevent="addHabit" class="space-y-6">
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

                <div v-if="friends.length > 0" class="space-y-3">
                  <label class="text-xs font-bold uppercase tracking-widest text-zinc-500">Share with</label>
                  <div class="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    <label v-for="friend in friends" :key="friend.id" class="flex items-center justify-between p-3 bg-black border border-zinc-925 rounded-xl cursor-pointer hover:border-zinc-800 transition-colors">
                      <div class="flex items-center gap-3">
                        <UserAvatar 
                          :src="friend.photourl" 
                          container-class="w-8 h-8 bg-zinc-925"
                          icon-class="w-4 h-4 text-zinc-600"
                        />
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
              </form>
            </div>

            <!-- Fixed Footer -->
            <div class="px-8 py-4 border-t border-zinc-800 bg-zinc-925/80 backdrop-blur-md flex gap-3">
              <button
                type="button"
                @click="showModal = false"
                class="flex-1 px-5 py-3 bg-transparent hover:bg-zinc-925 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="addHabitForm"
                :disabled="isAddingHabit"
                class="flex-1 px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <template v-if="isAddingHabit">
                  <div class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                  Adding...
                </template>
                <template v-else>
                  Add Habit
                </template>
              </button>
            </div>
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
          class="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto sm:py-8 py-0"
        >
          <!-- Backdrop -->
          <div class="fixed inset-0 bg-black/80 backdrop-blur-md" @click="showEditModal = false"></div>
          
          <!-- Modal Content -->
          <div 
            ref="modalContent"
            class="relative my-auto w-full h-full sm:h-auto sm:max-w-lg max-w-none bg-zinc-925 border-x-0 sm:border border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl overflow-hidden transition-all duration-300 flex flex-col"
          >
            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto p-8 pb-4">
              <div class="flex items-center gap-1 mb-6 -ml-2">

                <button @click="showEditModal = false" class="p-2 text-zinc-500 hover:text-white transition-all cursor-pointer flex-shrink-0">
                  <ChevronLeft class="w-6 h-6" />
                </button>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 min-w-0">
                    <h2 class="text-xl font-bold text-white truncate leading-none min-w-0">{{ editTitle }}</h2>
                    <!-- Streak Badge -->
                    <div 
                      v-if="(editingHabit?.currentStreak ?? 0) >= 2"
                      class="flex items-center gap-1 px-2 py-0.5 bg-black border rounded-full shrink-0"
                      :class="[
                        isFaded(editingHabit as Habit) ? 'opacity-30' : 'opacity-100',
                        getStreakTheme(editingHabit?.currentStreak ?? 0).border
                      ]"
                    >
                      <span 
                        class="text-[9px] font-black tracking-tight"
                        :class="getStreakTheme(editingHabit?.currentStreak ?? 0).text"
                      >
                        x{{ editingHabit?.currentStreak }} STREAK
                      </span>

                      <Flame 
                        v-if="(editingHabit?.currentStreak ?? 0) >= 7"
                        class="w-2.5 h-2.5" 
                        :class="[
                          getStreakTheme(editingHabit?.currentStreak ?? 0).text,
                          getStreakTheme(editingHabit?.currentStreak ?? 0).fill
                        ]"
                      />
                    </div>
                  </div>
                </div>
                <button @click="showDeleteModal = true" class="p-2 text-zinc-500 hover:text-rose-500 transition-all cursor-pointer flex-shrink-0">
                  <Trash2 class="w-5 h-5" />
                </button>
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

                  <div class="bg-black rounded-2xl p-4 border border-zinc-925 relative">
                    <!-- Loading Overlay -->
                    <Transition
                      enter-active-class="transition duration-200 ease-out"
                      enter-from-class="opacity-0"
                      enter-to-class="opacity-100"
                      leave-active-class="transition duration-300 ease-in"
                      leave-from-class="opacity-100"
                      leave-to-class="opacity-0"
                    >
                      <div v-if="calendarLoading" class="absolute inset-0 z-10 bg-black/40 backdrop-blur-[2px] flex items-center justify-center rounded-2xl">
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
                        <div class="relative">
                          <button
                            type="button"
                            @click.stop="openLogMenu(editingHabit!, day, $event)"
                            class="w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 relative"
                            :class="[
                              (day.getMonth() !== currentCalendarDate.getMonth()) ? 'opacity-30 cursor-not-allowed border-transparent' : 'cursor-pointer',
                              !isMarkable(day) && day.getMonth() === currentCalendarDate.getMonth() ? 'opacity-50' : '',
                              getStatus(editingHabit!.id, day) === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
                              getStatus(editingHabit!.id, day) === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
                              getStatus(editingHabit!.id, day) === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
                              'border-dashed border-zinc-800 bg-transparent hover:bg-zinc-925'
                            ]"
                          >
                            <Check v-if="getStatus(editingHabit!.id, day) === 'completed'" class="w-3 h-3 text-white" />
                            <XIcon v-else-if="getStatus(editingHabit!.id, day) === 'failed'" class="w-3 h-3 text-white" />
                            <span v-else-if="getStatus(editingHabit!.id, day) === 'skipped'" class="w-3 h-0.5 bg-white rounded-full"></span>
                          </button>

                          <!-- Status Dropdown (Calendar) -->
                          <Teleport to="body">
                            <Transition
                              enter-active-class="transition duration-200 ease-out"
                              enter-from-class="opacity-0 scale-95 -translate-y-2"
                              enter-to-class="opacity-100 scale-100 translate-y-0"
                              leave-active-class="transition duration-150 ease-in"
                              leave-from-class="opacity-100 scale-100 translate-y-0"
                              leave-to-class="opacity-0 scale-95 -translate-y-2"
                            >
                              <div 
                                v-if="activeLogMenu && activeLogMenu.habitId === editingHabit?.id && isSameDay(activeLogMenu.date, day)"
                                class="fixed z-[200] bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-1.5 flex flex-col gap-1.5 -translate-x-1/2"
                                :style="{ 
                                  top: `${menuPosition.top + 8}px`, 
                                  left: `${menuPosition.left}px` 
                                }"
                                @click.stop
                              >
                                <button
                                  v-for="opt in getLogOptions(editingHabit!, day)"
                                  :key="opt.label"
                                  @click.stop="setLogStatus(editingHabit!, day, opt.status)"
                                  class="w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 cursor-pointer relative"
                                  :class="opt.bgColor"
                                  :title="opt.label"
                                >
                                  <component :is="opt.icon" class="w-3.5 h-3.5" :class="opt.color" />
                                </button>
                              </div>
                            </Transition>
                          </Teleport>
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

                <div v-if="friends.length > 0" class="space-y-3 mt-8">
                  <div class="flex items-center gap-2 pr-2">
                    <label class="text-xs font-bold uppercase tracking-widest text-zinc-500">Share with</label>
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
                    class="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar transition-all duration-300"
                    :class="!isEditingSharing ? 'opacity-40 grayscale' : 'opacity-100'"
                  >
                    <label v-for="friend in sortedFriendsForEdit" :key="friend.id" class="flex items-center justify-between p-3 bg-black border border-zinc-925 rounded-xl transition-colors" :class="isEditingSharing ? 'cursor-pointer hover:border-zinc-800' : 'cursor-default pointer-events-none'">
                      <div class="flex items-center gap-3">
                        <UserAvatar 
                          :src="friend.photourl" 
                          container-class="w-8 h-8 bg-zinc-925"
                          icon-class="w-4 h-4 text-zinc-600"
                        />
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
              </div>
            </div>

            <!-- Fixed Footer -->
            <div class="px-8 py-4 border-t border-zinc-800 bg-zinc-925/80 backdrop-blur-md">
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
        <div v-if="showDeleteModal" class="fixed inset-0 z-[110] flex flex-col items-center justify-start overflow-y-auto p-4 sm:py-8">
          <!-- Backdrop -->
          <div class="fixed inset-0 bg-black/90 backdrop-blur-md" @click="showDeleteModal = false"></div>
          
          <!-- Modal Content -->
          <div class="relative my-auto w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
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
                :disabled="isDeletingHabit"
                class="w-full px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <template v-if="isDeletingHabit">
                  <div class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                  Deleting...
                </template>
                <template v-else>
                  Delete Permanently
                </template>
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
        <div v-if="showSharingConfirmModal" class="fixed inset-0 z-[120] flex flex-col items-center justify-start overflow-y-auto p-4 sm:py-8">
          <div class="fixed inset-0 bg-black/90 backdrop-blur-md" @click="showSharingConfirmModal = false"></div>
          <div class="relative my-auto w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
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
                :disabled="isUpdatingHabit"
                class="w-full px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <template v-if="isUpdatingHabit">
                  <div class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                  Saving...
                </template>
                <template v-else>
                  Confirm Changes
                </template>
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
        <div v-if="showReorderModal" class="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto sm:p-4 p-0 sm:py-8">
          <!-- Backdrop -->
          <div class="fixed inset-0 bg-black/80 backdrop-blur-md" @click="showReorderModal = false"></div>

          <!-- Modal Content -->
          <div class="relative my-auto w-full sm:max-w-sm bg-zinc-925 border-t sm:border border-zinc-800 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col" style="max-height: 80vh">
            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 shrink-0">
              <div>
                <h2 class="text-base font-bold text-white">Reorder habits</h2>
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
import { Plus, Trash2, Check, X as XIcon, Minus, ChevronLeft, ChevronRight, User, ChevronUp, ChevronDown, Edit2, Save, CheckSquare, GripVertical, ArrowUpDown, Flame } from 'lucide-vue-next';
import { format, subDays, isToday, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isAfter, startOfDay, addDays, isSameWeek, isSameMonth, getDaysInMonth, parseISO, startOfWeek, isBefore, isSameDay } from 'date-fns';
import type { Habit, HabitLog } from '~/composables/useHabitsApi';

definePageMeta({ middleware: 'auth' });
import { useSocial } from '../composables/useSocial';

const api = useHabitsApi();
const { user } = useAuth();
const { friends: rawFriends, refresh: refreshSocial, init: initSocial, cleanup: cleanupSocial } = useSocial();

const friends = computed(() => {
  const list = [...(rawFriends.value || [])];
  return list.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
});

const sortedFriendsForEdit = computed(() => {
  if (!editingHabit.value) return friends.value;
  const sharedIds = new Set(editingHabit.value.sharedwith || []);
  return [...friends.value].sort((a, b) => {
    const aShared = sharedIds.has(a.id);
    const bShared = sharedIds.has(b.id);
    if (aShared && !bShared) return -1;
    if (!aShared && bShared) return 1;
    return 0; // friends is already sorted alphabetically
  });
});
const { showToast } = useToast();

const habits = ref<Habit[]>([]);
const logs = ref<HabitLog[]>([]);
const loading = ref(true);

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
const calendarLoading = ref(false);
const isAddingHabit = ref(false);
const isDeletingHabit = ref(false);
const isUpdatingHabit = ref(false);

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
const isMarkable = (day: Date) => {
  const d = startOfDay(day);
  const t = startOfDay(today);
  const limit = subDays(t, 13); // Last 14 days including today
  return !isBefore(d, limit) && !isAfter(d, t);
};
const days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));
const startDate = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
const endDate = format(endOfMonth(addMonths(today, 1)), 'yyyy-MM-dd');

const isFaded = (habit: Habit) => {
  if (!habit || !habit.streakAnchorDate) return false;
  const anchor = startOfDay(parseISO(habit.streakAnchorDate));
  const yesterday = startOfDay(subDays(new Date(), 1));
  return isAfter(yesterday, anchor);
};

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

const getFrequencyText = (habit: Habit) => {
  const period = habit.frequencyPeriod;
  const count = habit.frequencyCount || 1;
  const now = new Date();

  if (period === 'daily') {
    let completed = 0;
    for (const l of logs.value) {
      if (l.habitid === habit.id && isToday(new Date(l.date)) && l.status === 'completed') {
        completed++;
      }
    }
    return completed >= 1 ? 'Target completed' : 'Daily, no skips';
  } else if (period === 'weekly') {
    const target = count;
    const maxSkips = 7 - target;
    
    let completed = 0;
    let skipped = 0;
    
    for (const l of logs.value) {
      if (l.habitid === habit.id && isSameWeek(new Date(l.date), now, { weekStartsOn: 0 })) {
        if (l.status === 'completed') completed++;
        else if (l.status === 'skipped') skipped++;
      }
    }
    
    if (completed >= target) return 'Weekly target completed';
    
    if (maxSkips === 0) {
      return `Weekly, ${completed}/${target}, no skips`;
    } else {
      const remainingSkips = Math.max(0, maxSkips - skipped);
      const skipText = remainingSkips === 1 ? '1 skip remaining' : `${remainingSkips} skips remaining`;
      return `Weekly, ${completed}/${target}, ${skipText}`;
    }
  } else if (period === 'monthly') {
    const daysInMonth = getDaysInMonth(now);
    const target = Math.min(count, daysInMonth);
    const maxSkips = daysInMonth - target;
    
    let completed = 0;
    let skipped = 0;
    
    for (const l of logs.value) {
      if (l.habitid === habit.id && isSameMonth(new Date(l.date), now)) {
        if (l.status === 'completed') completed++;
        else if (l.status === 'skipped') skipped++;
      }
    }
    
    if (completed >= target) return 'Monthly target completed';
    
    if (maxSkips === 0) {
      return `Monthly, ${completed}/${target}, no skips`;
    } else {
      const remainingSkips = Math.max(0, maxSkips - skipped);
      const skipText = remainingSkips === 1 ? '1 skip remaining' : `${remainingSkips} skips remaining`;
      return `Monthly, ${completed}/${target}, ${skipText}`;
    }
  }
  return '';
};

const load = async (silent = false) => {

  if (!silent) loading.value = true;
  try {
    const [h, l] = await Promise.all([
      api.getHabits(), 
      api.getLogs(startDate, endDate),
      refreshSocial()
    ]);
    habits.value = h;
    logs.value = l;

  } catch (error) {
    console.error('[Dashboard] load() failed:', error);
  } finally {
    loading.value = false;
  }
};



const getStatus = (habitId: string, day: Date) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  return logs.value.find(l => l.habitid === habitId && l.date === dateStr)?.status;
};

const activeLogMenu = ref<{ habitId: string, date: Date } | null>(null);
const menuPosition = ref({ top: 0, left: 0 });
const openLogMenu = (habit: Habit, day: Date, event: MouseEvent) => {
  if (!isMarkable(day)) {
    showToast('You can only update habits for the last 14 days', 'failed');
    return;
  }
  if (activeLogMenu.value?.habitId === habit.id && isSameDay(activeLogMenu.value.date, day)) {
    activeLogMenu.value = null;
  } else {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    menuPosition.value = {
      top: rect.bottom,
      left: rect.left + rect.width / 2
    };
    activeLogMenu.value = { habitId: habit.id, date: day };
  }
};

const closeLogMenu = () => {
  activeLogMenu.value = null;
};

const getLogOptions = (habit: Habit, day: Date) => {
  const currentStatus = getStatus(habit.id, day);
  
  // Use modal values if currently editing this habit to enforce rules immediately
  const isEditingThis = showEditModal.value && editingHabit.value?.id === habit.id;
  const frequencyPeriod = isEditingThis ? editFrequencyPeriod.value : habit.frequencyPeriod;
  const frequencyCount = isEditingThis ? editFrequencyCount.value : (habit.frequencyCount || 1);

  let maxSkips = 0;
  let usedSkips = 0;
  
  if (frequencyPeriod === 'weekly') {
    maxSkips = 7 - (frequencyCount || 1);
    usedSkips = logs.value.filter(l => 
      l.habitid === habit.id && 
      l.status === 'skipped' && 
      isSameWeek(new Date(l.date), day, { weekStartsOn: 0 })
    ).length;
  } else if (frequencyPeriod === 'monthly') {
    maxSkips = Math.max(0, getDaysInMonth(day) - (frequencyCount || 1));
    usedSkips = logs.value.filter(l => 
      l.habitid === habit.id && 
      l.status === 'skipped' && 
      isSameMonth(new Date(l.date), day)
    ).length;
  }

  const options: Array<{ label: string, status: 'completed' | 'failed' | 'skipped' | null, icon: any, color: string, bgColor: string }> = [];

  if (currentStatus !== 'completed') {
    options.push({ 
      label: 'Complete', 
      status: 'completed', 
      icon: Check, 
      color: 'text-white', 
      bgColor: 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' 
    });
  }

  if (currentStatus !== 'skipped' && usedSkips < maxSkips) {
    options.push({ 
      label: 'Skip', 
      status: 'skipped', 
      icon: Minus, 
      color: 'text-white', 
      bgColor: 'bg-zinc-500 border-zinc-500 shadow-none' 
    });
  }

  if (currentStatus !== 'failed') {
    options.push({ 
      label: 'Fail', 
      status: 'failed', 
      icon: XIcon, 
      color: 'text-white', 
      bgColor: 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' 
    });
  }

  if (currentStatus) {
    options.push({ 
      label: 'Clear', 
      status: null, 
      icon: Trash2, 
      color: 'text-zinc-400', 
      bgColor: 'bg-zinc-800 border-zinc-700' 
    });
  }

  return options;
};

const setLogStatus = async (habit: Habit, day: Date, nextStatus: 'completed' | 'failed' | 'skipped' | null) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  const originalLogs = JSON.parse(JSON.stringify(logs.value));
  const originalHabits = JSON.parse(JSON.stringify(habits.value));

  // 1. Optimistic UI Update
  if (nextStatus) {
    const idx = logs.value.findIndex(l => l.habitid === habit.id && l.date === dateStr);
    const existingLog = logs.value[idx];
    if (existingLog) {
      existingLog.status = nextStatus;
    } else {
      logs.value.push({
        id: `temp-${Date.now()}`,
        habitid: habit.id,
        ownerid: user.value?.id || '',
        date: dateStr,
        status: nextStatus,
        sharedwith: habit.sharedwith || []
      });
    }
    
    if (nextStatus === 'completed') showToast('Completed', 'completed');
    else if (nextStatus === 'failed') showToast('Failed', 'failed');
    else if (nextStatus === 'skipped') showToast('Skipped', 'skipped');
  } else {
    logs.value = logs.value.filter(l => !(l.habitid === habit.id && l.date === dateStr));
    showToast('Cleared', 'cleared');
  }

  activeLogMenu.value = null;

  // 2. Background Sync
  try {
    if (nextStatus) {
      const { log, habit: updatedHabit } = await api.upsertLog({ 
        habitid: habit.id, 
        date: dateStr, 
        status: nextStatus, 
        sharedwith: habit.sharedwith 
      });
      
      // Update with real server data (ensures correct IDs and recalculated streaks)
      const idx = logs.value.findIndex(l => l.habitid === habit.id && l.date === dateStr);
      if (idx >= 0) logs.value[idx] = log;
      
      const habitIdx = habits.value.findIndex(h => h.id === habit.id);
      if (habitIdx >= 0) habits.value[habitIdx] = updatedHabit;
    } else {
      const { habit: updatedHabit } = await api.deleteLog(habit.id, dateStr);
      
      // Update habits array with returned habit (updated streaks)
      const habitIdx = habits.value.findIndex(h => h.id === habit.id);
      if (habitIdx >= 0) habits.value[habitIdx] = updatedHabit;
    }
  } catch (error) {
    console.error('[Optimistic Update] Sync failed:', error);
    // 3. Revert on failure
    logs.value = originalLogs;
    habits.value = originalHabits;
    showToast('Failed to sync. Reverting...', 'failed');
  }
};

const toggleLog = async (habit: Habit, day: Date) => {
  // Legacy toggleLog kept for internal use or removed. 
  // Switching to openLogMenu and setLogStatus.
};

const addHabit = async () => {
  if (!newTitle.value.trim() || isAddingHabit.value) return;
  
  isAddingHabit.value = true;
  try {
    const habit = await api.createHabit({ 
      title: newTitle.value.trim(), 
      description: newDescription.value.trim(),
      frequencyCount: newFrequencyCount.value,
      frequencyPeriod: newFrequencyPeriod.value,
      sharedwith: newSharedWith.value,
      color: '#6366f1',
      user_date: format(new Date(), 'yyyy-MM-dd')
    });
    habits.value.push(habit);
    newTitle.value = '';
    newDescription.value = '';
    newFrequencyCount.value = 1;
    newFrequencyPeriod.value = 'daily';
    newSharedWith.value = [];
    showModal.value = false;
  } catch (error) {
    console.error('[Dashboard] Failed to add habit:', error);
    showToast('Failed to create habit', 'failed');
  } finally {
    isAddingHabit.value = false;
  }
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
    editSharedWithWorking.value = friends.value.map((f: any) => f.id);
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
  if (!editingHabit.value || !editTitle.value.trim() || isUpdatingHabit.value) return;
  
  isUpdatingHabit.value = true;
  isDirty.value = false;
  if (autosaveTimeout) {
    clearTimeout(autosaveTimeout);
    autosaveTimeout = null;
  }
  try {
    const updated = await api.updateHabit(editingHabit.value.id, { 
      title: editTitle.value.trim(),
      description: editDescription.value.trim(),
      frequencyCount: editFrequencyCount.value,
      frequencyPeriod: editFrequencyPeriod.value,
      sharedwith: editSharedWith.value,
      user_date: format(new Date(), 'yyyy-MM-dd'),
    });
    const idx = habits.value.findIndex(h => h.id === editingHabit.value?.id);
    if (idx >= 0) {
      habits.value[idx] = updated;
    }
  } catch (error) {
    console.error('[Dashboard] Failed to update habit:', error);
    showToast('Failed to save changes', 'failed');
  } finally {
    isUpdatingHabit.value = false;
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
  if (!editingHabit.value || isDeletingHabit.value) return;
  
  isDeletingHabit.value = true;
  try {
    await api.deleteHabit(editingHabit.value.id);
    habits.value = habits.value.filter(h => h.id !== editingHabit.value?.id);
    showDeleteModal.value = false;
    showEditModal.value = false;
  } catch (error) {
    console.error('[Dashboard] Failed to delete habit:', error);
    showToast('Failed to delete habit', 'failed');
  } finally {
    isDeletingHabit.value = false;
  }
};

// --- Dynamic Log Fetching ---
watch(currentCalendarDate, async (newDate) => {
  if (showEditModal.value) {
    const start = format(startOfMonth(newDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(newDate), 'yyyy-MM-dd');
    calendarLoading.value = true;
    try {
      const newLogs = await api.getLogs(start, end);
      newLogs.forEach(newLog => {
        const idx = logs.value.findIndex(l => l.id === newLog.id);
        if (idx >= 0) {
          logs.value[idx] = newLog;
        } else {
          logs.value.push(newLog);
        }
      });
    } catch (err) {
      console.error('[Dashboard] Failed to fetch historical logs:', err);
    } finally {
      calendarLoading.value = false;
    }
  }
});
// ----------------------------

const removeHabit = async (id: string) => {
  await api.deleteHabit(id);
  habits.value = habits.value.filter(h => h.id !== id);
};

// --- Modal State Management ---
const modalContent = ref<HTMLElement | null>(null);



const isAnyModalOpen = computed(() => 
  showModal.value || showEditModal.value || showDeleteModal.value || showSharingConfirmModal.value || showReorderModal.value
);

useModalHistory(isAnyModalOpen, () => {
  showModal.value = false;
  showEditModal.value = false;
  showDeleteModal.value = false;
  showSharingConfirmModal.value = false;
  showReorderModal.value = false;
});




const { subscribeToFriendHabits } = useRealtime();
let unsubscribeOwnHabits = () => {};

// Social integration is now handled by useSocial

onMounted(() => {

  // Social state is now initialized globally in default.vue layout
  load();
  window.addEventListener('click', closeLogMenu);
});

watch(() => user.value?.id, (newId) => {
  unsubscribeOwnHabits();
  if (newId) {

    unsubscribeOwnHabits = subscribeToFriendHabits(String(newId), (eventName, data) => {

      
      if (eventName === 'habit-updated' && data?.log && data?.habit) {
        // Update specific log
        const logIdx = logs.value.findIndex(l => 
          l.id === data.log.id || 
          (l.habitid === data.log.habitid && l.date === data.log.date)
        );
        if (logIdx >= 0) logs.value[logIdx] = data.log;
        else logs.value.push(data.log);

        // Update specific habit (for streaks)
        const habitIdx = habits.value.findIndex(h => h.id === data.habit.id);
        if (habitIdx >= 0) habits.value[habitIdx] = data.habit;
      } else if (eventName === 'habit-deleted') {
        const hid = data?.habitId || data?.habitid;
        if (hid && data?.date) {
          // Specific log was deleted
          logs.value = logs.value.filter(l => !(l.habitid === hid && l.date === data.date));
          if (data.habit) {
            const habitIdx = habits.value.findIndex(h => h.id === data.habit.id);
            if (habitIdx >= 0) habits.value[habitIdx] = data.habit;
          }
        } else if (hid) {
          // Entire habit was deleted
          habits.value = habits.value.filter(h => h.id !== hid);
          logs.value = logs.value.filter(l => l.habitid !== hid);
        } else {
          load(true);
        }
      } else {
        // Generic fallback for reorder or other updates
        load(true);
      }
    });
  }
}, { immediate: true });

onUnmounted(() => {
  // cleanupSocial(); // Now a no-op singleton cleanup handled by logout
  unsubscribeOwnHabits();
  window.removeEventListener('click', closeLogMenu);
});
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
</script>
