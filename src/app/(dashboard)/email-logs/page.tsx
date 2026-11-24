"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, MailCheck, AlertTriangle, Clock } from "lucide-react";

interface EmailLogItem {
  id: string;
  module: string;
  referenceId: string | null;
  recipients: string;
  subject: string;
  status: string;
  errorMessage: string | null;
  sentAt: string;
}

export default function EmailLogsPage() {
  const [logs, setLogs] = useState<EmailLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/email-logs", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to load email logs.");
      }
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load email logs.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const renderStatus = (log: EmailLogItem) => {
    const normalized = log.status.toUpperCase();
    const formattedDate = new Date(log.sentAt).toLocaleString();

    if (normalized === "SENT" || normalized === "DELIVERED" || normalized === "SEEDED_PREVIEW") {
      return (
        <span className="inline-flex items-center gap-1.5 text-emerald-400">
          <MailCheck className="w-3.5 h-3.5 shrink-0" />
          <span>
            {normalized === "SEEDED_PREVIEW" ? "Preview Logged" : "Sent"} ({formattedDate})
          </span>
        </span>
      );
    }

    if (normalized === "FAILED" || normalized === "ERROR") {
      return (
        <span
          title={log.errorMessage || "Delivery failed"}
          className="inline-flex items-center gap-1.5 text-red-400"
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Failed ({log.errorMessage || "SMTP error"})</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 text-slate-400">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>{log.status} ({formattedDate})</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Automated Email Audit Logs</h1>
          <p className="text-xs text-slate-400">
            Live dispatch, permit expiry, and maintenance alert delivery history from Neon
          </p>
        </div>
        <button
          type="button"
          onClick={fetchLogs}
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

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase">
            <tr>
              <th className="py-3 px-4">Reference / Order</th>
              <th className="py-3 px-4">Module</th>
              <th className="py-3 px-4">Subject & Recipients</th>
              <th className="py-3 px-4">Delivery Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="py-6 px-4 text-center text-slate-400">
                  Loading email audit logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 px-4 text-center text-slate-500">
                  No email audit records found in Neon yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-950/40">
                  <td className="py-3 px-4 font-mono text-white">
                    {log.referenceId || "—"}
                  </td>
                  <td className="py-3 px-4 font-semibold text-blue-400">
                    {log.module}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-white">{log.subject}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{log.recipients}</div>
                  </td>
                  <td className="py-3 px-4">{renderStatus(log)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}