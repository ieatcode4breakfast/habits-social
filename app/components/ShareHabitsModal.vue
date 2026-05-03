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
      <div v-if="modelValue" 
        class="fixed inset-0 z-[110] flex flex-col items-center justify-start overflow-y-auto sm:py-8 py-0"
      >
        <div class="fixed inset-0 bg-black/90 backdrop-blur-md" @click="close"></div>
        <div class="relative my-auto w-full h-full sm:h-auto sm:max-w-md max-w-none bg-zinc-925 border-x-0 sm:border border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl overflow-hidden transition-all duration-300 flex flex-col">
          
          <div class="flex-1 overflow-y-auto p-4 sm:p-8">
            <div class="text-center mb-6">
              <div class="w-16 h-16 bg-zinc-925 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check class="w-8 h-8 text-white" />
              </div>
              <h2 class="text-xl font-bold text-white mb-2">{{ title }}</h2>
              <p class="text-zinc-500 text-sm">
                Which habits would you like to share with <span class="text-zinc-200 font-medium">{{ targetUser?.username }}</span>?
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

            <div class="space-y-2 mb-2">
              <div v-for="habit in sortedHabits" :key="habit.id" 
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
          </div>

          <div class="px-4 sm:px-8 py-4 border-t border-zinc-800 bg-zinc-925/80 backdrop-blur-md flex gap-3 shrink-0">
            <button @click="close" class="flex-1 px-5 py-3 bg-transparent hover:bg-zinc-925 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap">
              Cancel
            </button>
            <button @click="executeBatchShare" :disabled="sharing" class="flex-1 px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap">
              <template v-if="sharing">
                <div class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                Saving...
              </template>
              <template v-else>
                {{ selectedHabitIds.length > 0 ? `Share ${selectedHabitIds.length} habits` : 'Continue' }}
              </template>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { Check, CheckSquare } from 'lucide-vue-next';
import { format } from 'date-fns';

const props = defineProps<{
  modelValue: boolean;
  title: string;
  targetUser: any;
  myHabits: any[];
  initialSelectedIds: string[];
}>();

const emit = defineEmits(['update:modelValue', 'shared']);

const selectedHabitIds = ref<string[]>([]);
const sharing = ref(false);

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    selectedHabitIds.value = [...(props.initialSelectedIds || [])];
  }
});

const sortedHabits = computed(() => {
  // Use the INITIAL selected IDs so the list doesn't jump around while clicking
  const initial = new Set(props.initialSelectedIds || []);
  return [...props.myHabits].sort((a, b) => {
    const aIn = initial.has(a.id);
    const bIn = initial.has(b.id);
    if (aIn && !bIn) return -1;
    if (!aIn && bIn) return 1;
    return 0; // Maintain original "My habits" order
  });
});

const close = () => {
  emit('update:modelValue', false);
};

const toggleHabitSelection = (id: string) => {
  const index = selectedHabitIds.value.indexOf(id);
  if (index === -1) selectedHabitIds.value.push(id);
  else selectedHabitIds.value.splice(index, 1);
};

const toggleSelectAllHabits = () => {
  if (selectedHabitIds.value.length === props.myHabits.length) {
    selectedHabitIds.value = [];
  } else {
    selectedHabitIds.value = props.myHabits.map((h: any) => h.id);
  }
};

const executeBatchShare = async () => {
  if (!props.targetUser) return;
  sharing.value = true;
  try {
    await $fetch('/api/social/share-habits', { 
      method: 'POST', 
      body: { 
        targetUserId: props.targetUser.id, 
        habitIds: selectedHabitIds.value,
        user_date: format(new Date(), 'yyyy-MM-dd')
      } 
    });
    emit('shared');
    close();
  } catch (error) {
    console.error('Failed to batch share habits:', error);
  } finally {
    sharing.value = false;
  }
};
</script>