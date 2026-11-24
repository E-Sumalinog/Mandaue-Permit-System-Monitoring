"use client";

import { useState } from "react";
import { MOCK_DISPATCHES, DispatchRecord } from "@/data/mockDispatches";
import { DispatchTable } from "@/components/dispatch/DispatchTable";
import { ImportModal } from "@/components/dispatch/ImportModal";
import { Upload, Truck, CheckCircle2, MailCheck, AlertCircle } from "lucide-react";

export default function DispatcherDashboardPage() {
  const [records, setRecords] = useState<DispatchRecord[]>(MOCK_DISPATCHES);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const notify = (msg: string) => {
    setBannerMsg(msg);
    setTimeout(() => setBannerMsg(null), 4000);
  };

  const handleImportRecords = (newRecords: DispatchRecord[], sourceLabel: string) => {
    setRecords((prev) => [...newRecords, ...prev]);
    notify(`Imported ${newRecords.length} dispatch record(s) from ${sourceLabel}.`);
  };

  const handleApprove = (ids: string[]) => {
    setRecords((prev) =>
      prev.map((r) => (ids.includes(r.id) ? { ...r, permitStatus: "APPROVED" } : r))
    );
    notify(`Approved permit for ${ids.length} selected truck(s).`);
  };

  const handleSendEmail = (ids: string[]) => {
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setRecords((prev) =>
      prev.map((r) =>
        ids.includes(r.id) ? { ...r, permitStatus: "EMAILED", lastEmailedAt: `Today ${now}` } : r
      )
    );
    notify(`Extracted & emailed permit details for ${ids.length} truck(s).`);
  };

  const kpis = [
    { label: "TOTAL TRUCKS", value: records.length, icon: Truck, color: "text-blue-400" },
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
          <h1 className="text-xl font-bold text-white">Dispatcher Center & Permit Monitoring</h1>
          <p className="text-xs text-slate-400">
            Delivery Trip Extraction, Permit Approval & Automated Email Dispatch
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsImportOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white transition"
        >
          <Upload className="w-4 h-4 text-blue-400" />
          Import Dispatcher Export (CSV/XLSX)
        </button>
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
            <div key={kpi.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold tracking-wider text-slate-400">
                  {kpi.label}
                </span>
                <Icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className="text-2xl font-bold text-white">{kpi.value}</p>
            </div>
          );
        })}
      </div>

      <DispatchTable data={records} onApprove={handleApprove} onSendEmail={handleSendEmail} />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportRecords={handleImportRecords}
      />
    </div>
  );
}