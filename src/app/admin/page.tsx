"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";

type Overview = {
  platformAdmin: boolean;
  organization: { id: string; name: string; created_at: string };
  metrics: {
    totalSchools: number;
    activeSchools: number;
    totalUsers: number;
    contentCreated: number;
    pendingApprovals: number;
    publishedContent: number;
  };
  activity: { id: string; label: string }[];
};

const STATS = [
  { key: "totalSchools", label: "Schools", tint: "bg-amber-50 text-amber-700" },
  { key: "activeSchools", label: "Active schools", tint: "bg-emerald-50 text-emerald-700" },
  { key: "totalUsers", label: "People", tint: "bg-sky-50 text-sky-700" },
  { key: "contentCreated", label: "Content created", tint: "bg-violet-50 text-violet-700" },
  { key: "pendingApprovals", label: "Waiting for approval", tint: "bg-orange-50 text-orange-700" },
  { key: "publishedContent", label: "Published", tint: "bg-teal-50 text-teal-700" },
] as const;

export default function AdminDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/overview", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Could not load admin");
        setData(body);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className="text-sm text-rose-700">{error}</p>;
  if (!data) return <p className="text-sm text-[var(--muted)]">Loading dashboard…</p>;

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Admin"
        title={`${data.organization.name} control centre`}
        description="Look after this school’s people, profile, and brand. Content still lives in the Alara workspace."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {STATS.map((stat) => (
          <article key={stat.key} className="card">
            <p className="text-sm text-[var(--muted)]">{stat.label}</p>
            <p className="mt-2 text-3xl font-extrabold text-[var(--navy)]">
              {data.metrics[stat.key]}
            </p>
            <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stat.tint}`}>
              This school
            </span>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card">
          <h2 className="section-title">Recent activity</h2>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Admin events will appear here once an audit log exists. Nothing has been
            recorded yet — and that is expected for V1.
          </p>
        </article>
        <article className="card space-y-3">
          <h2 className="section-title">Quick actions</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="btn-secondary text-left opacity-60" disabled>
              Add School
            </button>
            <Link href="/admin/users" className="btn-secondary text-center">
              Manage Users
            </Link>
            <Link href="/admin/school-profile" className="btn-secondary text-center">
              Edit School Profile
            </Link>
            <Link href="/admin/brand" className="btn-secondary text-center">
              Edit Brand
            </Link>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Add School is a platform-admin action. Phase 1 has no platform-admin role,
            so it stays closed.
          </p>
        </article>
      </section>
    </div>
  );
}
