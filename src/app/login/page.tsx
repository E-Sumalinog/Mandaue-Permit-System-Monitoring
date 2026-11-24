"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Truck, ShieldCheck, Lock, Mail, AlertCircle } from "lucide-react";

const SEEDED_ACCOUNTS = [
  {
    label: "ADMIN",
    email: "admin.mandaue@terminal.local",
    password: "Admin@1234",
  },
  {
    label: "APPROVER",
    email: "approver.mandaue@terminal.local",
    password: "Approver@1234",
  },
  {
    label: "STAFF",
    email: "staff.mandaue@terminal.local",
    password: "Staff@1234",
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin.mandaue@terminal.local");
  const [password, setPassword] = useState("Admin@1234");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const result = await login(email.trim(), password);
      if (!result.ok) {
        setErrorMsg(result.error || "Sign-in failed. Please check your credentials.");
      }
    } finally {
      setIsSubmitting(false);
    }
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
            <p className="text-xs text-slate-400">
              Mandaue Terminal Operations & Compliance Portal
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Corporate Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@terminal.local"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Quick-Fill Seeded Neon Account
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SEEDED_ACCOUNTS.map((acct) => {
                const isSelected = email.toLowerCase() === acct.email.toLowerCase();
                return (
                  <button
                    key={acct.label}
                    type="button"
                    onClick={() => {
                      setEmail(acct.email);
                      setPassword(acct.password);
                      setErrorMsg(null);
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border transition ${
                      isSelected
                        ? "bg-blue-600/20 border-blue-500 text-blue-400"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {acct.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2 mt-2"
          >
            <ShieldCheck className="w-4 h-4" />
            {isSubmitting ? "Signing In..." : "Sign In to Portal"}
          </button>
        </form>
      </div>
    </div>
  );
}