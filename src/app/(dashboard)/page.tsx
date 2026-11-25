"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

type PermitStatus = "PENDING" | "APPROVED" | "EMAILED" | "REJECTED";
type FilterTab = "ALL" | "PENDING" | "APPROVED" | "EMAILED" | "INCIDENTS";

interface UserRef {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface TerminalOption {
  id: string;
  code: string;
  name: string;
}

interface DispatchRecord {
  id: string;
  terminalId: string;
  terminal?: TerminalOption | null;
  sourcePlant: string;
  truck: string;
  priority: string;
  orderNumber: string;
  shipToNumber: string;
  destinationName: string;
  receivingWindow: string;
  incident: string | null;
  salesRoute: string;
  permitStatus: PermitStatus;
  approvedById?: string | null;
  approvedBy?: UserRef | null;
  approvedAt?: string | null;
  lastEmailedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface DispatchFormState {
  terminalId: string;
  sourcePlant: string;
  truck: string;
  priority: string;
  orderNumber: string;
  shipToNumber: string;
  destinationName: string;
  receivingWindow: string;
  incident: string;
  salesRoute: string;
}

const EMPTY_FORM: DispatchFormState = {
  terminalId: "",
  sourcePlant: "Mandaue Depot",
  truck: "",
  priority: "NORMAL",
  orderNumber: "",
  shipToNumber: "",
  destinationName: "",
  receivingWindow: "08:00 - 17:00",
  incident: "",
  salesRoute: "",
};

const STATUS_STYLES: Record<PermitStatus, string> = {
  PENDING: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  APPROVED: "border-blue-500/30 bg-blue-500/15 text-blue-300",
  EMAILED: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  REJECTED: "border-red-500/30 bg-red-500/15 text-red-300",
};

const PRIORITY_BADGES: Record<string, string> = {
  URGENT: "border-red-500/30 bg-red-500/15 text-red-300",
  HIGH: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  NORMAL: "border-slate-700 bg-slate-800/80 text-slate-300",
};

export default function DispatcherCenterPage() {
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [terminals, setTerminals] = useState<TerminalOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<DispatchRecord | null>(null);
  const [form, setForm] = useState<DispatchFormState>(EMPTY_FORM);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const [dispatchRes, terminalRes] = await Promise.all([
        fetch("/api/dispatches", { cache: "no-store" }),
        fetch("/api/terminals", { cache: "no-store" }),
      ]);

      const dispatchData = await dispatchRes.json().catch(() => ({}));
      if (!dispatchRes.ok) {
        throw new Error(
          dispatchData.error || "Failed to load dispatch records from Neon."
        );
      }

      setDispatches(
        Array.isArray(dispatchData.dispatches) ? dispatchData.dispatches : []
      );
      setSelectedIds([]);

      if (terminalRes.ok) {
        const terminalData = await terminalRes.json().catch(() => ({}));
        setTerminals(
          Array.isArray(terminalData.terminals) ? terminalData.terminals : []
        );
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to load Dispatcher Center."
      );
      setDispatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const metrics = useMemo(() => {
    const total = dispatches.length;
    const pending = dispatches.filter((d) => d.permitStatus === "PENDING").length;
    const approved = dispatches.filter((d) => d.permitStatus === "APPROVED").length;
    const emailed = dispatches.filter((d) => d.permitStatus === "EMAILED").length;
    const incidents = dispatches.filter(
      (d) => d.incident && d.incident.trim().length > 0
    ).length;
    return { total, pending, approved, emailed, incidents };
  }, [dispatches]);

  const filteredDispatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dispatches.filter((row) => {
      if (activeTab === "PENDING" && row.permitStatus !== "PENDING") return false;
      if (activeTab === "APPROVED" && row.permitStatus !== "APPROVED") return false;
      if (activeTab === "EMAILED" && row.permitStatus !== "EMAILED") return false;
      if (activeTab === "INCIDENTS" && (!row.incident || !row.incident.trim())) {
        return false;
      }

      if (priorityFilter !== "ALL" && row.priority !== priorityFilter) {
        return false;
      }

      if (!q) return true;
      return (
        row.truck.toLowerCase().includes(q) ||
        row.orderNumber.toLowerCase().includes(q) ||
        row.shipToNumber.toLowerCase().includes(q) ||
        row.destinationName.toLowerCase().includes(q) ||
        row.salesRoute.toLowerCase().includes(q) ||
        row.sourcePlant.toLowerCase().includes(q) ||
        (row.incident || "").toLowerCase().includes(q)
      );
    });
  }, [dispatches, activeTab, priorityFilter, searchQuery]);

  const exportTargetDispatches = useMemo(() => {
    return selectedIds.length > 0
      ? filteredDispatches.filter((r) => selectedIds.includes(r.id))
      : filteredDispatches;
  }, [selectedIds, filteredDispatches]);

  const allVisibleSelected =
    filteredDispatches.length > 0 &&
    filteredDispatches.every((row) => selectedIds.includes(row.id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(filteredDispatches.map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      const merged = new Set([
        ...selectedIds,
        ...filteredDispatches.map((r) => r.id),
      ]);
      setSelectedIds(Array.from(merged));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const openCreateModal = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setEditingRecord(null);
    setForm({
      ...EMPTY_FORM,
      terminalId: terminals[0]?.id ?? "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (record: DispatchRecord) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setEditingRecord(record);
    setForm({
      terminalId: record.terminalId || terminals[0]?.id || "",
      sourcePlant: record.sourcePlant,
      truck: record.truck,
      priority: record.priority,
      orderNumber: record.orderNumber,
      shipToNumber: record.shipToNumber,
      destinationName: record.destinationName,
      receivingWindow: record.receivingWindow,
      incident: record.incident ?? "",
      salesRoute: record.salesRoute,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setEditingRecord(null);
    setForm(EMPTY_FORM);
  };

  const handleSaveDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        terminalId: form.terminalId || undefined,
        sourcePlant: form.sourcePlant.trim(),
        truck: form.truck.trim().toUpperCase(),
        priority: form.priority,
        orderNumber: form.orderNumber.trim().toUpperCase(),
        shipToNumber: form.shipToNumber.trim().toUpperCase(),
        destinationName: form.destinationName.trim(),
        receivingWindow: form.receivingWindow.trim(),
        incident: form.incident.trim() || null,
        salesRoute: form.salesRoute.trim().toUpperCase(),
      };

      if (editingRecord) {
        const res = await fetch(`/api/dispatches/${editingRecord.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to update dispatch record.");
        }

        if (data.dispatch) {
          setDispatches((prev) =>
            prev.map((item) =>
              item.id === editingRecord.id ? data.dispatch : item
            )
          );
        } else {
          await loadData();
        }
        setSuccessMsg(`Updated trip ${payload.truck} (${payload.orderNumber}).`);
      } else {
        const res = await fetch("/api/dispatches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to create dispatch record.");
        }

        if (data.dispatch) {
          setDispatches((prev) => [data.dispatch, ...prev]);
        } else {
          await loadData();
        }
        setSuccessMsg(`Added trip ${payload.truck} (${payload.orderNumber}).`);
      }

      setIsModalOpen(false);
      setEditingRecord(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickApprove = async (record: DispatchRecord) => {
    setBusyRowId(record.id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/dispatches/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permitStatus: "APPROVED" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to approve permit.");
      }

      if (data.dispatch) {
        setDispatches((prev) =>
          prev.map((item) => (item.id === record.id ? data.dispatch : item))
        );
      }
      setSuccessMsg(`Approved permit for ${record.truck} (${record.orderNumber}).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setBusyRowId(null);
    }
  };

  const handleDeleteDispatch = async (record: DispatchRecord) => {
    const confirmed = window.confirm(
      `Delete trip ${record.truck} (${record.orderNumber})?`
    );
    if (!confirmed) return;

    setBusyRowId(record.id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/dispatches/${record.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete dispatch record.");
      }

      setDispatches((prev) => prev.filter((item) => item.id !== record.id));
      setSelectedIds((prev) => prev.filter((id) => id !== record.id));
      setSuccessMsg(`Deleted trip ${record.truck} (${record.orderNumber}).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusyRowId(null);
    }
  };

  const handleBulkStatusUpdate = async (nextStatus: "APPROVED" | "EMAILED") => {
    if (selectedIds.length === 0) return;

    setBulkBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const results = await Promise.all(
        selectedIds.map(async (id) => {
          const res = await fetch(`/api/dispatches/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ permitStatus: nextStatus }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || "Bulk update failed.");
          }
          return data.dispatch as DispatchRecord;
        })
      );

      const updatedMap = new Map(results.map((r) => [r.id, r]));
      setDispatches((prev) =>
        prev.map((item) => updatedMap.get(item.id) ?? item)
      );
      setSelectedIds([]);
      setSuccessMsg(
        nextStatus === "APPROVED"
          ? `Approved ${results.length} trip permit(s).`
          : `Marked ${results.length} trip(s) as emailed.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Bulk action failed.");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (terminals[0]?.id) {
        formData.append("terminalId", terminals[0].id);
      }

      const res = await fetch("/api/dispatches/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to import spreadsheet.");
      }

      await loadData();
      setSuccessMsg(
        `Imported ${data.importedCount ?? 0} trip(s) from ${file.name}${
          data.skippedCount ? ` (${data.skippedCount} skipped)` : ""
        }.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleExportDispatches = (format: "xlsx" | "csv") => {
    if (exportTargetDispatches.length === 0) return;

    const stamp = new Date().toISOString().slice(0, 10);
    const reportRows = exportTargetDispatches.map((r) => ({
      Truck: r.truck,
      Priority: r.priority,
      "Order #": r.orderNumber,
      "Ship-To #": r.shipToNumber,
      Destination: r.destinationName,
      "Sales Route": r.salesRoute,
      "Receiving Window": r.receivingWindow,
      Terminal: r.terminal?.name ?? "Mandaue Terminal",
      "Source Plant": r.sourcePlant,
      Incident: r.incident ?? "",
      "Permit Status": r.permitStatus,
      "Approved By": r.approvedBy?.name ?? "",
      "Created At": r.createdAt ? new Date(r.createdAt).toLocaleString() : "",
    }));

    const ws = XLSX.utils.json_to_sheet(reportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dispatch Report");
    XLSX.writeFile(wb, `dispatcher-report-${stamp}.${format}`, {
      bookType: format,
    });
  };

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "ALL", label: "All Trips", count: metrics.total },
    { key: "PENDING", label: "Pending", count: metrics.pending },
    { key: "APPROVED", label: "Approved", count: metrics.approved },
    { key: "EMAILED", label: "Emailed", count: metrics.emailed },
    { key: "INCIDENTS", label: "Incidents", count: metrics.incidents },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 p-3 sm:p-5 lg:p-6 text-slate-100">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Dispatcher Center &amp; Permit Monitoring
          </h1>
          <p className="mt-0.5 text-xs text-slate-400 sm:text-sm">
            Delivery Trip Extraction, Permit Approval &amp; Automated Email Dispatch
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-50 sm:text-sm"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-slate-700 disabled:opacity-50 sm:text-sm"
          >
            {importing ? "Importing..." : "Import CSV/XLSX"}
          </button>
          <button
            type="button"
            disabled={exportTargetDispatches.length === 0}
            onClick={() => handleExportDispatches("csv")}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
          >
            Export CSV
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-blue-500 sm:px-4 sm:text-sm"
          >
            + Add Trip
          </button>
        </div>
      </div>

      {/* Feedback Banners */}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-200 sm:text-sm">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="ml-4 text-xs text-red-300 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200 sm:text-sm">
          <span>{successMsg}</span>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="ml-4 text-xs text-emerald-300 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Total Trucks
          </p>
          <p className="mt-1.5 text-2xl font-bold text-white sm:text-3xl">
            {metrics.total}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Pending Approval
          </p>
          <p className="mt-1.5 text-2xl font-bold text-amber-400 sm:text-3xl">
            {metrics.pending}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Permits Approved
          </p>
          <p className="mt-1.5 text-2xl font-bold text-blue-400 sm:text-3xl">
            {metrics.approved}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Automated Emails Sent
          </p>
          <p className="mt-1.5 text-2xl font-bold text-emerald-400 sm:text-3xl">
            {metrics.emailed}
          </p>
        </div>
      </div>

      {/* Main Workspace Panel */}
      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 sm:p-5">
        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-blue-600/20 text-blue-300 ring-1 ring-blue-500/40"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      active
                        ? "bg-blue-500/30 text-blue-200"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <span className="text-xs text-slate-400">
            Showing{" "}
            <strong className="text-slate-200">
              {filteredDispatches.length}
            </strong>{" "}
            of {dispatches.length}
          </span>
        </div>

        {/* Search, Priority Filter & Bulk Actions */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search truck, order #, destination, route..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none sm:w-64 md:w-72 sm:text-sm"
            />

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none sm:text-sm"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">URGENT</option>
              <option value="HIGH">HIGH</option>
              <option value="NORMAL">NORMAL</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={selectedIds.length === 0 || bulkBusy}
              onClick={() => handleBulkStatusUpdate("APPROVED")}
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Approve ({selectedIds.length})
            </button>

            <button
              type="button"
              disabled={selectedIds.length === 0 || bulkBusy}
              onClick={() => handleBulkStatusUpdate("EMAILED")}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send Email ({selectedIds.length})
            </button>
          </div>
        </div>

        {/* Responsive Cards for Mobile, Tablet & 1024px–1279px Viewports (< xl) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:hidden">
          {loading ? (
            <div className="col-span-full rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center text-sm text-slate-400">
              Loading dispatch trips from Neon...
            </div>
          ) : filteredDispatches.length === 0 ? (
            <div className="col-span-full rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center text-sm text-slate-400">
              No dispatch records match your filter.
            </div>
          ) : (
            filteredDispatches.map((row) => {
              const isSelected = selectedIds.includes(row.id);
              const isBusy = busyRowId === row.id;
              return (
                <div
                  key={row.id}
                  className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                    isSelected
                      ? "border-blue-500/50 bg-blue-950/20"
                      : "border-slate-800 bg-slate-950/60"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(row.id)}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-600"
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-bold text-white">
                              {row.truck}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                PRIORITY_BADGES[row.priority] ||
                                PRIORITY_BADGES.NORMAL
                              }`}
                            >
                              {row.priority}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">
                            {row.orderNumber} • {row.shipToNumber}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          STATUS_STYLES[row.permitStatus]
                        }`}
                      >
                        {row.permitStatus}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1.5 border-t border-slate-800/80 pt-3 text-xs">
                      <div className="font-medium text-slate-100">
                        {row.destinationName}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                        <span>Route: {row.salesRoute}</span>
                        <span>Window: {row.receivingWindow}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {row.terminal?.name || "Mandaue Terminal"} • Plant:{" "}
                        {row.sourcePlant}
                      </div>
                      {row.incident && (
                        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">
                          ⚠ {row.incident}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-slate-800/80 pt-3">
                    {row.permitStatus === "PENDING" && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleQuickApprove(row)}
                        className="rounded-md bg-blue-600/20 px-2.5 py-1 text-xs font-medium text-blue-300 hover:bg-blue-600/30 disabled:opacity-50"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => openEditModal(row)}
                      className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDeleteDispatch(row)}
                      className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Clean Table for Desktop (>= xl / 1280px+) */}
        <div className="hidden overflow-x-auto rounded-lg border border-slate-800 xl:block">
          <table className="w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="bg-slate-950/75 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="w-10 px-3.5 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-600"
                  />
                </th>
                <th className="px-3.5 py-3">Truck &amp; Order</th>
                <th className="px-3.5 py-3">Destination &amp; Route</th>
                <th className="px-3.5 py-3">Terminal / Plant</th>
                <th className="px-3.5 py-3">Incident</th>
                <th className="px-3.5 py-3">Status</th>
                <th className="px-3.5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/30">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-slate-400"
                  >
                    Loading dispatch trips from Neon...
                  </td>
                </tr>
              ) : filteredDispatches.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-slate-400"
                  >
                    No dispatch records found. Add a trip or import a CSV/XLSX
                    file.
                  </td>
                </tr>
              ) : (
                filteredDispatches.map((row) => {
                  const isSelected = selectedIds.includes(row.id);
                  const isBusy = busyRowId === row.id;
                  return (
                    <tr
                      key={row.id}
                      className={`transition ${
                        isSelected ? "bg-blue-950/25" : "hover:bg-slate-800/40"
                      }`}
                    >
                      <td className="px-3.5 py-3.5 align-top">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(row.id)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-600"
                        />
                      </td>

                      <td className="whitespace-nowrap px-3.5 py-3.5 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            {row.truck}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              PRIORITY_BADGES[row.priority] ||
                              PRIORITY_BADGES.NORMAL
                            }`}
                          >
                            {row.priority}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-300">
                          {row.orderNumber}{" "}
                          <span className="text-slate-500">•</span>{" "}
                          <span className="text-slate-400">
                            {row.shipToNumber}
                          </span>
                        </div>
                      </td>

                      <td className="px-3.5 py-3.5 align-top">
                        <div className="font-medium text-slate-100">
                          {row.destinationName}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">
                            {row.salesRoute}
                          </span>
                          <span>{row.receivingWindow}</span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-3.5 py-3.5 align-top">
                        <div className="text-slate-200">
                          {row.terminal?.name || "Mandaue Terminal"}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400">
                          {row.sourcePlant}
                        </div>
                      </td>

                      <td className="max-w-[200px] px-3.5 py-3.5 align-top text-xs">
                        {row.incident ? (
                          <span className="inline-flex items-start gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-red-300">
                            <span>⚠</span>
                            <span>{row.incident}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3.5 py-3.5 align-top">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                            STATUS_STYLES[row.permitStatus]
                          }`}
                        >
                          {row.permitStatus}
                        </span>
                        <div className="mt-1 text-[11px] text-slate-400">
                          {row.approvedBy?.name
                            ? `By ${row.approvedBy.name}`
                            : new Date(row.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-3.5 py-3.5 text-right align-top">
                        <div className="inline-flex items-center gap-1.5">
                          {row.permitStatus === "PENDING" && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleQuickApprove(row)}
                              className="rounded-md border border-blue-500/30 bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-300 transition hover:bg-blue-500/25 disabled:opacity-50"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => openEditModal(row)}
                            className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDeleteDispatch(row)}
                            className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Trip Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {editingRecord ? "Edit Dispatch Trip" : "Add New Dispatch Trip"}
                </h2>
                <p className="text-xs text-slate-400">
                  Changes sync immediately with Neon PostgreSQL
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="rounded-md px-2.5 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDispatch} className="space-y-4">
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
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
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
                    Source Plant *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.sourcePlant}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        sourcePlant: e.target.value,
                      }))
                    }
                    placeholder="e.g. Mandaue Depot / ILO-01"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Truck / Plate # *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.truck}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, truck: e.target.value }))
                    }
                    placeholder="e.g. FBD-6182"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, priority: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Order # *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.orderNumber}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        orderNumber: e.target.value,
                      }))
                    }
                    placeholder="e.g. ORD-90491"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Ship-To # *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.shipToNumber}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        shipToNumber: e.target.value,
                      }))
                    }
                    placeholder="e.g. SHP-3015"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Name / Destination *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.destinationName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        destinationName: e.target.value,
                      }))
                    }
                    placeholder="e.g. Petron Banilad Road"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Receiving Window *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.receivingWindow}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        receivingWindow: e.target.value,
                      }))
                    }
                    placeholder="e.g. 14:00 - 17:00"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Sales Route *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.salesRoute}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        salesRoute: e.target.value,
                      }))
                    }
                    placeholder="e.g. CEBU-NORTH-02"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Incident / Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.incident}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        incident: e.target.value,
                      }))
                    }
                    placeholder="e.g. Gate pass verification pending"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {submitting
                    ? "Saving..."
                    : editingRecord
                      ? "Save Changes"
                      : "Create Trip"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}