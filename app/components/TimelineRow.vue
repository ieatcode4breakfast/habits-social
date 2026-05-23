<template>
  <div class="w-full sm:w-[320px] lg:w-[400px] shrink-0 px-2 sm:px-0">
    <div class="flex items-center w-full">
      <div v-for="(day, i) in days" :key="i" class="flex-1 flex justify-center relative">
        <!-- Sunday Divider -->
        <div 
          v-if="i > 0 && day.getDay() === 0" 
          class="absolute left-0 top-0 bottom-0 w-px bg-zinc-800/80"
        ></div>
        <div class="relative">
          <component
            :is="interactive ? 'button' : 'div'"
            type="button"
            @click.stop="interactive ? $emit('click-day', day, $event) : null"
            :class="[
              'w-8 h-8 flex items-center justify-center transition-all border-2 relative',
              cellShape === 'square' ? 'rounded-lg' : 'rounded-full',
              interactive && isMarkable(day) ? 'cursor-pointer' : 'cursor-default',
              statusMap[format(day, 'yyyy-MM-dd')] === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
              statusMap[format(day, 'yyyy-MM-dd')] === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
              statusMap[format(day, 'yyyy-MM-dd')] === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
              statusMap[format(day, 'yyyy-MM-dd')] === 'vacation' ? 'bg-amber-500 border-amber-500 shadow-md shadow-amber-500/20' :
              isMarkable(day) 
                ? (interactive ? 'bg-transparent border-dashed border-zinc-800 hover:bg-zinc-925' : 'bg-transparent border-dashed border-zinc-800')
                : 'bg-white/[0.03] border-dashed border-zinc-900',
              !isMarkable(day) && statusMap[format(day, 'yyyy-MM-dd')] ? 'opacity-60' : ''
            ]"
          >
            <Check v-if="statusMap[format(day, 'yyyy-MM-dd')] === 'completed'" class="w-4 h-4 text-white" />
            <XIcon v-else-if="statusMap[format(day, 'yyyy-MM-dd')] === 'failed'" class="w-4 h-4 text-white" />
            <Minus v-else-if="statusMap[format(day, 'yyyy-MM-dd')] === 'skipped'" class="w-4 h-4 text-white" />
            <Palmtree v-else-if="statusMap[format(day, 'yyyy-MM-dd')] === 'vacation'" class="w-4 h-4 text-white" />
          </component>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Check, X as XIcon, Minus, Palmtree } from 'lucide-vue-next';
import { format } from 'date-fns';
import { isMarkable } from '@/utils/ui';

const props = defineProps<{
  days: Date[];
  statusMap: Record<string, string | undefined>;
  interactive?: boolean;
  cellShape?: 'circle' | 'square';
}>();

defineEmits(['click-day']);

</script>
