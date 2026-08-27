"use client";

import { useEffect, useRef, useState } from "react";
import { patchWorkspace, useAlara } from "@/lib/useAlara";
import { rolesFromPalette, workingPalette } from "@/lib/brandColors";
import type { Database } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { BrandPalette } from "@/components/BrandPalette";

export default function BrainPage() {
  const { db, error, reload } = useAlara();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [palette, setPalette] = useState<string[]>([]);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (db) setPalette(workingPalette(db.brand));
  }, [db]);

  if (error) return <p>{error}</p>;
  if (!db) return <p>Loading…</p>;

  async function saveSchool(school: Database["school"]) {
    await patchWorkspace({ school });
    await reload();
  }

  async function saveBrand(patch: Partial<Database["brand"]>) {
    setBusy(true);
    setMessage(null);
    try {
      await patchWorkspace({ brand: patch });
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save colours");
    } finally {
      setBusy(false);
    }
  }

  async function saveTone(tone: Database["tone"]) {
    await patchWorkspace({ tone });
    await reload();
  }

  function savePalette(next: string[]) {
    setPalette(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const roles = rolesFromPalette(next);
      void saveBrand({
        palette: next,
        ...roles,
      });
    }, 400);
  }

  async function uploadLogo(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/admin/brand/logo", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not upload logo");
      await reload();
      setMessage(
        body.extracted
          ? "Logo saved. Alara picked the school colours from it."
          : "Logo saved. Add colours below if the file had no clear palette."
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not upload logo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="School Brain"
        title="Brand, facts, and rules"
        description="Every post is built from this. Staff do not pick hex codes on each graphic."
      />

      <section className="card space-y-4">
        <h2 className="font-medium">Logo and colours</h2>
        {db.brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={db.brand.logoUrl}
            alt="Logo"
            className="h-14 w-auto max-w-[220px] object-contain"
          />
        ) : (
          <p className="text-sm text-[var(--muted)]">No logo yet.</p>
        )}
        <label className="btn-secondary inline-block cursor-pointer">
          {busy ? "Saving…" : "Upload logo"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) uploadLogo(file);
            }}
          />
        </label>
        <p className="text-sm text-[var(--muted)]">{db.brand.detectedNote}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={db.brand.logoAccepted}
            onChange={(e) => saveBrand({ logoAccepted: e.target.checked })}
          />
          Use this as the default design system
        </label>
        <div>
          <p className="mb-2 text-sm text-[var(--ink)]">
            School colours. Alara uses these on every poster. Upload a logo to
            fill them automatically, or add more by hand.
          </p>
          <BrandPalette colors={palette} onChange={savePalette} busy={busy} />
        </div>
        {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
      </section>

      <section className="card grid gap-3 md:grid-cols-2">
        <Field
          label="School name"
          value={db.school.name}
          onChange={(name) => saveSchool({ ...db.school, name })}
        />
        <Field
          label="Tagline"
          value={db.school.tagline}
          onChange={(tagline) => saveSchool({ ...db.school, tagline })}
        />
        <Field
          label="Phone"
          value={db.school.phone}
          onChange={(phone) => saveSchool({ ...db.school, phone })}
        />
        <Field
          label="Website"
          value={db.school.website}
          onChange={(website) => saveSchool({ ...db.school, website })}
        />
        <Field
          label="Admissions line"
          value={db.school.admissionsLine}
          onChange={(admissionsLine) =>
            saveSchool({ ...db.school, admissionsLine })
          }
        />
        <Field
          label="Campuses (comma)"
          value={db.school.campuses.join(", ")}
          onChange={(v) =>
            saveSchool({
              ...db.school,
              campuses: v.split(",").map((s) => s.trim()).filter(Boolean),
            })
          }
        />
      </section>

      <section className="card">
        <h2 className="mb-2 font-medium">Tone</h2>
        <p className="text-sm">{db.tone.chips.join(" · ")}</p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={db.tone.studentNamesDefaultOff}
            onChange={(e) =>
              saveTone({ ...db.tone, studentNamesDefaultOff: e.target.checked })
            }
          />
          Keep student names off graphics and captions unless the brief turns them on
        </label>
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">Captions</h2>
        <p className="text-sm text-[var(--muted)]">
          Alara writes English captions from your brief.
        </p>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block">{label}</span>
      <input className="field" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
