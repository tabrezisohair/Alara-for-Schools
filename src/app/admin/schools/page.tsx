"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";

type SchoolRow = {
  id: string;
  name: string;
  status: string;
  users: number;
  createdAt: string;
  lastActivity: string | null;
};

export default function AdminSchoolsPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/schools", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Could not load schools");
        setSchools(body.schools ?? []);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const rows = useMemo(() => {
    return schools.filter((school) => {
      const match = school.name.toLowerCase().includes(query.toLowerCase());
      const statusOk = status === "all" || school.status === status;
      return match && statusOk;
    });
  }, [query, schools, status]);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Schools"
        title="Schools you look after"
        description="You can only see the school linked to your membership."
      />
      <div className="flex flex-wrap gap-3">
        <input
          className="field max-w-xs"
          placeholder="Search schools"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="field w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
        </select>
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow)]">
        <table className="w-full text-left text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">School</th>
              <th>Status</th>
              <th>Users</th>
              <th>Created</th>
              <th>Last activity</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((school) => (
              <tr key={school.id} className="border-t border-[var(--line)]">
                <td className="px-4 py-3 font-semibold text-[var(--navy)]">{school.name}</td>
                <td>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    Active
                  </span>
                </td>
                <td>{school.users}</td>
                <td>{new Date(school.createdAt).toLocaleDateString()}</td>
                <td>
                  {school.lastActivity
                    ? new Date(school.lastActivity).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4">
                  <Link className="text-sm font-semibold text-violet-600" href={`/admin/schools/${school.id}`}>
                    View school
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="px-4 py-8 text-sm text-[var(--muted)]">
            No school to show yet. Import Cedar when the admin credential is ready.
          </p>
        ) : null}
      </div>
    </div>
  );
}
