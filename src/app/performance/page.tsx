"use client";

import { useState } from "react";
import Link from "next/link";
import { useAlara } from "@/lib/useAlara";
import { PageHeader } from "@/components/PageHeader";
import { IconChevron } from "@/components/icons";
import type { Channel, ContentJob } from "@/lib/types";

export default function PerformancePage() {
  const { db, error } = useAlara();
  if (error) return <p>{error}</p>;
  if (!db) return <p>Loading…</p>;

  const igConnected = db.users.instagramConnected;
  const fbConnected = db.users.facebookConnected;
  const igPosts = countPublished(db.jobs, ["ig_post", "ig_story"]);
  const fbPosts = countPublished(db.jobs, ["facebook"]);
  const waiting = db.jobs.filter((j) => j.status === "review").length;

  return (
    <div className="space-y-5">
      <PageHeader
        kicker="Performance"
        title="How the posts are doing"
        description="Tap Instagram or Facebook to open Insights. Reach and engagement fill in after those accounts are connected."
      />

      <div className="space-y-3">
        <PlatformCard
          name="Instagram"
          accent="#E1306C"
          connected={igConnected}
          published={igPosts}
          metrics={[
            { label: "Posts published", value: String(igPosts), live: true },
            { label: "Reach", hint: "Unique accounts that saw your content" },
            { label: "Views", hint: "Times posts, Reels, and Stories were shown" },
            { label: "Interactions", hint: "Likes, comments, shares, and saves" },
            { label: "Accounts engaged", hint: "People who took an action" },
            { label: "Profile visits", hint: "Opens of the school profile" },
          ]}
        />
        <PlatformCard
          name="Facebook"
          accent="#1877F2"
          connected={fbConnected}
          published={fbPosts}
          metrics={[
            { label: "Posts published", value: String(fbPosts), live: true },
            { label: "Post reach", hint: "Unique people who saw a post" },
            { label: "Engagement", hint: "Reactions, comments, and shares" },
            { label: "Page views", hint: "Visits to the school Page" },
            { label: "Link clicks", hint: "Taps on links in posts" },
            { label: "Followers", hint: "People who follow the Page" },
          ]}
        />
      </div>

      <p className="text-sm text-[var(--muted)]">
        {waiting
          ? `${waiting} post${waiting === 1 ? "" : "s"} still waiting for approval.`
          : "Nothing waiting for approval."}{" "}
        Connect accounts in{" "}
        <Link href="/settings" className="font-semibold text-[var(--navy)]">
          Settings
        </Link>{" "}
        to load live Insights.
      </p>
    </div>
  );
}

function countPublished(jobs: ContentJob[], channels: Channel[]) {
  return jobs.filter(
    (job) =>
      job.status === "published" &&
      job.channels.some((channel) => channels.includes(channel))
  ).length;
}

function PlatformCard({
  name,
  accent,
  connected,
  published,
  metrics,
}: {
  name: string;
  accent: string;
  connected: boolean;
  published: number;
  metrics: { label: string; value?: string; hint?: string; live?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const panelId = `${name.toLowerCase()}-insights`;

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow)]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-white md:px-5"
        style={{ background: accent }}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold">{name}</p>
          <p className="text-xs text-white/80">
            {connected
              ? "Insights connected"
              : published
                ? `${published} published in Alara · Insights not connected`
                : "Connect to see Insights"}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold">
            {connected ? "Live" : "Alara only"}
          </span>
          <IconChevron
            className={`h-5 w-5 transition-transform ${open ? "rotate-90" : ""}`}
          />
        </span>
      </button>
      {open ? (
        <div id={panelId}>
          <dl className="grid grid-cols-2 gap-px bg-[var(--line)]">
            {metrics.map((metric) => (
              <div key={metric.label} className="bg-white px-4 py-3 md:px-5">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {metric.label}
                </dt>
                <dd className="mt-1 text-2xl font-extrabold text-[var(--navy)]">
                  {metric.live || connected ? metric.value ?? "—" : "—"}
                </dd>
                {metric.hint ? (
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">{metric.hint}</p>
                ) : null}
              </div>
            ))}
          </dl>
          {!connected ? (
            <div className="border-t border-[var(--line)] px-4 py-3 md:px-5">
              <Link href="/settings" className="text-sm font-semibold text-[var(--navy)]">
                Connect {name} in Settings ›
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
