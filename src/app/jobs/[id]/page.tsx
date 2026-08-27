"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deleteRecord, useAlara } from "@/lib/useAlara";
import { formatsForChannels } from "@/lib/constants";
import { composePoster, pickPosterPhoto } from "@/lib/compose";
import type { CaptionSet, Channel } from "@/lib/types";
import { ChannelPostPreview } from "@/components/ChannelPostPreview";

export default function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { db, error, reload } = useAlara();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draftCaptions, setDraftCaptions] = useState<
    Partial<Record<Channel, CaptionSet>>
  >({});
  const [captionStamp, setCaptionStamp] = useState("");
  const [refetched, setRefetched] = useState(false);
  const refetching = useRef(false);
  const [approvalLink, setApprovalLink] = useState("");
  const [copied, setCopied] = useState(false);

  const job = db?.jobs.find((item) => item.id === id);
  if (job && job.updatedAt !== captionStamp) {
    setCaptionStamp(job.updatedAt);
    setDraftCaptions(job.captions);
  }

  // The workspace loads once, so a post created or opened from a link in
  // another tab is not in this client's list yet. Refetch before giving up.
  useEffect(() => {
    if (!db || job || refetched || refetching.current) return;
    refetching.current = true;
    reload()
      .catch(() => undefined)
      .finally(() => setRefetched(true));
  }, [db, job, refetched, reload]);

  if (error) return <p>{error}</p>;
  if (!db) return <p>Loading…</p>;
  if (!job) {
    return refetched ? (
      <p>That post was not found. It may have been deleted.</p>
    ) : (
      <p>Loading…</p>
    );
  }

  const canChange =
    job.status === "review" ||
    job.status === "needs_edits" ||
    job.status === "draft" ||
    job.status === "approved" ||
    job.status === "scheduled";

  async function act(
    action: "approve" | "reject" | "publish" | "request_edits" | "schedule",
    extra?: { scheduledFor?: string }
  ) {
    setBusy(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Could not ${action.replace("_", " ")}`);
      }
      await reload();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : `Could not ${action.replace("_", " ")}`
      );
    } finally {
      setBusy(false);
    }
  }

  async function redesignLayout() {
    if (!db || !job) return;
    setBusy(true);
    setSaveError(null);
    try {
      const photoIds = job.brief.photoIds?.length ? job.brief.photoIds : job.assets;
      const made = [];
      for (const item of formatsForChannels(job.channels)) {
        const dataUrl = await composePoster({
          format: item.format,
          db,
          intent: job.intent,
          brief: job.brief,
          beat: job.campaignBeat,
          photoUrl: pickPosterPhoto(db, job.intent, photoIds),
        });
        made.push({ ...item, dataUrl });
      }
      const res = await fetch(`/api/jobs/${id}/outputs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outputs: made.map((item) => ({
            format: item.format,
            channel: item.channel,
            dataUrl: item.dataUrl,
          })),
        }),
      });
      if (!res.ok) throw new Error("Could not save the new layout");
      await reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not redesign");
    } finally {
      setBusy(false);
    }
  }

  async function rewriteCaptions() {
    setBusy(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/jobs/${id}/captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "polish" }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Could not rewrite captions");
      await reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not rewrite captions");
    } finally {
      setBusy(false);
    }
  }

  async function makeApprovalLink() {
    setBusy(true);
    setSaveError(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/jobs/${id}/approval-link`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Could not make a link");
      setApprovalLink(payload.url);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not make a link");
    } finally {
      setBusy(false);
    }
  }

  async function saveCaptions() {
    setBusy(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captions: draftCaptions,
          captionsOrigin: "human",
        }),
      });
      if (!res.ok) throw new Error("Could not save captions");
      await reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save captions");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={job.intent.replace(/_/g, " ")}
        title={job.title}
        actions={<StatusBadge status={job.status} />}
      />

      {job.clashWarning ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          {job.clashWarning}
        </p>
      ) : null}

      {job.changeRequest ? (
        <div className="rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm">
          <p className="font-semibold">
            {job.changeRequest.by} asked for changes
          </p>
          <p className="mt-1 whitespace-pre-wrap">{job.changeRequest.note}</p>
        </div>
      ) : null}

      {canChange ? (
        <section className="card space-y-2">
          <h2 className="font-medium">Send for approval</h2>
          <p className="text-sm text-[var(--muted)]">
            One link the approver can open on a phone. No Alara login needed, and
            it stops working once they decide or after two weeks.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={makeApprovalLink}
            >
              {approvalLink ? "New link" : "Get approval link"}
            </button>
            {approvalLink ? (
              <>
                <input className="field flex-1" readOnly value={approvalLink} />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(approvalLink);
                    setCopied(true);
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      <p className="text-sm text-[var(--muted)]">
        Photos stay as photographed. Redesign layout redraws the branded canvas
        around the same original photo — it does not edit faces.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {job.outputs.map((out) => (
          <ChannelPostPreview
            key={out.channel}
            channel={out.channel}
            imageUrl={out.imageUrl}
            caption={job.captions[out.channel]}
            schoolName={db.school.name}
            logoUrl={db.brand.logoUrl}
            facebookName={db.school.socials.facebook}
            instagramHandle={db.school.socials.instagram}
          />
        ))}
      </div>

      {canChange ? (
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={redesignLayout}
        >
          {busy ? "Working…" : "Redesign layout"}
        </button>
      ) : null}

      <section className="card space-y-3">
        <h2 className="font-medium">Captions</h2>
        <p className="text-sm text-[var(--muted)]">
          {job.captionsOrigin === "gemini"
            ? "Written by Alara. You can edit before you approve. Photos were not sent."
            : job.captionsOrigin === "human"
              ? "Edited by staff."
              : "Written from the school brief. Rewrite caption polishes the words only — it does not touch photos."}
        </p>
        {job.channels.map((ch) => (
          <div key={ch} className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{ch}</p>
            {canChange ? (
              <>
                <textarea
                  className="field min-h-28"
                  value={draftCaptions[ch]?.en ?? ""}
                  onChange={(e) =>
                    setDraftCaptions((prev) => ({
                      ...prev,
                      [ch]: { en: e.target.value },
                    }))
                  }
                />
              </>
            ) : (
              <>
                <pre className="whitespace-pre-wrap text-sm">{job.captions[ch]?.en}</pre>
              </>
            )}
          </div>
        ))}
        {canChange ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={saveCaptions}
            >
              Save captions
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={rewriteCaptions}
            >
              {busy ? "Working…" : "Rewrite caption"}
            </button>
          </div>
        ) : null}
      </section>

      {saveError ? <p className="text-sm text-rose-700">{saveError}</p> : null}

      <div className="flex flex-wrap gap-3">
        {job.status === "review" || job.status === "needs_edits" ? (
          <>
            <button className="btn-primary" onClick={() => act("approve")}>
              Approve
            </button>
            <button className="btn-secondary" onClick={() => act("request_edits")}>
              Request edits
            </button>
            <button className="btn-secondary" onClick={() => act("reject")}>
              Reject
            </button>
          </>
        ) : null}
        {job.status === "approved" || job.status === "review" ? (
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span>Schedule</span>
            <input
              className="field w-auto"
              type="datetime-local"
              value={scheduleAt || job.scheduledFor?.slice(0, 16) || ""}
              onChange={(e) => setScheduleAt(e.target.value)}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                act("schedule", {
                  scheduledFor: scheduleAt || job.scheduledFor,
                })
              }
            >
              Save schedule
            </button>
          </label>
        ) : null}
        {job.status === "approved" || job.status === "scheduled" ? (
          <button className="btn-primary" onClick={() => act("publish")}>
            Mark live &amp; email Head
          </button>
        ) : null}
        {job.status === "scheduled" && job.scheduledFor ? (
          <p className="text-sm text-[var(--muted)]">
            Scheduled for {new Date(job.scheduledFor).toLocaleString()}.
          </p>
        ) : null}
        {job.status === "published" ? (
          <p className="text-sm text-[var(--muted)]">
            Live{job.publishedAt ? ` · ${new Date(job.publishedAt).toLocaleString()}` : ""}.
            {db.email.connected
              ? " The Head was emailed the graphic and caption."
              : " The Head email is in Settings → Outbox until a mailbox is connected."}
          </p>
        ) : null}
        <button type="button" className="btn-delete" onClick={() => setConfirmOpen(true)}>
          Delete post
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this post?"
        busy={deleting}
        onCancel={() => {
          if (!deleting) setConfirmOpen(false);
        }}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await deleteRecord(`/api/jobs/${id}`);
            router.push("/");
          } catch (err) {
            setDeleting(false);
            alert(err instanceof Error ? err.message : "Could not delete");
          }
        }}
      >
        <p>
          Delete <span className="font-semibold">{job.title}</span>? This removes
          it from Alara
          {job.status === "published"
            ? ". It does not unpublish from Instagram or Facebook."
            : "."}
        </p>
      </ConfirmDialog>
    </div>
  );
}
