import { randomBytes, timingSafeEqual } from "crypto";
import type { ApprovalLink, ContentJob } from "./types";

/** Long enough for the Head to get to it, short enough that stale links die. */
const VALID_DAYS = 14;

export function newApprovalLink(): ApprovalLink {
  const now = new Date();
  return {
    token: randomBytes(24).toString("hex"),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + VALID_DAYS * 86400000).toISOString(),
  };
}

export function approvalPath(job: Pick<ContentJob, "id" | "approvalLink">) {
  if (!job.approvalLink) return null;
  return `/approve/${job.id}?t=${job.approvalLink.token}`;
}

export function approvalUrl(
  job: Pick<ContentJob, "id" | "approvalLink">,
  origin: string
) {
  const path = approvalPath(job);
  return path ? `${origin.replace(/\/+$/, "")}${path}` : null;
}

export type LinkState = "ok" | "unknown" | "expired" | "spent";

export function checkApprovalLink(
  job: ContentJob | undefined,
  token: string | undefined
): LinkState {
  if (!job || !token || !job.approvalLink) return "unknown";
  if (!sameToken(job.approvalLink.token, token)) return "unknown";
  if (job.approvalLink.usedAt) return "spent";
  if (new Date(job.approvalLink.expiresAt).getTime() < Date.now()) {
    return "expired";
  }
  return "ok";
}

function sameToken(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
