"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MEMBERSHIP_ROLES, PLANNED_ROLES, displayRoles, type MembershipRole } from "@/lib/admin/roles";

type UserRow = {
  id: string;
  name: string;
  email: string;
  roles: MembershipRole[];
  status: string;
  lastLogin: string | null;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [inviteSupported, setInviteSupported] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<MembershipRole[]>(["creator"]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Could not load people");
    setUsers(body.users ?? []);
    setInviteSupported(Boolean(body.inviteSupported));
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  function toggleRole(role: MembershipRole, current: MembershipRole[], setter: (next: MembershipRole[]) => void) {
    setter(current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  }

  async function invite() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, roles }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not invite");
      setEmail("");
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not invite");
    } finally {
      setBusy(false);
    }
  }

  async function saveRoles(userId: string, next: MembershipRole[]) {
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, roles: next }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error || "Could not update role");
      return;
    }
    await load();
  }

  async function removeUser() {
    if (!pending) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: pending.id }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Could not remove");
        return;
      }
      setPending(null);
      await load();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Users"
        title="People at this school"
        description="Roles stay on the existing membership list: School Admin, Content Creator, and Approver."
      />

      <section className="card space-y-4">
        <h2 className="font-semibold text-[var(--navy)]">Invite someone</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="field" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="field" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-3">
          {MEMBERSHIP_ROLES.map((role) => (
            <label key={role.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={roles.includes(role.id)}
                onChange={() => toggleRole(role.id, roles, setRoles)}
              />
              {role.label}
            </label>
          ))}
        </div>
        <button className="btn-primary" type="button" disabled={busy || !inviteSupported} onClick={invite}>
          {busy ? "Inviting…" : "Send invite"}
        </button>
        {!inviteSupported ? (
          <p className="text-sm text-[var(--muted)]">
            Invites are available when the server has a service-role key. Public signup stays off.
          </p>
        ) : null}
      </section>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <section className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow)]">
        <table className="w-full text-left text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last login</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-[var(--line)] align-top">
                <td className="px-4 py-3 font-semibold">{user.name}</td>
                <td>{user.email}</td>
                <td className="py-3">
                  <p>{displayRoles(user.roles).join(", ")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {MEMBERSHIP_ROLES.map((role) => (
                      <label key={role.id} className="text-xs">
                        <input
                          type="checkbox"
                          checked={user.roles.includes(role.id)}
                          onChange={() => {
                            const next = user.roles.includes(role.id)
                              ? user.roles.filter((item) => item !== role.id)
                              : [...user.roles, role.id];
                            if (next.length) saveRoles(user.id, next);
                          }}
                        />{" "}
                        {role.label}
                      </label>
                    ))}
                  </div>
                </td>
                <td>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    Active
                  </span>
                </td>
                <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "—"}</td>
                <td className="px-4 py-3">
                  <button type="button" className="btn-delete" onClick={() => setPending(user)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length ? (
          <p className="px-4 py-8 text-sm text-[var(--muted)]">No people to show yet.</p>
        ) : null}
      </section>

      <p className="text-sm text-[var(--muted)]">
        Planned later, not stored yet: {PLANNED_ROLES.map((role) => role.label).join(" and ")}.
      </p>

      <ConfirmDialog
        open={Boolean(pending)}
        title="Remove this person?"
        confirmLabel="Remove"
        busy={deleting}
        onCancel={() => {
          if (!deleting) setPending(null);
        }}
        onConfirm={removeUser}
      >
        <p>
          Remove{" "}
          <span className="font-semibold">{pending?.name || pending?.email}</span>{" "}
          from this school? They will lose access until invited again.
        </p>
      </ConfirmDialog>
    </div>
  );
}
