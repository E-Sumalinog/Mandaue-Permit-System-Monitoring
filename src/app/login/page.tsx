"use client";

import { useState } from "react";
import { useAuth, UserRole } from "@/context/AuthContext";
import { Truck, ShieldCheck, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@petron-logistics.local");
  const [password, setPassword] = useState("••••••••••••");
  const [selectedRole, setSelectedRole] = useState<UserRole>("ADMIN");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(email, selectedRole);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-red-600/20 border border-red-500/30 text-red-500">
            <Truck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Dispatcher & Permit Center</h1>
            <p className="text-xs text-slate-400">Automated Truck Tracking & Gate Pass Portal</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Corporate Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Sign In As (Demo Role Preview)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["ADMIN", "APPROVER", "STAFF"] as UserRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setSelectedRole(role);
                    setEmail(`${role.toLowerCase()}@petron-logistics.local`);
                  }}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold border transition ${
                    selectedRole === role
                      ? "bg-blue-600/20 border-blue-500 text-blue-400"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2 mt-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Sign In to Portal
          </button>
        </form>
      </div>
    </div>
  );
}