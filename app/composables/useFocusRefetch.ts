import { useDocumentVisibility, useThrottleFn } from '@vueuse/core';
import { watch } from 'vue';

export const useFocusRefetch = (callback: () => void, throttleMs = 30000) => {
  const visibility = useDocumentVisibility();
  const throttledCallback = useThrottleFn(callback, throttleMs);

  watch(visibility, (current) => {
    if (current === 'visible') {
      console.log('[FocusRefetch] App became visible, triggering callback...');
      throttledCallback();
    }
  });
};
