import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHabitsClient } from './useHabitsClient';

describe('useHabitsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchHabits calls the correct endpoint', async () => {
    const mockData = { data: [{ id: '1', title: 'Habit 1' }] };
    (global.$fetch as any).mockResolvedValue(mockData);

    const client = useHabitsClient();
    const result = await client.fetchHabits();

    expect(global.$fetch).toHaveBeenCalledWith('/api/habits', expect.anything());
    expect(result).toEqual(mockData.data);
  });

  it('postHabit sends the correct body and method', async () => {
    const habitData = { title: 'New Habit' };
    (global.$fetch as any).mockResolvedValue({ data: { id: 'new-id', ...habitData } });

    const client = useHabitsClient();
    await client.postHabit(habitData as any);

    expect(global.$fetch).toHaveBeenCalledWith('/api/habits', expect.objectContaining({
      method: 'POST',
      body: habitData
    }));
  });

  it('deleteHabit calls the correct endpoint with DELETE method', async () => {
    (global.$fetch as any).mockResolvedValue({});

    const client = useHabitsClient();
    await client.deleteHabit('habit-id');

    expect(global.$fetch).toHaveBeenCalledWith('/api/habits/habit-id', expect.objectContaining({
      method: 'DELETE'
    }));
  });

  it('fetchSync calls /api/sync with query params', async () => {
    (global.$fetch as any).mockResolvedValue({ serverTime: 12345 });

    const client = useHabitsClient();
    await client.fetchSync({ lastSynced: 1000 });

    expect(global.$fetch).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      query: { lastSynced: 1000 }
    }));
  });
});
