import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { agentHubApi, clearAuthToken, getStoredToken, persistAuthToken } from '../shared/api';
import type { LoginRequest, RegisterRequest, UserInfo } from '../shared/types';

type AuthContextValue = {
  token: string | null;
  user: UserInfo | null;
  initializing: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (credentials: RegisterRequest) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<UserInfo | null>(null);
  const [initializing, setInitializing] = useState(() => Boolean(getStoredToken()));

  const logout = useCallback(() => {
    clearAuthToken();
    setToken(null);
    setUser(null);
    setInitializing(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const storedToken = getStoredToken();

    if (!storedToken) {
      setInitializing(false);
      return undefined;
    }

    setToken(storedToken);
    setInitializing(true);

    void agentHubApi
      .getCurrentUser()
      .then((currentUser) => {
        if (!cancelled) {
          setUser(currentUser);
        }
      })
      .catch(() => {
        if (!cancelled) {
          logout();
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInitializing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [logout]);

  useEffect(() => {
    const handleUnauthorized = () => logout();

    window.addEventListener('agenthub:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('agenthub:unauthorized', handleUnauthorized);
  }, [logout]);

  const login = useCallback(async (credentials: LoginRequest) => {
    const response = await agentHubApi.login(credentials);
    persistAuthToken(response.token);
    setToken(response.token);
    setUser(response.user);
  }, []);

  const register = useCallback(async (credentials: RegisterRequest) => {
    const response = await agentHubApi.register(credentials);
    persistAuthToken(response.token);
    setToken(response.token);
    setUser(response.user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      initializing,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      logout,
    }),
    [initializing, login, logout, register, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
