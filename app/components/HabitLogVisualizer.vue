<template>
  <div class="w-full flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-x-4 gap-y-2 bg-zinc-900/50 rounded-xl p-3 mt-1">
    <!-- Left: Title & Streak & Frequency -->
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <h3 class="text-sm font-bold text-zinc-200 leading-tight break-all group-hover:text-white transition-colors">
          {{ title }}
        </h3>
        <!-- Streak Badge -->
        <div 
          v-if="(streakCount ?? 0) >= 2"
          class="flex items-center gap-1 px-1.5 py-0.5 bg-black border rounded-md shrink-0 border-emerald-500/50"
        >
          <Flame class="w-2.5 h-2.5 text-emerald-500 fill-emerald-500" />
          <span class="text-[9px] font-black tracking-tight text-emerald-500">
            x{{ streakCount }} STREAK
          </span>
        </div>
      </div>

    </div>

    <!-- Right: Custom Grid -->
    <div class="w-full sm:w-[320px] lg:w-[400px] shrink-0">
      <div class="flex items-center w-full">
        <div v-for="(day, index) in weeklyStatus" :key="day.date" class="flex-1 flex flex-col items-center gap-1">
          <!-- Day Name (TUE) -->
          <span class="text-[9px] uppercase font-black text-zinc-600">
            {{ format(parseISO(String(day.date)), 'EEE') }}
          </span>
          
          <!-- Box -->
          <div 
            class="w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 relative"
            :class="[
              day.status === 'completed' ? 'bg-emerald-500 border-emerald-500' :
              day.status === 'failed' ? 'bg-rose-500 border-rose-500' :
              day.status === 'skipped' ? 'bg-zinc-500 border-zinc-500' :
              day.status === 'vacation' ? 'bg-amber-500 border-amber-500' :
              'bg-transparent border-dashed border-zinc-800',
              
              // Glow effect for the last box using pseudo-element
              index === 6 ? 'after:absolute after:-inset-[2px] after:rounded-lg after:shadow-[0_0_15px_rgba(255,255,255,0.4)]' : '',
              
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
          <span class="text-[9px] font-bold text-zinc-600">
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

defineProps<{
  title: string;
  streakCount?: number;

  weeklyStatus: { date: string, status: string | undefined }[];
}>();
</script>
