"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { patchWorkspace, useAlara } from "@/lib/useAlara";
import type { SchoolFacts } from "@/lib/types";

export default function AdminSchoolProfilePage() {
  const { db, error, reload } = useAlara();
  const [school, setSchool] = useState<SchoolFacts | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (db) setSchool(db.school);
  }, [db]);

  if (error) return <p>{error}</p>;
  if (!school) return <p className="text-sm text-[var(--muted)]">Loading profile…</p>;

  async function save() {
    if (!school) return;
    setBusy(true);
    setMessage(null);
    try {
      await patchWorkspace({ school });
      await reload();
      setMessage("School profile saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="School profile"
        title="Facts parents should recognise"
        description="This is the admin version of School Brain’s profile. It saves to Supabase."
        actions={
          <button className="btn-primary" type="button" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save profile"}
          </button>
        }
      />
      <section className="card grid gap-4 md:grid-cols-2">
        <Field label="School name" value={school.name} onChange={(name) => setSchool({ ...school, name })} />
        <Field label="Website" value={school.website} onChange={(website) => setSchool({ ...school, website })} />
        <Field label="Phone" value={school.phone} onChange={(phone) => setSchool({ ...school, phone })} />
        <Field label="Address" value={school.address} onChange={(address) => setSchool({ ...school, address })} />
        <Field label="Tagline" value={school.tagline} onChange={(tagline) => setSchool({ ...school, tagline })} />
        <Field label="Levels" value={school.levels} onChange={(levels) => setSchool({ ...school, levels })} />
        <Field
          label="Description"
          value={school.mission}
          onChange={(mission) => setSchool({ ...school, mission })}
          className="md:col-span-2"
        />
        <Field
          label="Admissions line"
          value={school.admissionsLine}
          onChange={(admissionsLine) => setSchool({ ...school, admissionsLine })}
          className="md:col-span-2"
        />
        <Field
          label="Campuses (comma)"
          value={school.campuses.join(", ")}
          onChange={(v) =>
            setSchool({
              ...school,
              campuses: v.split(",").map((item) => item.trim()).filter(Boolean),
            })
          }
        />
      </section>
      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium">{label}</span>
      <input className="field" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
