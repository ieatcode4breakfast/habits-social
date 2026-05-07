<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="modelValue && habit" 
        class="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto sm:py-8 py-0"
      >
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black/80 backdrop-blur-md touch-none" @click="close"></div>
        
        <!-- Modal Content -->
        <div 
          ref="modalContent"
          class="relative my-auto w-full h-full sm:h-auto sm:max-w-lg max-w-none bg-zinc-925 border-x-0 sm:border border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl overflow-hidden transition-all duration-300 flex flex-col"
        >
          <!-- Sticky Header -->
          <div class="sticky top-0 z-10 bg-zinc-925 px-4 sm:px-8 py-4 sm:py-6 border-b border-zinc-800/80 flex items-center gap-1 shrink-0">
            <button @click="close" class="p-2 -ml-2 text-zinc-500 hover:text-white transition-all cursor-pointer flex-shrink-0">
              <ChevronLeft class="w-6 h-6" />
            </button>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 min-w-0">
                <h2 class="text-lg font-bold text-white truncate leading-none min-w-0">{{ editTitle }}</h2>
                <!-- Streak Badge -->
                <div 
                  v-if="(habit.currentStreak ?? 0) >= 2"
                  class="flex items-center gap-1 px-2 py-0.5 bg-black border rounded-full shrink-0"
                  :class="[
                    isFaded(habit) ? 'opacity-30' : 'opacity-100',
                    getStreakTheme(habit.currentStreak ?? 0).border
                  ]"
                >
                  <span 
                    class="text-[9px] font-black tracking-tight"
                    :class="getStreakTheme(habit.currentStreak ?? 0).text"
                  >
                    x{{ habit.currentStreak }} STREAK
                  </span>

                  <Flame 
                    v-if="(habit.currentStreak ?? 0) >= 7"
                    class="w-2.5 h-2.5" 
                    :class="[
                      getStreakTheme(habit.currentStreak ?? 0).text,
                      getStreakTheme(habit.currentStreak ?? 0).fill
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

              <!-- Frequency Group -->
              <div class="flex items-start gap-3">
                <!-- Left: Label + Selector -->
                <div class="flex flex-col gap-2">
                  <label class="text-xs font-bold uppercase tracking-widest text-zinc-500 h-4 flex items-center">Skips Allowed</label>
                  <select
                    v-model="editSkipsPeriod"
                    class="w-32 h-10 px-3 py-2 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-600 text-white appearance-none cursor-pointer text-sm"
                  >
                    <option value="none">No limit</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <template v-if="editSkipsPeriod !== 'none'">
                  <div class="flex items-start gap-3">
                    <div class="flex items-center gap-3">
                      <div class="flex flex-col items-center">
                        <button type="button" @click="adjustFrequency(1)" class="h-4 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                          <ChevronUp class="w-3 h-3" />
                        </button>
                        <div class="pt-2 pb-1">
                          <input
                            v-model.number="editSkipsCount"
                            type="number"
                            @blur="editSkipsCount = editSkipsPeriod === 'weekly' ? Math.max(0, Math.min(6, editSkipsCount)) : (editSkipsPeriod === 'monthly' ? Math.max(0, Math.min(28, editSkipsCount)) : 0)"
                            class="w-10 h-10 bg-black border border-zinc-800 rounded-lg text-center text-sm font-medium text-white focus:outline-none focus:ring-1 focus:ring-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                        <button type="button" @click="adjustFrequency(-1)" class="h-4 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                          <ChevronDown class="w-3 h-3" />
                        </button>
                      </div>
                      <span class="text-zinc-500 text-sm">{{ editSkipsCount === 1 ? 'skip' : 'skips' }}</span>
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
                          @click.stop="openLogMenu(day, $event)"
                          class="w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 relative"
                          :class="[
                            isMarkable(day) ? 'cursor-pointer' : 'cursor-default',
                            (day.getMonth() !== currentCalendarDate.getMonth()) ? 'opacity-30 border-transparent' : '',
                            getStatus(day) === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
                            getStatus(day) === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
                            getStatus(day) === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
                            getStatus(day) === 'vacation' ? 'bg-amber-500 border-amber-500 shadow-md shadow-amber-500/20' :
                            isMarkable(day) 
                              ? 'border-dashed border-zinc-800 bg-transparent hover:bg-zinc-925' 
                              : 'bg-white/[0.03] border-dashed border-zinc-900',
                            !isMarkable(day) && day.getMonth() === currentCalendarDate.getMonth() ? (getStatus(day) ? 'opacity-60' : 'opacity-100') : ''
                          ]"
                        >
                          <Check v-if="getStatus(day) === 'completed'" class="w-4 h-4 text-white" />
                          <XIcon v-else-if="getStatus(day) === 'failed'" class="w-4 h-4 text-white" />
                          <span v-else-if="getStatus(day) === 'skipped'" class="w-4 h-0.5 bg-white rounded-full"></span>
                          <Palmtree v-else-if="getStatus(day) === 'vacation'" class="w-4 h-4 text-white" />
                        </button>
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
                        :src="friend.photoUrl" 
                        container-class="w-8 h-8 bg-zinc-925"
                        icon-class="w-4 h-4 text-zinc-600"
                      />
                      <span class="text-sm font-semibold text-zinc-200">{{ friend.username || 'Unknown' }}</span>
                    </div>
                    <div 
                      class="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                      :class="[
                        editSharedWithWorking.includes(friend.id) 
                          ? 'bg-indigo-500 shadow-lg shadow-indigo-500/20' 
                          : 'bg-zinc-925'
                      ]"
                    >
                      <Check v-if="editSharedWithWorking.includes(friend.id)" class="w-3.5 h-3.5 text-white" />
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
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/95 backdrop-blur-sm touch-none" @click="showDeleteModal = false"></div>
        
        <!-- Modal Content -->
        <div class="relative my-auto w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
          <div class="w-16 h-16 bg-zinc-925 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 class="w-8 h-8 text-zinc-400" />
          </div>
          <h2 class="text-xl font-bold text-white mb-2">Delete Habit?</h2>
          <p class="text-zinc-500 mb-8 text-sm">
            This will permanently remove "<span class="text-zinc-200 font-medium">{{ habit?.title }}</span>" and all its progress. This action cannot be undone.
          </p>
          
          <div class="flex gap-3 mt-2">
            <button
              @click="showDeleteModal = false"
              class="flex-1 px-5 py-3 bg-transparent hover:bg-zinc-925 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap"
            >
              Keep Habit
            </button>
            <button
              @click="handleDelete"
              :disabled="isDeletingHabit"
              class="flex-1 px-5 py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              <template v-if="isDeletingHabit">
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
      <div class="fixed inset-0 bg-black/95 backdrop-blur-sm touch-none" @click="showSharingConfirmModal = false"></div>
        <div class="relative my-auto w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
          <div class="w-16 h-16 bg-zinc-925 rounded-full flex items-center justify-center mx-auto mb-4">
            <User class="w-8 h-8 text-zinc-400" />
          </div>
          <h2 class="text-xl font-bold text-white mb-2">Update Sharing?</h2>
          <p class="text-zinc-500 mb-8 text-sm">
            This will update who can see your progress for this habit.
          </p>
          <div class="flex gap-3 mt-2">
            <button
              @click="cancelSharingSave"
              class="flex-1 px-5 py-3 bg-transparent hover:bg-zinc-925 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              @click="confirmSharingSave"
              :disabled="isUpdatingHabit"
              class="flex-1 px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              <template v-if="isUpdatingHabit">
                <div class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                Saving...
              </template>
              <template v-else>
                Confirm
              </template>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Global Log Menu (Replaced by event emit) -->
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useModalHistory } from '~/composables/useModalHistory';
import { Trash2, Check, X as XIcon, Minus, ChevronLeft, ChevronRight, User, ChevronUp, ChevronDown, Edit2, Save, CheckSquare, Flame, Palmtree } from 'lucide-vue-next';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, addDays, isAfter, startOfDay, subMonths, addMonths, parseISO, isBefore, isSameDay, isSameWeek, isSameMonth } from 'date-fns';
import type { Habit, HabitLog } from '~/composables/useHabitsApi';

const props = defineProps<{
  modelValue: boolean;
  habit: Habit | null;
  friends: any[];
  logs: HabitLog[];
}>();

const emit = defineEmits(['update:modelValue', 'habit-updated', 'habit-deleted', 'open-log-menu']);

const api = useHabitsApi();
const { showToast } = useToast();

const editTitle = ref('');
const editDescription = ref('');
const editSkipsCount = ref(2);
const editSkipsPeriod = ref<'none' | 'weekly' | 'monthly'>('weekly');
const editSharedWith = ref<string[]>([]);
const editSharedWithWorking = ref<string[]>([]);

const showDeleteModal = ref(false);
const showSharingConfirmModal = ref(false);
const isEditingSharing = ref(false);
const reachedConfirmViaDone = ref(false);
const editDescriptionRef = ref<HTMLTextAreaElement | null>(null);
const currentCalendarDate = ref(new Date());
const calendarLoading = ref(false);
const isUpdatingHabit = ref(false);
const isDeletingHabit = ref(false);
const isInitializingEdit = ref(false);
const isDirty = ref(false);

const isInternalModalOpen = computed(() => showDeleteModal.value || showSharingConfirmModal.value);
const isSelfOrInternalOpen = computed(() => props.modelValue || isInternalModalOpen.value);

useModalHistory(isSelfOrInternalOpen, () => {
  if (showDeleteModal.value) {
    showDeleteModal.value = false;
  } else if (showSharingConfirmModal.value) {
    showSharingConfirmModal.value = false;
  } else {
    close();
  }
});

const close = () => emit('update:modelValue', false);

// Initialize state when modal opens
watch(() => props.modelValue, (isOpen) => {
  if (isOpen && props.habit) {
    const newHabit = props.habit;
    isInitializingEdit.value = true;
    editTitle.value = newHabit.title;
    editDescription.value = newHabit.description || '';
    editSkipsCount.value = newHabit.skipsCount ?? 2;
    editSkipsPeriod.value = newHabit.skipsPeriod as any || 'weekly';
    editSharedWith.value = [...(newHabit.sharedWith || [])];
    editSharedWithWorking.value = [...(newHabit.sharedWith || [])];
    isEditingSharing.value = false;
    currentCalendarDate.value = new Date();
    
    nextTick(() => {
      isInitializingEdit.value = false;
      isDirty.value = false;
      if (editDescriptionRef.value) {
        autoExpand(editDescriptionRef.value);
      }
    });
  }
}, { immediate: true });

// Auto-expand textarea
const autoExpand = (e: Event | HTMLElement) => {
  const el = (e instanceof Event ? e.target : e) as HTMLTextAreaElement;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};

// Calendar Logic
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
const isMarkable = (day: Date) => {
  const d = startOfDay(day);
  const t = startOfDay(today);
  const limit = subDays(t, 13);
  return !isBefore(d, limit) && !isAfter(d, t);
};

const prevMonth = () => currentCalendarDate.value = subMonths(currentCalendarDate.value, 1);
const nextMonth = () => currentCalendarDate.value = addMonths(currentCalendarDate.value, 1);

// Sync logs when month changes
watch(currentCalendarDate, async (newDate) => {
  if (props.modelValue && props.habit) {
    const start = format(startOfMonth(newDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(newDate), 'yyyy-MM-dd');
    calendarLoading.value = true;
    try {
      const newLogs = await api.getLogs(start, end);
      emit('habit-updated', { logs: newLogs }); // Parent should merge these logs
    } catch (err) {
      console.error('[HabitEditModal] Failed to fetch historical logs:', err);
    } finally {
      calendarLoading.value = false;
    }
  }
});

// Helper for status
const getStatus = (day: Date) => {
  if (!props.habit) return undefined;
  const dateStr = format(day, 'yyyy-MM-dd');
  return props.logs.find(l => l.habitId === props.habit?.id && l.date === dateStr)?.status;
};

const openLogMenu = (day: Date, event: MouseEvent) => {
  if (props.habit) {
    emit('open-log-menu', props.habit, day, event);
  }
};

// Frequency
const adjustFrequency = (delta: number) => {
  if (editSkipsPeriod.value === 'none') return;
  const max = editSkipsPeriod.value === 'weekly' ? 6 : 28;
  editSkipsCount.value = Math.max(0, Math.min(max, editSkipsCount.value + delta));
};

// Sharing
const sortedFriendsForEdit = computed(() => {
  if (!props.habit) return props.friends;
  // Use the INITIAL shared IDs so the list doesn't jump around while clicking
  const sharedIds = new Set(editSharedWith.value);
  return [...props.friends].sort((a, b) => {
    const aShared = sharedIds.has(a.id);
    const bShared = sharedIds.has(b.id);
    if (aShared && !bShared) return -1;
    if (!aShared && bShared) return 1;
    return (a.username || '').localeCompare(b.username || '');
  });
});

const toggleSelectAll = () => {
  if (editSharedWithWorking.value.length === props.friends.length) {
    editSharedWithWorking.value = [];
  } else {
    editSharedWithWorking.value = props.friends.map(f => f.id);
  }
};

const confirmSharingSave = async () => {
  editSharedWith.value = [...editSharedWithWorking.value];
  await updateHabit();
  showSharingConfirmModal.value = false;
  if (reachedConfirmViaDone.value) {
    close();
  }
  isEditingSharing.value = false;
};

const cancelSharingSave = () => {
  showSharingConfirmModal.value = false;
  if (reachedConfirmViaDone.value) {
    close();
  }
};



const updateHabit = async () => {
  if (!props.habit || !editTitle.value.trim() || isUpdatingHabit.value) return;
  
  isUpdatingHabit.value = true;
  isDirty.value = false;
  try {
    const updated = await api.updateHabit(props.habit.id, { 
      title: editTitle.value.trim(),
      description: editDescription.value.trim(),
      skipsCount: editSkipsCount.value,
      skipsPeriod: editSkipsPeriod.value,
      sharedWith: editSharedWith.value,
      userDate: format(new Date(), 'yyyy-MM-dd'),
    });
    emit('habit-updated', { habit: updated });
  } catch (error) {
    console.error('[HabitEditModal] Failed to update habit:', error);
    showToast('Failed to save changes', 'failed');
  } finally {
    isUpdatingHabit.value = false;
  }
};

const handleDoneClick = async () => {
  if (isEditingSharing.value) {
    reachedConfirmViaDone.value = true;
    showSharingConfirmModal.value = true;
  } else {
    await updateHabit();
    close();
  }
};

const handleDelete = async () => {
  if (!props.habit || isDeletingHabit.value) return;
  
  isDeletingHabit.value = true;
  try {
    await api.deleteHabit(props.habit.id);
    emit('habit-deleted', props.habit.id);
    showDeleteModal.value = false;
    close();
  } catch (error) {
    console.error('[HabitEditModal] Failed to delete habit:', error);
    showToast('Failed to delete habit', 'failed');
  } finally {
    isDeletingHabit.value = false;
  }
};

// Themes
const isFaded = (habit: Habit) => {
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
</script>
