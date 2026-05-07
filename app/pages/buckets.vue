<template>
  <div class="relative">
    <!-- Sticky Header + Date Row -->
    <div class="sticky top-0 md:top-[57px] z-40">
    <div class="px-4 sm:px-0 flex items-end justify-between gap-4 bg-black pt-2 pb-2 sm:pt-4">
      <div class="flex items-center gap-4">
        <div class="w-10 h-10 bg-zinc-925 rounded-xl shadow-lg flex items-center justify-center border border-zinc-800">
          <PaintBucket class="w-6 h-6 text-zinc-400" />
        </div>
        <div>
          <h1 class="text-base font-bold tracking-tight text-white mb-1">Buckets</h1>
          <p class="text-zinc-400 text-xs">{{ buckets.length }} bucket{{ buckets.length === 1 ? '' : 's' }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="buckets.length > 1"
          @click="showReorderModal = true"
          class="w-11 sm:w-28 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-semibold rounded-xl transition-all cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-95 border border-zinc-700/60"
          title="Reorder"
        >
          <ArrowUpDown class="w-4 h-4" />
          <span class="hidden sm:inline">Reorder</span>
        </button>
        <button 
          @click="openAddModal" 
          class="w-11 sm:w-28 py-2.5 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-95"
          title="Add Bucket"
        >
          <Plus class="w-4 h-4" />
          <span class="hidden sm:inline">Add</span>
        </button>
      </div>
    </div>
    <!-- Date Header -->
    <div class="bg-zinc-925 border-b border-t border-x-0 sm:border-x border-zinc-800/80 py-2 sm:rounded-t-2xl flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-x-4 gap-y-2 sm:px-4">
        <div class="w-full px-4 sm:px-0 sm:flex-1 sm:min-w-[200px] hidden sm:block pr-0 sm:pr-2"></div>
        <div class="w-full sm:w-[320px] lg:w-[400px] shrink-0 px-2 sm:px-0">
          <div class="flex justify-evenly sm:justify-between items-end w-full">
            <div v-for="(day, i) in days" :key="i" class="flex flex-col items-center w-8">
              <div 
                class="text-[10px] uppercase tracking-tighter font-black transition-colors"
                :class="isToday(day) ? 'text-white' : 'text-zinc-500'"
              >
                {{ format(day, 'EEE') }}
              </div>
              <div 
                class="text-[10px] sm:text-xs font-bold transition-colors"
                :class="isToday(day) ? 'text-white' : 'text-zinc-500'"
              >
                {{ format(day, 'd') }}
              </div>
            </div>
          </div>
        </div>
    </div>
    </div>

    <!-- Shared Habit Edit Modal -->
    <HabitEditModal
      v-model="showHabitEditModal"
      :habit="editingHabit"
      :friends="friends"
      :logs="habitLogs"
      @habit-updated="onHabitUpdatedFromModal"
      @habit-deleted="onHabitDeletedFromModal"
      @open-log-menu="openLogMenu"
    />

    <!-- Bucket List -->
    <div v-motion-fade class="bg-zinc-925/80 backdrop-blur-md sm:rounded-b-2xl rounded-none shadow-2xl border-b border-x-0 sm:border-x sm:border-b border-zinc-800/80 divide-y divide-zinc-800/80 relative">

      <div v-if="loading" class="flex justify-center p-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
      <template v-else>
        <div v-if="buckets.length === 0" class="p-10 text-center text-zinc-500 italic text-sm">
          No buckets yet. Add one above!
        </div>
      
        <div 
          v-for="bucket in buckets" :key="bucket.id"
          :data-bucket-id="bucket.id"
          draggable="true"
          @dragstart="onDragStart($event, bucket.id)"
          @dragover.prevent="onDragOver($event, bucket.id)"
          @drop.prevent="onDrop($event, bucket.id)"
          @dragend="onDragEnd"
          class="relative transition-all border-b border-zinc-800/50 last:border-0"
          :class="[
            draggingId === bucket.id ? 'opacity-30' : 'opacity-100',
            dragOverId === bucket.id ? 'ring-2 ring-inset ring-white/20 bg-zinc-800/50' : ''
          ]"
        >
          <!-- Bucket Header Row -->
          <div 
            @click="toggleExpand(bucket.id)"
            class="relative py-3 group transition-all duration-300 ease-out flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-x-4 gap-y-2 cursor-pointer hover:bg-zinc-800/40 sm:px-4"
          >
            <div class="w-full px-4 sm:px-0 sm:flex-1 sm:min-w-[200px] flex flex-col gap-0.5 pr-0 sm:pr-2">
              <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <ChevronRight 
                  class="w-4 h-4 text-zinc-600 transition-transform duration-300"
                  :class="expandedBucketId === bucket.id ? 'rotate-90 text-white' : ''"
                />
                <h3 class="text-sm font-bold text-zinc-200 leading-tight break-all group-hover:text-white transition-colors">{{ bucket.title }}</h3>
                
                <!-- Streak Badge -->
                <div 
                  v-if="(bucket.currentStreak ?? 0) >= 2"
                  class="flex items-center gap-1 px-1.5 py-0.5 bg-black border rounded-md shrink-0"
                  :class="[
                    isFaded(bucket) ? 'opacity-30' : 'opacity-100',
                    getStreakTheme(bucket.currentStreak ?? 0).border
                  ]"
                >
                  <Flame 
                    v-if="(bucket.currentStreak ?? 0) >= 7"
                    class="w-2.5 h-2.5" 
                    :class="[
                      getStreakTheme(bucket.currentStreak ?? 0).text,
                      getStreakTheme(bucket.currentStreak ?? 0).fill
                    ]"
                  />
                  <span 
                    class="text-[10px] font-black tracking-tight"
                    :class="getStreakTheme(bucket.currentStreak ?? 0).text"
                  >
                    x{{ bucket.currentStreak }}
                  </span>
                </div>
              </div>
              
              <div class="hidden sm:flex items-center gap-2">
                <div class="flex items-center gap-2 text-[10px] text-zinc-500 font-medium ml-6">
                  <span>{{ getHabitsInBucket(bucket).length }} habits</span>
                  <button 
                    @click.stop="openEditModal(bucket)"
                    class="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <Edit2 class="w-3 h-3 text-zinc-600" />
                  </button>
                </div>
              </div>
            </div>
            
            <!-- Read-only Timeline -->
            <div class="w-full sm:w-[320px] lg:w-[400px] shrink-0 px-2 sm:px-0">
              <div class="flex justify-evenly sm:justify-between items-center w-full">
                <div v-for="(day, i) in days" :key="i" class="flex justify-center w-8">
                  <div class="relative">
                    <div
                      class="w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 relative"
                      :class="[
                        getBucketStatus(bucket.id, day) === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
                        getBucketStatus(bucket.id, day) === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
                        getBucketStatus(bucket.id, day) === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
                        getBucketStatus(bucket.id, day) === 'vacation' ? 'bg-amber-500 border-amber-500 shadow-md shadow-amber-500/20' :
                        isMarkable(day) ? 'bg-transparent border-dashed border-zinc-800' : 'bg-white/[0.03] border-dashed border-zinc-900',
                        !isMarkable(day) && getBucketStatus(bucket.id, day) ? 'opacity-60' : ''
                      ]"
                    >
                      <Check v-if="getBucketStatus(bucket.id, day) === 'completed'" class="w-4 h-4 text-white" />
                      <XIcon v-else-if="getBucketStatus(bucket.id, day) === 'failed'" class="w-4 h-4 text-white" />
                      <Minus v-else-if="getBucketStatus(bucket.id, day) === 'skipped'" class="w-4 h-4 text-white" />
                      <Palmtree v-else-if="getBucketStatus(bucket.id, day) === 'vacation'" class="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Mobile Habit Count: below timeline -->
            <div class="sm:hidden px-4 pt-1">
              <div class="flex items-center gap-2 text-[10px] text-zinc-500 font-medium ml-6">
                <span>{{ getHabitsInBucket(bucket).length }} habits</span>
                <button 
                  @click.stop="openEditModal(bucket)"
                  class="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <Edit2 class="w-3 h-3 text-zinc-600" />
                </button>
              </div>
            </div>

          </div>

          <!-- Expanded Content: Habit List -->
          <Transition
            enter-active-class="transition-all duration-300 ease-out overflow-hidden"
            enter-from-class="max-h-0 opacity-0"
            enter-to-class="max-h-[1000px] opacity-100"
            leave-active-class="transition-all duration-200 ease-in overflow-hidden"
            leave-from-class="max-h-[1000px] opacity-100"
            leave-to-class="max-h-0 opacity-0"
          >
            <div v-if="expandedBucketId === bucket.id" class="border-t border-zinc-800/50">

              <div v-if="getHabitsInBucket(bucket).length === 0" class="py-6 text-center text-zinc-500 text-sm italic">
                No habits in this bucket.
              </div>
              <div v-else class="divide-y divide-zinc-800/30">
                  <div v-for="(habit, hIdx) in getHabitsInBucket(bucket)" :key="habit.id" 
                    class="flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-x-4 gap-y-2 py-3 rounded-xl transition-all hover:bg-white/[0.03] group/habit-row sm:px-4"
                  >
                    <div 
                      class="w-full px-4 sm:px-0 sm:flex-1 sm:min-w-[200px] flex items-center gap-2 cursor-pointer group/habit"
                      @click.stop="openHabitEditModal(habit)"
                    >
                      <div class="w-4 h-4 shrink-0"></div>
                      <div class="min-w-0 flex-1 flex items-center gap-2">
                        <span class="text-xs sm:text-sm font-bold text-zinc-400 group-hover/habit:text-white transition-colors truncate">{{ habit.title }}</span>
                        
                        <!-- Habit Streak Pill -->
                        <div 
                          v-if="(habit.currentStreak ?? 0) >= 2"
                          class="flex items-center gap-1 px-1.5 py-0.5 bg-black border rounded-md shrink-0"
                          :class="[
                            isFaded(habit) ? 'opacity-30' : 'opacity-100',
                            getStreakTheme(habit.currentStreak ?? 0).border
                          ]"
                        >
                          <Flame 
                            v-if="(habit.currentStreak ?? 0) >= 7"
                            class="w-2.5 h-2.5" 
                            :class="[
                              getStreakTheme(habit.currentStreak ?? 0).text,
                              getStreakTheme(habit.currentStreak ?? 0).fill
                            ]"
                          />
                          <span 
                            class="text-[10px] font-black tracking-tight"
                            :class="getStreakTheme(habit.currentStreak ?? 0).text"
                          >
                            x{{ habit.currentStreak }}
                          </span>
                        </div>
                      </div>
                    </div>
                  
                    <!-- Interactive Logs -->
                    <div class="w-full sm:w-[320px] lg:w-[400px] shrink-0 px-2 sm:px-0">
                      <div class="flex justify-evenly sm:justify-between items-center w-full">
                        <div v-for="(day, idx) in days" :key="idx" class="flex justify-center w-8">
                          <button
                            type="button"
                            @click.stop="openLogMenu(habit, day, $event)"
                            class="w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 relative"
                            :class="[
                              isMarkable(day) ? 'cursor-pointer' : 'cursor-default',
                              getHabitStatus(habit.id, day) === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
                              getHabitStatus(habit.id, day) === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
                              getHabitStatus(habit.id, day) === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
                              getHabitStatus(habit.id, day) === 'vacation' ? 'bg-amber-500 border-amber-500 shadow-md shadow-amber-500/20' :
                              isMarkable(day) 
                                ? 'bg-transparent border-dashed border-zinc-800 hover:bg-zinc-800/40' 
                                : 'bg-white/[0.03] border-dashed border-zinc-900',
                              !isMarkable(day) && getHabitStatus(habit.id, day) ? 'opacity-60' : ''
                            ]"
                          >
                            <Check v-if="getHabitStatus(habit.id, day) === 'completed'" class="w-4 h-4 text-white" />
                            <XIcon v-else-if="getHabitStatus(habit.id, day) === 'failed'" class="w-4 h-4 text-white" />
                            <Minus v-else-if="getHabitStatus(habit.id, day) === 'skipped'" class="w-4 h-4 text-white" />
                            <Palmtree v-else-if="getHabitStatus(habit.id, day) === 'vacation'" class="w-4 h-4 text-white" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
              </div>
            </div>
          </Transition>
        </div>
      </template>
    </div>

    <!-- Add Bucket Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showModal" class="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto sm:py-8 py-0">
          <div class="fixed inset-0 bg-black/80 backdrop-blur-md touch-none" @click="showModal = false"></div>
          
          <!-- Modal Content -->
          <div 
            ref="modalContent"
            class="relative my-auto w-full h-full sm:h-auto sm:max-w-md max-w-none bg-zinc-925 border-x-0 sm:border border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl overflow-hidden transition-all duration-300 flex flex-col"
          >
            <!-- Sticky Header -->
            <div class="sticky top-0 z-10 bg-zinc-925 px-4 sm:px-8 py-4 sm:py-6 border-b border-zinc-800/80 flex items-center gap-1 shrink-0">
              <button @click="showModal = false" class="p-2 -ml-2 text-zinc-500 hover:text-white transition-all cursor-pointer flex-shrink-0">
                <ChevronLeft class="w-6 h-6" />
              </button>
              <div class="flex-1 min-w-0">
                <h2 class="text-lg font-bold text-white truncate leading-none min-w-0">New Bucket</h2>
              </div>
            </div>

            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-8 sm:py-6">
              <form id="addBucketForm" @submit.prevent="addBucket" class="space-y-6">
                <div class="space-y-2">
                  <label class="text-xs font-bold uppercase tracking-widest text-zinc-500">Name</label>
                  <input
                    v-model="newTitle"
                    type="text"
                    placeholder="e.g. Morning Routine"
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
                      rows="1"
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

                <!-- Habits Group -->
                  <div class="space-y-2 pt-4">
                    <div class="flex items-center justify-between">
                      <label class="text-xs font-bold uppercase tracking-widest text-zinc-500">Habits in this bucket</label>
                      <button 
                        type="button"
                        @click="toggleSelectAllForAdd"
                        title="Select/Unselect All"
                        class="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                      >
                        <CheckSquare class="w-4 h-4" />
                      </button>
                    </div>

                    <button 
                      type="button"
                      @click="openSharedHabitsPicker"
                      class="text-xs font-bold tracking-widest text-violet-400 hover:bg-white/5 px-2 py-1 -ml-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 w-fit"
                    >
                      <Plus class="w-3 h-3" />
                      Add habits shared by friends
                    </button>

                    <div class="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      <label v-for="habit in sortedHabitsForAdd" :key="habit.id" class="flex items-center justify-between p-3 bg-black border border-zinc-925 rounded-xl cursor-pointer hover:border-zinc-800 transition-colors">
                        <div class="flex items-center gap-3">
                          <span class="text-sm font-semibold text-zinc-200">{{ habit.title }}</span>
                        </div>
                        <div 
                          class="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                          :class="[
                            newHabitIds.includes(habit.id) 
                              ? 'bg-indigo-500 shadow-lg shadow-indigo-500/20' 
                              : 'bg-zinc-925'
                          ]"
                        >
                          <Check v-if="newHabitIds.includes(habit.id)" class="w-3.5 h-3.5 text-white" />
                        </div>
                        <input type="checkbox" :value="habit.id" v-model="newHabitIds" class="hidden" />
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
                class="flex-1 px-5 py-3 bg-transparent hover:bg-zinc-925 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="addBucketForm"
                :disabled="isAddingBucket"
                class="flex-1 px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                <template v-if="isAddingBucket">
                  <div class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                  Adding...
                </template>
                <template v-else>
                  Add Bucket
                </template>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Edit Bucket Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showEditModal" class="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto sm:py-8 py-0">
          <div class="fixed inset-0 bg-black/80 backdrop-blur-md touch-none" @click="showEditModal = false"></div>
          
          <!-- Modal Content -->
          <div 
            ref="modalContent"
            class="relative my-auto w-full h-full sm:h-auto sm:max-w-md max-w-none bg-zinc-925 border-x-0 sm:border border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl overflow-hidden transition-all duration-300 flex flex-col"
          >
            <!-- Sticky Header -->
            <div class="sticky top-0 z-10 bg-zinc-925 px-4 sm:px-8 py-4 sm:py-6 border-b border-zinc-800/80 flex items-center gap-1 shrink-0">
              <button @click="showEditModal = false" class="p-2 -ml-2 text-zinc-500 hover:text-white transition-all cursor-pointer flex-shrink-0">
                <ChevronLeft class="w-6 h-6" />
              </button>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 min-w-0">
                  <h2 class="text-lg font-bold text-white truncate leading-none min-w-0">{{ editTitle }}</h2>
                  <!-- Streak Badge -->
                  <div 
                    v-if="(editingBucket?.currentStreak ?? 0) >= 2"
                    class="flex items-center gap-1 px-2 py-0.5 bg-black border rounded-full shrink-0"
                    :class="[
                      isFaded(editingBucket as Bucket) ? 'opacity-30' : 'opacity-100',
                      getStreakTheme(editingBucket?.currentStreak ?? 0).border
                    ]"
                  >
                    <span 
                      class="text-[9px] font-black tracking-tight"
                      :class="getStreakTheme(editingBucket?.currentStreak ?? 0).text"
                    >
                      x{{ editingBucket?.currentStreak }} STREAK
                    </span>
                    <Flame 
                      v-if="(editingBucket?.currentStreak ?? 0) >= 7"
                      class="w-2.5 h-2.5" 
                      :class="[
                        getStreakTheme(editingBucket?.currentStreak ?? 0).text,
                        getStreakTheme(editingBucket?.currentStreak ?? 0).fill
                      ]"
                    />
                  </div>
                </div>
              </div>
              <button @click="showDeleteModal = true" class="p-2 text-zinc-500 hover:text-rose-500 transition-all cursor-pointer flex-shrink-0">
                <Trash2 class="w-5 h-5" />
              </button>
            </div>

            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-8 sm:py-6">
              
              <div class="space-y-6">
                <div class="space-y-2">
                  <label class="text-xs font-bold uppercase tracking-widest text-zinc-500">Name</label>
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
                      rows="1"
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
                          <div
                            class="w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 relative"
                            :class="[
                              (day.getMonth() !== currentCalendarDate.getMonth()) ? 'opacity-30' : '',
                              getBucketStatus(editingBucket!.id, day) === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
                              getBucketStatus(editingBucket!.id, day) === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
                              getBucketStatus(editingBucket!.id, day) === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
                              getBucketStatus(editingBucket!.id, day) === 'vacation' ? 'bg-amber-500 border-amber-500 shadow-md shadow-amber-500/20' :
                              'border-dashed border-zinc-800 bg-transparent'
                            ]"
                          >
                            <Check v-if="getBucketStatus(editingBucket!.id, day) === 'completed'" class="w-4 h-4 text-white" />
                            <XIcon v-else-if="getBucketStatus(editingBucket!.id, day) === 'failed'" class="w-4 h-4 text-white" />
                            <Minus v-else-if="getBucketStatus(editingBucket!.id, day) === 'skipped'" class="w-4 h-4 text-white" />
                            <Palmtree v-else-if="getBucketStatus(editingBucket!.id, day) === 'vacation'" class="w-4 h-4 text-white" />
                          </div>
                        </div>
                        <div 
                          class="text-[9px] font-bold transition-colors" 
                          :class="[
                            isToday(day) ? 'text-white' : (day.getMonth() === currentCalendarDate.getMonth() ? 'text-zinc-400' : 'text-zinc-600'),
                            day.getMonth() !== currentCalendarDate.getMonth() ? 'opacity-30' : ''
                          ]"
                        >
                          {{ format(day, 'd') }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                  <div class="space-y-2 pt-4">
                    <div class="flex items-center justify-between">
                      <label class="text-xs font-bold uppercase tracking-widest text-zinc-500">Habits in this bucket</label>
                      <button 
                        type="button"
                        @click="toggleSelectAllForEdit"
                        title="Select/Unselect All"
                        class="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                      >
                        <CheckSquare class="w-4 h-4" />
                      </button>
                    </div>

                    <button 
                      type="button"
                      @click="openSharedHabitsPicker"
                      class="text-xs font-bold tracking-widest text-violet-400 hover:bg-white/5 px-2 py-1 -ml-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 w-fit"
                    >
                      <Plus class="w-3 h-3" />
                      Add habits shared by friends
                    </button>

                    <div class="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar transition-all duration-300">
                      <label v-for="habit in sortedHabitsForEdit" :key="habit.id" class="flex items-center justify-between p-3 bg-black border border-zinc-925 rounded-xl transition-colors cursor-pointer hover:border-zinc-800">
                        <div class="flex items-center gap-3">
                          <span class="text-sm font-semibold text-zinc-200">{{ habit.title }}</span>
                        </div>
                        <div 
                          class="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                          :class="[
                            editHabitIds.includes(habit.id) 
                              ? 'bg-indigo-500 shadow-lg shadow-indigo-500/20' 
                              : 'bg-zinc-925'
                          ]"
                        >
                          <Check v-if="editHabitIds.includes(habit.id)" class="w-3.5 h-3.5 text-white" />
                        </div>
                        <input type="checkbox" :value="habit.id" v-model="editHabitIds" class="hidden" />
                      </label>
                    </div>
                  </div>
              </div>
            </div>

            <!-- Fixed Footer -->
            <div class="px-8 py-4 border-t border-zinc-800 bg-zinc-925/80 backdrop-blur-md">
              <button
                type="button"
                @click="handleEditDone"
                class="w-full px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer whitespace-nowrap"
              >
                Save
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
          <div class="fixed inset-0 bg-black/80 backdrop-blur-md touch-none" @click="showDeleteModal = false"></div>
          
          <!-- Modal Content -->
          <div class="relative my-auto w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
            <div class="w-16 h-16 bg-zinc-925 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 class="w-8 h-8 text-zinc-400" />
            </div>
            <h2 class="text-xl font-bold text-white mb-2">Delete Bucket?</h2>
            <p class="text-zinc-500 mb-8 text-sm">
              This will permanently remove "<span class="text-zinc-200 font-medium">{{ editingBucket?.title }}</span>" and its streak history. The underlying habits will NOT be deleted.
            </p>
            
            <div class="flex gap-3 mt-2">
              <button
                @click="showDeleteModal = false"
                class="flex-1 px-5 py-3 bg-transparent hover:bg-zinc-925 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                Keep Bucket
              </button>
              <button
                @click="handleDelete"
                :disabled="isDeletingBucket"
                class="flex-1 px-5 py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                <template v-if="isDeletingBucket">
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
          <div class="fixed inset-0 bg-black/80 backdrop-blur-md touch-none" @click="showReorderModal = false"></div>

          <!-- Modal Content -->
          <div class="relative my-auto w-full sm:max-w-sm bg-zinc-925 border-t sm:border border-zinc-800 sm:rounded-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col" style="max-height: 80vh">
            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 shrink-0">
              <div>
                <h2 class="text-base font-bold text-white">Reorder buckets</h2>
                <p class="text-[11px] text-zinc-500 mt-0.5">Drag to rearrange</p>
              </div>
              <button
                @click="showReorderModal = false"
                class="px-4 py-2 bg-white hover:bg-zinc-200 text-black text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap"
              >
                Done
              </button>
            </div>

            <!-- Compact bucket list -->
            <div class="overflow-y-auto flex-1 p-2">
              <div
                v-for="bucket in buckets"
                :key="bucket.id"
                :data-bucket-id="bucket.id"
                draggable="true"
                @dragstart="onDragStart($event, bucket.id)"
                @dragover.prevent="onDragOver($event, bucket.id)"
                @drop.prevent="onDrop($event, bucket.id)"
                @dragend="onDragEnd"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all select-none"
                :class="[
                  draggingId === bucket.id ? 'opacity-30' : 'opacity-100',
                  dragOverId === bucket.id ? 'bg-zinc-700/60 ring-1 ring-white/20' : 'hover:bg-zinc-800/60'
                ]"
              >
                <div
                  class="touch-none shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
                  :class="isDragging ? 'cursor-grabbing' : 'cursor-grab'"
                  @touchstart.prevent="onGripTouchStart($event, bucket.id)"
                >
                  <GripVertical class="w-4 h-4" />
                </div>
                <span class="text-sm font-semibold text-zinc-200 truncate flex-1">{{ bucket.title }}</span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Global Log Menu -->
    <LogMenu
      :habit="activeHabitForMenu || null"
      :date="activeLogMenu?.date || null"
      :logs="habitLogs"
      :reference-el="referenceRef"
      @select="setLogStatus"
      @close="closeLogMenu"
    />
  </div>
</template>

<script setup lang="ts">
import { Plus, Trash2, Check, X as XIcon, Minus, ChevronLeft, ChevronRight, Flame, PaintBucket, Palmtree, Edit2, ChevronDown, ChevronUp, ArrowUpDown, GripVertical, CheckSquare } from 'lucide-vue-next';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isAfter, startOfDay, parseISO, isToday, startOfWeek, addDays, isSameDay, isSameWeek, isSameMonth, differenceInDays } from 'date-fns';
import type { Bucket, BucketLog, Habit } from '~/composables/useHabitsApi';

definePageMeta({ middleware: 'auth' });

const api = useHabitsApi();
const { user } = useAuth();
const { friends } = useSocial();
const { lastSyncTime } = api;
const { showToast } = useToast();

useSeoMeta({
  title: 'Buckets - HabitsSocial',
  description: 'Organize your habits into custom buckets on HabitsSocial.',
});

const buckets = ref<Bucket[]>([]);
const habitLogs = ref<HabitLog[]>([]);
const bucketLogs = ref<BucketLog[]>([]);
const availableHabits = ref<Habit[]>([]);
const loading = ref(true);

const newTitle = ref('');
const newDescription = ref('');
const newHabitIds = ref<string[]>([]);
const showModal = ref(false);
const showReorderModal = ref(false);

const showEditModal = ref(false);
const showDeleteModal = ref(false);
const editingBucket = ref<Bucket | null>(null);
const editTitle = ref('');
const editDescription = ref('');
const editHabitIds = ref<string[]>([]);
const editDescriptionRef = ref<HTMLTextAreaElement | null>(null);
const isAddingBucket = ref(false);
const isDeletingBucket = ref(false);
const isUpdatingBucket = ref(false);

const currentCalendarDate = ref(new Date());
const calendarLoading = ref(false);

const expandedBucketId = ref<string | null>(null);
const activeLogMenu = ref<{ habitId: string, date: Date } | null>(null);
const referenceRef = ref<HTMLElement | null>(null);

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

// Sort habits for modals: Associated habits first, then follow "My habits" (global) order
const sortedHabitsForAdd = computed(() => {
  const associated = new Set(newHabitIds.value);
  return [...availableHabits.value].sort((a, b) => {
    const aIn = associated.has(a.id);
    const bIn = associated.has(b.id);
    if (aIn && !bIn) return -1;
    if (!aIn && bIn) return 1;
    return 0; // Stable sort preserves global order
  });
});

const sortedHabitsForEdit = computed(() => {
  // Use the ORIGINAL habitIds from the bucket being edited so the list doesn't jump around while clicking
  const associated = new Set(editingBucket.value?.habitIds || []);
  return [...availableHabits.value].sort((a, b) => {
    const aIn = associated.has(a.id);
    const bIn = associated.has(b.id);
    if (aIn && !bIn) return -1;
    if (!aIn && bIn) return 1;
    return 0; // Stable sort preserves global order
  });
});

const toggleSelectAllForAdd = () => {
  if (newHabitIds.value.length === availableHabits.value.length) {
    newHabitIds.value = [];
  } else {
    newHabitIds.value = availableHabits.value.map(h => h.id);
  }
};

const toggleSelectAllForEdit = () => {
  if (editHabitIds.value.length === availableHabits.value.length) {
    editHabitIds.value = [];
  } else {
    editHabitIds.value = availableHabits.value.map(h => h.id);
  }
};


const prevMonth = () => currentCalendarDate.value = subMonths(currentCalendarDate.value, 1);
const nextMonth = () => currentCalendarDate.value = addMonths(currentCalendarDate.value, 1);

watch(currentCalendarDate, async (newDate) => {
  if (showEditModal.value) {
    const start = format(startOfMonth(newDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(newDate), 'yyyy-MM-dd');
    calendarLoading.value = true;
    try {
      const [newHabitLogs, newBucketLogs] = await Promise.all([
        api.getLogs(start, end),
        api.getBucketLogs(start, end)
      ]);
      
      // Merge habit logs
      newHabitLogs.forEach(nl => {
        const idx = habitLogs.value.findIndex(l => l.id === nl.id);
        if (idx >= 0) habitLogs.value[idx] = nl;
        else habitLogs.value.push(nl);
      });
      
      // Merge bucket logs
      newBucketLogs.forEach(nl => {
        const idx = bucketLogs.value.findIndex(l => l.id === nl.id);
        if (idx >= 0) bucketLogs.value[idx] = nl;
        else bucketLogs.value.push(nl);
      });
    } catch (err) {
      console.error('[Buckets] Failed to fetch historical logs:', err);
    } finally {
      calendarLoading.value = false;
    }
  }
});

const today = new Date();
const days = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(today, { weekStartsOn: 0 }), i));
const startDate = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
const endDate = format(endOfMonth(addMonths(today, 1)), 'yyyy-MM-dd');

const toggleExpand = (bucketId: string) => {
  const isOpening = expandedBucketId.value !== bucketId;
  expandedBucketId.value = isOpening ? bucketId : null;

  if (isOpening) {
    nextTick(() => {
      const el = document.querySelector(`[data-bucket-id="${bucketId}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const offset = 80; // Account for sticky header
        const top = window.pageYOffset + rect.top - offset;
        
        window.scrollTo({
          top,
          behavior: 'smooth'
        });
      }
    });
  }
};

const getHabitsInBucket = (bucket: Bucket) => {
  if (!bucket.habitIds) return [];
  return availableHabits.value.filter(h => bucket.habitIds.includes(h.id));
};

const activeHabitForMenu = computed(() => {
  if (!activeLogMenu.value) return null;
  return availableHabits.value.find(h => h.id === activeLogMenu.value?.habitId);
});

const openLogMenu = (habit: Habit, day: Date, event: MouseEvent) => {
  if (!isMarkable(day)) {
    showToast('You can only update habits for the last 14 days', 'failed');
    return;
  }
  if (activeLogMenu.value && activeLogMenu.value.habitId === habit.id && isSameDay(activeLogMenu.value.date, day)) {
    activeLogMenu.value = null;
    referenceRef.value = null;
  } else {
    const el = (event.target as HTMLElement).closest('button');
    if (el) {
      referenceRef.value = el;
      activeLogMenu.value = { habitId: habit.id, date: day };
    }
  }
};

const closeLogMenu = () => {
  activeLogMenu.value = null;
};

const setLogStatus = async (habit: Habit, day: Date, status: any) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  try {
    if (status === null) {
      await api.deleteLog(habit.id, dateStr);
    } else {
      await api.upsertLog({
        habitId: habit.id,
        date: dateStr,
        status
      });
    }
    // Refresh only logs to be fast
    const start = format(startOfMonth(currentCalendarDate.value), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentCalendarDate.value), 'yyyy-MM-dd');
    const [newL, newBL] = await Promise.all([
      api.getLogs(start, end),
      api.getBucketLogs(start, end)
    ]);
    habitLogs.value = newL;
    bucketLogs.value = newBL;
    activeLogMenu.value = null;
  } catch (error) {
    console.error('[Buckets] Failed to update log:', error);
    showToast('Failed to update log', 'failed');
  }
};

const isMarkable = (day: Date) => {
  const diff = differenceInDays(startOfDay(today), startOfDay(day));
  return diff >= 0 && diff < 14;
};

const getBucketStatus = (bucketId: string, day: Date) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  return bucketLogs.value.find(l => l.bucketId === bucketId && l.date === dateStr)?.status;
};

const getHabitStatus = (habitId: string, day: Date) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  return habitLogs.value.find(l => l.habitId === habitId && l.date === dateStr)?.status;
};

const autoExpand = (e: Event | HTMLElement) => {
  const el = (e instanceof Event ? e.target : e) as HTMLTextAreaElement;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
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

const isFaded = (item: Bucket | Habit) => {
  if (!item || !item.streakAnchorDate) return false;
  const anchor = startOfDay(parseISO(item.streakAnchorDate));
  const yesterday = startOfDay(subDays(new Date(), 1));
  return isAfter(yesterday, anchor);
};

const getStatus = (bucketId: string, day: Date): 'completed' | 'failed' | 'skipped' | 'vacation' | 'cleared' | null => {
  const dateStr = format(day, 'yyyy-MM-dd');
  const log = bucketLogs.value.find(l => l.bucketId === bucketId && l.date === dateStr);
  return (log?.status as any) || null;
};

const getHabitPreview = (bucket: Bucket) => {
  if (!bucket.habitIds || bucket.habitIds.length === 0) return '';
  return bucket.habitIds
    .map(id => availableHabits.value.find(h => h.id === id)?.title)
    .filter(Boolean)
    .join(', ');
};

const load = async (silent = false) => {
  if (!silent) loading.value = true;
  try {
    const [b, l, bl, h] = await Promise.all([
      api.getBuckets(), 
      api.getLogs(startDate, endDate),
      api.getBucketLogs(startDate, endDate),
      api.getHabits()
    ]);
    buckets.value = b;
    habitLogs.value = l;
    bucketLogs.value = bl;
    availableHabits.value = h;
  } catch (error) {
    console.error('[Buckets] load() failed:', error);
  } finally {
    loading.value = false;
  }
};

// --- Habit Editing ---
const showHabitEditModal = ref(false);
const editingHabit = ref<Habit | null>(null);

const onHabitUpdatedFromModal = ({ habit, logs: newLogs }: { habit?: Habit, logs?: HabitLog[] }) => {
  if (habit) {
    const idx = availableHabits.value.findIndex(h => h.id === habit.id);
    if (idx >= 0) availableHabits.value[idx] = habit;
  }
  if (newLogs) {
    newLogs.forEach(nl => {
      const idx = habitLogs.value.findIndex(l => l.id === nl.id);
      if (idx >= 0) habitLogs.value[idx] = nl;
      else habitLogs.value.push(nl);
    });
  }
};

const onHabitDeletedFromModal = (habitId: string) => {
  availableHabits.value = availableHabits.value.filter(h => h.id !== habitId);
  // Also remove from buckets
  buckets.value.forEach(b => {
    if (b.habitIds?.includes(habitId)) {
      b.habitIds = b.habitIds.filter(id => id !== habitId);
    }
  });
};

const openHabitEditModal = (habit: Habit) => {
  editingHabit.value = habit;
  showHabitEditModal.value = true;
};

const openHabitEditModalById = (habitId: string) => {
  const habit = availableHabits.value.find(h => h.id === habitId);
  if (habit) openHabitEditModal(habit);
};

const getHabitTitle = (habitId: string) => {
  return availableHabits.value.find(h => h.id === habitId)?.title || 'Unknown Habit';
};


const openAddModal = () => {
  if (buckets.value.length >= 30) {
    showToast('Limit reached: You can track a maximum of 30 buckets.', 'failed');
    return;
  }
  newTitle.value = '';
  newDescription.value = '';
  newHabitIds.value = [];
  showModal.value = true;
};

const openSharedHabitsPicker = () => {
  // TODO: Implement shared habits picker
  showToast('Shared habits picker coming soon!', 'skipped');
};

const addBucket = async () => {
  if (!newTitle.value.trim() || isAddingBucket.value) return;
  
  isAddingBucket.value = true;
  try {
    const bucket = await api.createBucket({ 
      title: newTitle.value.trim(), 
      description: newDescription.value.trim(),
      color: '#6366f1',
      habitIds: newHabitIds.value
    });
    buckets.value.unshift(bucket);
    showModal.value = false;
    // Re-fetch logs to get initial logs for this new bucket
    load(true);
  } catch (error) {
    console.error('[Buckets] Failed to add bucket:', error);
    showToast('Failed to create bucket', 'failed');
  } finally {
    isAddingBucket.value = false;
  }
};

const openEditModal = (bucket: Bucket) => {
  editingBucket.value = bucket;
  editTitle.value = bucket.title;
  editDescription.value = bucket.description || '';
  editHabitIds.value = [...(bucket.habitIds || [])];
  showEditModal.value = true;
  
  nextTick(() => {
    if (editDescriptionRef.value) {
      autoExpand(editDescriptionRef.value);
    }
  });
};

const updateBucket = async () => {
  if (!editingBucket.value || !editTitle.value.trim() || isUpdatingBucket.value) return;
  
  isUpdatingBucket.value = true;
  try {
    const updated = await api.updateBucket(editingBucket.value.id, { 
      title: editTitle.value.trim(),
      description: editDescription.value.trim(),
      habitIds: editHabitIds.value
    });
    const idx = buckets.value.findIndex(b => b.id === editingBucket.value?.id);
    if (idx >= 0) {
      buckets.value[idx] = updated;
    }
    // Habits may have changed, affecting logs immediately. Re-fetch.
    load(true);
  } catch (error) {
    console.error('[Buckets] Failed to update bucket:', error);
    showToast('Failed to save changes', 'failed');
  } finally {
    isUpdatingBucket.value = false;
  }
};

const handleEditDone = () => {
  updateBucket();
  showEditModal.value = false;
};

const handleDelete = async () => {
  if (!editingBucket.value || isDeletingBucket.value) return;
  
  isDeletingBucket.value = true;
  try {
    await api.deleteBucket(editingBucket.value.id);
    buckets.value = buckets.value.filter(b => b.id !== editingBucket.value?.id);
    showDeleteModal.value = false;
    showEditModal.value = false;
  } catch (error) {
    console.error('[Buckets] Failed to delete bucket:', error);
    showToast('Failed to delete bucket', 'failed');
  } finally {
    isDeletingBucket.value = false;
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
    const row = el?.closest('[data-bucket-id]') as HTMLElement | null;
    if (row) {
      const bid = row.dataset.bucketId;
      if (bid && bid !== draggingId.value) dragOverId.value = bid;
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
  const fromIdx = buckets.value.findIndex(b => b.id === fromId);
  const toIdx   = buckets.value.findIndex(b => b.id === toId);
  if (fromIdx === -1 || toIdx === -1) return;
  const list = [...buckets.value];
  const [moved] = list.splice(fromIdx, 1) as [Bucket];
  list.splice(toIdx, 0, moved);
  buckets.value = list;
  scheduleReorderSave();
};

let reorderTimeout: ReturnType<typeof setTimeout> | null = null;
const scheduleReorderSave = () => {
  if (reorderTimeout) clearTimeout(reorderTimeout);
  reorderTimeout = setTimeout(() => {
    api.reorderBuckets(buckets.value.map(b => b.id));
  }, 500);
};
// ─────────────────────────────────────────────────────────────────────────────

const isAnyModalOpen = computed(() => 
  showModal.value || showEditModal.value || showDeleteModal.value || showReorderModal.value
);

useModalHistory(isAnyModalOpen, () => {
  showModal.value = false;
  showReorderModal.value = false;
  showEditModal.value = false;
  showDeleteModal.value = false;
});

const { subscribeToFriendHabits, subscribeToUserBuckets } = useRealtime();
let unsubscribeOwnBuckets = () => {};
let unsubscribeOwnHabits = () => {};

onMounted(() => {
  load();
});

watch(lastSyncTime, () => {
  console.log('[Buckets] Background sync detected, refreshing data...');
  load(true);
});

watch(() => user.value?.id, (newId) => {
  unsubscribeOwnBuckets();
  unsubscribeOwnHabits();
  if (newId) {
    const idStr = String(newId);
    
    // Listen to bucket-specific events (CRUD on buckets)
    unsubscribeOwnBuckets = subscribeToUserBuckets(idStr, () => {
      api.sync();
    });

    // Listen to habit events (logging a habit affects bucket progress/streaks)
    unsubscribeOwnHabits = subscribeToFriendHabits(idStr, () => {
      api.sync();
    });

  }
}, { immediate: true });

onUnmounted(() => {
  unsubscribeOwnBuckets();
  unsubscribeOwnHabits();
});

</script>
