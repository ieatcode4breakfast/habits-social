import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBucketLimit } from '../composables/useBucketLimit';
import { ref } from 'vue';

// Mock useToast
const mockShowToast = vi.fn();
vi.mock('../composables/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast
  })
}));

describe('useBucketLimit Composable', () => {
  beforeEach(() => {
    mockShowToast.mockClear();
  });

  it('should return true when buckets are below 50', () => {
    const buckets = ref(Array.from({ length: 49 }, (_, i) => ({ id: i })));
    const { checkLimit } = useBucketLimit(buckets);
    
    const result = checkLimit();
    
    expect(result).toBe(true);
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it('should return false and show toast when buckets reach 50', () => {
    const buckets = ref(Array.from({ length: 50 }, (_, i) => ({ id: i })));
    const { checkLimit } = useBucketLimit(buckets);
    
    const result = checkLimit();
    
    expect(result).toBe(false);
    expect(mockShowToast).toHaveBeenCalledWith(
      'Limit reached: You can track a maximum of 50 buckets.',
      'failed'
    );
  });

  it('should return false and show toast when buckets exceed 50', () => {
    const buckets = ref(Array.from({ length: 51 }, (_, i) => ({ id: i })));
    const { checkLimit } = useBucketLimit(buckets);
    
    const result = checkLimit();
    
    expect(result).toBe(false);
    expect(mockShowToast).toHaveBeenCalled();
  });
});
