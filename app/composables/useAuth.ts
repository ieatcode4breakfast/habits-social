export const useAuth = () => {
  const user = useState<{ id: string; email: string; displayname: string; photourl?: string } | null>('auth-user', () => null);

  const fetchUser = async () => {
    try {
      const data = await $fetch<{ user: any }>('/api/auth/me');
      user.value = data.user;
    } catch {
      user.value = null;
    }
  };

  return { user, fetchUser };
};
