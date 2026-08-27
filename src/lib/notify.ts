import type {
  Channel,
  ContentJob,
  Database,
  EmailNotification,
} from "./types";
import { newId } from "./brain";
import { approvalUrl } from "./approvalLink";

const CHANNEL_LABEL: Record<Channel, string> = {
  download: "Download",
  ig_post: "Instagram",
  ig_story: "Instagram Story",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  gbp: "Google Business",
  website: "Website",
};

export function liveEmail(db: Database, job: ContentJob): EmailNotification | null {
  if (!db.email.enabled || !db.email.notifyLive) return null;
  if (!db.email.headEmail) return null;
  const channels = (job.publishedChannels ?? job.channels)
    .filter((channel) => channel !== "download")
    .map((channel) => CHANNEL_LABEL[channel])
    .join(", ");
  const imageUrl =
    job.outputs.find((output) => output.format === "square")?.imageUrl ??
    job.outputs[0]?.imageUrl;
  const caption =
    job.captions.facebook?.en || job.captions.ig_post?.en || "";
  return {
    id: newId("mail"),
    type: "live",
    to: db.email.headEmail,
    subject: `Live now: ${job.title} — ${db.school.name}`,
    body: [
      db.school.name,
      "",
      `${job.title} is live.`,
      channels
        ? `Posted to: ${channels}`
        : "Saved as a download pack (not posted to social).",
      job.publishedAt
        ? `Went live: ${new Date(job.publishedAt).toLocaleString()}`
        : "",
      job.approval ? `Approved by: ${job.approval.by}` : "",
      "",
      "Caption:",
      caption,
      "",
      "Alara does not post without approval.",
    ]
      .filter(Boolean)
      .join("\n"),
    imageUrl,
    sentAt: new Date().toISOString(),
    status: "queued",
    jobId: job.id,
  };
}

export function approvalEmail(
  db: Database,
  job: ContentJob,
  origin?: string
): EmailNotification | null {
  if (!db.email.enabled || !db.email.notifyApproval) return null;
  const to = db.email.approverEmail || db.email.headEmail;
  if (!to) return null;
  const link = origin ? approvalUrl(job, origin) : null;
  return {
    id: newId("mail"),
    type: "approval",
    to,
    subject: `Needs approval: ${job.title}`,
    body: [
      `${job.title} is waiting for approval.`,
      "",
      link
        ? `Approve or ask for changes here — no login needed:\n${link}`
        : "Open Alara to approve or ask for changes.",
      "",
      "Nothing goes out until you approve it. Reply-to-approve is not allowed.",
    ].join("\n"),
    imageUrl: job.outputs[0]?.imageUrl,
    sentAt: new Date().toISOString(),
    status: "queued",
    jobId: job.id,
  };
}

export function testEmail(db: Database): EmailNotification {
  return {
    id: newId("mail"),
    type: "test",
    to: db.email.headEmail || "head@school.test",
    subject: `Test: Alara live email for ${db.school.name}`,
    body: "If this were a real post, the graphic would be attached and the Head would see that it is live.",
    sentAt: new Date().toISOString(),
    status: "queued",
  };
}
