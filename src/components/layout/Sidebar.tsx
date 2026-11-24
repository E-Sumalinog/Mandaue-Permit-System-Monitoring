"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Gauge,
  FileBadge2,
  FileCheck2,
  MailCheck,
  Users,
  LogOut,
  Truck,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems = [
    {
      href: "/",
      label: "Dispatcher Center",
      icon: LayoutDashboard,
      roles: ["ADMIN", "APPROVER", "STAFF"],
    },
    {
      href: "/tank-monitoring",
      label: "Tank Pressure Gauges",
      icon: Gauge,
      roles: ["ADMIN", "APPROVER", "STAFF"],
    },
    {
      href: "/gov-permits",
      label: "Government Permits",
      icon: FileBadge2,
      roles: ["ADMIN", "APPROVER", "STAFF"],
    },
    {
      href: "/permits",
      label: "Trip Gate Passes",
      icon: FileCheck2,
      roles: ["ADMIN", "APPROVER", "STAFF"],
    },
    {
      href: "/email-logs",
      label: "Email Automation Logs",
      icon: MailCheck,
      roles: ["ADMIN", "APPROVER"],
    },
    {
      href: "/users",
      label: "User & Role Access",
      icon: Users,
      roles: ["ADMIN"],
    },
  ];

  const allowedNav = navItems.filter((item) => user && item.roles.includes(user.role));

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between min-h-screen shrink-0">
      <div>
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
          <Truck className="w-6 h-6 text-red-500" />
          <div>
            <span className="font-bold text-sm tracking-wide text-white block">OPS & PERMIT HUB</span>
            <span className="text-[11px] text-slate-400">Local Static-IP Edition</span>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {allowedNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
                  active
                    ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}