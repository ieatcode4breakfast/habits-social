<template>
  <div class="relative">
    <!-- Sticky Header + Date Row -->
    <div class="sticky top-0 md:top-[57px] z-40">
    <div class="px-4 sm:px-0 flex items-end justify-between gap-4 bg-black pt-2 pb-2 sm:pt-4">
      <div class="flex items-center gap-4">
        <UserAvatar 
          v-if="user"
          :src="user.photoUrl" 
          container-class="w-10 h-10 bg-zinc-925 rounded-xl shadow-sm"
          icon-class="w-6 h-6 text-zinc-600"
        />
        <div>
          <h1 class="text-base font-bold tracking-tight text-white mb-1">My habits</h1>
          <p class="text-zinc-400 text-xs">{{ habits.length }} habit{{ habits.length === 1 ? '' : 's' }}</p>
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
          @click="openAddModal" 
          class="w-11 sm:w-28 py-2.5 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-95"
          title="Add Habit"
        >
          <Plus class="w-4 h-4" />
          <span class="hidden sm:inline">Add</span>
        </button>
      </div>
    </div>
    <!-- Date Header -->
    <div class="bg-zinc-925/95 backdrop-blur-md border-b border-t border-x-0 sm:border-x border-zinc-800/80 py-2 sm:rounded-t-2xl flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-x-4 gap-y-2 sm:px-4">
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

    <!-- Habit List (Single Card) -->
    <div v-motion-fade class="bg-zinc-925/80 backdrop-blur-md sm:rounded-b-2xl rounded-none shadow-2xl border-b border-x-0 sm:border-x sm:border-b border-zinc-800/80 divide-y divide-zinc-800/80 relative">

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
        class="relative py-3 group transition-all flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-x-4 gap-y-2 cursor-pointer hover:bg-zinc-800/40 sm:px-4"
        :class="[
          draggingId === habit.id ? 'opacity-30' : 'opacity-100',
          dragOverId === habit.id ? 'ring-2 ring-inset ring-white/20 bg-zinc-800/50' : ''
        ]"
      >
        <div class="w-full px-4 sm:px-0 sm:flex-1 sm:min-w-[200px] flex flex-col gap-1 pr-0 sm:pr-2">
          <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <h3 class="text-sm font-bold text-zinc-200 leading-tight break-all group-hover:text-white transition-colors">{{ habit.title }}</h3>
            <!-- Compact Streak Badge -->
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
          <!-- Frequency Text -->
          <div class="text-[10px] font-semibold tracking-tight text-zinc-500">
            {{ getFrequencyText(habit) }}
          </div>
        </div>
        
        <!-- Checkboxes Section -->
        <div class="w-full sm:w-[320px] lg:w-[400px] shrink-0 px-2 sm:px-0">
          <div class="flex justify-evenly sm:justify-between items-center w-full">
            <div v-for="(day, i) in days" :key="i" class="flex justify-center w-8">
              <div class="relative">
                <button
                  @click.stop="openLogMenu(habit, day, $event)"
                  class="w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 relative"
                  :class="[
                    isMarkable(day) ? 'cursor-pointer' : 'cursor-default',
                    getStatus(habit.id, day) === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
                    getStatus(habit.id, day) === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
                    getStatus(habit.id, day) === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
                    getStatus(habit.id, day) === 'vacation' ? 'bg-amber-500 border-amber-500 shadow-md shadow-amber-500/20' :
                    isMarkable(day) 
                      ? 'bg-transparent border-dashed border-zinc-800 hover:bg-zinc-925' 
                      : 'bg-white/[0.03] border-dashed border-zinc-900',
                    !isMarkable(day) && getStatus(habit.id, day) ? 'opacity-60' : ''
                  ]"
                >
                  <Check v-if="getStatus(habit.id, day) === 'completed'" class="w-4 h-4 text-white" />
                  <XIcon v-else-if="getStatus(habit.id, day) === 'failed'" class="w-4 h-4 text-white" />
                  <Minus v-else-if="getStatus(habit.id, day) === 'skipped'" class="w-4 h-4 text-white" />
                  <Palmtree v-else-if="getStatus(habit.id, day) === 'vacation'" class="w-4 h-4 text-white" />
                </button>
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
                <h2 class="text-lg font-bold text-white truncate leading-none min-w-0">New Habit</h2>
              </div>
            </div>

            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-8 sm:py-6">
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

                <!-- Frequency Group -->
                <div class="flex items-start gap-3">
                  <!-- Left: Label + Selector -->
                  <div class="flex flex-col gap-2">
                    <label class="text-xs font-bold uppercase tracking-widest text-zinc-500 h-4 flex items-center">Skips Allowed</label>
                    <select
                      v-model="newSkipsPeriod"
                      class="w-32 h-10 px-3 py-2 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-600 text-white appearance-none cursor-pointer text-sm"
                    >
                      <option value="none">No limit</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  <template v-if="newSkipsPeriod !== 'none'">
                    <div class="flex items-start gap-3">
                      <div class="flex items-center gap-3">
                        <div class="flex flex-col items-center">
                          <button type="button" @click="adjustFrequency(true, 1)" class="h-4 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                            <ChevronUp class="w-3 h-3" />
                          </button>
                          <div class="pt-2 pb-1">
                            <input
                              v-model.number="newSkipsCount"
                              type="number"
                              @blur="newSkipsCount = newSkipsPeriod === 'weekly' ? Math.max(0, Math.min(6, newSkipsCount)) : (newSkipsPeriod === 'monthly' ? Math.max(0, Math.min(28, newSkipsCount)) : 0)"
                              class="w-10 h-10 bg-black border border-zinc-800 rounded-lg text-center text-sm font-medium text-white focus:outline-none focus:ring-1 focus:ring-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                          <button type="button" @click="adjustFrequency(true, -1)" class="h-4 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                            <ChevronDown class="w-3 h-3" />
                          </button>
                        </div>
                        <span class="text-zinc-500 text-sm">{{ newSkipsCount === 1 ? 'skip' : 'skips' }}</span>
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
                          :src="friend.photoUrl" 
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
                class="flex-1 px-5 py-3 bg-transparent hover:bg-zinc-925 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="addHabitForm"
                :disabled="isAddingHabit"
                class="flex-1 px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
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

    <!-- Shared Habit Edit Modal -->
    <HabitEditModal
      v-model="showEditModal"
      :habit="editingHabit"
      :friends="friends"
      :logs="logs"
      @habit-updated="onHabitUpdatedFromModal"
      @habit-deleted="onHabitDeletedFromModal"
      @open-log-menu="openLogMenu"
    />

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
          <div class="fixed inset-0 bg-black/80 backdrop-blur-md touch-none" @click="showReorderModal = false"></div>

          <!-- Modal Content -->
          <div class="relative my-auto w-full sm:max-w-sm bg-zinc-925 border-t sm:border border-zinc-800 sm:rounded-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col" style="max-height: 80vh">
            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 shrink-0">
              <div>
                <h2 class="text-base font-bold text-white">Reorder habits</h2>
                <p class="text-[11px] text-zinc-500 mt-0.5">Drag to rearrange</p>
              </div>
              <button
                @click="showReorderModal = false"
                class="px-4 py-2 bg-white hover:bg-zinc-200 text-black text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap"
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
                  @touchstart.prevent="onGripTouchStart($event)"
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

    <!-- Global Log Menu -->
    <LogMenu
      :habit="activeHabitForMenu || null"
      :date="activeLogMenu?.date || null"
      :logs="logs"
      :reference-el="referenceRef"
      :skips-period="showEditModal && editingHabit?.id === activeLogMenu?.habitId ? editSkipsPeriod : undefined"
      :skips-count="showEditModal && editingHabit?.id === activeLogMenu?.habitId ? editSkipsCount : undefined"
      @select="setLogStatus"
      @close="closeLogMenu"
    />
  </div>
</template>

<script setup lang="ts">
import { Plus, Trash2, Check, X as XIcon, Minus, ChevronLeft, ChevronRight, User, ChevronUp, ChevronDown, Edit2, Save, CheckSquare, GripVertical, ArrowUpDown, Flame, Palmtree } from 'lucide-vue-next';
import { format, subDays, isToday, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isAfter, startOfDay, addDays, isSameWeek, isSameMonth, parseISO, startOfWeek, isBefore, isSameDay } from 'date-fns';
import type { Habit, HabitLog } from '~/composables/useHabitsApi';

definePageMeta({ middleware: 'auth' });
import { useSocial } from '../composables/useSocial';

const api = useHabitsApi();
const { user } = useAuth();
const { lastSyncTime } = api;
const { friends: rawFriends, refresh: refreshSocial, init: initSocial, cleanup: cleanupSocial } = useSocial();

const friends = computed(() => {
  const list = [...(rawFriends.value || [])];
  return list.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
});

const sortedFriendsForEdit = computed(() => {
  if (!editingHabit.value) return friends.value;
  const sharedIds = new Set(editingHabit.value.sharedWith || []);
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
const newSkipsCount = ref(2);
const newSkipsPeriod = ref<'none' | 'weekly' | 'monthly'>('weekly');
const newSharedWith = ref<string[]>([]);
const showModal = ref(false);
const showReorderModal = ref(false);

const showEditModal = ref(false);
const showDeleteModal = ref(false);
const editingHabit = ref<Habit | null>(null);
const editTitle = ref('');
const editDescription = ref('');
const editSkipsCount = ref(2);
const editSkipsPeriod = ref<'none' | 'weekly'|'monthly'>('weekly');
const editSharedWith = ref<string[]>([]);
const editSharedWithWorking = ref<string[]>([]);
const isEditingSharing = ref(false);
const showSharingConfirmModal = ref(false);
const reachedConfirmViaDone = ref(false);
const editDescriptionRef = ref<HTMLTextAreaElement | null>(null);
const currentCalendarDate = ref(new Date());
const calendarLoading = ref(false);
const isAddingHabit = ref(false);

const draggingId = ref<string | null>(null);
const dragOverId = ref<string | null>(null);
const isDragging = ref(false);

const onDragStart = (e: DragEvent, id: string) => {
  draggingId.value = id;
  isDragging.value = true;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }
};

const onDragOver = (e: DragEvent, id: string) => {
  if (draggingId.value === id) return;
  dragOverId.value = id;
};

const onDrop = async (e: DragEvent, targetId: string) => {
  const sourceId = draggingId.value;
  if (!sourceId || sourceId === targetId) return;

  const oldIndex = habits.value.findIndex(h => h.id === sourceId);
  const newIndex = habits.value.findIndex(h => h.id === targetId);

  if (oldIndex !== -1 && newIndex !== -1) {
    const [movedHabit] = habits.value.splice(oldIndex, 1);
    if (movedHabit) {
      habits.value.splice(newIndex, 0, movedHabit);
    }
    
    try {
      await api.reorderHabits(habits.value.map(h => h.id));
    } catch (err) {
      console.error('[My Habits] Failed to save reorder:', err);
      showToast('Failed to save order', 'failed');
    }
  }
  
  dragOverId.value = null;
  draggingId.value = null;
};

const onDragEnd = () => {
  draggingId.value = null;
  dragOverId.value = null;
  isDragging.value = false;
};

const onGripTouchStart = (e: TouchEvent) => {
  // Grip handle touch start placeholder
};

const adjustFrequency = (isNew: boolean, delta: number) => {
  if (isNew) {
    if (newSkipsPeriod.value === 'none') return;
    const max = newSkipsPeriod.value === 'weekly' ? 6 : 28;
    newSkipsCount.value = Math.max(0, Math.min(max, newSkipsCount.value + delta));
  }
};

const openAddModal = () => {
  if (habits.value.length >= 30) {
    showToast('Limit reached: You can track a maximum of 30 habits.', 'failed');
    return;
  }
  showModal.value = true;
};

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
const days = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(today, { weekStartsOn: 0 }), i));
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
  const period = habit.skipsPeriod;
  const maxSkips = habit.skipsCount ?? 0;
  const now = new Date();

  let skipped = 0;
  if (period === 'weekly') {
    skipped = logs.value.filter(l => 
      l.habitId === habit.id && 
      l.status === 'skipped' && 
      isSameWeek(new Date(l.date), now, { weekStartsOn: 0 })
    ).length;
  } else if (period === 'monthly') {
    skipped = logs.value.filter(l => 
      l.habitId === habit.id && 
      l.status === 'skipped' && 
      isSameMonth(new Date(l.date), now)
    ).length;
  }

  if (period === 'none') return 'Unlimited skips';

  const remainingSkips = Math.max(0, maxSkips - skipped);
  const skipText = remainingSkips === 1 ? '1 skip remaining' : `${remainingSkips} skips remaining`;
  
  return `${skipText} this ${period === 'weekly' ? 'week' : 'month'}`;
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
    console.error('[My Habits] load() failed:', error);
  } finally {
    loading.value = false;
  }
};



const getStatus = (habitId: string, day: Date) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  return logs.value.find(l => l.habitId === habitId && l.date === dateStr)?.status;
};

const activeLogMenu = ref<{ habitId: string, date: Date } | null>(null);
const referenceRef = ref<HTMLElement | null>(null);

const activeHabitForMenu = computed(() => {
  if (!activeLogMenu.value) return null;
  return habits.value.find(h => h.id === activeLogMenu.value?.habitId) || (editingHabit.value?.id === activeLogMenu.value?.habitId ? editingHabit.value : null);
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


const setLogStatus = async (habit: Habit, day: Date, nextStatus: 'completed' | 'failed' | 'skipped' | 'vacation' | null) => {
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
        habitId: habit.id,
        ownerId: user.value?.id || '',
        date: dateStr,
        status: nextStatus,
        sharedWith: habit.sharedWith || []
      });
    }
    
    if (nextStatus === 'completed') showToast('Completed', 'completed');
    else if (nextStatus === 'failed') showToast('Failed', 'failed');
    else if (nextStatus === 'skipped') showToast('Skipped', 'skipped');
    else if (nextStatus === 'vacation') showToast('On Vacation!', 'skipped');
  } else {
    logs.value = logs.value.filter(l => !(l.habitId === habit.id && l.date === dateStr));
    showToast('Cleared', 'cleared');
  }

  activeLogMenu.value = null;

  // 2. Background Sync
  try {
    if (nextStatus) {
      const { log, habit: updatedHabit } = await api.upsertLog({ 
        habitId: habit.id, 
        date: dateStr, 
        status: nextStatus, 
        sharedWith: habit.sharedWith 
      });
      
      // Update with real server data (ensures correct IDs and recalculated streaks)
      const idx = logs.value.findIndex(l => l.habitId === habit.id && l.date === dateStr);
      if (idx >= 0) logs.value[idx] = log;
      
      const habitIdx = habits.value.findIndex(h => h.id === habit.id);
      if (habitIdx >= 0) habits.value[habitIdx] = updatedHabit;
    } else {
      const { log, habit: updatedHabit } = await api.deleteLog(habit.id, dateStr);
      
      // Update logs array with the 'cleared' record
      const idx = logs.value.findIndex(l => l.habitId === habit.id && l.date === dateStr);
      if (idx >= 0) logs.value[idx] = log;
      else logs.value.push(log);

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
  
  if (habits.value.length >= 30) {
    showToast('Limit reached: You can track a maximum of 30 habits.', 'failed');
    return;
  }

  isAddingHabit.value = true;
  try {
    const habit = await api.createHabit({ 
      title: newTitle.value.trim(), 
      description: newDescription.value.trim(),
      skipsCount: newSkipsCount.value,
      skipsPeriod: newSkipsPeriod.value,
      sharedWith: newSharedWith.value,
      color: '#6366f1',
      userDate: format(new Date(), 'yyyy-MM-dd')
    });
    habits.value.unshift(habit);
    newTitle.value = '';
    newDescription.value = '';
    newSkipsCount.value = 2;
    newSkipsPeriod.value = 'weekly';
    newSharedWith.value = [];
    showModal.value = false;
  } catch (error) {
    console.error('[My Habits] Failed to add habit:', error);
    showToast('Failed to create habit', 'failed');
  } finally {
    isAddingHabit.value = false;
  }
};

const onHabitUpdatedFromModal = ({ habit, logs: newLogs }: { habit?: Habit, logs?: HabitLog[] }) => {
  if (habit) {
    const idx = habits.value.findIndex(h => h.id === habit.id);
    if (idx >= 0) habits.value[idx] = habit;
  }
  if (newLogs) {
    newLogs.forEach(nl => {
      const idx = logs.value.findIndex(l => l.id === nl.id);
      if (idx >= 0) logs.value[idx] = nl;
      else logs.value.push(nl);
    });
  }
};

const onHabitDeletedFromModal = (habitId: string) => {
  habits.value = habits.value.filter(h => h.id !== habitId);
};

const openEditModal = (habit: Habit) => {
  editingHabit.value = habit;
  showEditModal.value = true;
};
// --- Modal State Management ---
const modalContent = ref<HTMLElement | null>(null);

const isAnyModalOpen = computed(() => 
  showModal.value || showReorderModal.value
);

useModalHistory(isAnyModalOpen, () => {
  showModal.value = false;
  showReorderModal.value = false;
});




const { subscribeToFriendHabits, subscribeToUserBuckets } = useRealtime();
let unsubscribeOwnHabits = () => {};
let unsubscribeOwnBuckets = () => {};

// Social integration is now handled by useSocial

onMounted(() => {

  // Social state is now initialized globally in default.vue layout
  load();
});

watch(lastSyncTime, () => {
  console.log('[Dashboard] Background sync detected, refreshing data...');
  load(true);
});

watch(() => user.value?.id, (newId) => {
  unsubscribeOwnHabits();
  if (newId) {

    unsubscribeOwnHabits = subscribeToFriendHabits(String(newId), (eventName: string, data: any) => {

      
      if (eventName === 'habit-updated' && data?.log && data?.habit) {
        // Update specific log
        const logIdx = logs.value.findIndex(l => 
          l.id === data.log.id || 
          (l.habitId === data.log.habitId && l.date === data.log.date)
        );
        if (logIdx >= 0) logs.value[logIdx] = data.log;
        else logs.value.push(data.log);

        // Update specific habit (for streaks)
        const habitIdx = habits.value.findIndex(h => h.id === data.habit.id);
        if (habitIdx >= 0) {
          habits.value[habitIdx] = data.habit;
        } else {
          // New habit from another session, need to sync Dexie
          api.sync();
        }

      } else if (eventName === 'habit-deleted') {
        const hid = data?.habitId;
        if (hid && data?.date) {
          // Specific log was deleted
          logs.value = logs.value.filter(l => !(l.habitId === hid && l.date === data.date));
          if (data.habit) {
            const habitIdx = habits.value.findIndex(h => h.id === data.habit.id);
            if (habitIdx >= 0) habits.value[habitIdx] = data.habit;
          }
          // Note: Specific log deletions are currently handled as 'cleared' status in logs,
          // so standard sync will pick them up.
        } else if (hid) {
          // Entire habit was deleted
          habits.value = habits.value.filter(h => h.id !== hid);
          logs.value = logs.value.filter(l => l.habitId !== hid);
          // Trigger sync to purge from Dexie
          api.sync();
        } else {
          api.sync();
        }
      } else {
        // Generic fallback for reorder or other updates
        api.sync();
      }
    });

    unsubscribeOwnBuckets = subscribeToUserBuckets(String(newId), (eventName: string, data: any) => {
      if (eventName === 'bucket-deleted') {
        api.sync();
      } else {
        api.sync();
      }
    });
  }
}, { immediate: true });

onUnmounted(() => {
  // cleanupSocial(); // Now a no-op singleton cleanup handled by logout
  unsubscribeOwnHabits();
  unsubscribeOwnBuckets();
});
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
</script>
