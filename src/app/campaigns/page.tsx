"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAlara, putState, deleteRecord } from "@/lib/useAlara";
import { ADMISSIONS_BEATS, EVENT_BEATS } from "@/lib/constants";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Campaign, CampaignBeat } from "@/lib/types";

const KINDS = [
  { id: "admissions", label: "Admissions", intent: "admissions" as const, beats: ADMISSIONS_BEATS },
  { id: "event", label: "Event", intent: "event" as const, beats: EVENT_BEATS },
] as const;

type KindId = (typeof KINDS)[number]["id"];

function beatsFor(kind: KindId) {
  return KINDS.find((item) => item.id === kind)?.beats ?? ADMISSIONS_BEATS;
}

function intentFor(kind: string) {
  return kind === "event" ? "event" : "admissions";
}

export default function CampaignsPage() {
  const { db, error, setDb, reload } = useAlara();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [kind, setKind] = useState<KindId>("admissions");
  const [name, setName] = useState("");
  const [startBeat, setStartBeat] = useState<CampaignBeat>(ADMISSIONS_BEATS[0].beat);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);

  const startOptions = useMemo(() => beatsFor(kind), [kind]);

  if (error) return <p>{error}</p>;
  if (!db) return <p>Loading…</p>;

  function onKindChange(next: KindId) {
    setKind(next);
    setStartBeat(beatsFor(next)[0].beat);
  }

  async function startCampaign() {
    if (!db) return;
    const title = name.trim() || (kind === "event" ? "Event campaign" : "Admissions campaign");
    const beats = beatsFor(kind).map((beat) => ({ beat: beat.beat, label: beat.label }));
    const campaign: Campaign = {
      id: `cmp-${crypto.randomUUID().slice(0, 8)}`,
      name: title,
      goal: kind,
      beats,
      createdAt: new Date().toISOString(),
    };
    setBusy(true);
    setMessage(null);
    try {
      const next = await putState({ campaigns: [campaign, ...db.campaigns] });
      setDb(next);
      const intent = intentFor(kind);
      router.push(
        `/?intent=${intent}&campaignId=${campaign.id}&beat=${startBeat}`
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not start the campaign");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Campaigns"
        title="Sequences, not one-off posts"
        description="Admissions and events work as a run of posts, not a single graphic."
        actions={
          db.campaigns.length ? (
            <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
              Start a campaign
            </button>
          ) : null
        }
      />

      {creating || db.campaigns.length === 0 ? (
        <section className="card max-w-xl space-y-5">
          {db.campaigns.length === 0 && !creating ? (
            <>
              <h2 className="text-lg font-bold text-[var(--navy)]">No campaigns yet</h2>
              <p className="text-sm text-[var(--muted)]">
                Start one when you need a sequence — admissions open through apply,
                or announce, remind, and recap an event.
              </p>
              <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
                Start a campaign
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-[var(--navy)]">Start a campaign</h2>
              <label className="block">
                <span className="mb-1 block text-sm">Campaign type</span>
                <select
                  className="field"
                  value={kind}
                  onChange={(e) => onKindChange(e.target.value as KindId)}
                >
                  {KINDS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm">Name</span>
                <input
                  className="field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={kind === "event" ? "e.g. Sports Day 2026" : "e.g. Admissions 2026"}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm">Start with</span>
                <select
                  className="field"
                  value={startBeat}
                  onChange={(e) => setStartBeat(e.target.value as CampaignBeat)}
                >
                  {startOptions.map((beat) => (
                    <option key={beat.beat} value={beat.beat}>
                      {beat.label}
                    </option>
                  ))}
                </select>
              </label>
              {message ? <p className="text-sm text-rose-700">{message}</p> : null}
              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={startCampaign}
                >
                  {busy ? "Starting…" : "Create campaign"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setCreating(false);
                    setMessage(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}

      {db.campaigns.length ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {db.campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onDelete={() => setPending(campaign)}
            />
          ))}
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(pending)}
        title="Delete this campaign?"
        busy={deleting}
        onCancel={() => {
          if (!deleting) setPending(null);
        }}
        onConfirm={async () => {
          if (!pending) return;
          setDeleting(true);
          try {
            await deleteRecord(`/api/campaigns/${pending.id}`);
            setPending(null);
            await reload();
          } catch (err) {
            setMessage(err instanceof Error ? err.message : "Could not delete");
          } finally {
            setDeleting(false);
          }
        }}
      >
        <p>
          Delete <span className="font-semibold">{pending?.name}</span>? Posts
          already made stay in Calendar and Home. This only removes the
          sequence.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function CampaignCard({
  campaign,
  onDelete,
}: {
  campaign: Campaign;
  onDelete: () => void;
}) {
  const done = campaign.beats.filter((beat) => beat.jobId).length;
  const next = campaign.beats.find((beat) => !beat.jobId);
  const intent = intentFor(campaign.goal);
  const createHref = next
    ? `/?intent=${intent}&campaignId=${campaign.id}&beat=${next.beat}`
    : `/?intent=${intent}&campaignId=${campaign.id}`;

  return (
    <article className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {campaign.goal === "event" ? "Event" : "Admissions"}
          </p>
          <h2 className="mt-1 text-lg font-bold text-[var(--navy)]">{campaign.name}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {done} of {campaign.beats.length} posts made
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {next ? (
            <Link className="btn-primary whitespace-nowrap" href={createHref}>
              Next post
            </Link>
          ) : null}
          <button type="button" className="btn-delete" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
      <ol className="space-y-2">
        {campaign.beats.map((beat) => (
          <li key={beat.beat} className="flex items-center justify-between gap-3 text-sm">
            <span className={beat.jobId ? "text-[var(--ink)]" : "text-[var(--muted)]"}>
              {beat.label}
            </span>
            {beat.jobId ? (
              <Link className="font-semibold text-[var(--navy)]" href={`/jobs/${beat.jobId}`}>
                View
              </Link>
            ) : (
              <Link
                className="font-semibold text-[var(--navy)]"
                href={`/?intent=${intent}&campaignId=${campaign.id}&beat=${beat.beat}`}
              >
                Create
              </Link>
            )}
          </li>
        ))}
      </ol>
    </article>
  );
}
