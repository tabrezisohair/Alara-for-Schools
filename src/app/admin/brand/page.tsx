"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { BrandPalette } from "@/components/BrandPalette";
import { rolesFromPalette, workingPalette } from "@/lib/brandColors";
import { patchWorkspace, useAlara } from "@/lib/useAlara";
import type { BrandProfile, ToneRules } from "@/lib/types";

export default function AdminBrandPage() {
  const { db, error, reload } = useAlara();
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [tone, setTone] = useState<ToneRules | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (db) {
      setBrand(db.brand);
      setTone(db.tone);
    }
  }, [db]);

  if (error) return <p>{error}</p>;
  if (!brand || !tone) return <p className="text-sm text-[var(--muted)]">Loading brand…</p>;

  async function save() {
    if (!brand || !tone) return;
    setBusy(true);
    setMessage(null);
    try {
      await patchWorkspace({ brand, tone });
      await reload();
      setMessage("Brand saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo(file: File) {
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/admin/brand/logo", { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Could not upload logo");
    await reload();
    setMessage(
      body.extracted
        ? "Logo saved. Colours were taken from the file."
        : "Logo saved."
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Brand"
        title="Navy, gold, and the school voice"
        description="Brand stays on this school. Staff do not pick colours on each post."
        actions={
          <button className="btn-primary" type="button" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save brand"}
          </button>
        }
      />

      <section className="card space-y-3">
        <h2 className="font-semibold">Logo</h2>
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt="" className="h-16 w-auto max-w-[240px] object-contain" />
        ) : (
          <p className="text-sm text-[var(--muted)]">No logo yet.</p>
        )}
        <label className="btn-secondary inline-block cursor-pointer">
          Upload logo
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadLogo(file).catch((err: Error) => setMessage(err.message));
            }}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={brand.logoAccepted}
            onChange={(e) => setBrand({ ...brand, logoAccepted: e.target.checked })}
          />
          Use this as the default design system
        </label>
        <div>
          <p className="mb-2 text-sm">School colours</p>
          <BrandPalette
            colors={workingPalette(brand)}
            onChange={(palette) => setBrand({ ...brand, palette, ...rolesFromPalette(palette) })}
          />
        </div>
      </section>

      <section className="card grid gap-4 md:grid-cols-2">
        <ColorField
          label="Text on primary"
          value={brand.textOnPrimary}
          onChange={(textOnPrimary) => setBrand({ ...brand, textOnPrimary })}
        />
        <label className="block text-sm">
          Heading font
          <input
            className="field mt-1"
            value={brand.fonts.heading}
            onChange={(e) => setBrand({ ...brand, fonts: { ...brand.fonts, heading: e.target.value } })}
          />
        </label>
        <label className="block text-sm">
          Body font
          <input
            className="field mt-1"
            value={brand.fonts.body}
            onChange={(e) => setBrand({ ...brand, fonts: { ...brand.fonts, body: e.target.value } })}
          />
        </label>
        <label className="block text-sm md:col-span-2">
          Brand guidance
          <textarea
            className="field mt-1 min-h-24"
            value={brand.detectedNote ?? ""}
            onChange={(e) => setBrand({ ...brand, detectedNote: e.target.value })}
          />
        </label>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Tone of voice</h2>
        <label className="block text-sm">
          Tone chips (comma)
          <input
            className="field mt-1"
            value={tone.chips.join(", ")}
            onChange={(e) =>
              setTone({
                ...tone,
                chips: e.target.value.split(",").map((item) => item.trim()).filter(Boolean),
              })
            }
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={tone.studentNamesDefaultOff}
            onChange={(e) => setTone({ ...tone, studentNamesDefaultOff: e.target.checked })}
          />
          Keep student names off graphics and captions unless the brief turns them on
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={tone.noSlang}
            onChange={(e) => setTone({ ...tone, noSlang: e.target.checked })}
          />
          No slang
        </label>
      </section>
      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <div className="mt-1 flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <input className="field" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </label>
  );
}
