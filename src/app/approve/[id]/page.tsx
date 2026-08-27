import { checkApprovalLink } from "@/lib/approvalLink";
import { CHANNEL_META } from "@/lib/constants";
import { formatLongDate } from "@/lib/ui";
import { organizationIdForJob, readDb } from "@/lib/store";
import { runWithOrganization } from "@/lib/orgScope";
import { ApproveActions } from "./ApproveActions";
import { ChannelPostPreview } from "@/components/ChannelPostPreview";

export const dynamic = "force-dynamic";

export default async function ApprovePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;
  const orgId = await organizationIdForJob(id);
  if (!orgId) {
    return (
      <Frame school="Alara">
        <h1 className="page-title">This link is not valid</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Ask the school office to send a fresh approval link.
        </p>
      </Frame>
    );
  }
  const db = await runWithOrganization(orgId, () => readDb());
  const job = db.jobs.find((item) => item.id === id);
  const state = checkApprovalLink(job, t);

  if (!job || state === "unknown") {
    return (
      <Frame school={db.school.name}>
        <h1 className="page-title">This link is not valid</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Ask the school office to send a fresh approval link.
        </p>
      </Frame>
    );
  }

  if (state === "expired") {
    return (
      <Frame school={db.school.name}>
        <h1 className="page-title">This link has expired</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          For safety, approval links stop working after two weeks. Ask the office
          for a new one for “{job.title}”.
        </p>
      </Frame>
    );
  }

  if (state === "spent") {
    return (
      <Frame school={db.school.name}>
        <h1 className="page-title">{job.title}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {job.status === "needs_edits"
            ? `Changes were requested on ${when(job.changeRequest?.at)}. The office is working on it.`
            : `Approved on ${when(job.approval?.at)}${
                job.approval?.by ? ` by ${job.approval.by}` : ""
              }. Nothing else is needed from you.`}
        </p>
      </Frame>
    );
  }

  const poster = job.outputs[0];
  const channels = job.channels
    .map(
      (channel) =>
        CHANNEL_META.find((item) => item.id === channel)?.label ?? channel
    )
    .join(", ");

  return (
    <Frame school={db.school.name}>
      <p className="kicker">Needs your approval</p>
      <h1 className="page-title">{job.title}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {[
          job.brief.date ? formatLongDate(job.brief.date) : null,
          job.brief.campus ? `${job.brief.campus} Campus` : null,
          channels,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {job.outputs.length ? (
        <div className="mt-5 grid gap-6">
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
      ) : poster ? (
        <figure className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster.imageUrl} alt={job.title} className="w-full" />
        </figure>
      ) : null}

      <ApproveActions jobId={job.id} token={t ?? ""} />

      <p className="mt-6 text-xs text-[var(--muted)]">
        Nothing is posted anywhere until you approve it. Photos are used exactly
        as photographed.
      </p>
    </Frame>
  );
}

function Frame({
  school,
  children,
}: {
  school: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.22em] text-[var(--navy)]">
        {school.toUpperCase()}
      </p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function when(iso?: string) {
  return iso ? new Date(iso).toLocaleString() : "an earlier date";
}
