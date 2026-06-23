import type { Habit, HabitLog, Bucket, BucketLog } from './useHabitsApi';
import type { SyncResponse } from '~~/server/types/sync';
import { habitsApi } from '~/utils/apiClient';

export const useHabitsClient = () => {
  const fetchHabits = async () => {
    const { data } = await habitsApi<{ data: Habit[] }>('/api/habits');
    return data;
  };

  const postHabit = async (habit: Partial<Habit>) => {
    return await habitsApi<{ data: Habit }>('/api/habits', { method: 'POST', body: habit });
  };

  const putHabit = async (id: string, habit: Partial<Habit>) => {
    return await habitsApi<{ data: Habit }>(`/api/habits/${id}`, { method: 'PUT', body: habit });
  };

  const deleteHabit = async (id: string) => {
    return await habitsApi(`/api/habits/${id}`, { method: 'DELETE' });
  };

  const postReorderHabits = async (ids: string[]) => {
    return await habitsApi('/api/habits/reorder', { method: 'POST', body: { ids } });
  };

  const postHabitLog = async (log: Partial<HabitLog>) => {
    return await habitsApi<{ data: HabitLog }>('/api/habitlogs', { method: 'POST', body: log });
  };

  const postBucket = async (bucket: Partial<Bucket>) => {
    return await habitsApi<{ data: Bucket }>('/api/buckets', { method: 'POST', body: bucket });
  };

  const putBucket = async (id: string, bucket: Partial<Bucket>) => {
    return await habitsApi<{ data: Bucket }>(`/api/buckets/${id}`, { method: 'PUT', body: bucket });
  };

  const deleteBucket = async (id: string) => {
    return await habitsApi(`/api/buckets/${id}`, { method: 'DELETE' });
  };

  const postReorderBuckets = async (ids: string[]) => {
    return await habitsApi('/api/buckets/reorder', { method: 'POST', body: { ids } });
  };

  const postBucketLog = async (log: Partial<BucketLog>) => {
    return await habitsApi<{ data: BucketLog }>('/api/bucketlogs', { method: 'POST', body: log });
  };

  const fetchSync = async (params: any) => {
    return await habitsApi<SyncResponse>('/api/sync', { query: params });
  };

  const postBulkSync = async (payload: { operations: any[] }) => {
    return await habitsApi<{ success: string[], failed: { id: string, code: string }[] }>('/api/sync/bulk', { method: 'POST', body: payload });
  };

  return {
    fetchHabits, postHabit, putHabit, deleteHabit, postReorderHabits,
    postHabitLog, postBucket, putBucket, deleteBucket, postReorderBuckets,
    postBucketLog, fetchSync, postBulkSync
  };
};
