"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type UserRole = "ADMIN" | "APPROVER" | "STAFF";

export interface TerminalInfo {
  id: string;
  code: string;
  name: string;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plant: string;
  terminalId: string | null;
  terminal: TerminalInfo | null;
}

interface LoginResult {
  ok: boolean;
  error?: string;
}

interface AuthContextType {
  user: UserSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapApiUserToSession(rawUser: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  terminalId?: string | null;
  terminal?: TerminalInfo | null;
  plant?: string;
}): UserSession {
  return {
    id: rawUser.id,
    name: rawUser.name,
    email: rawUser.email,
    role: rawUser.role,
    terminalId: rawUser.terminalId ?? null,
    terminal: rawUser.terminal ?? null,
    plant: rawUser.terminal?.name ?? rawUser.plant ?? "Mandaue Terminal",
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      if (!res.ok) {
        setUser(null);
        return;
      }

      const data = await res.json();
      if (data?.user) {
        setUser(mapApiUserToSession(data.user));
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.user) {
        return {
          ok: false,
          error: data?.error || "Invalid email or password.",
        };
      }

      setUser(mapApiUserToSession(data.user));
      router.push("/");
      router.refresh();
      return { ok: true };
    } catch {
      return {
        ok: false,
        error: "Unable to reach the authentication server.",
      };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
      router.push("/login");
      router.refresh();
    }
  };

  // Real roles come from Neon User records; kept as no-op for backward compatibility
  const switchRole = (_role: UserRole) => {
    // Intentionally disabled in database-backed auth mode
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, logout, refreshUser, switchRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}