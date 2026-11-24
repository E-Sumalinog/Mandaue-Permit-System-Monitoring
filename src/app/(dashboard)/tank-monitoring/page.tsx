"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Gauge,
  Wrench,
  PlusCircle,
  MailWarning,
  Thermometer,
  GitCommitHorizontal,
} from "lucide-react";

type MaintenanceCategory = "TANKS" | "VALVE" | "PRESSURE_GAUGE" | "OTHERS";
type AssetCondition = "NORMAL" | "WARNING" | "CRITICAL" | "UNDER_MAINTENANCE";
type FilterTab = "ALL" | "TANKS" | "VALVE_GAUGE" | "OTHERS";

interface LinkedAssetSummary {
  id: string;
  assetCode: string;
  name: string;
  category: MaintenanceCategory;
}

interface MaintenanceLogEntry {
  readingValue: number | null;
  temperatureC: number | null;
  findings: string | null;
  recordedAt: string;
  recordedBy?: { name: string | null };
}

interface ApiMaintenanceAsset {
  id: string;
  assetCode: string;
  name: string;
  category: MaintenanceCategory;
  locationNote: string | null;
  unit: string | null;
  minThreshold: number | null;
  maxThreshold: number | null;
  latestReading: number | null;
  nextServiceDate: string | null;
  updatedAt: string;
  condition: AssetCondition;
  parentAsset: LinkedAssetSummary | null;
  childAssets: LinkedAssetSummary[];
  logs?: MaintenanceLogEntry[];
}

interface DisplayAsset {
  id: string;
  assetCode: string;
  name: string;
  category: MaintenanceCategory;
  unit: string;
  latestReading: number | null;
  minThreshold: number | null;
  maxThreshold: number | null;
  temperatureC: number | null;
  condition: AssetCondition;
  nextServiceDate: string | null;
  lastCheckedAt: string;
  checkedBy: string;
  remarks: string;
  parentValveLabel: string | null;
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: "ALL", label: "All Maintenance Assets" },
  { key: "TANKS", label: "Tanks" },
  { key: "VALVE_GAUGE", label: "Valve → Pressure Gauge" },
  { key: "OTHERS", label: "Others (Pumps / Safety)" },
];

function mapAsset(a: ApiMaintenanceAsset): DisplayAsset {
  const latestLog = a.logs?.[0];
  const parentLabel = a.parentAsset
    ? `${a.parentAsset.assetCode} — ${a.parentAsset.name}`
    : a.childAssets.length > 0
    ? `Linked: ${a.childAssets.map((c) => c.assetCode).join(", ")}`
    : null;

  return {
    id: a.id,
    assetCode: a.assetCode,
    name: a.name,
    category: a.category,
    unit: a.unit || "PSI",
    latestReading: a.latestReading,
    minThreshold: a.minThreshold,
    maxThreshold: a.maxThreshold,
    temperatureC: latestLog?.temperatureC ?? null,
    condition: a.condition,
    nextServiceDate: a.nextServiceDate ? a.nextServiceDate.slice(0, 10) : null,
    lastCheckedAt: latestLog?.recordedAt
      ? new Date(latestLog.recordedAt).toLocaleString()
      : new Date(a.updatedAt).toLocaleString(),
    checkedBy: latestLog?.recordedBy?.name || "Terminal Operator",
    remarks: latestLog?.findings || a.locationNote || "No inspection remarks recorded.",
    parentValveLabel: parentLabel,
  };
}

export default function MaintenanceMonitoringPage() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<DisplayAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [psiInput, setPsiInput] = useState<string>("48.5");
  const [remarksInput, setRemarksInput] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const notify = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 5000);
  };

  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/maintenance", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      const mapped = Array.isArray(data?.assets)
        ? (data.assets as ApiMaintenanceAsset[]).map(mapAsset)
        : [];
      setAssets(mapped);

      const firstReadable =
        mapped.find(
          (item) =>
            typeof item.latestReading === "number" || typeof item.maxThreshold === "number"
        ) || mapped[0];
      if (firstReadable) {
        setSelectedId((prev) => prev || firstReadable.id);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const pressureAssets = assets.filter(
    (a) => typeof a.latestReading === "number" || typeof a.maxThreshold === "number"
  );

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const readingVal = parseFloat(psiInput);
    if (!selectedId || Number.isNaN(readingVal)) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          assetId: selectedId,
          readingValue: readingVal,
          findings: remarksInput.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.asset) {
        notify(data?.error || "Failed to save inspection reading.");
        return;
      }

      const updated = mapAsset(data.asset as ApiMaintenanceAsset);
      setAssets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setRemarksInput("");
      setIsLogOpen(false);

      if (data.breached) {
        notify(
          `CRITICAL ${updated.unit} ALERT on ${updated.assetCode} (${readingVal.toFixed(1)} ${updated.unit})! Alert logged to Neon.`
        );
      } else {
        notify(
          `Recorded inspection (${readingVal.toFixed(1)} ${updated.unit}) on ${updated.assetCode} by ${
            user?.name ?? "Operator"
          }.`
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendAlertEmail = async (item: DisplayAsset) => {
    const res = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        assetId: item.id,
        sendAlertOnly: true,
      }),
    });
    if (res.ok) {
      notify(`Logged maintenance/pressure alert email for ${item.assetCode} (${item.name}).`);
    } else {
      notify(`Failed to log alert email for ${item.assetCode}.`);
    }
  };

  const badgeStyle: Record<AssetCondition, string> = {
    NORMAL: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    WARNING: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    CRITICAL: "bg-red-500/15 text-red-400 border-red-500/30",
    UNDER_MAINTENANCE: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  };

  const visibleAssets = assets.filter((a) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "TANKS") return a.category === "TANKS";
    if (activeTab === "VALVE_GAUGE")
      return a.category === "VALVE" || a.category === "PRESSURE_GAUGE";
    return a.category === "OTHERS";
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">
            Mandaue Terminal — Maintenance & Pressure Gauges
          </h1>
          <p className="text-xs text-slate-400">
            Live monitoring for Storage Tanks, Valve → Pressure Gauge lines & Terminal Equipment
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

      {isLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-xs text-slate-400">
          Loading maintenance assets and readings from Neon...
        </div>
      ) : visibleAssets.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-xs text-slate-500">
          No maintenance assets found in this tab.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleAssets.map((item) => {
            const hasReading =
              typeof item.latestReading === "number" && typeof item.maxThreshold === "number";
            const pct = hasReading
              ? Math.min(
                  100,
                  Math.max(
                    5,
                    Math.round((item.latestReading! / (item.maxThreshold! * 1.2)) * 100)
                  )
                )
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
                      {item.category.replace("_", " ")} • {item.assetCode}
                    </span>
                    <h2 className="text-base font-bold text-white flex items-center gap-2 mt-0.5">
                      {hasReading ? (
                        <Gauge className="w-4 h-4 text-blue-400 shrink-0" />
                      ) : (
                        <Wrench className="w-4 h-4 text-indigo-400 shrink-0" />
                      )}
                      {item.name}
                    </h2>
                    {item.parentValveLabel && (
                      <p className="text-[11px] text-blue-400 flex items-center gap-1 mt-1">
                        <GitCommitHorizontal className="w-3.5 h-3.5" />
                        {item.parentValveLabel}
                      </p>
                    )}
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap ${
                      badgeStyle[item.condition]
                    }`}
                  >
                    {item.condition.replace("_", " ")}
                  </span>
                </div>

                {hasReading ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-2xl font-mono font-bold text-white">
                        {item.latestReading!.toFixed(1)}{" "}
                        <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                      </span>
                      <span className="text-slate-400 self-end">
                        Safe:{" "}
                        <strong className="text-slate-200">
                          {item.minThreshold ?? 0}–{item.maxThreshold} {item.unit}
                        </strong>
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full ${barColor} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs text-slate-300">
                    Next Scheduled Service:{" "}
                    <strong className="text-white">
                      {item.nextServiceDate || "Scheduled per PM cycle"}
                    </strong>
                  </div>
                )}

                <p className="text-xs text-slate-400">{item.remarks}</p>

                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                  <div className="flex items-center gap-3">
                    {typeof item.temperatureC === "number" && (
                      <span className="flex items-center gap-1">
                        <Thermometer className="w-3.5 h-3.5 text-slate-500" />
                        {item.temperatureC}°C
                      </span>
                    )}
                    <span>
                      Updated: {item.lastCheckedAt} ({item.checkedBy})
                    </span>
                  </div>

                  {(item.condition === "CRITICAL" || item.condition === "WARNING") && (
                    <button
                      type="button"
                      onClick={() => handleSendAlertEmail(item)}
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
      )}

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
                  {(pressureAssets.length > 0 ? pressureAssets : assets).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assetCode} — {a.name}{" "}
                      {typeof a.maxThreshold === "number"
                        ? `(Safe: ${a.minThreshold ?? 0}-${a.maxThreshold} ${a.unit})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Gauge Reading</label>
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
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold"
                >
                  {isSaving ? "Saving..." : "Save Reading"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}