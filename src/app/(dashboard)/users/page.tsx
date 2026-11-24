"use client";
import { useAuth } from "@/context/AuthContext";

export default function UsersPage() {
  const { user } = useAuth();
  if (user?.role !== "ADMIN") {
    return <div className="text-sm text-red-400">Access Denied: Admin privileges required.</div>;
  }
  const users = [
    { name: "Carlos Mendoza", email: "admin@petron-logistics.local", role: "ADMIN", plant: "All Terminals" },
    { name: "Engr. R. Villanueva", email: "supervisor@petron-logistics.local", role: "APPROVER", plant: "Mandaue Terminal" },
    { name: "J. Santos", email: "staff@petron-logistics.local", role: "STAFF", plant: "Mandaue Terminal" },
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">User & Role Management</h1>
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase">
            <tr>
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Assigned Terminal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {users.map((u) => (
              <tr key={u.email}>
                <td className="py-3 px-4 font-semibold text-white">{u.name}</td>
                <td className="py-3 px-4">{u.email}</td>
                <td className="py-3 px-4 text-blue-400 font-semibold">{u.role}</td>
                <td className="py-3 px-4">{u.plant}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}