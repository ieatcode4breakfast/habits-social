<template>
  <div :class="['rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center', containerClass || 'bg-zinc-800 border border-zinc-700']">
    <img 
      v-if="src && !hasError" 
      :src="src" 
      :class="[imgClass || 'w-full h-full object-cover']"
      @error="handleError"
    />
    <UserIcon v-else :class="iconClass || 'w-1/2 h-1/2 text-zinc-500'" />
  </div>
</template>

<script setup lang="ts">
import { User as UserIcon } from 'lucide-vue-next';

const props = defineProps<{
  src?: string | null;
  containerClass?: string;
  imgClass?: string;
  iconClass?: string;
}>();

const emit = defineEmits(['error']);

const hasError = ref(false);

const handleError = (event: Event) => {
  hasError.value = true;
  emit('error', event);
};

// Reset error state if src changes
watch(() => props.src, () => {
  hasError.value = false;
});
</script>
