"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import { DispatchRecord } from "@/data/mockDispatches";
import { X, Upload, Bot, FileSpreadsheet, CheckCircle2 } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportRecords: (newRecords: DispatchRecord[], sourceLabel: string) => void;
}

export function ImportModal({ isOpen, onClose, onImportRecords }: Props) {
  const [tab, setTab] = useState<"FILE" | "AUTO">("FILE");
  const [previewRows, setPreviewRows] = useState<DispatchRecord[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isRunningBot, setIsRunningBot] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    const mapped: DispatchRecord[] = rawRows.map((row, idx) => {
      const p = String(row["Priority"] ?? row["priority"] ?? "NORMAL").toUpperCase();
      const priority: DispatchRecord["priority"] =
        p === "URGENT" || p === "HIGH" || p === "NORMAL" ? p : "NORMAL";

      return {
        id: `imp-${Date.now()}-${idx}`,
        terminalInfo: String(row["Terminal Info"] ?? row["terminalInfo"] ?? "Mandaue Terminal"),
        sourcePlant: String(row["Source Plant"] ?? row["sourcePlant"] ?? "CEB-01"),
        truck: String(row["Truck"] ?? row["truck"] ?? `TRK-${1000 + idx}`),
        priority,
        orderNumber: String(row["Order #"] ?? row["orderNumber"] ?? `ORD-${90500 + idx}`),
        shipToNumber: String(row["Ship-to Number"] ?? row["shipToNumber"] ?? `SHP-${1100 + idx}`),
        destinationName: String(
          row["Name / Destination"] ?? row["destinationName"] ?? "Petron Station"
        ),
        receivingWindow: String(
          row["Receiving Window"] ?? row["receivingWindow"] ?? "08:00 - 12:00"
        ),
        incident: row["Incident"] || row["incident"] ? String(row["Incident"] ?? row["incident"]) : null,
        salesRoute: String(row["Sales Route"] ?? row["salesRoute"] ?? "CEBU-MAIN-01"),
        permitStatus: "PENDING",
        lastEmailedAt: null,
      };
    });

    setPreviewRows(mapped);
  };

  const handleConfirmFileImport = () => {
    if (previewRows.length === 0) return;
    onImportRecords(previewRows, fileName ?? "Dispatcher Export");
    setPreviewRows([]);
    setFileName(null);
    onClose();
  };

  const handleSimulateAutoExtract = () => {
    setIsRunningBot(true);
    setTimeout(() => {
      const extracted: DispatchRecord[] = [
        {
          id: `bot-${Date.now()}-1`,
          terminalInfo: "Mandaue Terminal",
          sourcePlant: "CEB-01",
          truck: "KAB-3309",
          priority: "URGENT",
          orderNumber: "ORD-90488",
          shipToNumber: "SHP-1092",
          destinationName: "Petron Banilad Road",
          receivingWindow: "11:00 - 14:00",
          incident: null,
          salesRoute: "CEBU-NORTH-02",
          permitStatus: "PENDING",
          lastEmailedAt: null,
        },
        {
          id: `bot-${Date.now()}-2`,
          terminalInfo: "Iloilo Depot",
          sourcePlant: "ILO-01",
          truck: "FBD-6182",
          priority: "HIGH",
          orderNumber: "ORD-90491",
          shipToNumber: "SHP-3015",
          destinationName: "Petron Mandurriao",
          receivingWindow: "14:00 - 17:00",
          incident: null,
          salesRoute: "PANAY-WEST-01",
          permitStatus: "PENDING",
          lastEmailedAt: null,
        },
      ];
      setIsRunningBot(false);
      onImportRecords(extracted, "Scheduled Dispatcher Extraction Bot");
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Extract & Import Dispatch Data</h2>
            <p className="text-xs text-slate-400">
              Load Dispatcher Center exports or run automated extraction
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switch */}
        <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-950/50">
          <button
            type="button"
            onClick={() => setTab("FILE")}
            className={`py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
              tab === "FILE"
                ? "border-blue-500 text-blue-400 bg-slate-900/60"
                : "border-transparent text-slate-400"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Upload CSV / Excel Export
          </button>
          <button
            type="button"
            onClick={() => setTab("AUTO")}
            className={`py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
              tab === "AUTO"
                ? "border-emerald-500 text-emerald-400 bg-slate-900/60"
                : "border-transparent text-slate-400"
            }`}
          >
            <Bot className="w-4 h-4" />
            Auto-Extract (Power Automate Alt)
          </button>
        </div>

        <div className="p-6 space-y-4">
          {tab === "FILE" ? (
            <>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-6 cursor-pointer transition bg-slate-950/40">
                <Upload className="w-7 h-7 text-blue-400 mb-2" />
                <span className="text-xs font-semibold text-white">
                  {fileName ? `Selected: ${fileName}` : "Click to select .CSV, .XLSX, or .XLS file"}
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  Columns supported: Truck, Order #, Ship-to Number, Source Plant, Receiving Window, Sales Route
                </span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {previewRows.length > 0 && (
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs">
                  <p className="text-emerald-400 font-semibold mb-1.5">
                    Parsed {previewRows.length} row(s) ready to import:
                  </p>
                  <ul className="space-y-1 text-slate-300 max-h-32 overflow-y-auto">
                    {previewRows.map((r) => (
                      <li key={r.id} className="flex justify-between">
                        <span className="font-mono text-white">{r.truck}</span>
                        <span>{r.orderNumber}</span>
                        <span className="text-slate-400">{r.destinationName}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={previewRows.length === 0}
                  onClick={handleConfirmFileImport}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white"
                >
                  Import {previewRows.length} Records
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Scheduled Extraction Job</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
                    READY (NO LICENSE FEE)
                  </span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Demonstrates automated trip extraction from the Dispatcher Center without recurring
                  per-bot Power Automate subscriptions. Once connected to your final data source,
                  this runs on your schedule or on-demand.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg font-semibold text-slate-400 hover:text-white"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={isRunningBot}
                  onClick={handleSimulateAutoExtract}
                  className="px-4 py-2 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isRunningBot ? "Extracting Dispatches..." : "Run Sample Extraction Now"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}