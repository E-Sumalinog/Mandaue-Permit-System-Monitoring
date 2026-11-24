"use client";

import { useState } from "react";
import {
  MOCK_MAINTENANCE_ASSETS,
  MaintenanceAsset,
  MaintenanceCategory,
  AssetCondition,
} from "@/data/mockOperations";
import { useAuth } from "@/context/AuthContext";
import { Gauge, Wrench, PlusCircle, MailWarning, Thermometer, GitCommitHorizontal } from "lucide-react";

const TABS: { key: "ALL" | MaintenanceCategory; label: string }[] = [
  { key: "ALL", label: "All Maintenance Assets" },
  { key: "TANKS", label: "Tanks" },
  { key: "VALVE_GAUGE", label: "Valve → Pressure Gauge" },
  { key: "OTHERS", label: "Others (Pumps / Safety)" },
];

export default function MaintenanceMonitoringPage() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<MaintenanceAsset[]>(MOCK_MAINTENANCE_ASSETS);
  const [activeTab, setActiveTab] = useState<"ALL" | MaintenanceCategory>("ALL");
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("m-3");
  const [psiInput, setPsiInput] = useState<string>("48.5");
  const [remarksInput, setRemarksInput] = useState<string>("");
  const [banner, setBanner] = useState<string | null>(null);

  const notify = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 5000);
  };

  const pressureAssets = assets.filter((a) => typeof a.currentPsi === "number");

  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    const psiVal = parseFloat(psiInput);
    if (isNaN(psiVal)) return;

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    let breachedCode = "";

    setAssets((prev) =>
      prev.map((a) => {
        if (a.id !== selectedId) return a;
        const min = a.minPsi ?? 0;
        const max = a.maxPsi ?? 100;
        let nextCondition: AssetCondition = "NORMAL";
        if (psiVal > max || psiVal < min) {
          nextCondition = "CRITICAL";
          breachedCode = a.assetCode;
        } else if (psiVal >= max - 4 || psiVal <= min + 4) {
          nextCondition = "WARNING";
        }
        return {
          ...a,
          currentPsi: psiVal,
          condition: nextCondition,
          lastCheckedAt: `Today ${now}`,
          checkedBy: user?.name ?? "Operator",
          remarks: remarksInput || a.remarks,
        };
      })
    );

    setRemarksInput("");
    setIsLogOpen(false);
    if (breachedCode) {
      notify(`CRITICAL PRESSURE ALERT on ${breachedCode} (${psiVal} PSI)! Safety email queued.`);
    } else {
      notify(`Recorded gauge inspection (${psiVal} PSI) successfully.`);
    }
  };

  const badgeStyle: Record<AssetCondition, string> = {
    NORMAL: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    WARNING: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    CRITICAL: "bg-red-500/15 text-red-400 border-red-500/30",
    UNDER_MAINTENANCE: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  };

  const visibleAssets = assets.filter(
    (a) => activeTab === "ALL" || a.category === activeTab
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">
            Mandaue Terminal — Maintenance & Pressure Gauges
          </h1>
          <p className="text-xs text-slate-400">
            Monitoring for Storage Tanks, Valve Line Pressure Gauges & Terminal Equipment
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsLogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition"
        >
          <PlusCircle className="w-4 h-4" />
          Log Pressure / Inspection
        </button>
      </div>

      {banner && (
        <div className="px-4 py-3 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-medium">
          {banner}
        </div>
      )}

      {/* Maintenance Sub-Tabs matching client drawing */}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
              activeTab === t.key
                ? "bg-blue-600/20 border-blue-500 text-blue-400"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Asset Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleAssets.map((item) => {
          const hasPsi = typeof item.currentPsi === "number" && typeof item.maxPsi === "number";
          const pct = hasPsi
            ? Math.min(100, Math.max(5, Math.round((item.currentPsi! / (item.maxPsi! * 1.2)) * 100)))
            : 0;
          const barColor =
            item.condition === "CRITICAL"
              ? "bg-red-500"
              : item.condition === "WARNING"
              ? "bg-amber-400"
              : "bg-emerald-500";

          return (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold uppercase text-slate-400">
                    {item.category.replace("_", " → ")} • {item.assetCode}
                  </span>
                  <h2 className="text-base font-bold text-white flex items-center gap-2 mt-0.5">
                    {hasPsi ? (
                      <Gauge className="w-4 h-4 text-blue-400 shrink-0" />
                    ) : (
                      <Wrench className="w-4 h-4 text-indigo-400 shrink-0" />
                    )}
                    {item.name}
                  </h2>
                  {item.parentValve && (
                    <p className="text-[11px] text-blue-400 flex items-center gap-1 mt-1">
                      <GitCommitHorizontal className="w-3.5 h-3.5" />
                      Attached to: {item.parentValve}
                    </p>
                  )}
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap ${badgeStyle[item.condition]}`}
                >
                  {item.condition.replace("_", " ")}
                </span>
              </div>

              {hasPsi ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-2xl font-mono font-bold text-white">
                      {item.currentPsi!.toFixed(1)}{" "}
                      <span className="text-xs font-normal text-slate-400">PSI</span>
                    </span>
                    <span className="text-slate-400 self-end">
                      Safe: <strong className="text-slate-200">{item.minPsi}–{item.maxPsi} PSI</strong>
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs text-slate-300">
                  Next Scheduled Service: <strong className="text-white">{item.nextServiceDate}</strong>
                </div>
              )}

              <p className="text-xs text-slate-400">{item.remarks}</p>

              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-3">
                  {typeof item.temperatureC === "number" && (
                    <span className="flex items-center gap-1">
                      <Thermometer className="w-3.5 h-3.5 text-slate-500" /> {item.temperatureC}°C
                    </span>
                  )}
                  <span>
                    Updated: {item.lastCheckedAt} ({item.checkedBy})
                  </span>
                </div>

                {(item.condition === "CRITICAL" || item.condition === "WARNING") && (
                  <button
                    type="button"
                    onClick={() =>
                      notify(
                        `Sent urgent maintenance/pressure alert email for ${item.assetCode} (${item.name}).`
                      )
                    }
                    className="flex items-center gap-1 text-red-400 hover:text-red-300 font-semibold"
                  >
                    <MailWarning className="w-3.5 h-3.5" />
                    Send Alert Email
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Log Reading Modal */}
      {isLogOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-bold text-white">Log Tank / Valve Pressure Gauge</h2>
            <form onSubmit={handleSaveLog} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Select Tank or Valve Gauge</label>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                >
                  {pressureAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assetCode} — {a.name} (Safe: {a.minPsi}-{a.maxPsi} PSI)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Gauge Reading (PSI)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={psiInput}
                  onChange={(e) => setPsiInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Inspection Remarks</label>
                <input
                  placeholder="Optional technician note..."
                  value={remarksInput}
                  onChange={(e) => setRemarksInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLogOpen(false)}
                  className="px-4 py-2 text-slate-400 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Save Reading
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}