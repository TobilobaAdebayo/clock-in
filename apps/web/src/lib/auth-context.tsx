'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  role: 'RECEPTIONIST' | 'SUPER_ADMIN';
  twoFactorEnabled?: boolean;
}

export interface TwoFactorChallenge {
  requiresTwoFactor: true;
  challengeToken: string;
  expiresInSeconds: number;
}

export type LoginOutcome =
  | { requiresTwoFactor: false; staff: StaffUser }
  | TwoFactorChallenge;

interface AuthContextType {
  user: StaffUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string,
    options?: { redirect?: boolean },
  ) => Promise<LoginOutcome>;
  verifyTwoFactorLogin: (
    challengeToken: string,
    code: string,
    options?: { redirect?: boolean },
  ) => Promise<StaffUser>;
  updateUser: (patch: Partial<StaffUser>) => void;
  logout: (redirectTo?: string) => Promise<void>;
  setToken: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Keep access token in memory
let globalAccessToken: string | null = null;

export const getAccessToken = () => globalAccessToken;
export const setGlobalAccessToken = (token: string | null) => {
  globalAccessToken = token;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const setToken = (token: string | null) => {
    globalAccessToken = token;
    setAccessTokenState(token);
  };

  const updateUser = (patch: Partial<StaffUser>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  // Try to restore session on initial load using httpOnly refresh cookie
  useEffect(() => {
    async function restoreSession() {
      try {
        const res = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setToken(json.data.accessToken);
            setUser(json.data.staff);
          }
        }
      } catch (err) {
        console.warn('Session restoration failed:', err);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = async (
    email: string,
    password: string,
    options?: { redirect?: boolean },
  ): Promise<LoginOutcome> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Login failed');
      }

      if (json.data?.requiresTwoFactor) {
        return {
          requiresTwoFactor: true,
          challengeToken: json.data.challengeToken,
          expiresInSeconds: json.data.expiresInSeconds,
        };
      }

      const staffUser: StaffUser = json.data.staff;
      setToken(json.data.accessToken);
      setUser(staffUser);

      if (options?.redirect !== false) {
        router.push(staffUser.role === 'SUPER_ADMIN' ? '/super-admin' : '/staff');
      }

      return { requiresTwoFactor: false, staff: staffUser };
    } finally {
      setIsLoading(false);
    }
  };

  const verifyTwoFactorLogin = async (
    challengeToken: string,
    code: string,
    options?: { redirect?: boolean },
  ): Promise<StaffUser> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/auth/2fa/verify-login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken, code: code.trim() }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Verification failed');
      }

      const staffUser: StaffUser = json.data.staff;
      setToken(json.data.accessToken);
      setUser(staffUser);

      if (options?.redirect !== false) {
        router.push(staffUser.role === 'SUPER_ADMIN' ? '/super-admin' : '/staff');
      }

      return staffUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (redirectTo = '/staff-login') => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Ignore network errors on logout
    } finally {
      setToken(null);
      setUser(null);
      router.push(redirectTo);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        isAuthenticated: !!user,
        login,
        verifyTwoFactorLogin,
        updateUser,
        logout,
        setToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
