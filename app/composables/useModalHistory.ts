import { watch, onMounted, onUnmounted, type Ref } from 'vue';

const modalStack: string[] = [];

/**
 * Intercepts the browser back button to close a modal instead of navigating away.
 * @param isOpen A ref or computed representing whether the modal is open.
 * @param onClose An optional callback to close the modal(s). If not provided, it will attempt to set isOpen.value to false.
 */
export const useModalHistory = (isOpen: Ref<boolean>, onClose?: () => void) => {
  if (import.meta.server) return;

  const modalId = Math.random().toString(36).substring(2, 9);
  let modalStatePushed = false;

  const handlePopState = (event: PopStateEvent) => {
    // If the modal is open and the state we landed on doesn't match this modal's ID,
    // it means the user pressed back (or history.back() was called for a nested modal)
    if (isOpen.value && event.state?.modalId !== modalId) {
      modalStatePushed = false;
      
      const index = modalStack.indexOf(modalId);
      if (index > -1) {
        modalStack.splice(index, 1);
      }

      if (onClose) {
        onClose();
      } else {
        isOpen.value = false;
      }
    }
  };

  watch(isOpen, (open, wasOpen) => {
    if (open && !wasOpen) {
      // Modal opened: push a unique state for this modal, preserving router state
      const currentState = window.history.state || {};
      window.history.pushState({ ...currentState, modalId }, '');
      modalStatePushed = true;
      modalStack.push(modalId);
    } else if (!open && wasOpen && modalStatePushed) {
      // Modal closed manually: pop back to clean up history state
      modalStatePushed = false;
      const index = modalStack.indexOf(modalId);
      if (index > -1) {
        modalStack.splice(index, 1);
        window.history.back();
      }
    }
  });


  onMounted(() => {
    window.addEventListener('popstate', handlePopState);
  });

  onUnmounted(() => {
    window.removeEventListener('popstate', handlePopState);
    // Cleanup: only pop if this specific modal was responsible for a state
    if (modalStatePushed) {
      modalStatePushed = false;
      const index = modalStack.indexOf(modalId);
      if (index > -1) {
        modalStack.splice(index, 1);
        window.history.back();
      }
    }
  });
};
