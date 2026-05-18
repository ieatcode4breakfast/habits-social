import { ref, onMounted, onUnmounted } from 'vue';

export const usePullToRefresh = (
  callback: () => Promise<void>,
  threshold = 80
) => {
  const pullDistance = ref(0);
  const isPulling = ref(false);
  const isRefreshing = ref(false);

  let startY = 0;
  let currentY = 0;
  let rafId: number | null = null;

  const onTouchStart = (e: TouchEvent) => {
    if (window.scrollY > 0 || isRefreshing.value) return;
    const touch = e.touches[0];
    if (!touch) return;
    startY = touch.clientY;
    isPulling.value = true;
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!isPulling.value || isRefreshing.value) return;
    const touch = e.touches[0];
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
      pullDistance.value = 0;
      isPulling.value = false;
      document.documentElement.style.setProperty('--pull-distance', '0px');
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }
  };

  const onTouchEnd = async () => {
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
          pullDistance.value = 0;
          document.documentElement.style.setProperty('--pull-distance', '0px');
        }, 300);
      }
    } else {
      pullDistance.value = 0;
      document.documentElement.style.setProperty('--pull-distance', '0px');
    }
  };

  onMounted(() => {
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
  });

  onUnmounted(() => {
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
  });

  return {
    pullDistance,
    isPulling,
    isRefreshing
  };
};
