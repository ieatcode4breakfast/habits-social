import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFocusRefetch } from './useFocusRefetch';
import { ref, nextTick } from 'vue';

// Setup mock refs outside to control them
const visibilityRef = ref('hidden');

vi.mock('@vueuse/core', () => ({
  useDocumentVisibility: () => visibilityRef,
  useThrottleFn: (fn: any) => fn // We mock it as a pass-through for simple behavior testing
}));

describe('useFocusRefetch', () => {
  beforeEach(() => {
    visibilityRef.value = 'hidden';
    vi.clearAllMocks();
  });

  it('should trigger callback when visibility becomes visible', async () => {
    const callback = vi.fn();
    useFocusRefetch(callback);

    visibilityRef.value = 'visible';
    await nextTick();

    expect(callback).toHaveBeenCalled();
  });

  it('should NOT trigger callback when visibility becomes hidden', async () => {
    const callback = vi.fn();
    visibilityRef.value = 'visible';
    useFocusRefetch(callback);
    
    // Reset call count after init watch might have triggered if we didn't guard it
    callback.mockClear();

    visibilityRef.value = 'hidden';
    await nextTick();

    expect(callback).not.toHaveBeenCalled();
  });
});
