import { NextRequest } from "next/server";
import {
  assemblePacket,
  contentHash,
  folderNameFor,
  jobTitle,
  newId,
  selectTemplate,
  writeCaptions,
} from "@/lib/brain";
import { appOrigin } from "@/lib/appOrigin";
import { newApprovalLink } from "@/lib/approvalLink";
import { dispatchMail } from "@/lib/mail/dispatch";
import { approvalEmail } from "@/lib/notify";
import { readDb, updateDb } from "@/lib/store";
import type { Brief, CampaignBeat, CaptionSet, Channel, ContentJob, Intent } from "@/lib/types";
import { DEFAULT_CHANNELS } from "@/lib/constants";
import { denyIfSignedOut } from "@/lib/auth/sessionGate";

export async function GET() {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const db = await readDb();
  return Response.json(db.jobs);
}

export async function POST(request: NextRequest) {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const body = (await request.json()) as {
    intent: Intent;
    brief: Brief;
    channels?: Channel[];
    captionLanguage?: "en" | "ur" | "both";
    posterLanguage?: "en" | "ur";
    beat?: CampaignBeat;
    assetIds?: string[];
    provenance?: Record<string, "typed" | "dropdown" | "voice" | "excel" | "inferred">;
    campaignId?: string;
    scheduledFor?: string;
    captions?: Partial<Record<Channel, CaptionSet>>;
    captionsOrigin?: "coded" | "human" | "gemini";
  };

  const db = await updateDb((current) => {
    const channels =
      body.channels?.length ? body.channels : DEFAULT_CHANNELS[body.intent];
    const packet = assemblePacket(current, {
      intent: body.intent,
      brief: body.brief,
      channels,
      captionLanguage: "en",
      posterLanguage: body.posterLanguage ?? current.posterLanguageDefault,
      beat: body.beat,
      assetIds: body.assetIds,
    });
    const coded = writeCaptions(current, packet);
    const captions =
      body.captions && Object.keys(body.captions).length ? body.captions : coded;
    const captionsOrigin = body.captions
      ? body.captionsOrigin ?? "human"
      : "coded";
    const title = jobTitle(body.intent, body.brief);
    const now = new Date().toISOString();

    let folderId = current.folders.find(
      (folder) =>
        folder.kind === "event" &&
        folder.name === folderNameFor(body.brief)
    )?.id;
    if (!folderId && (body.brief.eventType || body.brief.eventName)) {
      const parent =
        current.folders.find(
          (folder) =>
            folder.kind === "event_type" &&
            folder.eventType === body.brief.eventType
        ) ?? null;
      folderId = newId("fld");
      current.folders.push({
        id: folderId,
        parentId: parent?.id,
        name: folderNameFor(body.brief),
        kind: "event",
        campus: body.brief.campus,
        year: new Date().getFullYear().toString(),
        eventType: body.brief.eventType,
      });
    }

    const job: ContentJob = {
      id: newId("job"),
      title,
      intent: body.intent,
      brief: body.brief,
      provenance: body.provenance ?? {},
      assets: body.assetIds ?? [],
      libraryFolderId: folderId,
      campaignId: body.campaignId,
      campaignBeat: body.beat,
      channels,
      captionLanguage: "en",
      posterLanguage: body.posterLanguage ?? current.posterLanguageDefault,
      captions,
      captionsOrigin,
      outputs: [],
      status: "review",
      clashWarning: packet.clashWarning,
      templateId: selectTemplate(body.intent, body.brief, body.beat),
      brainPacketId: packet.id,
      scheduledFor: body.scheduledFor || body.brief.scheduledFor,
      approvalLink: newApprovalLink(),
      createdAt: now,
      updatedAt: now,
    };
    job.contentHash = contentHash(job);

    if (body.campaignId && body.beat) {
      const campaign = current.campaigns.find((item) => item.id === body.campaignId);
      const slot = campaign?.beats.find((item) => item.beat === body.beat);
      if (slot) slot.jobId = job.id;
    }

    current.packets.push(packet);
    current.jobs.unshift(job);
    const mail = approvalEmail(current, job, appOrigin(request));
    if (mail) current.notifications.unshift(mail);
    return current;
  });

  const mail = db.notifications.find(
    (item) => item.jobId === db.jobs[0]?.id && item.type === "approval"
  );
  if (mail) await dispatchMail(mail.id);
  return Response.json(db.jobs[0]);
}
