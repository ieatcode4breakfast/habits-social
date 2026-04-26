import { ref, watch, onMounted, onUnmounted, type Ref } from 'vue';

/**
 * Intercepts the browser back button to close a modal instead of navigating away.
 * @param isOpen A ref or computed representing whether the modal is open.
 * @param onClose An optional callback to close the modal(s). If not provided, it will attempt to set isOpen.value to false.
 */
export const useModalHistory = (isOpen: Ref<boolean>, onClose?: () => void) => {
  if (import.meta.server) return;

  let modalStatePushed = false;

  const handlePopState = (event: PopStateEvent) => {
    if (isOpen.value) {
      // Prevent the watcher from calling history.back() since we're already handling a popstate
      modalStatePushed = false;
      if (onClose) {
        onClose();
      } else {
        isOpen.value = false;
      }
    }
  };

  watch(isOpen, (open, wasOpen) => {
    if (open && !wasOpen) {
      // Modal opened: push a dummy state to the history stack
      window.history.pushState({ modal: true }, '');
      modalStatePushed = true;
    } else if (!open && wasOpen && modalStatePushed) {
      // Modal closed manually: remove the dummy state from the history stack
      if (window.history.state?.modal) {
        window.history.back();
      }
      modalStatePushed = false;
    }
  });


  onMounted(() => {
    window.addEventListener('popstate', handlePopState);
  });

  onUnmounted(() => {
    window.removeEventListener('popstate', handlePopState);
    // Cleanup the history stack if the component unmounts while the modal is open
    if (modalStatePushed && window.history.state?.modal) {
      window.history.back();
      modalStatePushed = false;
    }
  });
};
