import { ref, onMounted, onUnmounted, isRef, type Ref } from 'vue';

type PullTarget = HTMLElement | Ref<HTMLElement | null> | null | undefined;

export interface PullToRefreshOptions {
  scrollContainer?: PullTarget;
}

export const usePullToRefresh = (
  callback: () => Promise<void>,
  threshold = 80,
  options: PullToRefreshOptions = {}
) => {
  const pullDistance = ref(0);
  const isPulling = ref(false);
  const isRefreshing = ref(false);

  let startY = 0;
  let currentY = 0;
  let rafId: number | null = null;
  let activeTarget: Window | HTMLElement | null = null;
  let holdTimeout: ReturnType<typeof setTimeout> | null = null;

  const resolveTarget = (): Window | HTMLElement => {
    const target = options.scrollContainer;
    if (!target) return window;
    if (isRef(target)) return target.value ?? window;
    return target;
  };

  const getScrollOffset = (): number => {
    if (!activeTarget || activeTarget === window) {
      return window.scrollY;
    }

    if ('scrollTop' in activeTarget) {
      return activeTarget.scrollTop;
    }

    return window.scrollY;
  };

  const resetPullState = () => {
    pullDistance.value = 0;
    isPulling.value = false;
    document.documentElement.style.setProperty('--pull-distance', '0px');

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (holdTimeout) {
      clearTimeout(holdTimeout);
      holdTimeout = null;
    }
  };

  const onTouchStart = (e: TouchEvent) => {
    if (getScrollOffset() > 0 || isRefreshing.value) return;
    if (document.body.classList.contains('overflow-hidden')) return;
    const touch = e.touches[0] ?? e.changedTouches[0];
    if (!touch) return;
    startY = touch.clientY;
    isPulling.value = true;

    if (holdTimeout) clearTimeout(holdTimeout);
    holdTimeout = setTimeout(() => {
      if (isPulling.value && pullDistance.value < 15) {
        isPulling.value = false;
      }
    }, 200);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!isPulling.value || isRefreshing.value) return;
    if (document.body.classList.contains('overflow-hidden')) {
      resetPullState();
      return;
    }
    const touch = e.touches[0] ?? e.changedTouches[0];
    if (!touch) return;

    currentY = touch.clientY;
    const deltaY = currentY - startY;

    if (deltaY > 0) {
      const dist = Math.pow(deltaY, 0.85);
      if (dist > 10) {
        if (e.cancelable) e.preventDefault();
      }
      
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          if (isPulling.value && !isRefreshing.value) {
            pullDistance.value = dist;
            document.documentElement.style.setProperty('--pull-distance', `${dist}px`);
          }
          rafId = null;
        });
      }
    } else {
      resetPullState();
    }
  };

  const onTouchEnd = async () => {
    if (holdTimeout) {
      clearTimeout(holdTimeout);
      holdTimeout = null;
    }

    if (!isPulling.value || isRefreshing.value) return;

    isPulling.value = false;

    if (pullDistance.value >= threshold) {
      isRefreshing.value = true;
      pullDistance.value = threshold;
      document.documentElement.style.setProperty('--pull-distance', '0px');
      
      try {
        await callback();
      } finally {
        setTimeout(() => {
          isRefreshing.value = false;
          resetPullState();
        }, 300);
      }
    } else {
      resetPullState();
    }
  };

  const handleTouchStart: EventListener = event => onTouchStart(event as TouchEvent);
  const handleTouchMove: EventListener = event => onTouchMove(event as TouchEvent);
  const handleTouchEnd: EventListener = () => { void onTouchEnd(); };

  onMounted(() => {
    activeTarget = resolveTarget();
    activeTarget.addEventListener('touchstart', handleTouchStart, { passive: false });
    activeTarget.addEventListener('touchmove', handleTouchMove, { passive: false });
    activeTarget.addEventListener('touchend', handleTouchEnd);
    activeTarget.addEventListener('touchcancel', handleTouchEnd);
  });

  onUnmounted(() => {
    if (!activeTarget) return;

    activeTarget.removeEventListener('touchstart', handleTouchStart);
    activeTarget.removeEventListener('touchmove', handleTouchMove);
    activeTarget.removeEventListener('touchend', handleTouchEnd);
    activeTarget.removeEventListener('touchcancel', handleTouchEnd);
  });

  return {
    pullDistance,
    isPulling,
    isRefreshing
  };
};
