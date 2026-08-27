"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { displayRoles } from "@/lib/admin/roles";

type Detail = {
  organization: { id: string; name: string; created_at: string };
  status: string;
  school: {
    website?: string | null;
    phone?: string | null;
    mission?: string | null;
    address?: string | null;
    tagline?: string | null;
    tone?: { chips?: string[] } | null;
  } | null;
  brand: {
    logoUrl?: string;
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
    detected_note?: string | null;
  } | null;
  users: { id: string; name: string; email: string; roles: string[]; status: string }[];
  usage: { contentCreated: number; pendingApprovals: number; publishedContent: number };
};

export default function AdminSchoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/schools/${id}`, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Could not load school");
        setData(body);
      })
      .catch((err: Error) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <div className="card max-w-lg">
        <h1 className="page-title">Cannot open that school</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{error}</p>
        <Link href="/admin/schools" className="btn-primary mt-4 inline-block">
          Back to schools
        </Link>
      </div>
    );
  }
  if (!data) return <p className="text-sm text-[var(--muted)]">Loading school…</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="School"
        title={data.organization.name}
        description="Only your own school can be opened from this panel."
      />

      <section className="grid gap-3 sm:grid-cols-4">
        <article className="card">
          <p className="text-sm text-[var(--muted)]">Status</p>
          <p className="mt-1 font-semibold text-emerald-700">Active</p>
        </article>
        <article className="card">
          <p className="text-sm text-[var(--muted)]">Created</p>
          <p className="mt-1 font-semibold">
            {new Date(data.organization.created_at).toLocaleDateString()}
          </p>
        </article>
        <article className="card">
          <p className="text-sm text-[var(--muted)]">People</p>
          <p className="mt-1 font-semibold">{data.users.length}</p>
        </article>
        <article className="card">
          <p className="text-sm text-[var(--muted)]">Published posts</p>
          <p className="mt-1 font-semibold">{data.usage.publishedContent}</p>
        </article>
      </section>

      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="section-title">School profile</h2>
          <Link href="/admin/school-profile" className="text-sm font-semibold text-violet-600">
            Edit
          </Link>
        </div>
        <p>{data.school?.tagline || "No tagline yet."}</p>
        <p className="text-sm text-[var(--muted)]">{data.school?.mission || "No description yet."}</p>
        <p className="text-sm text-[var(--muted)]">
          {data.school?.website || "No website"} · {data.school?.phone || "No phone"} ·{" "}
          {data.school?.address || "No address"}
        </p>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Brand</h2>
          <Link href="/admin/brand" className="text-sm font-semibold text-violet-600">
            Edit
          </Link>
        </div>
        {data.brand?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.brand.logoUrl} alt="" className="h-12 w-auto max-w-[200px] object-contain" />
        ) : (
          <p className="text-sm text-[var(--muted)]">No logo uploaded yet.</p>
        )}
        <div className="flex gap-2">
          {["primary_color", "secondary_color", "accent_color"].map((key) => {
            const color = data.brand?.[key as "primary_color"];
            return color ? (
              <span key={key} className="h-8 w-8 rounded-full border border-[var(--line)]" style={{ background: color }} />
            ) : null;
          })}
        </div>
        <p className="text-sm text-[var(--muted)]">
          {(data.school?.tone?.chips ?? []).join(" · ") || "No tone chips yet."}
        </p>
        <p className="text-sm text-[var(--muted)]">{data.brand?.detected_note || ""}</p>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Users</h2>
          <Link href="/admin/users" className="text-sm font-semibold text-violet-600">
            Manage
          </Link>
        </div>
        {data.users.map((user) => (
          <div key={user.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-[var(--muted)]">{user.email}</p>
            </div>
            <p>{displayRoles(user.roles).join(", ") || "Staff"}</p>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Active
            </span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="section-title">Usage</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {data.usage.contentCreated} posts created · {data.usage.pendingApprovals} waiting ·{" "}
          {data.usage.publishedContent} published. These counts come from the current
          workspace file, not from a second school.
        </p>
      </section>
    </div>
  );
}
