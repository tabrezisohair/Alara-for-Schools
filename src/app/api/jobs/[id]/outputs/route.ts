import { NextRequest } from "next/server";
import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import { saveDataUrl } from "@/lib/files";
import { updateDb } from "@/lib/store";
import { contentHash } from "@/lib/brain";
import type { Channel } from "@/lib/types";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const { id } = await context.params;
  const body = (await request.json()) as {
    outputs: { format: "square" | "story" | "wide"; channel: Channel; dataUrl: string }[];
  };

  if (!body.outputs?.length) {
    return Response.json({ error: "No graphics to save." }, { status: 400 });
  }

  let missing = false;
  let failed: string | null = null;

  const db = await updateDb(async (current) => {
    const job = current.jobs.find((item) => item.id === id);
    if (!job) {
      missing = true;
      return current;
    }
    const outputs = [];
    for (const output of body.outputs) {
      try {
        const imageUrl = await saveDataUrl(output.dataUrl, "posts");
        outputs.push({
          format: output.format,
          channel: output.channel,
          imageUrl,
        });
      } catch {
        failed = `Could not save the ${output.format} graphic.`;
        return current;
      }
    }
    job.outputs = outputs;
    job.updatedAt = new Date().toISOString();
    job.status = "review";
    job.approval = undefined;
    job.contentHash = contentHash(job);
    return current;
  });

  if (missing) return Response.json({ error: "Post not found" }, { status: 404 });
  if (failed) return Response.json({ error: failed }, { status: 500 });

  return Response.json(db.jobs.find((item) => item.id === id));
}
