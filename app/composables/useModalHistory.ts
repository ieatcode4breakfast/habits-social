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
export const useModalHistory = (isOpen: Ref<boolean>, onClose?: () => boolean | void) => {
  if (import.meta.server) return { suppressNextHistoryBack: () => {} };

  const modalKey = `modal-${Math.random().toString(36).substring(2, 9)}`;
  let modalStatePushed = false;

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

  return { suppressNextHistoryBack };
};
