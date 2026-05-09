import { useHabitsApi } from './useHabitsApi';

export const useBucketState = () => {
  const api = useHabitsApi();
  
  // Shared bucket logic could go here
  // For now, it just exposes the reactive buckets from the API
  const { buckets } = api;

  const sharedBuckets = computed(() => 
    buckets.value.filter(b => b.sharedMembers && b.sharedMembers.length > 0)
  );

  const personalBuckets = computed(() => 
    buckets.value.filter(b => !b.sharedMembers || b.sharedMembers.length === 0)
  );

  return {
    buckets,
    sharedBuckets,
    personalBuckets,
    sync: api.sync
  };
};
