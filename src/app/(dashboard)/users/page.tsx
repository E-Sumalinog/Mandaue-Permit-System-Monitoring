"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth, UserRole } from "@/context/AuthContext";
import { RefreshCw, ShieldAlert } from "lucide-react";

interface ApiUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  terminalId: string | null;
  terminal: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export default function UsersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<ApiUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load users.");
      }
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user?.role === "ADMIN") {
      loadUsers();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading, user?.role, loadUsers]);

  if (authLoading) {
    return (
      <div className="text-xs text-slate-400">Checking permissions...</div>
    );
  }

  if (user?.role !== "ADMIN") {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-400 flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <span>Access Denied: Admin privileges required.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">User & Role Management</h1>
          <p className="text-xs text-slate-400">
            Active RBAC accounts and terminal assignments loaded from Neon
          </p>
        </div>

        <button
          type="button"
          onClick={loadUsers}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase">
            <tr>
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Assigned Terminal</th>
              <th className="py-3 px-4">Account Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-6 px-4 text-center text-slate-400">
                  Loading users from Neon...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 px-4 text-center text-slate-500">
                  No users found in Neon.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-950/40">
                  <td className="py-3 px-4 font-semibold text-white">{u.name}</td>
                  <td className="py-3 px-4 font-mono">{u.email}</td>
                  <td className="py-3 px-4 text-blue-400 font-semibold">{u.role}</td>
                  <td className="py-3 px-4">
                    {u.terminal?.name || "All Terminals"}
                  </td>
                  <td className="py-3 px-4">
                    {u.isActive ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-semibold">
                        INACTIVE
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}