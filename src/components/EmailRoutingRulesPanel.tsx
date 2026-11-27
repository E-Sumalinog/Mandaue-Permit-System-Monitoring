"use client";

import React, { useCallback, useEffect, useState } from "react";

export interface TerminalOption {
  id: string;
  code: string;
  name: string;
}

export interface EmailRoutingRuleItem {
  id: string;
  terminalId: string;
  module: string;
  filterKey: string | null;
  toRecipients: string;
  ccRecipients: string | null;
  isActive: boolean;
  createdAt?: string;
  terminal?: {
    id: string;
    code: string;
    name: string;
  };
}

interface EmailRoutingRulesPanelProps {
  terminals: TerminalOption[];
  selectedTerminalId?: string;
  userRole?: string;
}

const MODULE_OPTIONS = [
  { value: "GOVT_PERMIT_EXPIRY", label: "Government Permit Expiry" },
  { value: "DISPATCH_CLEARANCE", label: "Dispatch Clearance" },
  { value: "TANK_PRESSURE_ALERT", label: "Tank Pressure Alert" },
];

const FILTER_PRESETS = [
  { value: "", label: "All Categories / Permits (Default)" },
  { value: "AIR", label: "AIR" },
  { value: "WATER", label: "WATER" },
  { value: "HAZWASTE", label: "HAZWASTE" },
  { value: "BIR", label: "BIR" },
  { value: "PTO", label: "PTO" },
  { value: "BUSINESS", label: "BUSINESS" },
];

export default function EmailRoutingRulesPanel({
  terminals,
  selectedTerminalId,
  userRole = "STAFF",
}: EmailRoutingRulesPanelProps) {
  const isAdmin = String(userRole).toUpperCase() === "ADMIN";

  const [rules, setRules] = useState<EmailRoutingRuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Create form state
  const [terminalId, setTerminalId] = useState<string>(
    selectedTerminalId && selectedTerminalId !== "ALL"
      ? selectedTerminalId
      : terminals[0]?.id || ""
  );
  const [moduleName, setModuleName] = useState<string>("GOVT_PERMIT_EXPIRY");
  const [filterPreset, setFilterPreset] = useState<string>("");
  const [customFilterKey, setCustomFilterKey] = useState<string>("");
  const [toRecipients, setToRecipients] = useState<string>("");
  const [ccRecipients, setCcRecipients] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFilterKey, setEditFilterKey] = useState<string>("");
  const [editTo, setEditTo] = useState<string>("");
  const [editCc, setEditCc] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTerminalId && selectedTerminalId !== "ALL") {
      setTerminalId(selectedTerminalId);
    } else if (!terminalId && terminals[0]?.id) {
      setTerminalId(terminals[0].id);
    }
  }, [selectedTerminalId, terminals, terminalId]);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedTerminalId && selectedTerminalId !== "ALL") {
        params.set("terminalId", selectedTerminalId);
      }
      const query = params.toString();
      const res = await fetch(`/api/routing-rules${query ? `?${query}` : ""}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load routing rules.");
      }
      setRules(Array.isArray(data.rules) ? data.rules : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load routing rules.");
    } finally {
      setLoading(false);
    }
  }, [selectedTerminalId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const resolveCreateFilterKey = () => {
    if (filterPreset === "CUSTOM") {
      return customFilterKey.trim().toUpperCase() || null;
    }
    return filterPreset.trim().toUpperCase() || null;
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setError(null);
    setFeedback(null);

    if (!terminalId || !toRecipients.trim()) {
      setError("Please select a terminal and enter at least one TO email.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/routing-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terminalId,
          module: moduleName,
          filterKey: resolveCreateFilterKey(),
          toRecipients,
          ccRecipients,
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create routing rule.");
      }

      setRules((prev) => [data.rule, ...prev]);
      setToRecipients("");
      setCcRecipients("");
      setCustomFilterKey("");
      setFeedback("Routing rule saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create routing rule.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = (rule: EmailRoutingRuleItem) => {
    setEditingId(rule.id);
    setEditFilterKey(rule.filterKey || "");
    setEditTo(rule.toRecipients || "");
    setEditCc(rule.ccRecipients || "");
    setFeedback(null);
    setError(null);
  };

  const handleSaveEdit = async (ruleId: string) => {
    if (!isAdmin) return;
    setBusyId(ruleId);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch(`/api/routing-rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filterKey: editFilterKey.trim() ? editFilterKey.trim().toUpperCase() : null,
          toRecipients: editTo,
          ccRecipients: editCc,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update routing rule.");
      }

      setRules((prev) => prev.map((r) => (r.id === ruleId ? data.rule : r)));
      setEditingId(null);
      setFeedback("Routing rule updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update routing rule.");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (rule: EmailRoutingRuleItem) => {
    if (!isAdmin) return;
    setBusyId(rule.id);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch(`/api/routing-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to toggle rule status.");
      }
      setRules((prev) => prev.map((r) => (r.id === rule.id ? data.rule : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle rule status.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!isAdmin) return;
    setBusyId(ruleId);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch(`/api/routing-rules/${ruleId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete routing rule.");
      }
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      setFeedback("Routing rule deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete routing rule.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 text-slate-100">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">Email Routing Rules</h2>
          <p className="text-xs text-slate-400">
            Configure TO and CC alert recipients per terminal, module, and category/permit filter key.
          </p>
        </div>
        <button
          type="button"
          onClick={loadRules}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
        >
          Refresh Rules
        </button>
      </div>

      {!isAdmin && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Viewing in read-only mode. Only <strong>ADMIN</strong> accounts can add, edit, toggle, or delete routing rules.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      {feedback && (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          {feedback}
        </div>
      )}

      {isAdmin && (
        <form
          onSubmit={handleCreateRule}
          className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-6"
        >
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Terminal
            </label>
            <select
              value={terminalId}
              onChange={(e) => setTerminalId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              required
            >
              <option value="">Select terminal...</option>
              {terminals.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code ? `${t.code} — ${t.name}` : t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Module
            </label>
            <select
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            >
              {MODULE_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Filter Key (Category / Permit)
            </label>
            <select
              value={filterPreset}
              onChange={(e) => setFilterPreset(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            >
              {FILTER_PRESETS.map((p) => (
                <option key={p.label} value={p.value}>
                  {p.label}
                </option>
              ))}
              <option value="CUSTOM">Custom Permit / Filter Key...</option>
            </select>
          </div>

          {filterPreset === "CUSTOM" && (
            <div className="md:col-span-6">
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Custom Filter Key
              </label>
              <input
                type="text"
                value={customFilterKey}
                onChange={(e) => setCustomFilterKey(e.target.value)}
                placeholder="e.g. DENR-ECC-01 or CUSTOM_KEY"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              />
            </div>
          )}

          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-300">
              TO Recipients (comma-separated)
            </label>
            <input
              type="text"
              value={toRecipients}
              onChange={(e) => setToRecipients(e.target.value)}
              placeholder="ops@example.com, compliance@example.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              required
            />
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-300">
              CC Recipients (optional, comma-separated)
            </label>
            <input
              type="text"
              value={ccRecipients}
              onChange={(e) => setCcRecipients(e.target.value)}
              placeholder="manager@example.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="flex justify-end md:col-span-6">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {submitting ? "Saving Rule..." : "Add Routing Rule"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading routing rules...</p>
      ) : rules.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          No email routing rules configured yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase text-slate-400">
                <th className="px-3 py-2.5">Terminal</th>
                <th className="px-3 py-2.5">Module / Filter</th>
                <th className="px-3 py-2.5">TO Recipients</th>
                <th className="px-3 py-2.5">CC</th>
                <th className="px-3 py-2.5">Status</th>
                {isAdmin && <th className="px-3 py-2.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {rules.map((rule) => {
                const isEditing = editingId === rule.id;
                const isBusy = busyId === rule.id;

                return (
                  <tr key={rule.id} className="align-top hover:bg-slate-800/30">
                    <td className="px-3 py-3 font-medium text-slate-200">
                      {rule.terminal?.code
                        ? `${rule.terminal.code} — ${rule.terminal.name}`
                        : rule.terminal?.name || rule.terminalId}
                    </td>

                    <td className="px-3 py-3">
                      <div className="text-xs font-medium text-slate-200">{rule.module}</div>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editFilterKey}
                          onChange={(e) => setEditFilterKey(e.target.value)}
                          placeholder="Filter key (e.g. AIR)"
                          className="mt-1 w-36 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                        />
                      ) : (
                        <span className="mt-1 inline-block rounded bg-slate-800 px-2 py-0.5 text-xs text-sky-300">
                          {rule.filterKey || "ALL"}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3 text-xs text-slate-300">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editTo}
                          onChange={(e) => setEditTo(e.target.value)}
                          className="w-full min-w-50 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                        />
                      ) : (
                        <span className="break-all">{rule.toRecipients}</span>
                      )}
                    </td>

                    <td className="px-3 py-3 text-xs text-slate-400">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editCc}
                          onChange={(e) => setEditCc(e.target.value)}
                          placeholder="Optional CC emails"
                          className="w-full min-w-40 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                        />
                      ) : (
                        <span className="break-all">{rule.ccRecipients || "—"}</span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {isAdmin ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleToggleActive(rule)}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            rule.isActive
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : "bg-slate-700/60 text-slate-400 border border-slate-600"
                          }`}
                        >
                          {rule.isActive ? "Active" : "Paused"}
                        </button>
                      ) : (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            rule.isActive
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-slate-700/60 text-slate-400"
                          }`}
                        >
                          {rule.isActive ? "Active" : "Paused"}
                        </span>
                      )}
                    </td>

                    {isAdmin && (
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleSaveEdit(rule.id)}
                                className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => setEditingId(null)}
                                className="rounded bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-600"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => startEditing(rule)}
                                className="rounded bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleDeleteRule(rule.id)}
                                className="rounded bg-rose-600/20 px-2.5 py-1 text-xs font-medium text-rose-300 hover:bg-rose-600/30 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}