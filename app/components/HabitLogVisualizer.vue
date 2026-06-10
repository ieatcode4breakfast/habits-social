<template>
  <div
    class="w-full flex flex-col items-stretch gap-x-4 gap-y-2 bg-surface-solid/50 rounded-xl p-3 mt-1"
    :class="compact ? 'lg:flex-row lg:items-center lg:justify-between' : 'sm:flex-row sm:items-center sm:justify-between'"
  >
    <!-- Left: Title & Streak & Frequency -->
    <div class="flex flex-col gap-1 flex-1 min-w-0">
      <div class="flex items-center gap-2 flex-nowrap min-w-0">
        <h3 class="text-sm font-bold text-fg leading-tight truncate min-w-0 group-hover:text-fg transition-colors">
          {{ title }}
        </h3>
        <!-- Streak Badge -->
        <div 
          v-if="(streakCount ?? 0) >= 2"
          class="flex items-center gap-1 px-1.5 py-0.5 bg-surface-inset border rounded-md shrink-0"
          :class="[
            streakIsFaded ? 'opacity-30' : 'opacity-100',
            streakTheme.border
          ]"
        >
          <Flame 
            v-if="(streakCount ?? 0) >= 7"
            class="w-2.5 h-2.5"
            :class="[streakTheme.text, streakTheme.fill]"
          />
          <span class="text-[9px] font-black tracking-tight" :class="streakTheme.text">
            x{{ streakCount }} STREAK
          </span>
        </div>
      </div>
      <div v-if="frequencyText" class="text-[10px] font-semibold tracking-tight text-fg-subtle">
        {{ frequencyText }}
      </div>

    </div>

    <!-- Right: Custom Grid -->
    <div 
      class="w-full shrink-0"
      :class="compact ? 'lg:w-[320px]' : 'sm:w-[320px] lg:w-[400px]'"
    >
      <div class="flex items-center w-full">
        <div v-for="(day, index) in weeklyStatus" :key="day.date" class="flex-1 flex flex-col items-center gap-1">
          <!-- Day Name (TUE) -->
          <span class="text-[9px] uppercase font-black text-fg-subtle">
            {{ format(parseISO(String(day.date)), 'EEE') }}
          </span>
          
          <!-- Circle -->
          <div 
            class="w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 relative"
            :class="[
              day.status === 'completed' ? 'bg-emerald-500 border-emerald-500' :
              day.status === 'failed' ? 'bg-rose-500 border-rose-500' :
              day.status === 'skipped' ? 'bg-zinc-500 border-zinc-500' :
              day.status === 'vacation' ? 'bg-amber-500 border-amber-500' :
              'bg-transparent border-dashed border-cell-markable-border',
              
              // Normal shadows for boxes
              day.status === 'completed' ? 'shadow-md shadow-emerald-500/20' :
              day.status === 'failed' ? 'shadow-md shadow-rose-500/20' :
              day.status === 'vacation' ? 'shadow-md shadow-amber-500/20' : ''
            ]"
          >
            <Check v-if="day.status === 'completed'" class="w-3 h-3 text-white" />
            <XIcon v-else-if="day.status === 'failed'" class="w-3 h-3 text-white" />
            <Minus v-else-if="day.status === 'skipped'" class="w-3 h-3 text-white" />
            <Palmtree v-else-if="day.status === 'vacation'" class="w-3 h-3 text-white" />
          </div>

          <!-- Day Number (12) -->
          <span class="text-[9px] font-bold text-fg-subtle">
            {{ format(parseISO(String(day.date)), 'd') }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Flame, Check, X as XIcon, Minus, Palmtree } from 'lucide-vue-next';
import { format, parseISO } from 'date-fns';
import { computed } from 'vue';
import { getStreakTheme, isStreakFaded } from '~/utils/ui';

const props = defineProps<{
  title: string;
  streakCount?: number;
  streakAnchorDate?: string | null;
  compact?: boolean;
  frequencyText?: string;
  referenceDate?: Date;

  weeklyStatus: { date: string, status: string | undefined }[];
}>();

const referenceDate = computed(() => props.referenceDate ?? new Date());
const streakTheme = computed(() => getStreakTheme(props.streakCount ?? 0));
const streakIsFaded = computed(() => isStreakFaded(props.streakAnchorDate ?? null, referenceDate.value));
</script>
