"use client";

import { useCallback, useEffect, useState } from "react";
import type { DispatchRecord } from "@/data/mockDispatches";
import { DispatchTable } from "@/components/dispatch/DispatchTable";
import { ImportModal } from "@/components/dispatch/ImportModal";
import {
  Upload,
  Truck,
  CheckCircle2,
  MailCheck,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface ApiDispatchRow {
  id: string;
  sourcePlant: string;
  truck: string;
  priority: string;
  orderNumber: string;
  shipToNumber: string;
  destinationName: string;
  receivingWindow: string;
  incident: string | null;
  salesRoute: string;
  permitStatus: string;
  lastEmailedAt: string | null;
  terminal?: {
    code?: string;
    name?: string;
  } | null;
}

function mapApiDispatchToRecord(row: ApiDispatchRow): DispatchRecord {
  const normalizedStatus = (
    row.permitStatus === "APPROVED" || row.permitStatus === "EMAILED"
      ? row.permitStatus
      : "PENDING"
  ) as DispatchRecord["permitStatus"];

  const terminalLabel = row.terminal?.name
    ? row.terminal.code
      ? `${row.terminal.name} (${row.terminal.code})`
      : row.terminal.name
    : row.sourcePlant || "Mandaue Terminal";

  return {
    id: row.id,
    sourcePlant: row.sourcePlant,
    truck: row.truck,
    priority: row.priority,
    orderNumber: row.orderNumber,
    shipToNumber: row.shipToNumber,
    destinationName: row.destinationName,
    receivingWindow: row.receivingWindow,
    incident: row.incident ?? null,
    salesRoute: row.salesRoute,
    terminalInfo: terminalLabel,
    permitStatus: normalizedStatus,
    lastEmailedAt: row.lastEmailedAt
      ? new Date(row.lastEmailedAt).toLocaleString()
      : undefined,
  } as DispatchRecord;
}

export default function DispatcherDashboardPage() {
  const [records, setRecords] = useState<DispatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const notify = (msg: string) => {
    setBannerMsg(msg);
    setTimeout(() => setBannerMsg(null), 4000);
  };

  const loadDispatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/dispatches", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      const rows = Array.isArray(data?.dispatches)
        ? (data.dispatches as ApiDispatchRow[]).map(mapApiDispatchToRecord)
        : [];
      setRecords(rows);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDispatches();
  }, [loadDispatches]);

  const handleImportRecords = (
    newRecords: DispatchRecord[],
    sourceLabel: string
  ) => {
    void (async () => {
      const res = await fetch("/api/dispatches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ records: newRecords }),
      });

      if (!res.ok) {
        notify("Failed to save imported dispatch records to Neon.");
        return;
      }

      await loadDispatches();
      notify(
        `Imported ${newRecords.length} dispatch record(s) from ${sourceLabel} into Neon.`
      );
    })();
  };

  const handleApprove = (ids: string[]) => {
    void (async () => {
      const res = await fetch("/api/dispatches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "APPROVE", ids }),
      });

      if (!res.ok) {
        notify("Failed to approve selected permits.");
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.dispatches)) {
        setRecords(
          (data.dispatches as ApiDispatchRow[]).map(mapApiDispatchToRecord)
        );
      } else {
        await loadDispatches();
      }
      notify(`Approved permit for ${ids.length} selected truck(s).`);
    })();
  };

  const handleSendEmail = (ids: string[]) => {
    void (async () => {
      const res = await fetch("/api/dispatches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "EMAIL", ids }),
      });

      if (!res.ok) {
        notify("Failed to log automated email dispatch.");
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.dispatches)) {
        setRecords(
          (data.dispatches as ApiDispatchRow[]).map(mapApiDispatchToRecord)
        );
      } else {
        await loadDispatches();
      }
      notify(`Extracted & logged permit email for ${ids.length} truck(s).`);
    })();
  };

  const kpis = [
    {
      label: "TOTAL TRUCKS",
      value: records.length,
      icon: Truck,
      color: "text-blue-400",
    },
    {
      label: "PENDING APPROVAL",
      value: records.filter((r) => r.permitStatus === "PENDING").length,
      icon: AlertCircle,
      color: "text-amber-400",
    },
    {
      label: "PERMITS APPROVED",
      value: records.filter((r) => r.permitStatus === "APPROVED").length,
      icon: CheckCircle2,
      color: "text-indigo-400",
    },
    {
      label: "AUTOMATED EMAILS SENT",
      value: records.filter((r) => r.permitStatus === "EMAILED").length,
      icon: MailCheck,
      color: "text-emerald-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">
            Dispatcher Center & Permit Monitoring
          </h1>
          <p className="text-xs text-slate-400">
            Delivery Trip Extraction, Permit Approval & Automated Email Dispatch
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadDispatches}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white transition"
          >
            <Upload className="w-4 h-4 text-blue-400" />
            Import Dispatcher Export (CSV/XLSX)
          </button>
        </div>
      </div>

      {bannerMsg && (
        <div className="px-4 py-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
          {bannerMsg}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold tracking-wider text-slate-400">
                  {kpi.label}
                </span>
                <Icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className="text-2xl font-bold text-white">
                {isLoading ? "—" : kpi.value}
              </p>
            </div>
          );
        })}
      </div>

      <DispatchTable
        data={records}
        onApprove={handleApprove}
        onSendEmail={handleSendEmail}
      />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportRecords={handleImportRecords}
      />
    </div>
  );
}