export const maxDuration = 120;

import { NextRequest } from "next/server";
import { assemblePacket, writeCaptions } from "@/lib/brain";
import { denyIfSignedOut } from "@/lib/auth/sessionGate";
import {
  createGeminiPackage,
  geminiConfigured,
  polishCaptions,
  type PosterFormat,
} from "@/lib/gemini";
import { readDb } from "@/lib/store";
import type { Brief, CampaignBeat, CaptionSet, Channel, Intent } from "@/lib/types";

export async function POST(request: NextRequest) {
  const denied = await denyIfSignedOut();
  if (denied) return denied;
  const body = (await request.json()) as {
    action?: "draft" | "polish" | "create";
    intent: Intent;
    brief: Brief;
    channels: Channel[];
    beat?: CampaignBeat;
    captionLanguage?: "en" | "ur" | "both";
    captions?: Partial<Record<Channel, CaptionSet>>;
    formats?: PosterFormat[];
    cutoutDataUrl?: string;
  };

  if (!body.intent || !body.channels?.length) {
    return Response.json({ error: "Intent and channels are required." }, { status: 400 });
  }

  const db = await readDb();
  const captionLanguage = "en" as const;
  const packet = assemblePacket(db, {
    intent: body.intent,
    brief: body.brief,
    channels: body.channels,
    captionLanguage,
    posterLanguage: db.posterLanguageDefault,
    beat: body.beat,
  });
  const coded = writeCaptions(db, packet);
  const current = body.captions && Object.keys(body.captions).length ? body.captions : coded;
  const draft = {
    intent: body.intent,
    brief: body.brief,
    channels: body.channels,
    captions: current,
    captionLanguage,
    campaignBeat: body.beat,
  };

  if (body.action === "draft" || !body.action) {
    return Response.json({ captions: coded, captionsOrigin: "coded" });
  }

  if (!geminiConfigured()) {
    return Response.json(
      { error: "Gemini is not configured on the server." },
      { status: 503 }
    );
  }

  if (body.action === "polish") {
    try {
      const captions = await polishCaptions({ db, job: draft });
      return Response.json({ captions, captionsOrigin: "gemini" });
    } catch (err) {
      return Response.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Gemini could not rewrite the caption.",
          captions: current,
          captionsOrigin: "coded",
        },
        { status: 502 }
      );
    }
  }

  if (body.action === "create") {
    const formats =
      body.formats?.length
        ? body.formats
        : (["square"] as PosterFormat[]);
    try {
      const result = await createGeminiPackage({
        db,
        job: draft,
        formats,
        cutoutDataUrl: body.cutoutDataUrl,
      });
      return Response.json({
        captions: current,
        captionsOrigin: body.captions ? "human" : "coded",
        posters: result.posters,
        posterOrigin: result.posterOrigin,
        warning: result.warning,
      });
    } catch (err) {
      return Response.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Gemini could not create this post.",
          captions: current,
          captionsOrigin: "coded",
          posters: {},
          posterOrigin: "none",
        },
        { status: 502 }
      );
    }
  }

  return Response.json({ error: "Unknown action." }, { status: 400 });
}
