<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="modelValue" class="fixed inset-0 z-[110] flex flex-col items-center justify-start overflow-y-auto p-4 sm:py-8">
          <div class="fixed inset-0 bg-black/80 backdrop-blur-md touch-none" @click="$emit('update:modelValue', false)"></div>
          
          <!-- Modal Content -->
          <div class="relative my-auto w-full max-w-sm bg-surface-raised border border-border-muted rounded-3xl shadow-2xl p-8 text-center">
            <div class="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 class="w-8 h-8 text-fg-muted" />
            </div>
            <h2 class="text-xl font-bold text-fg mb-2">Delete Bucket?</h2>
            <p class="text-fg-subtle mb-8 text-sm">
              This will permanently remove "<span class="text-fg font-medium">{{ bucketTitle }}</span>" and its streak history. The underlying habits will NOT be deleted.
            </p>
            
            <div class="flex gap-3 mt-2">
              <button
                @click="$emit('update:modelValue', false)"
                class="flex-1 px-5 py-3 bg-transparent hover:bg-surface-raised text-fg-muted hover:text-fg font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                Keep Bucket
              </button>
              <button
                @click="$emit('confirm')"
                :disabled="loading"
                class="flex-1 px-5 py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                <template v-if="loading">
                  <div class="w-4 h-4 border-2 border-fg/20 border-t-white rounded-full animate-spin"></div>
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
  </ClientOnly>
</template>

<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next';

defineProps<{
  modelValue: boolean;
  bucketTitle: string;
  loading?: boolean;
}>();

defineEmits(['update:modelValue', 'confirm']);
</script>
