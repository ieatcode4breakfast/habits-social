import { ref, type Ref } from 'vue';
import { useToast } from './useToast';

export const useBucketLimit = (buckets: Ref<any[]>) => {
  const { showToast } = useToast();

  const checkLimit = () => {
    if (buckets.value.length >= 30) {
      showToast('Limit reached: You can track a maximum of 30 buckets.', 'failed');
      return false;
    }
    return true;
  };

  return {
    checkLimit
  };
};
