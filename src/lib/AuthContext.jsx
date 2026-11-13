import { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, configurationError } from '@/api/client';

const AuthContext = createContext(null);
const fingerprint = user => user ? `${user.auth_user_id}:${user.id}:${user.access_type}` : '';

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setLoading] = useState(!!api);
  const [authChecked, setChecked] = useState(!api);
  const [authError, setError] = useState(null);
  const generation = useRef(0);
  const loginEpoch = useRef(0);
  const previous = useRef(null);

  const applyUser = useCallback(current => {
    const next = fingerprint(current);
    if (previous.current !== next) {
      // Cached administrative data must not survive sign-out or a role change.
      queryClient.cancelQueries();
      queryClient.clear();
      previous.current = next;
    }
    setUser(current);
  }, [queryClient]);

  const refresh = useCallback(async () => {
    if (!api) return;
    const request = ++generation.current;
    setLoading(true);
    try {
      const current = await api.auth.me();
      if (request !== generation.current) return;
      applyUser(current);
      setError(null);
    } catch (error) {
      if (request !== generation.current) return;
      applyUser(null);
      setError(error.message || 'Não foi possível conferir seu acesso.');
    } finally {
      if (request === generation.current) { setLoading(false); setChecked(true); }
    }
  }, [applyUser]);

  useEffect(() => {
    sessionStorage.removeItem('employeeSession');
    if (!api) return;
    refresh();
    const timers = new Set();
    const { data: { subscription } } = api.auth.onChange(event => {
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_OUT') {
        ++generation.current;
        ++loginEpoch.current;
        applyUser(null);
        setLoading(false);
        setChecked(true);
        return;
      }
      // Supabase callbacks must finish before another auth SDK call is made.
      setLoading(true);
      const timer = setTimeout(() => { timers.delete(timer); refresh(); }, 0);
      timers.add(timer);
    });
    window.addEventListener('focus', refresh);
    return () => {
      ++generation.current;
      ++loginEpoch.current;
      subscription.unsubscribe();
      timers.forEach(clearTimeout);
      window.removeEventListener('focus', refresh);
    };
  }, [applyUser, refresh]);

  const signIn = async (login, password) => {
    const attempt = ++loginEpoch.current;
    const current = await api.auth.signIn(login, password);
    if (attempt !== loginEpoch.current) {
      await api.auth.logout();
      throw new Error('A entrada foi cancelada. Entre novamente.');
    }
    ++generation.current;
    applyUser(current);
    setError(null);
    setLoading(false);
    setChecked(true);
  };
  const logout = async () => {
    ++generation.current;
    ++loginEpoch.current;
    applyUser(null);
    setLoading(true);
    try { await api.auth.logout(); }
    finally { setLoading(false); }
  };
  return <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoadingAuth,
    authChecked, authError, configurationError, signIn, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requires AuthProvider');
  return context;
}
