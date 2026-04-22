import { useState } from '#app';

export interface UserContext {
  id: string;
  email: string;
  displayname?: string;
  photourl?: string;
}

export const useAuth = () => {
  const user = useState<UserContext | null>('auth-user', () => null);

  const fetchUser = async () => {
    try {
      const { data } = await useFetch<{ user: UserContext | null }>('/api/auth/me');
      if (data.value && data.value.user) {
        user.value = data.value.user;
      } else {
        user.value = null;
      }
    } catch (e) {
      user.value = null;
    }
  };

  return { user, fetchUser };
};
