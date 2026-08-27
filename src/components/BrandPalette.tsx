"use client";

import { MAX_PALETTE, normalizeHex } from "@/lib/brandColors";

const ROLE_LABELS = ["Main", "Highlight", "Light"];

export function BrandPalette({
  colors,
  onChange,
  busy = false,
}: {
  colors: string[];
  onChange: (next: string[]) => void;
  busy?: boolean;
}) {
  function updateAt(index: number, value: string) {
    const hex = normalizeHex(value);
    if (!hex) return;
    onChange(colors.map((color, i) => (i === index ? hex : color)));
  }

  function addColor() {
    if (colors.length >= MAX_PALETTE) return;
    onChange([...colors, colors[0] ?? "#0D2C54"]);
  }

  function removeAt(index: number) {
    if (colors.length <= 2) return;
    onChange(colors.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {colors.map((color, index) => (
          <div key={index} className="space-y-1">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {ROLE_LABELS[index] ?? `Extra ${index - 2}`}
              </span>
              <span className="flex items-center gap-2">
                <input
                  type="color"
                  value={normalizeHex(color) ?? "#0D2C54"}
                  disabled={busy}
                  onChange={(e) => updateAt(index, e.target.value)}
                  className="h-10 w-10 cursor-pointer rounded border border-[var(--line)] bg-white p-0"
                />
                <input
                  className="field w-28"
                  value={color}
                  disabled={busy}
                  onChange={(e) => updateAt(index, e.target.value)}
                />
              </span>
            </label>
            {index > 1 ? (
              <button
                type="button"
                className="btn-delete"
                disabled={busy}
                onClick={() => removeAt(index)}
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {colors.length < MAX_PALETTE ? (
        <button type="button" className="btn-secondary" disabled={busy} onClick={addColor}>
          Add a colour
        </button>
      ) : null}
    </div>
  );
}
