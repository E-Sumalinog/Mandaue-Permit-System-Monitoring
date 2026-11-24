"use client";

import { useCallback, useEffect, useState } from "react";
import { QrCode, RefreshCw } from "lucide-react";

interface DispatchPermitRecord {
  id: string;
  orderNo: string;
  truckPlateNo: string;
  destination: string;
  receivingWindow: string | null;
  salesRoute: string | null;
  permitStatus: string;
}

export default function PermitsPage() {
  const [permits, setPermits] = useState<DispatchPermitRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPermits = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dispatches", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load generated permits.");
      }

      const rows: DispatchPermitRecord[] = Array.isArray(data?.dispatches)
        ? data.dispatches
        : [];

      const approvedOnly = rows.filter((d) => {
        const status = String(d.permitStatus || "").toUpperCase();
        return status === "APPROVED" || status === "EMAILED";
      });

      setPermits(approvedOnly);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load permits.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPermits();
  }, [loadPermits]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Generated Permits & Gate Passes</h1>
          <p className="text-xs text-slate-400">
            Approved and emailed dispatch gate passes loaded from Neon
          </p>
        </div>

        <button
          type="button"
          onClick={loadPermits}
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

      {isLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-xs text-slate-400">
          Loading approved gate passes from Neon...
        </div>
      ) : permits.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-xs text-slate-500">
          No approved or emailed dispatch permits found yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {permits.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex justify-between items-center gap-4"
            >
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-semibold font-mono">
                    PERMIT #{item.orderNo}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
                    {item.permitStatus}
                  </span>
                </div>
                <h2 className="text-base font-bold text-white">Truck: {item.truckPlateNo}</h2>
                <p className="text-slate-400">Destination: {item.destination}</p>
                <p className="text-slate-400">
                  Window: {item.receivingWindow || "Standard"} • Route:{" "}
                  {item.salesRoute || "Mandaue"}
                </p>
              </div>
              <div className="p-3 bg-white rounded-lg text-slate-950 shrink-0">
                <QrCode className="w-14 h-14" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}