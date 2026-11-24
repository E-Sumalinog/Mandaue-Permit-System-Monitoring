"use client";
import { MOCK_DISPATCHES } from "@/data/mockDispatches";
import { QrCode } from "lucide-react";

export default function PermitsPage() {
  const approved = MOCK_DISPATCHES.filter((d) => d.permitStatus === "APPROVED" || d.permitStatus === "EMAILED");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Generated Permits & Gate Passes</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {approved.map((item) => (
          <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex justify-between items-center">
            <div className="space-y-1 text-xs">
              <span className="text-emerald-400 font-semibold">PERMIT #{item.orderNumber}</span>
              <h2 className="text-base font-bold text-white">Truck: {item.truck}</h2>
              <p className="text-slate-400">Destination: {item.destinationName}</p>
              <p className="text-slate-400">Window: {item.receivingWindow} • Route: {item.salesRoute}</p>
            </div>
            <div className="p-3 bg-white rounded-lg text-slate-950">
              <QrCode className="w-14 h-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}