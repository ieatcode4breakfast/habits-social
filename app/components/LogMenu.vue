<template>
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
        v-if="habit && date && referenceEl"
        ref="floatingRef"
        class="fixed z-[200] bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-1.5 flex flex-row gap-1.5"
        :style="floatingStyles"
        @click.stop
      >
        <button
          v-for="opt in options"
          :key="opt.label"
          @click.stop="handleSelect(opt.status)"
          class="w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 cursor-pointer relative"
          :class="opt.bgColor"
          :title="opt.label"
        >
          <component :is="opt.icon" class="w-4 h-4" :class="opt.color" />
        </button>

        <!-- Arrow -->
        <div 
          ref="arrowRef"
          class="absolute w-3 h-3 bg-zinc-900 border-r border-b border-zinc-800 rotate-45"
          :style="{
            left: middlewareData.arrow?.x != null ? `${middlewareData.arrow.x}px` : '',
            top: middlewareData.arrow?.y != null ? `${middlewareData.arrow.y}px` : '',
            bottom: '-6px'
          }"
        ></div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Check, X as XIcon, Minus, Trash2, Palmtree } from 'lucide-vue-next';
import { useFloating, offset, flip, shift, arrow, autoUpdate } from '@floating-ui/vue';
import { format, isSameWeek, isSameMonth } from 'date-fns';
import type { Habit, HabitLog } from '~/composables/useHabitsApi';

const props = defineProps<{
  habit: Habit | null;
  date: Date | null;
  logs: HabitLog[];
  referenceEl: HTMLElement | null;
  // Optional effective settings (e.g. from a modal's temporary state)
  skipsPeriod?: 'none' | 'weekly' | 'monthly';
  skipsCount?: number;
}>();

const emit = defineEmits(['select', 'close']);

const floatingRef = ref<HTMLElement | null>(null);
const arrowRef = ref<HTMLElement | null>(null);

const { floatingStyles, middlewareData } = useFloating(computed(() => props.referenceEl), floatingRef, {
  placement: 'top',
  middleware: [
    offset(12),
    flip(),
    shift({ padding: 10 }),
    arrow({ element: arrowRef })
  ],
  whileElementsMounted: autoUpdate
});

const options = computed(() => {
  if (!props.habit || !props.date) return [];

  const dateStr = format(props.date, 'yyyy-MM-dd');
  const currentStatus = props.logs.find(l => l.habitId === props.habit?.id && l.date === dateStr)?.status;
  
  // Use effective settings if provided, otherwise fallback to habit's own settings
  const skipsPeriod = props.skipsPeriod || props.habit.skipsPeriod;
  const skipsCount = props.skipsCount ?? (props.habit.skipsCount ?? 2);

  let maxSkips = 0;
  let usedSkips = 0;
  
  if (skipsPeriod === 'none') {
    maxSkips = 999;
    usedSkips = 0;
  } else if (skipsPeriod === 'weekly') {
    maxSkips = skipsCount || 0;
    usedSkips = props.logs.filter(l => 
      l.habitId === props.habit?.id && 
      l.status === 'skipped' && 
      isSameWeek(new Date(l.date), props.date!, { weekStartsOn: 0 })
    ).length;
  } else if (skipsPeriod === 'monthly') {
    maxSkips = skipsCount || 0;
    usedSkips = props.logs.filter(l => 
      l.habitId === props.habit?.id && 
      l.status === 'skipped' && 
      isSameMonth(new Date(l.date), props.date!)
    ).length;
  }

  const opts: any[] = [];
  const canSkip = usedSkips < maxSkips;

  if (currentStatus !== 'completed') {
    opts.push({ 
      label: 'Complete', 
      status: 'completed', 
      icon: Check, 
      color: 'text-white', 
      bgColor: 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' 
    });
  }

  if (currentStatus !== 'skipped' && canSkip) {
    opts.push({ 
      label: 'Skip', 
      status: 'skipped', 
      icon: Minus, 
      color: 'text-white', 
      bgColor: 'bg-zinc-500 border-zinc-500 shadow-none' 
    });
  }

  if (currentStatus !== 'failed' && !canSkip) {
    opts.push({ 
      label: 'Fail', 
      status: 'failed', 
      icon: XIcon, 
      color: 'text-white', 
      bgColor: 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' 
    });
  }

  if (currentStatus !== 'vacation' && !canSkip) {
    opts.push({ 
      label: 'Vacation', 
      status: 'vacation', 
      icon: Palmtree, 
      color: 'text-white', 
      bgColor: 'bg-amber-500 border-amber-500 shadow-md shadow-amber-500/20' 
    });
  }

  if (currentStatus && currentStatus !== 'cleared') {
    opts.push({ 
      label: 'Clear', 
      status: null, 
      icon: Trash2, 
      color: 'text-zinc-400', 
      bgColor: 'bg-zinc-800 border-zinc-700' 
    });
  }

  return opts;
});

const handleSelect = (status: string | null) => {
  // Pass all context back to the handler
  emit('select', props.habit, props.date, status);
  emit('close');
};

const handleGlobalClick = () => {
  if (props.habit && props.date) {
    emit('close');
  }
};

onMounted(() => {
  window.addEventListener('click', handleGlobalClick);
});

onUnmounted(() => {
  window.removeEventListener('click', handleGlobalClick);
});
</script>
