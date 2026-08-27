import { NextRequest } from "next/server";
import { checkApprovalLink } from "@/lib/approvalLink";
import { contentHash } from "@/lib/brain";
import { runWithOrganization } from "@/lib/orgScope";
import { organizationIdForJob, readDb, updateDb } from "@/lib/store";

/**
 * Public on purpose: the approver decides from a phone with no Alara login.
 * The signed link is the credential, so it is checked on every call and is
 * spent once a decision is recorded.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    action?: "approve" | "request_edits";
    note?: string;
    by?: string;
  };

  if (body.action !== "approve" && body.action !== "request_edits") {
    return Response.json({ error: "Unknown action." }, { status: 400 });
  }

  const orgId = await organizationIdForJob(id);
  if (!orgId) {
    return Response.json({ error: linkMessage("unknown") }, { status: 403 });
  }

  const db = await runWithOrganization(orgId, () => readDb());
  const job = db.jobs.find((item) => item.id === id);
  const state = checkApprovalLink(job, body.token);
  if (state !== "ok") {
    return Response.json({ error: linkMessage(state) }, { status: 403 });
  }
  if (job!.status === "published") {
    return Response.json(
      { error: "This post is already live." },
      { status: 409 }
    );
  }

  const by = (body.by || "").trim() || db.users.approverName;
  const at = new Date().toISOString();

  await runWithOrganization(orgId, () =>
    updateDb((current) => {
    const found = current.jobs.find((item) => item.id === id);
    if (!found) return current;
    if (body.action === "approve") {
      found.approval = { by, at };
      found.contentHash = contentHash(found);
      found.status =
        found.scheduledFor && new Date(found.scheduledFor).getTime() > Date.now()
          ? "scheduled"
          : "approved";
      found.changeRequest = undefined;
    } else {
      found.status = "needs_edits";
      found.approval = undefined;
      found.changeRequest = {
        note: (body.note || "").trim() || "No detail given.",
        by,
        at,
      };
    }
    if (found.approvalLink) found.approvalLink.usedAt = at;
    found.updatedAt = at;
    return current;
  })
  );

  return Response.json({ ok: true, action: body.action });
}

function linkMessage(state: "unknown" | "expired" | "spent") {
  if (state === "expired") {
    return "This approval link has expired. Ask the school office for a new one.";
  }
  if (state === "spent") {
    return "This link was already used. Ask the school office for a new one.";
  }
  return "This approval link is not valid.";
}
