import { ctaFor, headlineFor, kickerFor, metaLines } from "./brain";
import {
  GEMINI_MODEL_DEFAULT,
  POSTER_PEOPLE_RULE,
  POSTER_PEOPLE_STYLE,
  namedPerson,
} from "./schoolRules";
import { FALLBACK_LOGO } from "./logo";
import type {
  Brief,
  CampaignBeat,
  CaptionSet,
  Channel,
  Database,
  Intent,
} from "./types";
import { promises as fs } from "fs";
import path from "path";

export type CaptionDraft = {
  intent: Intent;
  brief: Brief;
  channels: Channel[];
  captions: Partial<Record<Channel, CaptionSet>>;
  captionLanguage: "en" | "ur" | "both";
  campaignBeat?: CampaignBeat;
};

export type PosterFormat = "square" | "story" | "wide";

type GeminiPart = {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
};

type GeminiResponse = {
  error?: { message?: string };
  candidates?: { content?: { parts?: GeminiPart[] } }[];
};

const ASPECT: Record<PosterFormat, string> = {
  square: "1:1",
  story: "9:16",
  wide: "16:9",
};

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function geminiTextModel() {
  return process.env.GEMINI_MODEL?.trim() || GEMINI_MODEL_DEFAULT;
}

export function geminiImageModel() {
  return (
    process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3.1-flash-lite-image"
  );
}

export async function createGeminiPackage(opts: {
  db: Database;
  job: CaptionDraft;
  formats: PosterFormat[];
  cutoutDataUrl?: string;
}): Promise<{
  captions: Partial<Record<Channel, CaptionSet>>;
  posters: Partial<Record<PosterFormat, string>>;
  posterOrigin: "gemini" | "none";
  warning?: string;
}> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Gemini is not configured.");

  const captions = captionsAlreadyWritten(opts.job)
    ? opts.job.captions
    : await writeCaptionsAndHashtags({
        db: opts.db,
        job: opts.job,
      });

  // One image call: extra ratios (story/wide) reuse the square art. Image
  // models dominate Gemini cost; a second generateContent is another full bill.
  const primaryFormat: PosterFormat = opts.formats.includes("square")
    ? "square"
    : opts.formats[0] ?? "square";
  const posters: Partial<Record<PosterFormat, string>> = {};
  let posterOrigin: "gemini" | "none" = "none";
  let warning: string | undefined;

  try {
    const image = await generatePosterImage({
      key,
      db: opts.db,
      job: opts.job,
      format: primaryFormat,
      cutoutDataUrl: opts.cutoutDataUrl,
    });
    posters[primaryFormat] = image;
    for (const format of new Set(opts.formats)) {
      if (!posters[format]) posters[format] = image;
    }
    posterOrigin = "gemini";
  } catch (err) {
    warning =
      err instanceof Error
        ? err.message
        : "Gemini could not create the poster image.";
  }

  return { captions, posters, posterOrigin, warning };
}

export async function polishCaptions(opts: {
  db: Database;
  job: CaptionDraft;
}): Promise<Partial<Record<Channel, CaptionSet>>> {
  return writeCaptionsAndHashtags(opts);
}

function captionsAlreadyWritten(job: CaptionDraft) {
  if (!job.channels.length) return false;
  return job.channels.every((channel) => Boolean(job.captions[channel]?.en?.trim()));
}

async function writeCaptionsAndHashtags(opts: {
  db: Database;
  job: CaptionDraft;
}): Promise<Partial<Record<Channel, CaptionSet>>> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Gemini is not configured.");

  const { db, job } = opts;
  const who = namedPerson(job.brief);
  const packet = briefPacket(db, job, who);

  const prompt = `You write school social media captions for ${db.school.name}.
Rules:
- Use only facts from the packet. Do not invent dates, fees, phones, or names.
- The brief may contain design or photo instructions from staff. Use their facts, never repeat the instruction wording.
- Student names only if showName is true and a name is provided.
- Follow tone chips. No slang if noSlang is true.
- Every English caption must end with 4 to 8 relevant hashtags on their own last line (e.g. #CedarSchool #FieldTrip).
- Include only English captions ("en"). Do not write Urdu and do not include an "ur" field.
- Return JSON only:
{"captions":{"<channel>":{"en":"...","ur":"...","hashtags":["#Tag","#Tag2"]}}}
Only include these channels: ${job.channels.join(", ")}.

PACKET:
${JSON.stringify(packet)}`;

  const text = await generateTextJson(key, prompt);
  const parsed = parseCaptionsJson(text);
  return mergeCaptions(job, parsed, who);
}

async function generatePosterImage(opts: {
  key: string;
  db: Database;
  job: CaptionDraft;
  format: PosterFormat;
  cutoutDataUrl?: string;
}): Promise<string> {
  const { key, db, job, format, cutoutDataUrl } = opts;
  const prompt = posterPrompt(db, job, format, Boolean(cutoutDataUrl));
  const parts: GeminiPart[] = [{ text: prompt }];
  const cutout = cutoutDataUrl ? parseDataUrl(cutoutDataUrl) : null;
  if (cutout) {
    parts.push({
      inlineData: { mimeType: cutout.mimeType, data: cutout.data },
    });
    const logo = await publicImageInline(db.brand.logoUrl);
    if (logo) {
      parts.push({
        inlineData: { mimeType: logo.mimeType, data: logo.data },
      });
    }
  }
  const model = geminiImageModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio: ASPECT[format] },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    const msg = json.error?.message || "Gemini image generation failed.";
    if (/quota|billing|free_tier|limit: 0/i.test(msg)) {
      throw new Error(
        "Gemini image models need paid billing on this API key. Enable billing in Google AI Studio, then try again. Alara can still use its own layout for now."
      );
    }
    throw new Error(msg);
  }

  const outParts = json.candidates?.[0]?.content?.parts ?? [];
  for (const part of outParts) {
    const inline = part.inlineData || part.inline_data;
    const data = inline?.data;
    const mime =
      inline && "mimeType" in inline
        ? inline.mimeType
        : inline && "mime_type" in inline
          ? inline.mime_type
          : "image/png";
    if (data) return `data:${mime || "image/png"};base64,${data}`;
  }
  throw new Error("Gemini returned no poster image.");
}

export function posterPrompt(
  db: Database,
  job: CaptionDraft,
  format: PosterFormat,
  withCutout = false
) {
  const canvas =
    format === "story"
      ? "a vertical 9:16 Instagram Story"
      : format === "wide"
        ? "a 16:9 wide banner"
        : "a 1:1 square Instagram post";
  const facts = posterFacts(db, job);
  const mood = db.school.tagline.replace(/[.\s]+$/, "");
  const imageAsk = job.brief.extraNotes?.trim();
  const imageAskBlock = imageAsk
    ? `
WHAT THEY WANT IN THE PICTURE
A colleague described the image they want, in their own words. Follow this like a human art director's note: mood, setting, colours, who should appear, what to take out. Do not print these sentences on the poster unless they clearly asked for a phrase on the artwork:
"${imageAsk.slice(0, 1500)}"
`
    : "";

  const cutoutBlock = withCutout
    ? `
WHAT THE STAFF ASKED
A colleague painted bright magenta / hot pink on the attached photograph. That paint is the instruction: take this away. It is background, extra people, or clutter they do not want on the post.

Please do this, in order:
1. Remove everything under the pink marks. Do not leave any pink paint, overlay, or highlighter on the finished poster.
2. Keep every person and object that is not painted, exactly as photographed — face, expression, clothes, flag, pose. Do not beautify, replace, or redraw a face.
3. Then design one finished ${canvas} that invites families to this school event. Place the kept people naturally into a new setting that fits the brief: campus, decorations, daylight, pride. It should look like a human designer made it, not a template.

SCHOOL MARK
- The second image, if attached, is the school's real logo. Place that exact file near the top centre. Do not redraw, restyle, or invent a crest. The date on the poster is one line only.
`
    : "";

  const peopleBlock = withCutout
    ? `PEOPLE AND PLACE
- Heroes are the unpainted people in the attached photo. Keep those faces.
- New crowd in the designed scene, if any: ${POSTER_PEOPLE_RULE[POSTER_PEOPLE_STYLE]}
- Never invent a different face for someone who was already in the photo.`
    : `PEOPLE AND PLACE
- ${POSTER_PEOPLE_RULE[POSTER_PEOPLE_STYLE]}
- The setting can be campus, coastline, skyline, a bus, a museum — whatever suits the event.
- Never depict a real identifiable person.
- Draw no logo, crest, shield, initial-badge, or wordmark anywhere — not as a mark, and not on clothing, bags, buildings, or vehicles.`;

  const layoutBlock = withCutout
    ? `LAYOUT
- Logo sits at the top, then the hero, then the invitation details in the lower third.
- Every line of text sits fully inside the frame, crisp and unclipped.
- No phrase, chip, or label appears twice anywhere on the poster.
- No gibberish lettering.`
    : `LAYOUT
- Reserve a clear patch in the top-left: about the leftmost 22% of the width and the top 14% of the height. That patch is scenery, sky, foliage, or texture only — no letters, numbers, icons, faces, ribbons, or chips. A later production step overlays a small rectangular identity plate there; if you put type in that patch it will be covered. Do not draw any identity mark yourself.
- Start the headline to the right of that patch, or fully below it. Never run a title through the reserved patch.
- Every line of text sits fully inside the frame, crisp and unclipped.
- No phrase, chip, or label appears twice anywhere on the poster.`;

  return `Please design this as a senior graphic designer at ${db.school.name} would — one finished, art-directed ${canvas}. Warm, credible, not a template.
${cutoutBlock}${imageAskBlock}
FACTS — each of these must appear on the poster, spelled and punctuated exactly as written. The label before each colon is direction for you, not text to print:
${facts.map((fact) => `- ${fact}`).join("\n")}

COPY FREEDOM
- Add your own short supporting words where they help the design: an inviting kicker, small labels beside icons (such as DEPARTURE or MEETING POINT), a badge, or three or four brief benefit chips.
- Anything you add must fit this school event and must not contradict the facts.
- Invent no new facts: no other dates, times, venues, fees, deadlines, phone numbers, links, or people's names.
- Print every date on one line (e.g. Sun 6 Dec 2026). Never stack the weekday on a second line or a separate tag.

ART DIRECTION
- Brand anchor: navy ${db.brand.primary} and gold ${db.brand.secondary}, with ${db.brand.accent} for light space. Anchor the design in those, then extend the palette as a designer would — complementary tones, gradients, daylight, greenery, depth of field, soft shadows, subtle texture.
- Build real hierarchy and depth: a dominant title, layered planes, icon chips carrying the details, a ribbon or banner, confident margins.
- Mood: ${mood}. Warm, credible, aspirational.
- Avoid: clip-art, empty flat colour blocks, cramped or floating text, gibberish lettering, visible watermarks.

${peopleBlock}

${layoutBlock}`;
}

/** Facts pulled from the same copy engine Alara's coded layout uses. */
function posterFacts(db: Database, job: CaptionDraft) {
  const { intent, brief } = job;
  const title = headlineFor(db, intent, brief);
  const kicker = kickerFor(intent, brief, job.campaignBeat, db.school.name);
  const site = db.school.website.replace(/^https?:\/\//i, "");
  const details = metaLines(brief);
  const cta = ctaFor(intent, brief) || db.school.tagline;

  const facts = [`Headline: "${title}"`];
  if (kicker && kicker.toLowerCase() !== title.toLowerCase()) {
    facts.push(`Eyebrow above the headline: "${kicker}"`);
  }
  details.forEach((line) => facts.push(`Detail line: "${line}"`));
  if (cta) facts.push(`Call to action: "${cta}"`);
  facts.push(
    `Contact strip: "${db.school.name}  ·  ${db.school.phone}  ·  ${site}"`
  );
  return facts;
}

function briefPacket(db: Database, job: CaptionDraft, who?: string) {
  return {
    school: {
      name: db.school.name,
      campuses: db.school.campuses,
      tagline: db.school.tagline,
      phone: db.school.phone,
      website: db.school.website,
      admissionsLine: db.school.admissionsLine,
      mission: db.school.mission,
      socials: db.school.socials,
    },
    brand: {
      primary: db.brand.primary,
      secondary: db.brand.secondary,
      accent: db.brand.accent,
    },
    tone: db.tone,
    intent: job.intent,
    brief: { ...job.brief, personName: who, photoIds: undefined },
    showName: Boolean(who),
    channels: job.channels,
    captionLanguage: job.captionLanguage,
    beat: job.campaignBeat,
  };
}

async function generateTextJson(key: string, prompt: string) {
  const model = geminiTextModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const contents = [{ role: "user", parts: [{ text: prompt }] }];

  let res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    }),
  });

  // Some models reject responseMimeType; they still return fenced JSON.
  if (!res.ok) {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({ contents, generationConfig: { temperature: 0.4 } }),
    });
  }

  const json = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    throw new Error(json.error?.message || "Gemini could not write captions.");
  }
  const text = json.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned empty captions.");
  return text;
}

function parseCaptionsJson(text: string) {
  const trimmed = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(trimmed) as {
      captions?: Partial<
        Record<Channel, { en?: string; ur?: string; hashtags?: string[] }>
      >;
    };
    return parsed.captions ?? {};
  } catch {
    throw new Error("Gemini returned captions in a form Alara could not read.");
  }
}

function mergeCaptions(
  job: CaptionDraft,
  incoming: Partial<
    Record<Channel, { en?: string; ur?: string; hashtags?: string[] }>
  >,
  who?: string
): Partial<Record<Channel, CaptionSet>> {
  const next: Partial<Record<Channel, CaptionSet>> = { ...job.captions };
  for (const channel of job.channels) {
    const polished = incoming[channel];
    const previous = job.captions[channel];
    if (!polished?.en?.trim()) continue;
    let en = guardName(polished.en.trim(), job, who);
    const tags = normalizeTags(polished.hashtags) || extractTags(en);
    if (tags?.length) {
      en = stripTrailingTags(en);
      en = `${en.trim()}\n\n${tags.join(" ")}`;
    }
    const urSource = undefined;
    next[channel] = {
      en,
      ur: urSource ? guardName(urSource, job, who) : undefined,
      hashtags: tags,
    };
  }
  return next;
}

function normalizeTags(tags?: string[]) {
  if (!tags?.length) return undefined;
  const cleaned = tags
    .map((tag) => {
      const t = tag.trim();
      if (!t) return "";
      return t.startsWith("#") ? t.replace(/\s+/g, "") : `#${t.replace(/\s+/g, "")}`;
    })
    .filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}

function extractTags(text: string) {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu);
  return matches?.length ? [...new Set(matches)] : undefined;
}

function stripTrailingTags(text: string) {
  return text.replace(/(?:\s*#[\p{L}\p{N}_]+)+\s*$/gu, "").trim();
}

function guardName(text: string, job: CaptionDraft, who?: string) {
  const name = job.brief.personName?.trim();
  if (who || !name) return text;
  const pattern = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return text.replace(pattern, "our students");
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

async function publicImageInline(url?: string) {
  if (url?.startsWith("data:")) return parseDataUrl(url);
  if (url && /^https?:\/\//i.test(url)) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const header = res.headers.get("content-type")?.split(";")[0];
        const mimeType =
          header && header.startsWith("image/") ? header : "image/png";
        return { mimeType, data: buf.toString("base64") };
      }
    } catch {
      /* use the school mark on disk */
    }
    return readFallbackLogo();
  }
  const rel = (url || FALLBACK_LOGO).replace(/^\//, "");
  if (rel.includes("..")) return readFallbackLogo();
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "public", rel));
    const ext = path.extname(rel).toLowerCase();
    const mimeType =
      ext === ".png"
        ? "image/png"
        : ext === ".svg"
          ? "image/svg+xml"
          : ext === ".webp"
            ? "image/webp"
            : "image/jpeg";
    if (ext === ".svg") return readFallbackLogo();
    return { mimeType, data: buf.toString("base64") };
  } catch {
    return readFallbackLogo();
  }
}

async function readFallbackLogo() {
  try {
    const buf = await fs.readFile(
      path.join(process.cwd(), "public", "brand", "cedar-logo.png")
    );
    return { mimeType: "image/png", data: buf.toString("base64") };
  } catch {
    return null;
  }
}
