export const useAuth = () => {
  const user = useState<{ id: string; email: string; username: string; photourl?: string } | null>('auth-user', () => null);

  const fetchUser = async () => {
    try {
      const headers = useRequestHeaders(['cookie']) as Record<string, string>;
      const data = await $fetch<{ user: any }>('/api/auth/me', { headers });
      user.value = data.user;
    } catch {
      user.value = null;
    }
  };

  return { user, fetchUser };
};
