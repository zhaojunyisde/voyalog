import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiPost, apiGet } from '../services/api';

interface Tokens {
  access_token: string;
  id_token: string;
  refresh_token: string;
}

interface User {
  user_id: string;
  username: string;
}

interface AuthContextType {
  user: User | null;
  tokens: Tokens | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokens] = useState<Tokens | null>(() => {
    const stored = localStorage.getItem('auth_tokens');
    return stored ? JSON.parse(stored) : null;
  });
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async (accessToken: string) => {
    try {
      const data = await apiGet<User>('/users/me', accessToken);
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (tokens) {
      fetchUser(tokens.access_token).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [tokens, fetchUser]);

  const login = async (username: string, password: string) => {
    const data = await apiPost<Tokens & { expires_in: number }>('/auth/login', { username, password });
    const t: Tokens = {
      access_token: data.access_token,
      id_token: data.id_token,
      refresh_token: data.refresh_token,
    };
    localStorage.setItem('auth_tokens', JSON.stringify(t));
    setTokens(t);
  };

  const logout = async () => {
    if (tokens) {
      try {
        await apiPost('/auth/logout', { access_token: tokens.access_token });
      } catch { /* ignore */ }
    }
    localStorage.removeItem('auth_tokens');
    setTokens(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, tokens, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
