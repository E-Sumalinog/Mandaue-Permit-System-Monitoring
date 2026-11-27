"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import EmailRoutingRulesPanel from "@/components/EmailRoutingRulesPanel";

type GovtPermitCategory =
  | "AIR"
  | "WATER"
  | "HAZWASTE"
  | "BIR"
  | "PTO"
  | "BUSINESS";

type ComplianceStatus = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED";

type ActiveTab = "PERMITS" | "ROUTING_RULES" | "EMAIL_LOGS";

interface TerminalRef {
  id: string;
  code: string;
  name: string;
}

interface UserRef {
  id: string;
  name: string;
  email: string;
  role?: string;
  terminalId?: string | null;
}

interface GovernmentPermitRecord {
  id: string;
  terminalId: string;
  terminal?: TerminalRef | null;
  category: GovtPermitCategory;
  permitNumber: string;
  permitName: string;
  issuingAgency: string | null;
  issueDate: string;
  expiryDate: string;
  reminderLeadDays: number;
  status: ComplianceStatus;
  documentPath: string | null;
  remarks: string | null;
  lastReminderSent: string | null;
  updatedBy?: UserRef | null;
  createdAt: string;
}

interface EmailRoutingRuleRecord {
  id: string;
  terminalId: string;
  module: string;
  filterKey: string | null;
  toRecipients: string;
  ccRecipients: string | null;
  isActive: boolean;
}

interface EmailLogRecord {
  id: string;
  module: string;
  referenceId: string | null;
  recipients: string;
  subject: string;
  status: string;
  errorMessage: string | null;
  sentAt: string;
}

interface PermitFormState {
  terminalId: string;
  category: GovtPermitCategory;
  permitNumber: string;
  permitName: string;
  issuingAgency: string;
  issueDate: string;
  expiryDate: string;
  reminderLeadDays: number;
  documentPath: string;
  remarks: string;
  recipientEmail: string;
}

const CATEGORIES: GovtPermitCategory[] = [
  "AIR",
  "WATER",
  "HAZWASTE",
  "BIR",
  "PTO",
  "BUSINESS",
];

const STATUS_BADGES: Record<ComplianceStatus, string> = {
  ACTIVE: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  EXPIRING_SOON: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  EXPIRED: "border-red-500/30 bg-red-500/15 text-red-300",
};

function toDateInputValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function getDaysRemaining(expiryIso: string): number {
  const expiry = new Date(expiryIso).getTime();
  const now = Date.now();
  return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
}

const EMPTY_FORM: PermitFormState = {
  terminalId: "",
  category: "AIR",
  permitNumber: "",
  permitName: "",
  issuingAgency: "",
  issueDate: new Date().toISOString().slice(0, 10),
  expiryDate: "",
  reminderLeadDays: 30,
  documentPath: "",
  remarks: "",
  recipientEmail: "",
};

export default function GovernmentPermitsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("PERMITS");

  const [permits, setPermits] = useState<GovernmentPermitRecord[]>([]);
  const [routingRules, setRoutingRules] = useState<EmailRoutingRuleRecord[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLogRecord[]>([]);
  const [terminals, setTerminals] = useState<TerminalRef[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>("ADMIN");
  const [activeTerminalId, setActiveTerminalId] = useState<string>("ALL");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingExpiry, setCheckingExpiry] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<PermitFormState>(EMPTY_FORM);

  const loadPermitsData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [permitsRes, terminalsRes, sessionRes] = await Promise.all([
        fetch("/api/permits", { cache: "no-store" }),
        fetch("/api/terminals", { cache: "no-store" }),
        fetch("/api/auth/session", { cache: "no-store" }).catch(() => null),
      ]);

      const permitsData = await permitsRes.json().catch(() => ({}));
      if (!permitsRes.ok) {
        throw new Error(permitsData.error || "Failed to load permits.");
      }

      const loadedPermits: GovernmentPermitRecord[] = Array.isArray(
        permitsData.permits
      )
        ? permitsData.permits
        : [];
      setPermits(loadedPermits);
      setRoutingRules(
        Array.isArray(permitsData.routingRules) ? permitsData.routingRules : []
      );
      setEmailLogs(
        Array.isArray(permitsData.emailLogs) ? permitsData.emailLogs : []
      );

      let loadedTerminals: TerminalRef[] = [];
      if (terminalsRes.ok) {
        const termData = await terminalsRes.json().catch(() => ({}));
        loadedTerminals = Array.isArray(termData.terminals)
          ? termData.terminals
          : [];
        setTerminals(loadedTerminals);
      }

      if (sessionRes && sessionRes.ok) {
        const sessionData = await sessionRes.json().catch(() => ({}));
        const role =
          sessionData?.user?.role ||
          sessionData?.session?.role ||
          sessionData?.role;
        if (typeof role === "string" && role.trim()) {
          setCurrentUserRole(role.trim().toUpperCase());
        }

        const termId =
          sessionData?.user?.terminalId ||
          sessionData?.session?.terminalId ||
          sessionData?.terminalId;
        if (typeof termId === "string" && termId.trim()) {
          setActiveTerminalId(termId.trim());
        } else if (loadedPermits[0]?.terminalId) {
          setActiveTerminalId(loadedPermits[0].terminalId);
        } else if (loadedTerminals[0]?.id) {
          setActiveTerminalId(loadedTerminals[0].id);
        }
      } else {
        if (loadedPermits[0]?.terminalId) {
          setActiveTerminalId(loadedPermits[0].terminalId);
        } else if (loadedTerminals[0]?.id) {
          setActiveTerminalId(loadedTerminals[0].id);
        }
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to load Government Permits."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPermitsData();
  }, [loadPermitsData]);

  const recipientByPermitId = useMemo(() => {
    const map = new Map<string, string>();
    for (const rule of routingRules) {
      if (rule.isActive && rule.filterKey) {
        map.set(rule.filterKey, rule.toRecipients);
      }
    }
    return map;
  }, [routingRules]);

  const stats = useMemo(() => {
    const total = permits.length;
    const active = permits.filter((p) => p.status === "ACTIVE").length;
    const expiringSoon = permits.filter(
      (p) => p.status === "EXPIRING_SOON"
    ).length;
    const expired = permits.filter((p) => p.status === "EXPIRED").length;
    return { total, active, expiringSoon, expired };
  }, [permits]);

  const filteredPermits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return permits.filter((p) => {
      if (categoryFilter !== "ALL" && p.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== "ALL" && p.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const recipient = (recipientByPermitId.get(p.id) || "").toLowerCase();
      return (
        p.permitNumber.toLowerCase().includes(q) ||
        p.permitName.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.issuingAgency || "").toLowerCase().includes(q) ||
        recipient.includes(q)
      );
    });
  }, [permits, categoryFilter, statusFilter, searchQuery, recipientByPermitId]);

  const openCreateModal = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setForm({
      ...EMPTY_FORM,
      terminalId:
        activeTerminalId !== "ALL"
          ? activeTerminalId
          : terminals[0]?.id ?? "",
    });
    setIsModalOpen(true);
  };

  const handleCreatePermit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/permits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          reminderLeadDays: Number(form.reminderLeadDays) || 30,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save permit.");
      }

      setIsModalOpen(false);
      setForm(EMPTY_FORM);
      await loadPermitsData();
      setActiveTab("PERMITS");
      setSuccessMsg(
        `Saved permit ${data.permit?.permitNumber ?? ""} with per-permit alert settings.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save permit.");
    } finally {
      setSaving(false);
    }
  };

  const handleRunExpiryCheck = async () => {
    setCheckingExpiry(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/permits/check-expiry", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Expiry check failed.");
      }

      await loadPermitsData();
      const count = data.notifiedCount ?? 0;
      setSuccessMsg(
        `Expiry check completed: ${count} reminder(s) processed.`
      );
      if (count > 0) {
        setActiveTab("EMAIL_LOGS");
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Expiry check failed."
      );
    } finally {
      setCheckingExpiry(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 text-slate-100 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Government Permits &amp; Pre-Expiry Alerts
          </h1>
          <p className="mt-0.5 text-xs text-slate-400 sm:text-sm">
            Permit Lifecycle, Recipient Routing Rules &amp; Automated Expiry Audit Logs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadPermitsData}
            disabled={loading}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50 sm:text-sm"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={handleRunExpiryCheck}
            disabled={checkingExpiry}
            className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3.5 py-2 text-xs font-medium text-amber-200 hover:bg-amber-500/25 disabled:opacity-50 sm:text-sm"
          >
            {checkingExpiry ? "Checking Expiry..." : "Run Expiry Check Now"}
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 sm:text-sm"
          >
            + Add Permit
          </button>
        </div>
      </div>

      {/* Banners */}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-xs text-red-300 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <div className="flex flex-wrap items-center gap-3">
            <span>{successMsg}</span>
            {activeTab !== "EMAIL_LOGS" && (
              <button
                type="button"
                onClick={() => setActiveTab("EMAIL_LOGS")}
                className="rounded border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-100 hover:bg-emerald-500/30"
              >
                View Email Logs →
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-xs text-emerald-300 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Total Permits
          </p>
          <p className="mt-1.5 text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Active
          </p>
          <p className="mt-1.5 text-2xl font-bold text-emerald-400">
            {stats.active}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Expiring Soon
          </p>
          <p className="mt-1.5 text-2xl font-bold text-amber-400">
            {stats.expiringSoon}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Expired
          </p>
          <p className="mt-1.5 text-2xl font-bold text-red-400">
            {stats.expired}
          </p>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("PERMITS")}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition sm:text-sm ${
            activeTab === "PERMITS"
              ? "bg-blue-600 text-white shadow-sm"
              : "border border-slate-800 bg-slate-900/70 text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <span>Government Permits</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              activeTab === "PERMITS"
                ? "bg-blue-500/60 text-white"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            {permits.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ROUTING_RULES")}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition sm:text-sm ${
            activeTab === "ROUTING_RULES"
              ? "bg-blue-600 text-white shadow-sm"
              : "border border-slate-800 bg-slate-900/70 text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <span>Email Routing Rules</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              activeTab === "ROUTING_RULES"
                ? "bg-blue-500/60 text-white"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            {routingRules.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("EMAIL_LOGS")}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition sm:text-sm ${
            activeTab === "EMAIL_LOGS"
              ? "bg-blue-600 text-white shadow-sm"
              : "border border-slate-800 bg-slate-900/70 text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <span>Pre-Expiry Email Logs</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              activeTab === "EMAIL_LOGS"
                ? "bg-blue-500/60 text-white"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            {emailLogs.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Government Permits Table */}
      {activeTab === "PERMITS" && (
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search permit #, name, agency, recipient email..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none sm:w-72"
            />

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 sm:text-sm"
              >
                <option value="ALL">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 sm:text-sm"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="EXPIRING_SOON">EXPIRING_SOON</option>
                <option value="EXPIRED">EXPIRED</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full divide-y divide-slate-800 text-left text-sm">
              <thead className="bg-slate-950/75 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3.5 py-3">Permit</th>
                  <th className="px-3.5 py-3">Category</th>
                  <th className="px-3.5 py-3">Expiry &amp; Lead Days</th>
                  <th className="px-3.5 py-3">Recipient Email(s)</th>
                  <th className="px-3.5 py-3">Status</th>
                  <th className="px-3.5 py-3">Last Reminder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-900/30">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      Loading government permits...
                    </td>
                  </tr>
                ) : filteredPermits.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      No government permits found. Click &ldquo;+ Add
                      Permit&rdquo; to create one.
                    </td>
                  </tr>
                ) : (
                  filteredPermits.map((p) => {
                    const daysLeft = getDaysRemaining(p.expiryDate);
                    const perPermitRecipient = recipientByPermitId.get(p.id);
                    return (
                      <tr key={p.id} className="hover:bg-slate-800/40">
                        <td className="px-3.5 py-3">
                          <div className="font-semibold text-white">
                            {p.permitName}
                          </div>
                          <div className="text-xs text-slate-400">
                            {p.permitNumber}
                            {p.issuingAgency ? ` • ${p.issuingAgency}` : ""}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-3">
                          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-200">
                            {p.category}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-3 text-xs">
                          <div className="text-slate-200">
                            {toDateInputValue(p.expiryDate)} ({daysLeft}d)
                          </div>
                          <div className="text-slate-400">
                            Alert {p.reminderLeadDays}d before expiry
                          </div>
                        </td>
                        <td className="px-3.5 py-3 text-xs text-slate-200">
                          {perPermitRecipient ? (
                            <span>{perPermitRecipient}</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setActiveTab("ROUTING_RULES")}
                              className="text-sky-300 underline decoration-sky-500/40 underline-offset-2 hover:text-sky-200"
                            >
                              Category/Terminal Rule
                            </button>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                              STATUS_BADGES[p.status]
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-3 text-xs text-slate-400">
                          {p.lastReminderSent
                            ? new Date(p.lastReminderSent).toLocaleString()
                            : "Not sent yet"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Email Routing Rules Management */}
      {activeTab === "ROUTING_RULES" && (
        <EmailRoutingRulesPanel
          terminals={terminals}
          selectedTerminalId={activeTerminalId}
          userRole={currentUserRole}
        />
      )}

      {/* TAB 3: Recent Expiry Email Logs */}
      {activeTab === "EMAIL_LOGS" && (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-white">
                Pre-Expiry Email Audit Logs
              </h2>
              <p className="text-xs text-slate-400">
                Delivery history for automated and manual permit expiry checks.
              </p>
            </div>
            <button
              type="button"
              onClick={loadPermitsData}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              Refresh Logs
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full divide-y divide-slate-800 text-left text-xs">
              <thead className="bg-slate-950/75 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3.5 py-2.5">Sent At</th>
                  <th className="px-3.5 py-2.5">Recipients</th>
                  <th className="px-3.5 py-2.5">Subject</th>
                  <th className="px-3.5 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-900/30">
                {emailLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      No pre-expiry email logs yet.
                    </td>
                  </tr>
                ) : (
                  emailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40">
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-slate-400">
                        {new Date(log.sentAt).toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-200">
                        {log.recipients}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-300">
                        <div>{log.subject}</div>
                        {log.errorMessage && (
                          <div className="mt-0.5 text-[11px] text-rose-400">
                            {log.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                            log.status === "SENT"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : log.status === "FAILED"
                                ? "bg-rose-500/15 text-rose-300"
                                : "bg-amber-500/15 text-amber-300"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Permit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-semibold text-white">
                Add Government Permit
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePermit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Terminal
                  </label>
                  <select
                    value={form.terminalId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        terminalId: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  >
                    {terminals.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Category *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        category: e.target.value as GovtPermitCategory,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Permit Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.permitNumber}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        permitNumber: e.target.value,
                      }))
                    }
                    placeholder="e.g. DENR-PTO-2026-01"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Issuing Agency
                  </label>
                  <input
                    type="text"
                    value={form.issuingAgency}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        issuingAgency: e.target.value,
                      }))
                    }
                    placeholder="e.g. DENR EMB-7 / LGU Mandaue"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Permit Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.permitName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        permitName: e.target.value,
                      }))
                    }
                    placeholder="e.g. Permit to Operate Air Pollution Source"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Issue Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.issueDate}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        issueDate: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Expiry Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.expiryDate}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        expiryDate: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Notify Days Before Expiry
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={form.reminderLeadDays}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        reminderLeadDays: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Per-Permit Email Recipient(s)
                  </label>
                  <input
                    type="text"
                    value={form.recipientEmail}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        recipientEmail: e.target.value,
                      }))
                    }
                    placeholder="compliance@example.com"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Remarks
                  </label>
                  <input
                    type="text"
                    value={form.remarks}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, remarks: e.target.value }))
                    }
                    placeholder="Optional notes or renewal reference"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Permit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}