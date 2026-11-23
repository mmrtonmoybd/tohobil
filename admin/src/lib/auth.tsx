import React, { createContext, useContext, useState, useEffect } from 'react';
import { adminFetch } from './api';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

interface AuthContextType {
  admin: AdminUser | null;
  loading: boolean;
  login: (admin: AdminUser, csrf: string) => void;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.removeItem('tohobil_admin_token');
    localStorage.removeItem('tohobil_admin_user');
    adminFetch<{ status: string; admin: AdminUser; csrf_token: string }>('auth/me')
      .then((res) => {
        setAdmin(res.admin);
        sessionStorage.setItem('tohobil_admin_csrf', res.csrf_token);
      })
      .catch(() => {
        setAdmin(null);
        sessionStorage.removeItem('tohobil_admin_csrf');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  function login(adminUser: AdminUser, csrf: string) {
    sessionStorage.setItem('tohobil_admin_csrf', csrf);
    setAdmin(adminUser);
  }

  async function logout() {
    try {
      await adminFetch('auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    sessionStorage.removeItem('tohobil_admin_csrf');
    setAdmin(null);
    window.location.href = '/admin/login';
  }

  function hasPermission(perm: string): boolean {
    if (!admin) return false;
    if (admin.role === 'super_admin') return true;
    if (admin.permissions.includes('*')) return true;
    return admin.permissions.includes(perm);
  }

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
