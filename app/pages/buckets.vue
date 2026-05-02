<template>
  <div class="space-y-1 relative">
    <!-- Header -->
    <div class="px-4 sm:px-0 flex items-end justify-between gap-4 sticky top-[57px] z-40 bg-black pt-2 pb-2 sm:pt-4">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 rounded-2xl shadow-lg shadow-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
          <PaintBucket class="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight text-white mb-1">Buckets</h1>
          <p class="text-zinc-400 text-xs">{{ buckets.length }} bucket{{ buckets.length === 1 ? '' : 's' }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
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

    <!-- Bucket List -->
    <div v-motion-fade class="bg-zinc-925/80 backdrop-blur-md sm:rounded-2xl rounded-none shadow-2xl border-y border-x-0 sm:border border-zinc-800/80 divide-y divide-zinc-800/80 overflow-x-auto custom-scrollbar">
      <div v-if="loading" class="flex justify-center p-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
      <template v-else>
        <div v-if="buckets.length === 0" class="p-10 text-center text-zinc-500 italic text-sm">
          No buckets yet. Add one above!
        </div>
      
        <div 
          v-for="bucket in buckets" :key="bucket.id"
          @click="openEditModal(bucket)"
          class="relative p-4 pt-14 sm:pt-4 group transition-all flex flex-wrap items-center justify-between gap-x-8 gap-y-4 cursor-pointer hover:bg-zinc-800/40"
        >
          <!-- Top Left Badges Container -->
          <div class="absolute top-3 left-0 sm:top-2 flex items-center gap-2 z-20 transition-all duration-500">
            <!-- Floating Streak Badge -->
            <div 
              v-if="(bucket.currentStreak ?? 0) >= 2"
              class="flex items-center gap-1.5 px-3 py-1 bg-black border border-l-0 rounded-r-full rounded-l-none transition-all duration-500"
              :class="[
                isFaded(bucket) ? 'opacity-30' : 'opacity-100',
                getStreakTheme(bucket.currentStreak ?? 0).border
              ]"
            >
              <span 
                class="text-[10px] font-black tracking-tight"
                :class="getStreakTheme(bucket.currentStreak ?? 0).text"
              >
                x{{ bucket.currentStreak }} STREAK
              </span>
              <Flame 
                v-if="(bucket.currentStreak ?? 0) >= 7"
                class="w-3.5 h-3.5" 
                :class="[
                  getStreakTheme(bucket.currentStreak ?? 0).text,
                  getStreakTheme(bucket.currentStreak ?? 0).fill
                ]"
              />
            </div>

            <!-- Habit count badge -->
            <div class="flex items-center px-2 py-1 bg-zinc-925 border border-zinc-800 rounded-lg text-[10px] font-bold tracking-tight text-zinc-400 shadow-sm" :class="{'ml-3': (bucket.currentStreak ?? 0) < 2}">
              {{ bucket.habitIds?.length || 0 }} habit{{ (bucket.habitIds?.length || 0) === 1 ? '' : 's' }}
            </div>
          </div>

          <div class="flex items-center gap-3 min-w-[200px] flex-1">
            <div class="text-left flex items-start gap-2 relative">
              <h3 class="font-bold text-zinc-200 leading-tight break-all group-hover:text-white transition-colors">{{ bucket.title }}</h3>
            </div>
          </div>
          
          <!-- Read-only Timeline -->
          <div class="flex-1 min-w-[320px] flex justify-center sm:justify-end items-end gap-4 pointer-events-none">
            <div class="flex justify-evenly items-end w-full max-w-lg">
              <div v-for="(day, i) in days" :key="i" class="flex flex-col items-center gap-2">
                <div class="text-[10px] uppercase tracking-tighter text-zinc-500 font-black">
                  {{ format(day, 'EEE') }}
                </div>
                
                <div class="relative">
                  <div
                    class="w-9 h-9 rounded-lg flex items-center justify-center transition-all border-2 relative"
                    :class="[
                      getStatus(bucket.id, day) === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
                      getStatus(bucket.id, day) === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
                      getStatus(bucket.id, day) === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
                      'bg-transparent border-dashed border-zinc-800'
                    ]"
                  >
                    <Check v-if="getStatus(bucket.id, day) === 'completed'" class="w-4 h-4 text-white" />
                    <XIcon v-else-if="getStatus(bucket.id, day) === 'failed'" class="w-4 h-4 text-white" />
                    <Minus v-else-if="getStatus(bucket.id, day) === 'skipped'" class="w-4 h-4 text-white" />
                  </div>
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
                <div class="space-y-3 pt-4">
                  <label class="text-xs font-bold uppercase tracking-widest text-zinc-500">Choose habits to add in your bucket</label>
                  <div class="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    <label v-for="habit in availableHabits" :key="habit.id" class="flex items-center justify-between p-3 bg-black border border-zinc-925 rounded-xl cursor-pointer hover:border-zinc-800 transition-colors">
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
        <div v-if="showEditModal" 
          class="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto sm:py-8 py-0"
        >
          <!-- Backdrop -->
          <div class="fixed inset-0 bg-black/80 backdrop-blur-md" @click="showEditModal = false"></div>
          
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

                <!-- Habits Group -->
                <div class="space-y-3 pt-4">
                  <div class="flex items-center justify-between">
                    <label class="text-xs font-bold uppercase tracking-widest text-zinc-500">Choose habits to add in your bucket</label>
                  </div>
                  <div class="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar transition-all duration-300">
                    <label v-for="habit in availableHabits" :key="habit.id" class="flex items-center justify-between p-3 bg-black border border-zinc-925 rounded-xl transition-colors cursor-pointer hover:border-zinc-800">
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

  </div>
</template>

<script setup lang="ts">
import { Plus, Trash2, Check, X as XIcon, Minus, ChevronLeft, Flame, PaintBucket } from 'lucide-vue-next';
import { format, subDays, startOfMonth, endOfMonth, addMonths, subMonths, isAfter, startOfDay, parseISO } from 'date-fns';
import type { Bucket, BucketLog, Habit } from '~/composables/useHabitsApi';

definePageMeta({ middleware: 'auth' });

const api = useHabitsApi();
const { user } = useAuth();
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

const today = new Date();
const days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));
const startDate = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
const endDate = format(endOfMonth(addMonths(today, 1)), 'yyyy-MM-dd');

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

const isFaded = (bucket: Bucket) => {
  if (!bucket || !bucket.streakAnchorDate) return false;
  const anchor = startOfDay(parseISO(bucket.streakAnchorDate));
  const yesterday = startOfDay(subDays(new Date(), 1));
  return isAfter(yesterday, anchor);
};

const getStatus = (bucketId: string, day: Date): 'completed' | 'failed' | 'skipped' | 'cleared' | null => {
  const dateStr = format(day, 'yyyy-MM-dd');
  const log = bucketLogs.value.find(l => l.bucketid === bucketId && l.date === dateStr);
  return (log?.status as any) || null;
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
    buckets.value.push(bucket);
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

const isAnyModalOpen = computed(() => 
  showModal.value || showEditModal.value || showDeleteModal.value
);

useModalHistory(isAnyModalOpen, () => {
  showModal.value = false;
  if (showEditModal.value && !showDeleteModal.value) {
    // Treat dismissing edit as a save, similar to My Habits
    handleEditDone();
  }
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
    unsubscribeOwnBuckets = subscribeToUserBuckets(idStr, (eventName) => {
      if (eventName === 'bucket-updated' || eventName === 'bucket-deleted' || eventName === 'bucket-needs-refresh') {
        api.sync(); // This will trigger the lastSyncTime watcher and reload data
      }
    });

    // Listen to habit events (logging a habit affects bucket progress/streaks)
    unsubscribeOwnHabits = subscribeToFriendHabits(idStr, (eventName) => {
      if (eventName === 'habit-updated' || eventName === 'habit-deleted') {
        api.sync();
      }
    });

  }
}, { immediate: true });

onUnmounted(() => {
  unsubscribeOwnBuckets();
  unsubscribeOwnHabits();
});

</script>
