import { NextRequest } from "next/server";
import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import { contentHash } from "@/lib/brain";
import { deletePublicFile } from "@/lib/files";
import { dispatchMail } from "@/lib/mail/dispatch";
import { liveEmail } from "@/lib/notify";
import { removeJob } from "@/lib/remove";
import { readDb, updateDb } from "@/lib/store";
import type { ContentJob } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const { id } = await context.params;
  const db = await readDb();
  const job = db.jobs.find((item) => item.id === id);
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(job);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const { id } = await context.params;
  const patch = (await request.json()) as Partial<ContentJob> & {
    action?: "approve" | "reject" | "publish" | "request_edits" | "schedule";
  };
  let refused: string | null = null;
  let found = false;

  const db = await updateDb((current) => {
    const index = current.jobs.findIndex((item) => item.id === id);
    if (index < 0) return current;
    found = true;
    const prev = current.jobs[index];
    const { action, ...rest } = patch;
    const next: ContentJob = {
      ...prev,
      ...rest,
      id: prev.id,
      updatedAt: new Date().toISOString(),
    };

    if (action === "approve") {
      next.approval = {
        by: current.users.approverName,
        at: new Date().toISOString(),
      };
      next.contentHash = contentHash(next);
      next.status =
        next.scheduledFor && new Date(next.scheduledFor).getTime() > Date.now()
          ? "scheduled"
          : "approved";
    }
    if (action === "schedule") {
      if (patch.scheduledFor) next.scheduledFor = patch.scheduledFor;
      if (next.status === "approved" && next.scheduledFor) {
        next.status = "scheduled";
      }
    }
    if (action === "reject") next.status = "rejected";
    if (action === "request_edits") next.status = "needs_edits";
    if (action === "publish") {
      if (next.status !== "approved" && next.status !== "scheduled") {
        refused = "Approve this post before marking it live.";
        return current;
      }
      if (next.contentHash !== contentHash(next)) {
        refused =
          "The post changed after it was approved. Get it approved again before marking it live.";
        return current;
      }
      next.status = "published";
      next.publishedAt = new Date().toISOString();
      next.publishedChannels = next.channels;
      const mail = liveEmail(current, next);
      if (mail) current.notifications.unshift(mail);
    }

    if (
      patch.captions ||
      patch.outputs ||
      patch.assets ||
      patch.channels ||
      patch.brief
    ) {
      if (next.status === "approved" || next.status === "scheduled") {
        next.status = "review";
        next.approval = undefined;
      }
    }

    current.jobs[index] = next;
    return current;
  });

  if (!found) return Response.json({ error: "Post not found" }, { status: 404 });
  if (refused) return Response.json({ error: refused }, { status: 409 });

  const job = db.jobs.find((item) => item.id === id);
  if (patch.action === "publish") {
    const mail = db.notifications.find((item) => item.jobId === id && item.type === "live");
    if (mail) await dispatchMail(mail.id);
  }
  return Response.json(job);
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const { id } = await context.params;
  let files: string[] = [];
  let removed = false;
  await updateDb((current) => {
    const next = removeJob(current, id);
    if (next) {
      removed = true;
      files = next.outputs.map((output) => output.imageUrl);
    }
    return current;
  });
  if (!removed) return Response.json({ error: "Post not found" }, { status: 404 });
  await Promise.all(files.map((url) => deletePublicFile(url)));
  return Response.json({ ok: true });
}
