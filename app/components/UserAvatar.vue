<template>
  <div :class="['rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center', containerClass || 'bg-surface-hover border border-border-strong']">
    <img 
      v-if="src && !hasError" 
      :src="src" 
      :class="[imgClass || 'w-full h-full object-cover', 'min-w-0 min-h-0']"
      @error="handleError"
    />
    <UserIcon v-else :class="iconClass || 'w-1/2 h-1/2 text-fg-subtle'" />
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
