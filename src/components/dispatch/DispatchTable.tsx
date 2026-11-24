"use client";

import React, { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
} from "@tanstack/react-table";
import { DispatchRecord, PermitStatus } from "@/data/mockDispatches";
import { useAuth } from "@/context/AuthContext";
import { CheckCircle2, Mail, Search, AlertTriangle } from "lucide-react";

type FilterTab = "ALL" | "PENDING" | "APPROVED" | "EMAILED" | "INCIDENTS";

interface Props {
  data: DispatchRecord[];
  onApprove: (ids: string[]) => void;
  onSendEmail: (ids: string[]) => void;
}

export function DispatchTable({ data, onApprove, onSendEmail }: Props) {
  const { user } = useAuth();
  const [globalFilter, setGlobalFilter] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const canApprove = user?.role === "ADMIN" || user?.role === "APPROVER";

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (activeTab === "INCIDENTS") return Boolean(item.incident);
      if (activeTab === "ALL") return true;
      return item.permitStatus === activeTab;
    });
  }, [data, activeTab]);

  const statusBadge = (status: PermitStatus) => {
    const styles: Record<PermitStatus, string> = {
      PENDING: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      APPROVED: "bg-blue-500/15 text-blue-400 border-blue-500/30",
      EMAILED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      REJECTED: "bg-red-500/15 text-red-400 border-red-500/30",
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${styles[status]}`}>
        {status}
      </span>
    );
  };

  const priorityBadge = (priority: DispatchRecord["priority"]) => {
    const styles: Record<DispatchRecord["priority"], string> = {
      URGENT: "text-red-400 font-bold",
      HIGH: "text-amber-400 font-semibold",
      NORMAL: "text-slate-300",
    };
    return <span className={`text-xs ${styles[priority]}`}>{priority}</span>;
  };

  const columns = useMemo<ColumnDef<DispatchRecord>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="rounded border-slate-700 bg-slate-900"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="rounded border-slate-700 bg-slate-900"
          />
        ),
      },
      { accessorKey: "terminalInfo", header: "Terminal Info" },
      { accessorKey: "sourcePlant", header: "Source Plant" },
      {
        accessorKey: "truck",
        header: "Truck",
        cell: ({ row }) => (
          <span className="font-mono font-semibold text-white">{row.original.truck}</span>
        ),
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => priorityBadge(row.original.priority),
      },
      { accessorKey: "orderNumber", header: "Order #" },
      { accessorKey: "shipToNumber", header: "Ship-to #" },
      { accessorKey: "destinationName", header: "Name / Destination" },
      { accessorKey: "receivingWindow", header: "Receiving Window" },
      {
        accessorKey: "incident",
        header: "Incident",
        cell: ({ row }) =>
          row.original.incident ? (
            <span className="inline-flex items-center gap-1 text-xs text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" /> {row.original.incident}
            </span>
          ) : (
            <span className="text-slate-600 text-xs">—</span>
          ),
      },
      { accessorKey: "salesRoute", header: "Sales Route" },
      {
        accessorKey: "permitStatus",
        header: "Permit Status",
        cell: ({ row }) => statusBadge(row.original.permitStatus),
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { globalFilter, rowSelection },
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  });

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "ALL", label: "All Trips" },
    { key: "PENDING", label: "Pending" },
    { key: "APPROVED", label: "Approved" },
    { key: "EMAILED", label: "Emailed" },
    { key: "INCIDENTS", label: "Incidents" },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Filter Tabs */}
      <div className="px-4 pt-3 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setActiveTab(t.key);
              setRowSelection({});
            }}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === t.key
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search truck, order #, ship-to, route..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {canApprove && (
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => {
                onApprove(selectedIds);
                setRowSelection({});
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approve Permit ({selectedIds.length})
            </button>
          )}

          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => {
              onSendEmail(selectedIds);
              setRowSelection({});
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition"
          >
            <Mail className="w-3.5 h-3.5" />
            Extract & Send Email ({selectedIds.length})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr
                key={hg.id}
                className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase text-slate-400"
              >
                {hg.headers.map((header) => (
                  <th key={header.id} className="py-3 px-4 font-semibold whitespace-nowrap">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-xs text-slate-300">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-slate-500">
                  No dispatch records match the current filter.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/40 transition">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-3 px-4 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}