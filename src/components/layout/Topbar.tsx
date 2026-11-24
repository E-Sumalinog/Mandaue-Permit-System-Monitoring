"use client";

import { useAuth, UserRole } from "@/context/AuthContext";
import { Shield } from "lucide-react";

export function Topbar() {
  const { user, switchRole } = useAuth();
  if (!user) return null;

  return (
    <header className="h-16 bg-slate-900/70 border-b border-slate-800 px-6 flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span>Terminal Scope:</span>
        <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 font-medium">{user.plant}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
          <span className="text-[11px] text-slate-400">Demo Role:</span>
          <select
            value={user.role}
            onChange={(e) => switchRole(e.target.value as UserRole)}
            className="bg-transparent text-xs font-semibold text-blue-400 focus:outline-none cursor-pointer"
          >
            <option value="ADMIN" className="bg-slate-900">ADMIN (Full Access)</option>
            <option value="APPROVER" className="bg-slate-900">APPROVER (Supervisor)</option>
            <option value="STAFF" className="bg-slate-900">STAFF (Limited)</option>
          </select>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="text-right">
            <p className="text-xs font-semibold text-white">{user.name}</p>
            <p className="text-[11px] text-slate-400 flex items-center justify-end gap-1">
              <Shield className="w-3 h-3 text-emerald-400" /> {user.role}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}