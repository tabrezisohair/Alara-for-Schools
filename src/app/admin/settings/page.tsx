"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAlara } from "@/lib/useAlara";

export default function AdminSettingsPage() {
  const { workspace, reload } = useAlara();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Karachi");

  useEffect(() => {
    if (workspace) {
      setName(workspace.organization.name);
      setTimezone(workspace.organization.timezone);
    }
  }, [workspace]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timezone }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not save");
      await reload();
      setMessage("Settings saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Settings"
        title="School workspace"
        description="These settings belong to your organisation. There is no platform-admin layer yet."
      />
      <section className="card grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          Organisation name
          <input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-sm">
          Timezone
          <input className="field mt-1" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </label>
      </section>
      <button className="btn-primary" type="button" disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save settings"}
      </button>
      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
