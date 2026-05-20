import { describe, it, expect, vi } from 'vitest';
import { useBucketState } from './useBucketState';

vi.mock('./useHabitsApi', () => ({
  useHabitsApi: () => ({
    buckets: ref([
      { id: 'b1', title: 'Personal', sharedMembers: [] },
      { id: 'b2', title: 'Shared', sharedMembers: [{ userId: 'u1', username: 'user1', status: 'active' }] }
    ]),
    sync: vi.fn()
  })
}));

describe('useBucketState', () => {
  it('separates personal and shared buckets', () => {
    const state = useBucketState();
    expect(state.personalBuckets.value).toHaveLength(1);
    const firstPersonal = state.personalBuckets.value[0];
    expect(firstPersonal).toBeDefined();
    expect(firstPersonal?.id).toBe('b1');
    expect(state.sharedBuckets.value).toHaveLength(1);
    const firstShared = state.sharedBuckets.value[0];
    expect(firstShared).toBeDefined();
    expect(firstShared?.id).toBe('b2');
  });
});
