import { NextRequest } from "next/server";
import { appOrigin } from "@/lib/appOrigin";
import { approvalUrl, newApprovalLink } from "@/lib/approvalLink";
import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import { updateDb } from "@/lib/store";

/** Mints a fresh link so staff can send it by WhatsApp when email is not connected. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const { id } = await context.params;

  let url: string | null = null;
  await updateDb((current) => {
    const job = current.jobs.find((item) => item.id === id);
    if (!job) return current;
    job.approvalLink = newApprovalLink();
    job.updatedAt = new Date().toISOString();
    url = approvalUrl(job, appOrigin(request));
    return current;
  });

  if (!url) return Response.json({ error: "Post not found" }, { status: 404 });
  return Response.json({ url });
}
