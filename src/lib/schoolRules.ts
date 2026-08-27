import type { Asset, Brief } from "./types";

/**
 * School photo and caption rules — lock before Gemini is connected.
 *
 * Photos, never (default):
 * - retouch, filter, morph, or generate a face
 * - cover-crop a photograph used as-is (that can cut a face)
 * - auto-pick a library photo onto a poster
 * - use a do_not_use asset
 * - send a full uploaded photograph (other children included) to Gemini
 *
 * Photos, yes:
 * - keep the original pixels on the real-photo path
 * - contain the whole photo on a branded event/post canvas
 * - as-is posts with a caption bar under the picture
 *
 * Marked-background path (staff must choose it; never the default):
 * - staff paint over background (and anyone they do not want)
 * - that marked photograph is sent with plain instructions: remove the
 *   painted areas, keep unpainted people exactly as shot, then design
 *   the event poster. The school logo file may be attached.
 * - do not alter an unpainted face
 *
 * Captions + posters (Gemini):
 * - send the structured brief (not chat)
 * - captions include hashtags
 * - artwork-only posters are generated from the brief; no school photo
 * - if image billing is off, fall back to Alara’s coded layout
 *
 * Gemini must never approve or mark live.
 */

export const GEMINI_MODEL_DEFAULT = "gemini-3.5-flash-lite";

/** Product is English-only; Urdu caption generation is disabled. */
export function urduCaptionsEnabled(_lang?: "en" | "ur" | "both") {
  return false;
}

/**
 * How generated artwork may depict people. This is about art the model draws,
 * never about a photo the school uploaded — those are always kept as shot.
 *
 * illustrated    — flat or semi-flat illustration only, no photoreal people
 * photo_no_faces — photographic look, children only from behind/at distance
 * photo_free     — photographic look including student and staff faces
 */
export type PosterPeopleStyle = "illustrated" | "photo_no_faces" | "photo_free";

export const POSTER_PEOPLE_STYLE: PosterPeopleStyle = "photo_no_faces";

export const POSTER_PEOPLE_RULE: Record<PosterPeopleStyle, string> = {
  illustrated:
    "Any people must be polished editorial illustration, never photorealistic. Illustration quality should feel like a design studio, not clip-art.",
  photo_no_faces:
    "Photographic realism is welcome and encouraged. Children may appear only from behind, at a distance, in silhouette, or with faces turned away or out of frame — never a clear, identifiable child's face. Adults may be shown the same way.",
  photo_free:
    "Photographic realism is welcome, including students and staff shown naturally in campus life.",
};

export const GEMINI_CAPTION_RULES = `You polish school social captions. You do not invent facts.
Rules:
- Keep campus, date, time, grades, phone, website, and fees exactly as given.
- Do not add student names unless showName is true and a name is provided.
- No slang if noSlang is true. Tone chips must be followed.
- Add relevant hashtags.
- Do not mention that you are an AI.
- Do not describe or request photographs of real students.
- Return JSON only.`;

export function isKeepOriginal(asset?: Asset | null) {
  return asset?.keepOriginal !== false;
}

export function isPosterSafeAsset(asset?: Asset | null): asset is Asset {
  return Boolean(asset && asset.flag !== "do_not_use");
}

export function namedPerson(brief: Brief) {
  if (!brief.showName) return undefined;
  const name = brief.personName?.trim();
  return name || undefined;
}

/** Staff often type design or photo-edit asks into the brief. Those are not caption copy. */
const DESIGN_INSTRUCTION = [
  /\b(remove|erase|delete|replace|change)\b[^.!?]*\b(background|bg)\b/i,
  /\bcut ?out\b/i,
  /\bcrop\b/i,
  /\bretouch|photoshop|airbrush|beautify\b/i,
  /\bblur\b/i,
  /\b(edit|fix|clean up)\b[^.!?]*\b(photo|picture|image|face)\b/i,
  /\b(make|create|design)\b[^.!?]*\b(post|poster|graphic|caption|hashtag)\b/i,
  /\bonly keep\b/i,
];

/** True when the text asks Alara to alter a photograph, which the school does not allow. */
export function photoEditRequest(...texts: (string | undefined)[]) {
  return texts.some((text) =>
    text ? DESIGN_INSTRUCTION.some((pattern) => pattern.test(text)) : false
  );
}

/** Drops instruction sentences so they never reach a parent-facing caption. */
export function stripDesignInstructions(text?: string) {
  if (!text) return undefined;
  const kept = text
    .split(/(?<=[.!?])\s+/)
    .filter(
      (sentence) =>
        sentence.trim() &&
        !DESIGN_INSTRUCTION.some((pattern) => pattern.test(sentence))
    )
    .join(" ")
    .trim();
  return kept ? kept.replace(/[.\s]+$/, "") : undefined;
}

export function resolvePhotoTreatment(brief: Brief) {
  return (
    brief.photoTreatment ??
    (brief.photoMode === "finish"
      ? "designed"
      : brief.photoMode === "post"
        ? "captioned"
        : "as_is")
  );
}
