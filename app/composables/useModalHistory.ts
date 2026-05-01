import { watch, onMounted, onUnmounted, isReadonly, type Ref } from 'vue';

/**
 * Global counter to track how many modals are currently open.
 * This allows us to handle nested modals correctly (e.g. confirmation on top of edit).
 */
const activeModalCount = ref(0);

/**
 * Intercepts the browser back button to close a modal instead of navigating away.
 * Uses history.pushState to create a dummy entry that can be popped.
 */
export const useModalHistory = (isOpen: Ref<boolean>, onClose?: () => boolean | void) => {
  if (import.meta.server) return;

  const modalKey = `modal-${Math.random().toString(36).substring(2, 9)}`;
  let modalStatePushed = false;

  const updateScrollLock = (open: boolean) => {
    if (open) {
      activeModalCount.value++;
      if (activeModalCount.value === 1) {
        document.body.classList.add('overflow-hidden');
        document.documentElement.classList.add('overflow-hidden');
      }
    } else {
      activeModalCount.value = Math.max(0, activeModalCount.value - 1);
      if (activeModalCount.value === 0) {
        document.body.classList.remove('overflow-hidden');
        document.documentElement.classList.remove('overflow-hidden');
      }
    }
  };

  const handlePopState = (event: PopStateEvent) => {
    // If the modal is open and the state we landed on doesn't have OUR specific key,
    // it means the user pressed back (or history.back() was called).
    if (isOpen.value && modalStatePushed && !event.state?.[modalKey]) {
      // If onClose returns false, it means the close was vetoed (e.g., unsaved changes)
      const canClose = onClose ? onClose() : true;

      if (canClose === false) {
        // Re-push the state to restore history and keep the modal open.
        // Use a small delay to ensure the browser has finished processing the current popstate.
        setTimeout(() => {
          const currentState = window.history.state || {};
          window.history.pushState({ ...currentState, [modalKey]: true }, '');
        }, 10);
      } else {
        modalStatePushed = false;
        // Only assign if it's not a readonly computed ref
        if (!isReadonly(isOpen) && isOpen.value) {
          isOpen.value = false;
        }
      }
    }
  };

  // Dedicated watcher for scroll lock
  watch(isOpen, (open, wasOpen) => {
    if (open && !wasOpen) {
      updateScrollLock(true);
    } else if (!open && wasOpen) {
      updateScrollLock(false);
    }
  });

  // Dedicated watcher for history state
  watch(isOpen, (open, wasOpen) => {
    if (open && !wasOpen) {
      // Modal opened: push a unique key for this modal, preserving other state
      const currentState = window.history.state || {};
      window.history.pushState({ ...currentState, [modalKey]: true }, '');
      modalStatePushed = true;
    } else if (!open && wasOpen && modalStatePushed) {
      modalStatePushed = false;
      // Only pop if the current top state still belongs to us
      if (window.history.state?.[modalKey]) {
        window.history.back();
      }
    }
  });

  onMounted(() => {
    window.addEventListener('popstate', handlePopState);
  });

  onUnmounted(() => {
    window.removeEventListener('popstate', handlePopState);
    if (modalStatePushed && window.history.state?.[modalKey]) {
      modalStatePushed = false;
      window.history.back();
    }
    // If the component is unmounted while the modal was open, 
    // we must decrement the counter to avoid a permanent scroll lock.
    if (isOpen.value) {
      updateScrollLock(false);
    }
  });
};
