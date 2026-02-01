/**
 * Auth Context
 *
 * Manages authentication state for the admin dashboard.
 * Supports Microsoft SSO and magic link authentication.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiClient from '../api/client';

interface AdminUser {
  user_id: string;
  email: string;
  name?: string;
  role: 'admin' | 'super_admin';
  is_active: boolean;
  last_login_at?: string;
}

interface AuthContextType {
  user: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'admin_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Set up axios interceptor for auth header
  useEffect(() => {
    const interceptor = apiClient.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => {
      apiClient.interceptors.request.eject(interceptor);
    };
  }, []);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async (): Promise<boolean> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return false;
    }

    try {
      const response = await apiClient.get('/admin/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success && response.data.data) {
        setUser(response.data.data);
        setIsLoading(false);
        return true;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem(TOKEN_KEY);
    }

    setUser(null);
    setIsLoading(false);
    return false;
  };

  const login = (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    checkAuth();
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
