import Link from "next/link";
import type { Intent } from "@/lib/types";
import { INTENT_UI } from "@/lib/intentUi";

export function IntentVisual({
  id,
  className = "h-11 w-11",
}: {
  id: Intent;
  className?: string;
}) {
  const ui = INTENT_UI[id];
  const Icon = ui.Icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl ${ui.tint} ${className}`}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

export function IntentCard({
  id,
  label,
  hint,
  onClick,
  href,
  active,
}: {
  id: Intent;
  label: string;
  hint: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
}) {
  const className = `card-btn flex items-center gap-3 text-left ${
    active ? "ring-2 ring-[var(--navy)]" : ""
  }`;
  const body = (
    <>
      <IntentVisual id={id} />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[var(--navy)]">{label}</span>
        <span className="mt-0.5 block text-sm text-[var(--muted)]">{hint}</span>
      </span>
      <span className="text-lg text-slate-300">›</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}
