<template>
  <ClientOnly>
    <Teleport to="body">
    <!-- Overlay -->
    <Transition
      enter-active-class="transition-none"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md touch-none"
        @click="requestClose"
      ></div>
    </Transition>

    <!-- Content -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="modelValue"
        class="fixed inset-0 z-[100] pointer-events-none flex flex-col items-center justify-start overflow-y-auto sm:py-8 py-0"
      >
        <div
          class="relative my-auto w-full h-full sm:h-auto sm:max-w-md max-w-none bg-surface-raised border-x-0 sm:border border-border-muted sm:rounded-3xl rounded-none overflow-hidden transition-all duration-300 flex flex-col pointer-events-auto"
        >
          <!-- Sticky Header -->
          <div class="sticky top-0 z-10 bg-surface-raised px-4 sm:px-8 py-4 sm:py-6 border-b border-border-muted/80 flex items-center gap-1 shrink-0">
            <button
              @click="requestClose"
              :disabled="tutorialReadonly"
              class="p-2 -ml-2 text-fg-subtle hover:text-fg transition-all cursor-pointer flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <ChevronLeft class="w-6 h-6" />
            </button>
            <div class="flex-1 min-w-0">
              <h2 class="text-lg font-bold text-fg truncate leading-none min-w-0">New Habit</h2>
            </div>
          </div>

          <!-- Scrollable Content -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-8 sm:py-6">
            <form id="addHabitForm" @submit.prevent="handleSubmit" class="space-y-6">
              <div class="space-y-2" data-coach-target="my-habits-add-title">
                <label class="text-xs font-bold uppercase tracking-widest text-fg-subtle">Habit Name</label>
                <input
                  v-model="title"
                  type="text"
                  placeholder="e.g. Morning Meditation"
                  required
                  maxlength="50"
                  autofocus
                  :disabled="tutorialReadonly"
                  class="w-full px-4 py-3 bg-surface-inset border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-border-strong text-fg placeholder-fg-subtle transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <!-- Description -->
              <div class="space-y-2" data-coach-target="my-habits-add-description">
                <label class="text-xs font-bold uppercase tracking-widest text-fg-subtle">Description</label>
                <div class="relative">
                  <textarea
                    v-model="description"
                    rows="1"
                    maxlength="300"
                    placeholder=""
                    :disabled="tutorialReadonly"
                    @input="autoExpandTextarea"
                    class="w-full px-4 py-3 bg-surface-inset border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-border-strong text-fg placeholder-fg-subtle transition-all resize-none overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                  ></textarea>
                  <div class="absolute -bottom-5 right-1 text-[10px] font-bold text-fg-subtle">
                    {{ description.length }}/300
                  </div>
                </div>
              </div>

              <!-- Frequency Group -->
              <div class="flex items-start gap-3" data-coach-target="my-habits-add-skips">
                <div class="flex flex-col gap-2">
                  <label class="text-xs font-bold uppercase tracking-widest text-fg-subtle h-4 flex items-center">Skips Allowed</label>
                  <select
                    v-model="skipsPeriod"
                    :disabled="tutorialReadonly"
                    class="w-40 h-10 px-3 py-2 bg-surface-inset border border-border-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-border-strong text-fg appearance-none cursor-pointer text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="disabled">No skips allowed</option>
                    <option value="none">Unlimited skips</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <template v-if="skipsPeriod === 'weekly' || skipsPeriod === 'monthly'">
                  <div class="flex items-start gap-3">
                    <div class="flex items-center gap-3">
                      <div class="flex flex-col items-center">
                        <button
                          type="button"
                          @click="adjustFrequency(1)"
                          :disabled="tutorialReadonly"
                          class="h-4 flex items-center justify-center text-fg-subtle hover:text-fg transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <ChevronUp class="w-3 h-3" />
                        </button>
                        <div class="pt-2 pb-1">
                          <input
                            v-model.number="skipsCount"
                            type="number"
                            :disabled="tutorialReadonly"
                            class="w-10 h-10 bg-surface-inset border border-border-muted rounded-lg text-center text-sm font-medium text-fg focus:outline-none focus:ring-1 focus:ring-border-strong [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                        </div>
                        <button
                          type="button"
                          @click="adjustFrequency(-1)"
                          :disabled="tutorialReadonly"
                          class="h-4 flex items-center justify-center text-fg-subtle hover:text-fg transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <ChevronDown class="w-3 h-3" />
                        </button>
                      </div>
                      <span class="text-fg-subtle text-sm">{{ skipsCount === 1 ? 'skip' : 'skips' }}</span>
                    </div>
                  </div>
                </template>
              </div>

              <!-- Social Sharing -->
              <div v-if="friends.length > 0" class="space-y-3" data-coach-target="my-habits-add-share">
                <label class="text-xs font-bold uppercase tracking-widest text-fg-subtle">Share with</label>
                <div class="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <label
                    v-for="friend in friends"
                    :key="friend.id"
                    class="flex items-center justify-between p-3 bg-surface-inset border border-surface-raised rounded-xl transition-colors"
                    :class="tutorialReadonly ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-border-muted'"
                  >
                    <div class="flex items-center gap-3">
                      <UserAvatar
                        :src="friend.photoUrl"
                        container-class="w-8 h-8 bg-surface-raised"
                        icon-class="w-4 h-4 text-fg-subtle"
                      />
                      <span class="text-sm font-semibold text-fg truncate flex-1 min-w-0 mr-4">{{ friend.username || 'Unknown' }}</span>
                    </div>
                    <div
                      class="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                      :class="[sharedWith.includes(friend.id) ? 'bg-surface-hover shadow-lg shadow-surface-hover/20' : 'bg-surface-raised']"
                    >
                      <Check v-if="sharedWith.includes(friend.id)" class="w-3.5 h-3.5 text-white" />
                    </div>
                    <input type="checkbox" :value="friend.id" v-model="sharedWith" :disabled="tutorialReadonly" class="hidden" />
                  </label>
                </div>
              </div>
            </form>
          </div>

          <!-- Fixed Footer -->
          <div class="px-8 py-4 border-t border-border-muted bg-surface-raised/80 backdrop-blur-md flex gap-3">
            <button
              type="button"
              @click="requestClose"
              :disabled="tutorialReadonly"
              class="flex-1 px-5 py-3 text-fg-muted hover:text-fg font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="addHabitForm"
              :disabled="saving"
              :aria-disabled="tutorialReadonly || saving ? 'true' : undefined"
              data-coach-target="my-habits-add-save"
              class="flex-1 px-5 py-3 bg-action-primary hover:bg-action-primary-hover text-action-primary-fg font-semibold rounded-xl transition-all shadow-lg shadow-fg-inverted/5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <template v-if="saving">
                <div class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                Adding...
              </template>
              <template v-else>
                Add Habit
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
import { ref, watch } from 'vue';
import { ChevronLeft, ChevronUp, ChevronDown, Check } from 'lucide-vue-next';
import { autoExpandTextarea } from '~/utils/ui';
import type { UserProfile } from '~/composables/useSocial';

export type SkipPeriod = 'disabled' | 'none' | 'weekly' | 'monthly';

export type TutorialInitialValues = {
  title?: string;
  description?: string;
  skipsPeriod?: SkipPeriod;
  skipsCount?: number;
  sharedWith?: string[];
};

export type HabitAddPayload = {
  title: string;
  description: string;
  skipsCount: number;
  skipsPeriod: SkipPeriod;
  sharedWith: string[];
};

const props = withDefaults(defineProps<{
  modelValue: boolean;
  friends: UserProfile[];
  saving?: boolean;
  initialValues?: TutorialInitialValues;
  tutorialReadonly?: boolean;
}>(), {
  saving: false,
  initialValues: () => ({}),
  tutorialReadonly: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [payload: HabitAddPayload];
}>();

const title = ref('');
const description = ref('');
const skipsCount = ref(2);
const skipsPeriod = ref<SkipPeriod>('weekly');
const sharedWith = ref<string[]>([]);

const normalizeSkipsCount = (period: SkipPeriod, count: number) => {
  if (period === 'disabled' || period === 'none') return 0;
  const max = period === 'weekly' ? 6 : 27;
  return Math.max(1, Math.min(max, count));
};

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    if (props.tutorialReadonly && props.initialValues) {
      title.value = props.initialValues.title ?? '';
      description.value = props.initialValues.description ?? '';
      skipsCount.value = props.initialValues.skipsCount ?? 2;
      skipsPeriod.value = props.initialValues.skipsPeriod ?? 'weekly';
      sharedWith.value = props.initialValues.sharedWith ?? [];
    } else {
      title.value = '';
      description.value = '';
      skipsCount.value = 2;
      skipsPeriod.value = 'weekly';
      sharedWith.value = [];
    }
  }
}, { immediate: true });

watch(skipsPeriod, (period) => {
  skipsCount.value = normalizeSkipsCount(period, skipsCount.value);
});

const adjustFrequency = (delta: number) => {
  if (props.tutorialReadonly) return;
  skipsCount.value = normalizeSkipsCount(skipsPeriod.value, skipsCount.value + delta);
};

const requestClose = () => {
  if (props.tutorialReadonly) return;
  emit('update:modelValue', false);
};

const handleSubmit = () => {
  if (props.tutorialReadonly) return;
  const normalizedSkipsCount = normalizeSkipsCount(skipsPeriod.value, skipsCount.value);
  emit('save', {
    title: title.value.trim(),
    description: description.value.trim(),
    skipsCount: normalizedSkipsCount,
    skipsPeriod: skipsPeriod.value,
    sharedWith: sharedWith.value
  });
};
</script>
