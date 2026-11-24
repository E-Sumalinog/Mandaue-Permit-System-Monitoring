"use client";
import { MOCK_DISPATCHES } from "@/data/mockDispatches";

export default function EmailLogsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Automated Email Audit Logs</h1>
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase">
            <tr>
              <th className="py-3 px-4">Order #</th>
              <th className="py-3 px-4">Truck</th>
              <th className="py-3 px-4">Route / Recipient Group</th>
              <th className="py-3 px-4">Delivery Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {MOCK_DISPATCHES.map((d) => (
              <tr key={d.id}>
                <td className="py-3 px-4 font-mono">{d.orderNumber}</td>
                <td className="py-3 px-4 font-semibold text-white">{d.truck}</td>
                <td className="py-3 px-4">{d.salesRoute} Dispatch Group</td>
                <td className="py-3 px-4">
                  {d.lastEmailedAt ? (
                    <span className="text-emerald-400">Sent ({d.lastEmailedAt})</span>
                  ) : (
                    <span className="text-slate-500">Queued / Awaiting Trigger</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}