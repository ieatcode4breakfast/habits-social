<template>
  <ClientOnly>
    <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="habit && date && referenceEl"
        class="fixed inset-0 z-[190] touch-none"
        @click.stop="emit('close')"
        @wheel.stop.prevent
        @touchmove.stop.prevent
      >
        <div
          class="fixed inset-0 bg-transparent touch-none"
          @click.stop="emit('close')"
          @wheel.stop.prevent
          @touchmove.stop.prevent
        ></div>
        <div
          ref="floatingRef"
          class="fixed z-[200] w-max max-w-[calc(100vw-1.25rem)] bg-surface-solid/95 backdrop-blur-xl border border-border-muted rounded-2xl shadow-2xl p-1.5 flex flex-row gap-1.5"
          :style="floatingStyles"
          :data-coach-target="menuCoachTarget"
          @click.stop
        >
          <button
            v-for="opt in options"
            :key="opt.label"
            @click.stop="handleSelect(opt.status)"
            class="w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 cursor-pointer relative"
            :class="opt.bgColor"
            :title="opt.label"
            :data-coach-target="coachTargetByStatus?.[getCoachStatus(opt.status)]"
          >
            <component :is="opt.icon" class="w-4 h-4" :class="opt.color" />
          </button>

          <!-- Arrow -->
          <div
            ref="arrowRef"
            class="absolute w-3 h-3 bg-surface-solid border-r border-b border-border-muted rotate-45"
            :style="arrowStyles"
          ></div>
        </div>
      </div>
    </Transition>
  </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, type Component } from 'vue';
import { Check, X as XIcon, Minus, Trash2, Palmtree } from 'lucide-vue-next';
import { useFloating, offset, flip, shift, arrow, autoUpdate } from '@floating-ui/vue';
import { format, isSameWeek, isSameMonth } from 'date-fns';
import type { Habit, HabitLog } from '~/composables/useHabitsApi';

type SelectableLogStatus = Exclude<HabitLog['status'], 'cleared'> | null;
type LogMenuCoachStatus = Exclude<HabitLog['status'], 'cleared'> | 'cleared';

interface LogMenuOption {
  label: string;
  status: SelectableLogStatus;
  icon: Component;
  color: string;
  bgColor: string;
}

const props = defineProps<{
  habit: Habit | null;
  date: Date | null;
  logs: HabitLog[];
  referenceEl: HTMLElement | null;
  // Optional effective settings (e.g. from a modal's temporary state)
  skipsPeriod?: Habit['skipsPeriod'];
  skipsCount?: number;
  optionMode?: 'available' | 'all';
  menuCoachTarget?: string;
  coachTargetByStatus?: Partial<Record<LogMenuCoachStatus, string>>;
}>();

const emit = defineEmits<{
  select: [habit: Habit, date: Date, status: SelectableLogStatus];
  close: [];
}>();

const floatingRef = ref<HTMLElement | null>(null);
const arrowRef = ref<HTMLElement | null>(null);
const isOpen = computed(() => Boolean(props.habit && props.date && props.referenceEl));

const { floatingStyles, middlewareData, placement, update } = useFloating(computed(() => props.referenceEl), floatingRef, {
  placement: 'top',
  strategy: 'fixed',
  transform: false,
  open: isOpen,
  middleware: [
    offset(12),
    flip(),
    shift({ padding: 10 }),
    arrow({ element: arrowRef })
  ],
  whileElementsMounted: autoUpdate
});

const arrowStaticSide = computed(() => {
  const basePlacement = placement.value.split('-')[0];
  if (basePlacement === 'bottom') return 'top';
  if (basePlacement === 'left') return 'right';
  if (basePlacement === 'right') return 'left';
  return 'bottom';
});

const arrowStyles = computed<Record<string, string>>(() => {
  const styles: Record<string, string> = {};
  if (middlewareData.value.arrow?.x != null) {
    styles.left = `${middlewareData.value.arrow.x}px`;
  }
  if (middlewareData.value.arrow?.y != null) {
    styles.top = `${middlewareData.value.arrow.y}px`;
  }
  styles[arrowStaticSide.value] = '-6px';
  return styles;
});

const buildOption = (label: string, status: SelectableLogStatus, icon: Component, color: string, bgColor: string): LogMenuOption => ({
  label,
  status,
  icon,
  color,
  bgColor,
});

const getCoachStatus = (status: SelectableLogStatus): LogMenuCoachStatus => status ?? 'cleared';

const options = computed<LogMenuOption[]>(() => {
  const habit = props.habit;
  const selectedDate = props.date;
  if (!habit || !selectedDate) return [];

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const currentStatus = props.logs.find(l => l.habitId === habit.id && l.date === dateStr)?.status;

  // Use effective settings if provided, otherwise fallback to habit's own settings
  const skipsPeriod = props.skipsPeriod || habit.skipsPeriod;
  const skipsCount = props.skipsCount ?? (habit.skipsCount ?? 2);

  let maxSkips = 0;
  let usedSkips = 0;

  if (skipsPeriod === 'disabled' || ((skipsPeriod === 'weekly' || skipsPeriod === 'monthly') && skipsCount === 0)) {
    maxSkips = 0;
    usedSkips = 0;
  } else if (skipsPeriod === 'none') {
    maxSkips = 999;
    usedSkips = 0;
  } else if (skipsPeriod === 'weekly') {
    maxSkips = skipsCount || 0;
    usedSkips = props.logs.filter(l =>
      l.habitId === habit.id &&
      l.status === 'skipped' &&
      isSameWeek(new Date(l.date), selectedDate, { weekStartsOn: 0 })
    ).length;
  } else if (skipsPeriod === 'monthly') {
    maxSkips = skipsCount || 0;
    usedSkips = props.logs.filter(l =>
      l.habitId === habit.id &&
      l.status === 'skipped' &&
      isSameMonth(new Date(l.date), selectedDate)
    ).length;
  }

  const opts: LogMenuOption[] = [];
  const canSkip = usedSkips < maxSkips;

  if (props.optionMode === 'all') {
    return [
      buildOption('Complete', 'completed', Check, 'text-fg', 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20'),
      buildOption('Skip', 'skipped', Minus, 'text-fg', 'bg-zinc-500 border-zinc-500 shadow-none'),
      buildOption('Fail', 'failed', XIcon, 'text-fg', 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20'),
      buildOption('Vacation', 'vacation', Palmtree, 'text-fg', 'bg-amber-500 border-amber-500 shadow-md shadow-amber-500/20'),
      buildOption('Clear', null, Trash2, 'text-fg-muted', 'bg-surface-hover border-border-strong'),
    ];
  }

  if (currentStatus !== 'completed') {
    opts.push(buildOption(
      'Complete',
      'completed',
      Check,
      'text-fg',
      'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20'
    ));
  }

  if (currentStatus !== 'skipped' && canSkip) {
    opts.push(buildOption(
      'Skip',
      'skipped',
      Minus,
      'text-fg',
      'bg-zinc-500 border-zinc-500 shadow-none'
    ));
  }

  if (currentStatus !== 'failed' && !canSkip) {
    opts.push(buildOption(
      'Fail',
      'failed',
      XIcon,
      'text-fg',
      'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20'
    ));
  }

  if (currentStatus !== 'vacation' && !canSkip) {
    opts.push(buildOption(
      'Vacation',
      'vacation',
      Palmtree,
      'text-fg',
      'bg-amber-500 border-amber-500 shadow-md shadow-amber-500/20'
    ));
  }

  if (currentStatus && currentStatus !== 'cleared') {
    opts.push(buildOption(
      'Clear',
      null,
      Trash2,
      'text-fg-muted',
      'bg-surface-hover border-border-strong'
    ));
  }

  return opts;
});

watch(
  () => [
    props.referenceEl,
    props.habit?.id,
    props.date?.getTime(),
    options.value.length
  ] as const,
  async () => {
    if (!isOpen.value) return;
    await nextTick();
    update();
  },
  { flush: 'post' }
);

const handleSelect = (status: SelectableLogStatus) => {
  if (!props.habit || !props.date) return;
  // Pass all context back to the handler
  emit('select', props.habit, props.date, status);
  emit('close');
};
</script>
