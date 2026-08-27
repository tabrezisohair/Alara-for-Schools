"use client";

import { INTENTS } from "@/lib/constants";
import { IntentVisual } from "@/components/IntentCard";
import { PageHeader } from "@/components/PageHeader";

export default function AdminContentSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Content settings"
        title="What this school can communicate"
        description="These types power Create today. They stay enabled. Saving a custom on/off set would need a new database field, so V1 does not persist changes."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {INTENTS.map((item) => (
          <article key={item.id} className="card flex items-center gap-3">
            <IntentVisual id={item.id} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[var(--navy)]">{item.label}</p>
              <p className="text-sm text-[var(--muted)]">{item.hint}</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Enabled
            </span>
          </article>
        ))}
      </div>
      <p className="text-sm text-[var(--muted)]">
        Create → Compose → Review → Approve is unchanged. Do not turn types off from here in V1.
      </p>
    </div>
  );
}
