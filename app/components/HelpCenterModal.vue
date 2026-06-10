<template>
  <ClientOnly>
    <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="isOpen" class="fixed inset-0 z-[180] bg-black">
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-center-modal-title"
          tabindex="-1"
          class="h-[100dvh] outline-none"
          @keydown="handleDialogKeydown"
        >
          <Suspense @resolve="focusDialog">
            <HelpCenterUI
              mode="modal"
              :active-path="activePath"
              title-id="help-center-modal-title"
              @close="close"
              @navigate="open"
            />

            <template #fallback>
              <div class="min-h-[100dvh] text-zinc-100 flex items-center justify-center">
                <h1 id="help-center-modal-title" class="sr-only">Help Center</h1>
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-200 hover:bg-zinc-800 transition-colors"
                  @click="close"
                >
                  Loading...
                </button>
              </div>
            </template>
          </Suspense>
        </div>
      </div>
    </Transition>
    </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useHelpModal } from '~/composables/useHelpModal';
import HelpCenterUI from './HelpCenterUI.vue';

interface ScrollLockSnapshot {
  scrollY: number;
  body: {
    position: string;
    top: string;
    left: string;
    right: string;
    width: string;
    overflow: string;
  };
  html: {
    overflow: string;
  };
}

const { isOpen, activePath, open, close } = useHelpModal();
const dialogRef = ref<HTMLElement | null>(null);
const previouslyFocusedElement = ref<HTMLElement | null>(null);
const scrollLockSnapshot = ref<ScrollLockSnapshot | null>(null);

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const getFocusableElements = () => {
  return Array.from(dialogRef.value?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
    .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
};

const focusDialog = () => {
  const firstFocusable = getFocusableElements()[0];
  if (firstFocusable) {
    firstFocusable.focus();
    return;
  }

  dialogRef.value?.focus();
};

const lockScroll = () => {
  if (!import.meta.client || scrollLockSnapshot.value) return;

  const bodyEl = document.body;
  const htmlEl = document.documentElement;

  scrollLockSnapshot.value = {
    scrollY: window.scrollY,
    body: {
      position: bodyEl.style.position,
      top: bodyEl.style.top,
      left: bodyEl.style.left,
      right: bodyEl.style.right,
      width: bodyEl.style.width,
      overflow: bodyEl.style.overflow
    },
    html: {
      overflow: htmlEl.style.overflow
    }
  };

  bodyEl.style.position = 'fixed';
  bodyEl.style.top = `-${scrollLockSnapshot.value.scrollY}px`;
  bodyEl.style.left = '0';
  bodyEl.style.right = '0';
  bodyEl.style.width = '100%';
  bodyEl.style.overflow = 'hidden';
  htmlEl.style.overflow = 'hidden';
};

const unlockScroll = () => {
  if (!import.meta.client || !scrollLockSnapshot.value) return;

  const bodyEl = document.body;
  const htmlEl = document.documentElement;
  const snapshot = scrollLockSnapshot.value;
  scrollLockSnapshot.value = null;

  bodyEl.style.position = snapshot.body.position;
  bodyEl.style.top = snapshot.body.top;
  bodyEl.style.left = snapshot.body.left;
  bodyEl.style.right = snapshot.body.right;
  bodyEl.style.width = snapshot.body.width;
  bodyEl.style.overflow = snapshot.body.overflow;
  htmlEl.style.overflow = snapshot.html.overflow;

  window.scrollTo(0, snapshot.scrollY);
};

const restoreFocus = () => {
  if (!import.meta.client) return;
  previouslyFocusedElement.value?.focus();
  previouslyFocusedElement.value = null;
};

const handleFocusIn = (event: FocusEvent) => {
  if (!isOpen.value || !dialogRef.value || !(event.target instanceof Node)) return;
  if (dialogRef.value.contains(event.target)) return;

  focusDialog();
};

const handleDialogKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }

  if (event.key !== 'Tab') return;

  const focusableElements = getFocusableElements();
  if (focusableElements.length === 0) {
    event.preventDefault();
    dialogRef.value?.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  if (!firstElement || !lastElement) return;

  const activeElement = document.activeElement;

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
};

watch(isOpen, async (openValue) => {
  if (!import.meta.client) return;

  if (openValue) {
    previouslyFocusedElement.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lockScroll();
    await nextTick();
    focusDialog();
    document.addEventListener('focusin', handleFocusIn);
  } else {
    document.removeEventListener('focusin', handleFocusIn);
    unlockScroll();
    await nextTick();
    restoreFocus();
  }
});

onBeforeUnmount(() => {
  if (!import.meta.client) return;
  document.removeEventListener('focusin', handleFocusIn);
  unlockScroll();
});
</script>
