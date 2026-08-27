"use client";

import Link from "next/link";
import { useAlara } from "@/lib/useAlara";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { workspace, noOrganization, error } = useAlara();
  if (error) return <p>{error}</p>;
  if (noOrganization) return null;
  if (!workspace) return <p className="text-sm text-[var(--muted)]">Loading admin…</p>;
  if (!workspace.roles.includes("admin")) {
    return (
      <div className="card max-w-lg">
        <p className="kicker">Admin</p>
        <h1 className="page-title">School admin required</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          This area is for the school administrator. Ask an admin if you need access.
        </p>
        <Link href="/" className="btn-primary mt-5 inline-block">
          Back to Home
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
