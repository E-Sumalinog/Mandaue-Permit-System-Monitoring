"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type UserRole = "ADMIN" | "APPROVER" | "STAFF";

interface TerminalOption {
  id: string;
  code: string;
  name: string;
  location?: string | null;
  isActive?: boolean;
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  terminalId: string | null;
  terminal?: {
    id: string;
    code: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt?: string;
}

interface UserFormState {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  terminalId: string;
  isActive: boolean;
}

const EMPTY_FORM: UserFormState = {
  name: "",
  email: "",
  password: "",
  role: "STAFF",
  terminalId: "",
  isActive: true,
};

const ROLE_STYLES: Record<UserRole, string> = {
  ADMIN: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  APPROVER: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  STAFF: "bg-sky-500/15 text-sky-300 border-sky-500/30",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [terminals, setTerminals] = useState<TerminalOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const [usersRes, terminalsRes] = await Promise.all([
        fetch("/api/users", { cache: "no-store" }),
        fetch("/api/terminals", { cache: "no-store" }),
      ]);

      const usersData = await usersRes.json().catch(() => ({}));
      if (!usersRes.ok) {
        throw new Error(usersData.error || "Failed to load users from Neon.");
      }

      setUsers(Array.isArray(usersData.users) ? usersData.users : []);

      if (terminalsRes.ok) {
        const terminalsData = await terminalsRes.json().catch(() => ({}));
        setTerminals(
          Array.isArray(terminalsData.terminals) ? terminalsData.terminals : []
        );
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to load user management data."
      );
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
      const matchesQuery =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.terminal?.name || "").toLowerCase().includes(q) ||
        (u.terminal?.code || "").toLowerCase().includes(q);
      return matchesRole && matchesQuery;
    });
  }, [users, searchQuery, roleFilter]);

  const openCreateModal = () => {
    setSuccessMsg(null);
    setErrorMsg(null);
    setEditingUser(null);
    setForm({
      ...EMPTY_FORM,
      terminalId: terminals[0]?.id ?? "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user: UserRecord) => {
    setSuccessMsg(null);
    setErrorMsg(null);
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      terminalId: user.terminalId ?? "",
      isActive: user.isActive,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (editingUser) {
        const payload: Record<string, unknown> = {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          role: form.role,
          terminalId: form.terminalId || null,
          isActive: form.isActive,
        };
        if (form.password.trim().length > 0) {
          payload.password = form.password.trim();
        }

        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to update user.");
        }

        if (data.user) {
          setUsers((prev) =>
            prev.map((item) => (item.id === editingUser.id ? data.user : item))
          );
        } else {
          await loadData();
        }
        setSuccessMsg(`Updated account for ${form.name.trim()}.`);
      } else {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            password: form.password,
            role: form.role,
            terminalId: form.terminalId || null,
            isActive: form.isActive,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to create user.");
        }

        if (data.user) {
          setUsers((prev) => [data.user, ...prev]);
        } else {
          await loadData();
        }
        setSuccessMsg(`Created user ${form.name.trim()}.`);
      }

      setIsModalOpen(false);
      setEditingUser(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Operation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: UserRecord) => {
    setBusyUserId(user.id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const nextActive = !user.isActive;
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to update status.");
      }

      if (data.user) {
        setUsers((prev) =>
          prev.map((item) => (item.id === user.id ? data.user : item))
        );
      } else {
        setUsers((prev) =>
          prev.map((item) =>
            item.id === user.id ? { ...item, isActive: nextActive } : item
          )
        );
      }
      setSuccessMsg(
        `${user.name} is now ${nextActive ? "Active" : "Inactive"}.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to toggle user status."
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDeleteUser = async (user: UserRecord) => {
    const confirmed = window.confirm(
      `Delete user "${user.name}" (${user.email})? This action cannot be undone.`
    );
    if (!confirmed) return;

    setBusyUserId(user.id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete user.");
      }

      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      setSuccessMsg(`Deleted user ${user.name}.`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to delete user."
      );
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="space-y-6 p-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            User &amp; Role Management
          </h1>
          <p className="text-sm text-slate-400">
            Active RBAC accounts and terminal assignments synced with Neon
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            + Add User
          </button>
        </div>
      </div>

      {/* Feedback Banners */}
      {errorMsg && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {successMsg}
        </div>
      )}

      {/* Search & Role Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search name, email, or terminal..."
          className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none sm:max-w-sm"
        />

        <div className="flex items-center gap-2">
          <label htmlFor="role-filter" className="text-xs text-slate-400">
            Role:
          </label>
          <select
            id="role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
          >
            <option value="ALL">All Roles</option>
            <option value="ADMIN">ADMIN</option>
            <option value="APPROVER">APPROVER</option>
            <option value="STAFF">STAFF</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
        <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
          <thead className="bg-slate-900/90 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3.5">Name</th>
              <th className="px-4 py-3.5">Email</th>
              <th className="px-4 py-3.5">Role</th>
              <th className="px-4 py-3.5">Assigned Terminal</th>
              <th className="px-4 py-3.5">Account Status</th>
              <th className="px-4 py-3.5">Created</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  Loading users from Neon...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  No users found in Neon.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const isBusy = busyUserId === user.id;
                return (
                  <tr
                    key={user.id}
                    className="transition hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3.5 font-medium text-white">
                      {user.name}
                    </td>
                    <td className="px-4 py-3.5 text-slate-300">
                      {user.email}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          ROLE_STYLES[user.role]
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-300">
                      {user.terminal
                        ? `${user.terminal.name} (${user.terminal.code})`
                        : "All / Unassigned"}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleActive(user)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition disabled:opacity-50 ${
                          user.isActive
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                            : "border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                        title="Click to toggle account status"
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            user.isActive ? "bg-emerald-400" : "bg-slate-500"
                          }`}
                        />
                        {user.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => openEditModal(user)}
                          className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDeleteUser(user)}
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

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {editingUser ? "Edit User Account" : "Create New User"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Juan Dela Cruz"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="user@mandaue.local"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  {editingUser
                    ? "New Password (leave blank to keep current)"
                    : "Password *"}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  minLength={6}
                  value={form.password}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                  placeholder={
                    editingUser ? "••••••••" : "Minimum 6 characters"
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Role
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        role: e.target.value as UserRole,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="STAFF">STAFF</option>
                    <option value="APPROVER">APPROVER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Assigned Terminal
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
                    <option value="">Unassigned / All</option>
                    {terminals.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, isActive: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-600"
                />
                Account is active
              </label>

              <div className="flex items-center justify-end gap-2.5 pt-2">
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
                    : editingUser
                      ? "Save Changes"
                      : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}