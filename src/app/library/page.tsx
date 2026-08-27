"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { deleteRecord, useAlara } from "@/lib/useAlara";
import type { ContentJob, LibraryFolder, PhotoFlag } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { CHANNEL_META } from "@/lib/constants";
import { timeAgo } from "@/lib/ui";

const CREATED_TABS = [
  { id: "all", label: "All" },
  { id: "review", label: "Awaiting approval" },
  { id: "approved", label: "Approved" },
  { id: "published", label: "Published" },
] as const;

type CreatedTab = (typeof CREATED_TABS)[number]["id"];

export default function LibraryPage() {
  const { db, error, reload, setDb } = useAlara();
  const [mounted, setMounted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [campus, setCampus] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<
    | { kind: "photo"; id: string; name: string }
    | { kind: "folder"; folder: LibraryFolder; photoCount: number }
    | { kind: "keep"; id: string; name: string }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);
  const [createdTab, setCreatedTab] = useState<CreatedTab>("all");

  useEffect(() => {
    setMounted(true);
  }, []);

  const created = useMemo(() => {
    const jobs = (db?.jobs ?? []).filter((job) => job.outputs.length > 0);
    return [...jobs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [db?.jobs]);

  if (!mounted) return <p>Loading…</p>;
  if (error) return <p>{error}</p>;
  if (!db) return <p>Loading…</p>;
  const data = db;

  async function upload(folderId: string, file: File) {
    const form = new FormData();
    form.set("file", file);
    form.set("folderId", folderId);
    form.set("flag", "internal");
    await fetch("/api/upload", { method: "POST", body: form });
    await reload();
  }

  async function setFlag(id: string, flag: PhotoFlag) {
    const assets = data.assets.map((a) => (a.id === id ? { ...a, flag } : a));
    const next = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assets }),
    }).then((r) => r.json());
    setDb(next);
  }

  async function setKeepOriginal(id: string, keepOriginal: boolean) {
    const assets = data.assets.map((a) =>
      a.id === id ? { ...a, keepOriginal } : a
    );
    const next = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assets }),
    }).then((r) => r.json());
    setDb(next);
  }

  async function addEvent() {
    if (!name.trim()) {
      setFormError("Give the event a name.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          campus: campus || data.school.campuses[0],
          date,
        }),
      });
      if (!res.ok) throw new Error("Could not add event");
      setName("");
      setDate("");
      setAdding(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not add event");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPending() {
    if (!pending) return;
    setDeleting(true);
    try {
      if (pending.kind === "keep") {
        await setKeepOriginal(pending.id, false);
      } else if (pending.kind === "photo") {
        await deleteRecord(`/api/assets/${pending.id}`);
      } else {
        await deleteRecord(`/api/folders/${pending.folder.id}`);
      }
      setPending(null);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not finish that");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Library"
        title="Events and photos"
        description="Uploads stay original. Alara never retouches faces or crops through them. Marketing is a human choice. Do not use never appears on a post."
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setAdding(true);
              setCampus(data.school.campuses[0] ?? "");
            }}
          >
            Add event
          </button>
        }
      />

      {adding ? (
        <section className="card space-y-4">
          <h2 className="font-medium">New event</h2>
          <label className="block text-sm">
            Event name
            <input
              className="field mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Science Fair"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              Campus
              <select
                className="field mt-1"
                value={campus}
                onChange={(e) => setCampus(e.target.value)}
              >
                {data.school.campuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Date (optional)
              <input
                className="field mt-1"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          {formError ? <p className="text-sm text-rose-700">{formError}</p> : null}
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={addEvent}
            >
              {busy ? "Adding…" : "Create event"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Created posts</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Every graphic Alara has made, with its approval state. Nothing here
              is live until someone approves it and marks it live.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {CREATED_TABS.map((tab) => {
              const count =
                tab.id === "all"
                  ? created.length
                  : created.filter((job) => job.status === tab.id).length;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCreatedTab(tab.id)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    createdTab === tab.id
                      ? "bg-[var(--navy)] text-white"
                      : "bg-[var(--paper)] text-[var(--navy)]"
                  }`}
                >
                  {tab.label} {count ? `(${count})` : ""}
                </button>
              );
            })}
          </div>
        </div>

        {created.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Nothing created yet. Posters you make in Create land here as soon as
            they are sent for approval.
          </p>
        ) : (
          <CreatedGrid
            jobs={
              createdTab === "all"
                ? created
                : created.filter((job) => job.status === createdTab)
            }
            emptyLabel={`No posts are ${
              CREATED_TABS.find((tab) => tab.id === createdTab)?.label.toLowerCase() ??
              "there"
            } right now.`}
          />
        )}
      </section>

      {db.folders.map((folder) => {
        const photos = db.assets.filter((a) => a.folderId === folder.id);
        const folderPosts = created.filter(
          (job) => job.libraryFolderId === folder.id
        );
        const createHref = `/?intent=event&eventName=${encodeURIComponent(
          folder.eventType || folder.name
        )}&campus=${encodeURIComponent(folder.campus || "")}${
          folder.eventType
            ? `&eventType=${encodeURIComponent(folder.eventType)}`
            : ""
        }`;
        return (
          <section key={folder.id} className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-medium">{folder.name}</h2>
              <div className="flex flex-wrap gap-2">
                {folder.kind === "event" ? (
                  <Link className="btn-secondary text-sm" href={createHref}>
                    Create a post
                  </Link>
                ) : null}
                {folder.kind === "event" ? (
                  <button
                    type="button"
                    className="btn-delete"
                    onClick={() =>
                      setPending({
                        kind: "folder",
                        folder,
                        photoCount: photos.length,
                      })
                    }
                  >
                    Delete folder
                  </button>
                ) : null}
                <label className="btn-secondary cursor-pointer text-sm">
                  Add photos
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      [...(e.target.files ?? [])].forEach((file) =>
                        upload(folder.id, file)
                      );
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {photos.map((photo) => (
                <figure key={photo.id} className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt=""
                    className="aspect-square w-full rounded bg-[var(--navy)] object-contain"
                  />
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={photo.keepOriginal !== false}
                      onChange={(e) => {
                        if (e.target.checked) {
                          void setKeepOriginal(photo.id, true);
                          return;
                        }
                        setPending({
                          kind: "keep",
                          id: photo.id,
                          name: photo.name,
                        });
                      }}
                    />
                    Keep original — never retouch
                  </label>
                  <select
                    className="field"
                    value={photo.flag}
                    onChange={(e) =>
                      setFlag(photo.id, e.target.value as PhotoFlag)
                    }
                  >
                    <option value="marketing">Marketing</option>
                    <option value="internal">Internal</option>
                    <option value="do_not_use">Do not use</option>
                  </select>
                  {photo.flag !== "do_not_use" ? (
                    <>
                      <Link
                        className="text-xs font-semibold text-[var(--navy)]"
                        href={`/?intent=photos_to_post&photoId=${photo.id}`}
                      >
                        Post as-is
                      </Link>
                      <Link
                        className="block text-xs font-semibold text-[var(--navy)]"
                        href={`/?intent=event&photoId=${photo.id}`}
                      >
                        Use on event poster
                      </Link>
                    </>
                  ) : (
                    <p className="text-xs text-[var(--muted)]">Will not be posted.</p>
                  )}
                  <button
                    type="button"
                    className="btn-delete"
                    onClick={() =>
                      setPending({
                        kind: "photo",
                        id: photo.id,
                        name: photo.name,
                      })
                    }
                  >
                    Delete photo
                  </button>
                </figure>
              ))}
            </div>
            {folderPosts.length ? (
              <div className="space-y-2 border-t border-[var(--line)] pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Posts created for this event
                </p>
                <CreatedGrid jobs={folderPosts} compact />
              </div>
            ) : null}
          </section>
        );
      })}

      <ConfirmDialog
        open={Boolean(pending)}
        title={
          pending?.kind === "keep"
            ? "Allow this photo on posters?"
            : pending?.kind === "folder"
              ? "Delete this event folder?"
              : "Delete this photo?"
        }
        busy={deleting}
        danger={pending?.kind !== "keep"}
        confirmLabel={pending?.kind === "keep" ? "Continue" : "Delete"}
        onCancel={() => {
          if (!deleting) setPending(null);
        }}
        onConfirm={confirmPending}
      >
        {pending?.kind === "keep" ? (
          <p>
            Alara still will not crop or retouch faces. Unchecking only records
            that{" "}
            <span className="font-semibold">{pending.name || "this photo"}</span>{" "}
            may sit whole on a branded event poster.
          </p>
        ) : null}
        {pending?.kind === "photo" ? (
          <p>
            Remove{" "}
            <span className="font-semibold">{pending.name || "this photo"}</span>{" "}
            from the library? It will not be used on new posters.
          </p>
        ) : null}
        {pending?.kind === "folder" ? (
          <p>
            Delete <span className="font-semibold">{pending.folder.name}</span>
            {pending.photoCount
              ? ` and ${pending.photoCount} photo${pending.photoCount === 1 ? "" : "s"} in it`
              : ""}
            ? Posts already made stay.
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

function CreatedGrid({
  jobs,
  compact,
  emptyLabel,
}: {
  jobs: ContentJob[];
  compact?: boolean;
  emptyLabel?: string;
}) {
  if (!jobs.length) {
    return <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>;
  }
  return (
    <div
      className={`grid gap-3 ${
        compact ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
      }`}
    >
      {jobs.map((job) => {
        const poster = job.outputs[0];
        const channels = job.channels
          .map(
            (channel) =>
              CHANNEL_META.find((item) => item.id === channel)?.label ?? channel
          )
          .join(", ");
        return (
          <figure
            key={job.id}
            className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white"
          >
            <Link href={`/jobs/${job.id}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={poster.imageUrl}
                alt={job.title}
                className="aspect-square w-full object-cover"
              />
            </Link>
            <figcaption className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/jobs/${job.id}`}
                  className="text-sm font-semibold text-[var(--navy)]"
                >
                  {job.title}
                </Link>
                <StatusBadge status={job.status} />
              </div>
              {compact ? null : (
                <p className="text-xs text-[var(--muted)]">
                  {channels} · {timeAgo(job.updatedAt)}
                </p>
              )}
              <div className="flex flex-wrap gap-3 text-xs font-semibold text-[var(--navy)]">
                <Link href={`/jobs/${job.id}`}>Open</Link>
                <a href={poster.imageUrl} download>
                  Download
                </a>
              </div>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
