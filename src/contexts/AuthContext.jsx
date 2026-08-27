import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { API_ENDPOINTS } from '../config/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const response = await api.get(API_ENDPOINTS.usuarios.profile);
      setUser(response.data.user || response.data);
      setError('');
    } catch (requestError) {
      if (requestError.response?.status !== 401) setError('Não foi possível validar a sessão.');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const handleExpired = () => { setUser(null); setError('Sua sessão expirou. Entre novamente.'); };
    window.addEventListener('geomind:session-expired', handleExpired);
    return () => window.removeEventListener('geomind:session-expired', handleExpired);
  }, [refresh]);

  const login = useCallback(async (credentials) => {
    setError('');
    const response = await api.post(API_ENDPOINTS.usuarios.login, credentials);
    setUser(response.data.user || response.data);
    return response.data;
  }, []);

  const register = useCallback(async (payload) => {
    setError('');
    const response = await api.post(API_ENDPOINTS.usuarios.register, payload);
    setUser(response.data.user || response.data);
    return response.data;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post(API_ENDPOINTS.usuarios.logout); } finally { setUser(null); }
  }, []);

  const value = useMemo(() => ({ user, loading, error, login, register, logout, refresh }), [user, loading, error, login, register, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}
