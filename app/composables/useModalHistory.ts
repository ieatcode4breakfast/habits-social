import { ref, watch, onMounted, onUnmounted, isReadonly, type Ref } from 'vue';

/**
 * Global counter to track how many modals are currently open.
 * This allows us to handle nested modals correctly (e.g. confirmation on top of edit).
 */
const activeModalCount = ref(0);

interface ScrollLockSnapshot {
  scrollY: number;
  body: {
    position: string;
    top: string;
    left: string;
    right: string;
    width: string;
    overflow: string;
    paddingRight: string;
  };
  html: {
    overflow: string;
  };
}

let scrollLockSnapshot: ScrollLockSnapshot | null = null;

const getScrollbarWidth = () => {
  const documentWidth = document.documentElement.clientWidth;
  if (documentWidth <= 0) return 0;
  return Math.max(0, window.innerWidth - documentWidth);
};

const lockDocumentScroll = () => {
  const htmlEl = document.documentElement;
  const bodyEl = document.body;
  const scrollbarWidth = getScrollbarWidth();

  scrollLockSnapshot = {
    scrollY: window.scrollY,
    body: {
      position: bodyEl.style.position,
      top: bodyEl.style.top,
      left: bodyEl.style.left,
      right: bodyEl.style.right,
      width: bodyEl.style.width,
      overflow: bodyEl.style.overflow,
      paddingRight: bodyEl.style.paddingRight,
    },
    html: {
      overflow: htmlEl.style.overflow,
    },
  };

  bodyEl.style.position = 'fixed';
  bodyEl.style.top = `-${scrollLockSnapshot.scrollY}px`;
  bodyEl.style.left = '0';
  bodyEl.style.right = '0';
  bodyEl.style.width = '100%';
  bodyEl.style.overflow = 'hidden';

  if (scrollbarWidth > 0) {
    const currentPaddingRight = Number.parseFloat(window.getComputedStyle(bodyEl).paddingRight) || 0;
    bodyEl.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
  }

  htmlEl.style.overflow = 'hidden';
};

const unlockDocumentScroll = () => {
  if (!scrollLockSnapshot) return;

  const htmlEl = document.documentElement;
  const bodyEl = document.body;
  const { scrollY, body, html } = scrollLockSnapshot;
  scrollLockSnapshot = null;

  bodyEl.style.position = body.position;
  bodyEl.style.top = body.top;
  bodyEl.style.left = body.left;
  bodyEl.style.right = body.right;
  bodyEl.style.width = body.width;
  bodyEl.style.overflow = body.overflow;
  bodyEl.style.paddingRight = body.paddingRight;
  htmlEl.style.overflow = html.overflow;

  window.scrollTo(0, scrollY);
};

/**
 * Intercepts the browser back button to close a modal instead of navigating away.
 * Uses history.pushState to create a dummy entry that can be popped.
 */
export const useModalHistory = (
  isOpen: Ref<boolean>,
  onClose?: () => boolean | void,
  options?: {
    activePath?: Ref<string>;
    onNavigate?: (path: string) => void;
  }
) => {
  if (import.meta.server) return { suppressNextHistoryBack: () => {} };

  const modalKey = `modal-${Math.random().toString(36).substring(2, 9)}`;
  let modalStatePushed = false;
  let historyCount = 0;
  let isClosing = false;

  const updateScrollLock = (open: boolean) => {
    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    if (open) {
      activeModalCount.value++;
      if (activeModalCount.value === 1) {
        bodyEl.classList.add('overflow-hidden');
        htmlEl.classList.add('overflow-hidden');
        lockDocumentScroll();
      }
    } else {
      activeModalCount.value = Math.max(0, activeModalCount.value - 1);
      if (activeModalCount.value === 0) {
        bodyEl.classList.remove('overflow-hidden');
        htmlEl.classList.remove('overflow-hidden');
        unlockDocumentScroll();
      }
    }
  };

  const handlePopState = (event: PopStateEvent) => {
    if (isClosing) {
      if (!event.state?.[modalKey]) {
        isClosing = false;
      }
      return;
    }

    if (isOpen.value && modalStatePushed) {
      const modalState = event.state?.[modalKey];
      if (modalState && typeof modalState === 'object') {
        // We navigated back to a previous state of this modal
        historyCount = (modalState.index || 0) + 1;
        if (options?.onNavigate && typeof modalState.path === 'string') {
          options.onNavigate(modalState.path);
        }
      } else if (modalState === true) {
        // Fallback for simple modals or legacy behavior (it has the key but no path object)
        historyCount = 1;
      } else if (!modalState) {
        // No key for this modal on the new state: user went back past the first state
        const canClose = onClose ? onClose() : true;

        if (canClose === false) {
          // Re-push state to restore history and keep modal open
          setTimeout(() => {
            const currentState = window.history.state || {};
            const path = options?.activePath?.value || '';
            const nextIndex = Math.max(0, historyCount - 1);
            window.history.pushState({ ...currentState, [modalKey]: { path, index: nextIndex } }, '');
          }, 10);
        } else {
          modalStatePushed = false;
          historyCount = 0;
          if (!isReadonly(isOpen) && isOpen.value) {
            isOpen.value = false;
          }
        }
      }
    }
  };

  const suppressNextHistoryBack = () => {
    if (!modalStatePushed) return;
    modalStatePushed = false;

    const currentState = window.history.state || {};
    if (currentState?.[modalKey]) {
      const nextState = { ...currentState };
      delete nextState[modalKey];
      window.history.replaceState(nextState, '', window.location.href);
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

  // Watcher for path changes to support multi-step navigation
  if (options?.activePath) {
    watch(options.activePath, (newPath, oldPath) => {
      if (isOpen.value && modalStatePushed && newPath !== oldPath) {
        const currentState = window.history.state || {};
        const modalState = currentState[modalKey];
        if (modalState && typeof modalState === 'object' && modalState.path === newPath) {
          // Changed via popstate already, do not push new state
          return;
        }

        const nextIndex = historyCount;
        window.history.pushState({ ...currentState, [modalKey]: { path: newPath, index: nextIndex } }, '');
        historyCount++;
      }
    });
  }

  // Dedicated watcher for history state
  watch(isOpen, (open, wasOpen) => {
    if (open && !wasOpen) {
      // Modal opened: push a unique key for this modal, preserving other state
      const currentState = window.history.state || {};
      const path = options?.activePath?.value || '';
      window.history.pushState({ ...currentState, [modalKey]: { path, index: 0 } }, '');
      modalStatePushed = true;
      historyCount = 1;
    } else if (!open && wasOpen && modalStatePushed) {
      modalStatePushed = false;
      if (historyCount > 0 && !isClosing && window.history.state?.[modalKey]) {
        isClosing = true;
        window.history.go(-historyCount);
      }
      historyCount = 0;
    }
  });

  onMounted(() => {
    window.addEventListener('popstate', handlePopState);
  });

  onUnmounted(() => {
    window.removeEventListener('popstate', handlePopState);
    if (modalStatePushed && window.history.state?.[modalKey]) {
      modalStatePushed = false;
      window.history.go(-historyCount);
    }
    // If the component is unmounted while the modal was open, 
    // we must decrement the counter to avoid a permanent scroll lock.
    if (isOpen.value) {
      updateScrollLock(false);
    }
  });

  return { suppressNextHistoryBack };
};
