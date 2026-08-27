import { STATUS_LABEL } from "@/lib/constants";

const TONE: Record<string, string> = {
  draft: "bg-stone-100 text-stone-700",
  review: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-900",
  scheduled: "bg-sky-100 text-sky-900",
  published: "bg-navy text-white",
  rejected: "bg-rose-100 text-rose-900",
  needs_edits: "bg-orange-100 text-orange-900",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[status] ?? "bg-stone-100"}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
