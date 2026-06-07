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

  it('should return true when buckets are below 30', () => {
    const buckets = ref(Array.from({ length: 29 }, (_, i) => ({ id: i })));
    const { checkLimit } = useBucketLimit(buckets);
    
    const result = checkLimit();
    
    expect(result).toBe(true);
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it('should return false and show toast when buckets reach 30', () => {
    const buckets = ref(Array.from({ length: 30 }, (_, i) => ({ id: i })));
    const { checkLimit } = useBucketLimit(buckets);
    
    const result = checkLimit();
    
    expect(result).toBe(false);
    expect(mockShowToast).toHaveBeenCalledWith(
      'Limit reached: You can track a maximum of 30 buckets.',
      'failed'
    );
  });

  it('should return false and show toast when buckets exceed 30', () => {
    const buckets = ref(Array.from({ length: 31 }, (_, i) => ({ id: i })));
    const { checkLimit } = useBucketLimit(buckets);
    
    const result = checkLimit();
    
    expect(result).toBe(false);
    expect(mockShowToast).toHaveBeenCalled();
  });
});
