"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { deleteRecord, useAlara } from "@/lib/useAlara";
import { eventIdentity } from "@/lib/calendarIdentity";
import { CHANNEL_META, INTENTS, STATUS_LABEL } from "@/lib/constants";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { IconCalendar } from "@/components/icons";
import type { CalendarEvent, ContentJob, Intent, JobStatus } from "@/lib/types";

type ImportDuplicate = {
  name: string;
  date: string;
  campus: string;
  type: string;
};

type PendingDelete =
  | { kind: "event"; id: string; name: string; date: string }
  | { kind: "duplicates"; count: number }
  | { kind: "job"; id: string; title: string };

type DayFilter = "upcoming" | "all" | "posts" | "school";

type DayItem =
  | {
      kind: "post";
      id: string;
      title: string;
      subtitle: string;
      color: string;
      href: string;
      job: ContentJob;
    }
  | {
      kind: "school";
      id: string;
      title: string;
      subtitle: string;
      color: string;
      event: CalendarEvent;
    };

type DayGroup = {
  date: string;
  day: string;
  weekday: string;
  monthLabel: string;
  items: DayItem[];
};

const POST_COLORS: Record<Intent, string> = {
  event: "#6D5AE6",
  announcement: "#E67E22",
  achievement: "#16A34A",
  admissions: "#0EA5E9",
  showcase: "#DB2777",
  photos_to_post: "#7C3AED",
  other: "#475569",
};

const SCHOOL_COLOR = "#102a56";

export default function CalendarPage() {
  const { db, error, reload } = useAlara();
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [filter, setFilter] = useState<DayFilter>("upcoming");
  const [pickedDate, setPickedDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [importNote, setImportNote] = useState<{
    added: number;
    duplicates: ImportDuplicate[];
  } | null>(null);

  const duplicateKeys = useMemo(() => {
    if (!db) return new Set<string>();
    const counts = new Map<string, number>();
    for (const row of db.calendar) {
      const key = eventIdentity(row);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set(
      [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key)
    );
  }, [db]);

  const extraCopies = useMemo(() => {
    if (!db) return 0;
    const counts = new Map<string, number>();
    for (const row of db.calendar) {
      const key = eventIdentity(row);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  }, [db]);

  const days = useMemo(() => {
    if (!db) return [] as DayGroup[];
    return buildDayGroups(db.jobs, db.calendar, {
      filter,
      pickedDate,
      duplicateKeys,
    });
  }, [db, filter, pickedDate, duplicateKeys]);

  if (error) return <p>{error}</p>;
  if (!db) return <p>Loading…</p>;

  async function onImport(file: File, input: HTMLInputElement) {
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("confirm", "true");
      const res = await fetch("/api/calendar/import", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not import");
      setImportNote({
        added: body.added ?? 0,
        duplicates: body.duplicates ?? [],
      });
      await reload();
    } catch (err) {
      setImportNote(null);
      alert(err instanceof Error ? err.message : "Could not import");
    } finally {
      input.value = "";
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!pending) return;
    setDeleting(true);
    try {
      if (pending.kind === "event") {
        await deleteRecord(`/api/calendar/${pending.id}`);
      } else if (pending.kind === "duplicates") {
        await deleteRecord("/api/calendar/duplicates");
      } else {
        await deleteRecord(`/api/jobs/${pending.id}`);
      }
      setPending(null);
      await reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setDeleting(false);
    }
  }

  const monthTitle =
    pickedDate
      ? monthYearFromIso(pickedDate)
      : days[0]?.monthLabel || monthYearFromIso(todayIso());

  return (
    <div className="space-y-5">
      <PageHeader
        kicker="Calendar"
        title="Content calendar"
        description="Up to two posts a day. School dates sit beside them."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative inline-flex">
              <span className="btn-secondary inline-flex cursor-pointer items-center gap-2">
                <IconCalendar className="h-4 w-4" />
                <span className="hidden sm:inline">Date</span>
              </span>
              <input
                type="date"
                className="absolute inset-0 cursor-pointer opacity-0"
                value={pickedDate}
                onChange={(e) => {
                  setPickedDate(e.target.value);
                  if (e.target.value) setFilter("all");
                }}
              />
            </label>
            <label>
              <span className="sr-only">Filter</span>
              <select
                className="field w-auto"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value as DayFilter);
                  if (e.target.value !== "all") setPickedDate("");
                }}
              >
                <option value="upcoming">Upcoming</option>
                <option value="all">All days</option>
                <option value="posts">Posts only</option>
                <option value="school">School dates only</option>
              </select>
            </label>
          </div>
        }
      />

      <div className="flex items-end justify-between gap-3 md:hidden">
        <div>
          <p className="text-2xl font-extrabold text-[var(--navy)]">{monthTitle}</p>
          <p className="text-sm text-[var(--muted)]">Content posting calendar</p>
        </div>
      </div>

      <div className="card flex flex-wrap gap-3">
        <a className="btn-secondary" href="/api/calendar/template">
          Download Excel template
        </a>
        <label className="btn-secondary inline-block cursor-pointer">
          {busy ? "Importing…" : "Import Excel"}
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file, e.target);
            }}
          />
        </label>
        {extraCopies ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPending({ kind: "duplicates", count: extraCopies })}
          >
            Remove extra copies
          </button>
        ) : null}
      </div>

      {pickedDate ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-[var(--navy)] px-3 py-1 font-semibold text-white">
            Showing {formatDayChip(pickedDate)}
          </span>
          <button
            type="button"
            className="font-semibold text-[var(--navy)]"
            onClick={() => setPickedDate("")}
          >
            Clear date
          </button>
        </div>
      ) : null}

      {importNote ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            importNote.duplicates.length
              ? "border-amber-300 bg-amber-50 text-amber-950"
              : "border-emerald-200 bg-emerald-50 text-emerald-950"
          }`}
        >
          <p className="font-semibold">
            {importNote.added
              ? `${importNote.added} new date${importNote.added === 1 ? "" : "s"} added.`
              : "No new dates added."}
          </p>
          {importNote.duplicates.length ? (
            <ul className="mt-2 list-disc pl-5">
              {importNote.duplicates.map((item, index) => (
                <li key={`${item.name}-${item.date}-${index}`}>
                  <span className="font-semibold">{item.name}</span>
                  {item.date ? ` · ${item.date}` : ""}
                  {item.campus ? ` · ${item.campus}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {days.length ? (
        <div className="space-y-6">
          {days.map((group) => (
            <section key={group.date} className="grid grid-cols-[3.5rem_1fr] gap-3 md:grid-cols-[4.5rem_1fr] md:gap-5">
              <div className="relative pt-1 text-center">
                <p className="text-3xl font-extrabold leading-none text-[var(--navy)] md:text-4xl">
                  {group.day}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--navy)]">{group.weekday}</p>
                <span className="absolute bottom-0 left-1/2 top-16 hidden w-px -translate-x-1/2 bg-[var(--navy)]/25 md:block" />
              </div>
              <div className="space-y-2.5">
                {group.items.map((item) => (
                  <article
                    key={`${item.kind}-${item.id}`}
                    className="overflow-hidden rounded-2xl text-white shadow-[var(--shadow)]"
                    style={{ background: item.color }}
                  >
                    <div className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        {item.kind === "post" ? (
                          <Link href={item.href} className="block font-semibold">
                            {item.title}
                          </Link>
                        ) : (
                          <p className="font-semibold">{item.title}</p>
                        )}
                        <p className="mt-1 text-sm text-white/85">{item.subtitle}</p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold"
                        onClick={() =>
                          setPending(
                            item.kind === "post"
                              ? {
                                  kind: "job",
                                  id: item.id,
                                  title: item.title,
                                }
                              : {
                                  kind: "event",
                                  id: item.id,
                                  name: item.title,
                                  date: group.date,
                                }
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="card text-sm text-[var(--muted)]">
          Nothing on this view yet. Create a post with a date, or import school dates from Excel.
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={
          pending?.kind === "duplicates"
            ? "Remove extra copies?"
            : pending?.kind === "job"
              ? "Delete this post?"
              : "Delete this date?"
        }
        busy={deleting}
        onCancel={() => {
          if (!deleting) setPending(null);
        }}
        onConfirm={confirmDelete}
      >
        {pending?.kind === "event" ? (
          <p>
            Remove <span className="font-semibold">{pending.name}</span>
            {pending.date ? ` on ${pending.date}` : ""} from the school calendar?
            Linked posts stay.
          </p>
        ) : null}
        {pending?.kind === "duplicates" ? (
          <p>
            Keep one copy of each date and remove {pending.count} extra
            {pending.count === 1 ? " row" : " rows"}?
          </p>
        ) : null}
        {pending?.kind === "job" ? (
          <p>
            Delete <span className="font-semibold">{pending.title}</span>? This
            removes the post from Alara. It does not unpublish from social
            channels.
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

function buildDayGroups(
  jobs: ContentJob[],
  events: CalendarEvent[],
  opts: {
    filter: DayFilter;
    pickedDate: string;
    duplicateKeys: Set<string>;
  }
): DayGroup[] {
  const today = todayIso();
  const map = new Map<string, DayItem[]>();

  const showPosts = opts.filter !== "school";
  const showSchool = opts.filter !== "posts";

  if (showPosts) {
    const byDate = new Map<string, ContentJob[]>();
    for (const job of jobs) {
      const date = postDate(job);
      if (!date) continue;
      if (opts.pickedDate && date !== opts.pickedDate) continue;
      if (opts.filter === "upcoming" && date < today) continue;
      const list = byDate.get(date) ?? [];
      list.push(job);
      byDate.set(date, list);
    }
    for (const [date, list] of byDate) {
      const sorted = [...list].sort((a, b) =>
        (a.scheduledFor || a.updatedAt).localeCompare(b.scheduledFor || b.updatedAt)
      );
      const capped = sorted.slice(0, 2);
      for (const job of capped) {
        const channel = CHANNEL_META.find((item) => item.id === job.channels[0]);
        const intent = INTENTS.find((item) => item.id === job.intent);
        pushItem(map, date, {
          kind: "post",
          id: job.id,
          title: job.title,
          subtitle: [
            channel?.label ?? "Post",
            STATUS_LABEL[job.status as JobStatus] ?? job.status,
            intent?.label,
          ]
            .filter(Boolean)
            .join(" · "),
          color: POST_COLORS[job.intent] ?? POST_COLORS.other,
          href: `/jobs/${job.id}`,
          job,
        });
      }
    }
  }

  if (showSchool) {
    for (const event of events) {
      if (opts.pickedDate && event.date !== opts.pickedDate) continue;
      if (opts.filter === "upcoming" && event.date < today) continue;
      const duplicated = opts.duplicateKeys.has(eventIdentity(event));
      pushItem(map, event.date, {
        kind: "school",
        id: event.id,
        title: event.name,
        subtitle: [
          event.campus,
          event.type,
          duplicated ? "Duplicated" : null,
        ]
          .filter(Boolean)
          .join(" · "),
        color: SCHOOL_COLOR,
        event,
      });
    }
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => {
      const parts = dayParts(date);
      return {
        date,
        day: parts.day,
        weekday: parts.weekday,
        monthLabel: parts.monthLabel,
        items,
      };
    });
}

function pushItem(map: Map<string, DayItem[]>, date: string, item: DayItem) {
  const list = map.get(date) ?? [];
  list.push(item);
  map.set(date, list);
}

function postDate(job: ContentJob) {
  if (job.scheduledFor) return job.scheduledFor.slice(0, 10);
  if (job.brief.date) return job.brief.date;
  if (job.brief.deadline) return job.brief.deadline;
  if (job.publishedAt) return job.publishedAt.slice(0, 10);
  return job.createdAt.slice(0, 10);
}

function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayParts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return {
    day: String(d),
    weekday: date.toLocaleDateString("en-GB", {
      weekday: "short",
      timeZone: "UTC",
    }),
    monthLabel: date.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
  };
}

function monthYearFromIso(iso: string) {
  return dayParts(iso).monthLabel;
}

function formatDayChip(iso: string) {
  const parts = dayParts(iso);
  return `${parts.weekday} ${parts.day}`;
}
