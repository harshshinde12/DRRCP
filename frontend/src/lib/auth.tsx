import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, getToken, setToken } from './api-client.ts';
import type { Role, User } from './types.ts';

interface AuthCtx {
  user: User | null | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: Record<string, string>) => Promise<User>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

async function fetchMe(): Promise<User> {
  const res = await apiClient.get('/auth/me');
  return res.data.data.user as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const token = getToken();

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: !!token,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    const onUnauthorized = () => {
      qc.setQueryData(['me'], null);
      navigate('/login', { replace: true });
    };
    window.addEventListener('drrcp:unauthorized', onUnauthorized);
    return () => window.removeEventListener('drrcp:unauthorized', onUnauthorized);
  }, [qc, navigate]);

  const loginMut = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await apiClient.post('/auth/login', { email, password });
      return res.data.data as { user: User; token: string };
    },
    onSuccess: ({ user, token }) => {
      setToken(token);
      qc.setQueryData(['me'], user);
    },
  });

  const registerMut = useMutation({
    mutationFn: async (input: Record<string, string>) => {
      const res = await apiClient.post('/auth/register', input);
      return res.data.data as { user: User; token: string };
    },
    onSuccess: ({ user, token }) => {
      setToken(token);
      qc.setQueryData(['me'], user);
    },
  });

  const value = useMemo<AuthCtx>(() => ({
    user: token ? meQuery.data ?? null : null,
    isLoading: !!token && meQuery.isLoading,
    isAuthenticated: !!token && !!meQuery.data,
    login: async (email, password) => (await loginMut.mutateAsync({ email, password })).user,
    register: async (input) => (await registerMut.mutateAsync(input)).user,
    logout: async () => {
      try { await apiClient.post('/auth/logout'); } catch { /* token may be dead */ }
      setToken(null);
      qc.clear();
      navigate('/login', { replace: true });
    },
    hasRole: (...roles) => !!meQuery.data && roles.includes(meQuery.data.role),
  }), [token, meQuery.data, meQuery.isLoading, loginMut, registerMut, qc, navigate]);

  // expose pending states for forms via context consumers reading mutations is overkill;
  // pages use their own useMutation wrappers where needed.
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function homeForRole(role: Role): string {
  switch (role) {
    case 'ADMIN': return '/admin';
    case 'CITIZEN': return '/my-requests';
    case 'RESCUE_TEAM': return '/missions';
    case 'VOLUNTEER': return '/tasks';
    case 'SHELTER_MANAGER': return '/my-shelters';
    case 'NGO': return '/inventory';
    default: return '/';
  }
}
