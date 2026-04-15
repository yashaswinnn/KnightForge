import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore.js';
import { getMe } from '../lib/api.js';

export function useAuth() {
  const { token, user, isAuthenticated, setUser, logout } = useAuthStore();

  const { data: me, error } = useQuery({
    queryKey: ['me'],
    queryFn:  getMe,
    enabled:  !!token,
    retry:    false,
  });

  useEffect(() => { if (me)    setUser(me); }, [me,    setUser]);
  useEffect(() => { if (error) logout();    }, [error, logout]);

  return { user: me || user, isAuthenticated, token, logout };
}
