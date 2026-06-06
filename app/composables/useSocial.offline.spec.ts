import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref, type Ref } from 'vue';

const fetchMock = vi.fn();
const stateStore = new Map<string, Ref<unknown>>();
const isOnlineRef = ref(true);

const useStateMock = <T>(key: string, init: () => T): Ref<T> => {
  if (!stateStore.has(key)) {
    stateStore.set(key, ref(init()));
  }
  return stateStore.get(key) as Ref<T>;
};

vi.mock('#app', () => ({
  useState: useStateMock,
}));

vi.mock('nuxt/app', () => ({
  useState: useStateMock,
}));

vi.mock('#app/composables/state', () => ({
  useState: useStateMock,
}));

vi.mock('./useAuth', () => ({
  useAuth: () => ({
    user: ref({ id: 'user-1', email: 'u@example.com', username: 'user' }),
  }),
}));

vi.mock('@vueuse/core', () => ({
  useNetwork: () => ({ isOnline: isOnlineRef })
}));

vi.stubGlobal('$fetch', fetchMock);

describe('useSocial offline refresh guard', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    stateStore.clear();
    isOnlineRef.value = true;
  });

  it('refreshes friendships while online', async () => {
    fetchMock.mockResolvedValueOnce({
      data: {
        friendships: [
          {
            id: 'friendship-1',
            initiatorId: 'user-1',
            receiverId: 'user-2',
            status: 'accepted'
          }
        ],
        profiles: [
          { id: 'user-2', email: 'friend@example.com', username: 'friend' }
        ]
      }
    });

    const { useSocial } = await import('./useSocial');
    const social = useSocial();

    await social.refresh();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(social.friends.value[0]?.id).toBe('user-2');
  });

  it('does not fetch friendships while offline', async () => {
    isOnlineRef.value = false;

    const { useSocial } = await import('./useSocial');
    const social = useSocial();

    await social.refresh();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(social.friendships.value).toEqual([]);
  });
});
