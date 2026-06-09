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
            @click="handleDayClick(day, $event)"
            :class="[
              'w-8 h-8 flex items-center justify-center transition-all border-2 relative',
              cellShape === 'square' ? 'rounded-lg' : 'rounded-full',
              interactive && isMarkable(day, referenceDate) ? 'cursor-pointer' : 'cursor-default',
              statusMap[format(day, 'yyyy-MM-dd')] === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
              statusMap[format(day, 'yyyy-MM-dd')] === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
              statusMap[format(day, 'yyyy-MM-dd')] === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
              statusMap[format(day, 'yyyy-MM-dd')] === 'vacation' ? 'bg-amber-500 border-amber-500 shadow-md shadow-amber-500/20' :
              isMarkable(day, referenceDate) 
                ? (interactive ? 'bg-transparent border-dashed border-zinc-400 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800' : 'bg-transparent border-dashed border-zinc-400 dark:border-zinc-600')
                : 'bg-zinc-100 dark:bg-white/[0.03] border-dashed border-zinc-300 dark:border-zinc-800',
              !isMarkable(day, referenceDate) && statusMap[format(day, 'yyyy-MM-dd')] ? 'opacity-60' : ''
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
  referenceDate?: Date;
  interactive?: boolean;
  cellShape?: 'circle' | 'square';
}>();

const referenceDate = computed(() => props.referenceDate ?? new Date());

const emit = defineEmits<{
  'click-day': [day: Date, event: MouseEvent];
}>();

const handleDayClick = (day: Date, event: MouseEvent) => {
  if (!props.interactive) return;
  event.stopPropagation();
  emit('click-day', day, event);
};

</script>
