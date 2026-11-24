"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type UserRole = "ADMIN" | "APPROVER" | "STAFF";

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plant: string;
}

interface AuthContextType {
  user: UserSession | null;
  isLoading: boolean;
  login: (email: string, role?: UserRole) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USERS: Record<UserRole, UserSession> = {
  ADMIN: {
    id: "u-1",
    name: "Carlos Mendoza",
    email: "admin@petron-logistics.local",
    role: "ADMIN",
    plant: "All Terminals",
  },
  APPROVER: {
    id: "u-2",
    name: "Engr. R. Villanueva",
    email: "supervisor@petron-logistics.local",
    role: "APPROVER",
    plant: "Mandaue Terminal",
  },
  STAFF: {
    id: "u-3",
    name: "J. Santos (Dispatcher)",
    email: "staff@petron-logistics.local",
    role: "STAFF",
    plant: "Mandaue Terminal",
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("petron_demo_user");
    if (saved) {
      setUser(JSON.parse(saved));
    }
    setIsLoading(false);
  }, []);

  const login = (email: string, role: UserRole = "ADMIN") => {
    const profile = { ...DEMO_USERS[role], email: email || DEMO_USERS[role].email };
    setUser(profile);
    localStorage.setItem("petron_demo_user", JSON.stringify(profile));
    router.push("/");
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("petron_demo_user");
    router.push("/login");
  };

  const switchRole = (role: UserRole) => {
    const nextUser = DEMO_USERS[role];
    setUser(nextUser);
    localStorage.setItem("petron_demo_user", JSON.stringify(nextUser));
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}