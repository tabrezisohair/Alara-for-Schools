"use client";

import { PageHeader } from "@/components/PageHeader";

const TYPES = [
  "User login",
  "User invited",
  "User role changed",
  "School profile updated",
  "Brand profile updated",
  "User removed",
  "Settings changed",
];

export default function AdminAuditLogPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Audit log"
        title="What changed, and who changed it"
        description="There is no audit table in Phase 1. This page is ready for events when that layer exists."
      />
      <section className="card">
        <p className="font-semibold text-[var(--navy)]">Nothing recorded yet</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          When an audit log is added later, you will see invites, role changes, and
          profile edits here. No events were invented for this screen.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TYPES.map((item) => (
            <span
              key={item}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
            >
              {item}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
