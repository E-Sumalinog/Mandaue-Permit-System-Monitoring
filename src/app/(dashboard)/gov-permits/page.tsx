"use client";

import { useState } from "react";
import {
  MOCK_GOV_PERMITS,
  GovernmentPermit,
  GovtPermitCategory,
  GovPermitStatus,
} from "@/data/mockOperations";
import { useAuth } from "@/context/AuthContext";
import { Mail, RefreshCw, Plus, X } from "lucide-react";

const CATEGORIES: { key: "ALL" | GovtPermitCategory; label: string }[] = [
  { key: "ALL", label: "All Govt Permits" },
  { key: "AIR", label: "Air" },
  { key: "WATER", label: "Water" },
  { key: "HAZWASTE", label: "HazWaste" },
  { key: "BIR", label: "BIR" },
  { key: "PTO", label: "PTO" },
  { key: "BUSINESS", label: "Business" },
];

export default function GovernmentPermitsPage() {
  const { user } = useAuth();
  const [permits, setPermits] = useState<GovernmentPermit[]>(MOCK_GOV_PERMITS);
  const [activeCategory, setActiveCategory] = useState<"ALL" | GovtPermitCategory>("ALL");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // Add Permit Form State
  const [category, setCategory] = useState<GovtPermitCategory>("AIR");
  const [permitNumber, setPermitNumber] = useState("");
  const [permitName, setPermitName] = useState("");
  const [issuingAgency, setIssuingAgency] = useState("");
  const [expiryDate, setExpiryDate] = useState("2027-11-24");

  const canManage = user?.role === "ADMIN" || user?.role === "APPROVER";

  const notify = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 5000);
  };

  const handleAddPermit = (e: React.FormEvent) => {
    e.preventDefault();
    const diffDays = Math.ceil(
      (new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    const status: GovPermitStatus =
      diffDays < 0 ? "EXPIRED" : diffDays <= 30 ? "EXPIRING_SOON" : "ACTIVE";

    const newEntry: GovernmentPermit = {
      id: `gp-${Date.now()}`,
      category,
      permitNumber,
      permitName,
      issuingAgency: issuingAgency || "Government Agency",
      terminal: "Mandaue Terminal",
      issueDate: new Date().toISOString().slice(0, 10),
      expiryDate,
      daysRemaining: diffDays,
      status,
      lastReminderSent: null,
    };

    setPermits((prev) => [newEntry, ...prev]);
    setPermitNumber("");
    setPermitName("");
    setIssuingAgency("");
    setIsAddOpen(false);
    notify(`Added ${category} permit (${newEntry.permitNumber}) under Mandaue Terminal.`);
  };

  const handleSendReminder = (permit: GovernmentPermit) => {
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setPermits((prev) =>
      prev.map((p) => (p.id === permit.id ? { ...p, lastReminderSent: `Today ${now}` } : p))
    );
    notify(`Sent renewal alert email for ${permit.category} permit (${permit.permitNumber}).`);
  };

  const handleRenewPermit = (id: string) => {
    setPermits((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              expiryDate: "2027-11-24",
              daysRemaining: 365,
              status: "ACTIVE",
            }
          : p
      )
    );
    notify("Permit renewed for 12 months.");
  };

  const statusBadge: Record<GovPermitStatus, string> = {
    ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    EXPIRING_SOON: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    EXPIRED: "bg-red-500/15 text-red-400 border-red-500/30",
  };

  const filtered = permits.filter(
    (p) => activeCategory === "ALL" || p.category === activeCategory
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">
            Mandaue Terminal — Government Permits
          </h1>
          <p className="text-xs text-slate-400">
            Compliance Tracking for Air, Water, HazWaste, BIR, PTO & Business Permits
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" />
          Add Govt Permit
        </button>
      </div>

      {banner && (
        <div className="px-4 py-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
          {banner}
        </div>
      )}

      {/* 6 Category Tabs matching client drawing */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setActiveCategory(cat.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
              activeCategory === cat.key
                ? "bg-blue-600/20 border-blue-500 text-blue-400"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Permits Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Permit # & Description</th>
                <th className="py-3 px-4">Issuing Agency</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Countdown</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-bold text-[11px]">
                      {p.category}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-mono text-blue-400 font-semibold">{p.permitNumber}</div>
                    <div className="text-slate-300">{p.permitName}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-400">{p.issuingAgency}</td>
                  <td className="py-3 px-4 font-mono">{p.expiryDate}</td>
                  <td className="py-3 px-4 font-semibold">
                    {p.daysRemaining < 0 ? (
                      <span className="text-red-400">{Math.abs(p.daysRemaining)} days overdue</span>
                    ) : (
                      <span>{p.daysRemaining} days left</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${statusBadge[p.status]}`}
                    >
                      {p.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSendReminder(p)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1"
                      >
                        <Mail className="w-3 h-3 text-emerald-400" />
                        Remind
                      </button>

                      {canManage && p.status !== "ACTIVE" && (
                        <button
                          type="button"
                          onClick={() => handleRenewPermit(p.id)}
                          className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Renew
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Permit Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Register Government Permit</h2>
              <button type="button" onClick={() => setIsAddOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddPermit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Permit Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as GovtPermitCategory)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                >
                  <option value="AIR">Air</option>
                  <option value="WATER">Water</option>
                  <option value="HAZWASTE">HazWaste</option>
                  <option value="BIR">BIR</option>
                  <option value="PTO">PTO</option>
                  <option value="BUSINESS">Business</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Permit Number</label>
                <input
                  required
                  placeholder="e.g., DENR-POA-2026-991"
                  value={permitNumber}
                  onChange={(e) => setPermitNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Permit Name / Description</label>
                <input
                  required
                  placeholder="e.g., Permit to Operate Generator Set"
                  value={permitName}
                  onChange={(e) => setPermitName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Issuing Agency</label>
                  <input
                    placeholder="e.g., DENR-EMB"
                    value={issuingAgency}
                    onChange={(e) => setIssuingAgency(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-slate-400 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Save Permit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}