import { NextRequest } from "next/server";
import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import { contentHash } from "@/lib/brain";
import { geminiConfigured, polishCaptions } from "@/lib/gemini";
import { readDb, updateDb } from "@/lib/store";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "polish") {
    return Response.json({ error: "Unknown action." }, { status: 400 });
  }
  if (!geminiConfigured()) {
    return Response.json(
      { error: "Gemini is not configured on the server." },
      { status: 503 }
    );
  }

  const db = await readDb();
  const job = db.jobs.find((item) => item.id === id);
  if (!job) return Response.json({ error: "Post not found." }, { status: 404 });
  if (
    job.status === "published" ||
    job.status === "rejected"
  ) {
    return Response.json(
      { error: "This post can no longer be rewritten." },
      { status: 400 }
    );
  }

  try {
    const captions = await polishCaptions({ db, job });
    const next = await updateDb((current) => {
      const found = current.jobs.find((item) => item.id === id);
      if (!found) return current;
      found.captions = captions;
      found.captionsOrigin = "gemini";
      found.updatedAt = new Date().toISOString();
      if (found.status === "approved" || found.status === "scheduled") {
        found.status = "review";
        found.approval = undefined;
      }
      found.contentHash = contentHash(found);
      return current;
    });
    return Response.json(next.jobs.find((item) => item.id === id));
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Gemini could not rewrite the caption. The coded caption is unchanged.",
      },
      { status: 502 }
    );
  }
}
