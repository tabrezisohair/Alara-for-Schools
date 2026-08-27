"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ADMISSIONS_BEATS,
  ANNOUNCEMENT_TYPES,
  CHANNEL_META,
  DEFAULT_CHANNELS,
  EVENT_BEATS,
  EVENT_TYPES,
  formatsForChannels,
  GRADE_OPTIONS,
  INTENTS,
  OTHER_CATEGORIES,
  SHOWCASE_TYPES,
} from "@/lib/constants";
import { composePoster, pickPosterPhoto, stampLogo } from "@/lib/compose";
import { deleteRecord, useAlara } from "@/lib/useAlara";
import {
  isPosterSafeAsset,
  photoEditRequest,
} from "@/lib/schoolRules";
import type { Asset, Brief, CampaignBeat, CaptionSet, Channel, Database, Intent } from "@/lib/types";
import { VoiceMic } from "./VoiceMic";
import { IntentCard } from "./IntentCard";
import { ChannelPostPreview } from "./ChannelPostPreview";
import { ConfirmDialog } from "./ConfirmDialog";
import { CutoutEditor } from "./CutoutEditor";

const DRAFT_KEY = "alara-create-draft";
const MAX_STEP = 4;

type Preview = {
  format: "square" | "story" | "wide";
  dataUrl: string;
  channel: Channel;
};

type ImageSource = "photo" | "artwork" | "cutout";

type CreateDraft = {
  step: number;
  intent: Intent | null;
  brief: Brief;
  beat: CampaignBeat | "";
  channels: Channel[];
  voiceNote: string;
  captions?: Partial<Record<Channel, CaptionSet>>;
  captionsOrigin?: "coded" | "human" | "gemini";
  imageSource?: ImageSource;
};

export function CreateWizard({ db }: { db: Database }) {
  const router = useRouter();
  const { reload } = useAlara();
  const params = useSearchParams();
  const startIntent = (params.get("intent") as Intent) || null;
  const startPhoto = params.get("photoId");
  const fromLink = Boolean(
    params.get("intent") ||
      params.get("photoId") ||
      params.get("campaignId") ||
      params.get("eventName") ||
      params.get("eventType") ||
      params.get("date") ||
      params.get("campus") ||
      params.get("beat")
  );
  const [step, setStep] = useState(startIntent ? 1 : 0);
  const [intent, setIntent] = useState<Intent | null>(startIntent);
  const [brief, setBrief] = useState<Brief>(() =>
    briefFromParams(params, db, startIntent, startPhoto)
  );
  const campaignId = params.get("campaignId") || undefined;
  const [beat, setBeat] = useState<CampaignBeat | "">(
    (params.get("beat") as CampaignBeat) || ""
  );
  const [channels, setChannels] = useState<Channel[]>(
    DEFAULT_CHANNELS[startIntent ?? "event"]
  );
  const [voiceNote, setVoiceNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [captions, setCaptions] = useState<Partial<Record<Channel, CaptionSet>>>({});
  const [captionsOrigin, setCaptionsOrigin] = useState<"coded" | "human" | "gemini">("coded");
  const [posterOrigin, setPosterOrigin] = useState<"alara" | "gemini">("alara");
  const [imageSource, setImageSource] = useState<ImageSource | null>(null);
  const [askingImageSource, setAskingImageSource] = useState(false);
  const [editingCutout, setEditingCutout] = useState(false);
  const [cutoutDataUrl, setCutoutDataUrl] = useState<string | null>(null);
  const [resumable, setResumable] = useState<CreateDraft | null>(null);
  const skipDraftWrite = useRef(true);

  function goToStep(next: number, historyMode: "push" | "replace" | "none" = "push") {
    setStep(next);
    if (historyMode === "none" || typeof window === "undefined") return;
    const state = { alaraCreateStep: next };
    if (historyMode === "replace") window.history.replaceState(state, "");
    else window.history.pushState(state, "");
  }

  function goBackStep() {
    if (typeof window !== "undefined" && window.history.state?.alaraCreateStep != null) {
      window.history.back();
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  }

  function resumeDraft(saved: CreateDraft) {
    setIntent(saved.intent);
    setBrief(saved.brief);
    setBeat(saved.beat);
    setChannels(
      saved.channels.length
        ? saved.channels
        : DEFAULT_CHANNELS[saved.intent ?? "event"]
    );
    setVoiceNote(saved.voiceNote);
    setCaptions(saved.captions ?? {});
    setCaptionsOrigin(saved.captionsOrigin ?? "coded");
    setImageSource(saved.imageSource ?? null);
    setAskingImageSource(false);
    setEditingCutout(false);
    setCutoutDataUrl(null);
    // Preview/schedule need regenerating after a resume.
    const next = saved.step >= 3 ? 2 : saved.step;
    goToStep(next, "replace");
    setResumable(null);
  }

  const missing = useMemo(() => missingFields(intent, brief), [intent, brief]);

  useEffect(() => {
    skipDraftWrite.current = true;
    if (fromLink) {
      writeCreateDraft({
        step: startIntent ? 1 : 0,
        intent: startIntent,
        brief: briefFromParams(params, db, startIntent, startPhoto),
        beat: (params.get("beat") as CampaignBeat) || "",
        channels: DEFAULT_CHANNELS[startIntent ?? "event"],
        voiceNote: "",
      });
    }
    queueMicrotask(() => {
      // Offer the unfinished post instead of loading it. Restoring silently
      // dropped staff into another intent's brief without ever asking what
      // they wanted to post.
      if (!fromLink) {
        const saved = readCreateDraft();
        if (saved?.intent) setResumable(saved);
      }
      skipDraftWrite.current = false;
    });
  }, [fromLink]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const initial = startIntent ? 1 : 0;
    window.history.replaceState({ alaraCreateStep: initial }, "");
    const onPop = (event: PopStateEvent) => {
      const next = (event.state as { alaraCreateStep?: number } | null)?.alaraCreateStep;
      if (typeof next === "number" && next >= 0 && next <= MAX_STEP) {
        setStep(next);
        return;
      }
      setStep(0);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // Only seed history once when the wizard mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (skipDraftWrite.current) return;
    writeCreateDraft({
      step,
      intent,
      brief,
      beat,
      channels,
      voiceNote,
      captions,
      captionsOrigin,
      imageSource: imageSource ?? undefined,
    });
  }, [step, intent, brief, beat, channels, voiceNote, captions, captionsOrigin, imageSource]);

  function fill(partial: Brief) {
    setBrief((b) => ({ ...b, ...partial }));
  }

  function hasRealPhoto() {
    if (!intent) return false;
    return Boolean(pickPosterPhoto(db, intent, brief.photoIds));
  }

  function shouldAskImageSource() {
    return Boolean(intent && intent !== "photos_to_post" && hasRealPhoto());
  }

  function requestCreate(source?: ImageSource) {
    if (!intent) return;
    if (intent === "photos_to_post") {
      setImageSource("photo");
      setAskingImageSource(false);
      void makePreview({ source: "photo" });
      return;
    }
    if (!hasRealPhoto()) {
      setImageSource("artwork");
      setAskingImageSource(false);
      void makePreview({ source: "artwork" });
      return;
    }
    if (!source) {
      setAskingImageSource(true);
      return;
    }
    if (source === "cutout") {
      setImageSource("cutout");
      setAskingImageSource(false);
      setEditingCutout(true);
      goToStep(2, "replace");
      return;
    }
    setImageSource(source);
    setAskingImageSource(false);
    setEditingCutout(false);
    void makePreview({ source });
  }

  async function makePreview(opts?: {
    keepCaptions?: boolean;
    source?: ImageSource;
    cutout?: string;
  }) {
    if (!intent) return;
    setBusy(true);
    setError(null);
    try {
      const formats = formatsForChannels(channels);
      const uniqueFormats = [...new Set(formats.map((item) => item.format))];
      const photoTreatment = brief.photoTreatment ?? "as_is";
      const source: ImageSource =
        opts?.source ??
        imageSource ??
        (intent === "photos_to_post" || hasRealPhoto() ? "photo" : "artwork");
      const cutout = opts?.cutout ?? cutoutDataUrl ?? undefined;
      const useOriginalPhoto =
        source === "photo" ||
        (intent === "photos_to_post" &&
          (photoTreatment === "as_is" || photoTreatment === "captioned"));

      let made: Preview[] = [];
      let nextPosterOrigin: "alara" | "gemini" = "alara";
      let captionsApplied = false;

      if (!useOriginalPhoto) {
        try {
          const gemRes = await fetch("/api/captions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "create",
              intent,
              brief: { ...brief, extraNotes: voiceNote || brief.extraNotes },
              channels,
              beat: beat || undefined,
              captionLanguage: "en",
              formats: uniqueFormats,
              captions: opts?.keepCaptions ? captions : undefined,
              cutoutDataUrl: source === "cutout" ? cutout : undefined,
            }),
          });
          const gemJson = await gemRes.json();
          if (gemJson.captions && !opts?.keepCaptions) {
            setCaptions(gemJson.captions);
            setCaptionsOrigin(gemJson.captionsOrigin || "gemini");
            captionsApplied = true;
          }
          if (gemJson.posterOrigin === "gemini" && gemJson.posters) {
            const mapped = formats.map((item) => ({
              ...item,
              dataUrl:
                gemJson.posters[item.format] ||
                gemJson.posters.square ||
                gemJson.posters.story ||
                gemJson.posters.wide ||
                "",
            }));
            if (mapped.every((item) => item.dataUrl)) {
              made = await Promise.all(
                mapped.map(async (item) => ({
                  ...item,
                  dataUrl: await stampLogo({
                    dataUrl: item.dataUrl,
                    brand: db.brand,
                  }),
                }))
              );
              nextPosterOrigin = "gemini";
            }
          }
          const notice = gemJson.warning || (!gemRes.ok ? gemJson.error : null);
          if (notice) {
            console.warn("Poster fell back to the coded brand layout:", notice);
          }
        } catch (err) {
          console.warn("Poster fell back to the coded brand layout:", err);
        }
      }

      if (!made.length) {
        const photoUrl =
          source === "cutout" && cutout
            ? cutout
            : pickPosterPhoto(db, intent, brief.photoIds);
        made = [];
        for (const item of formats) {
          const dataUrl = await composePoster({
            format: item.format,
            db,
            intent,
            brief,
            beat: beat || undefined,
            photoUrl,
          });
          made.push({ ...item, dataUrl });
        }
        nextPosterOrigin = "alara";
        if (!opts?.keepCaptions && !captionsApplied) {
          const capRes = await fetch("/api/captions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "polish",
              intent,
              brief: { ...brief, extraNotes: voiceNote || brief.extraNotes },
              channels,
              beat: beat || undefined,
              captionLanguage: "en",
              captions: Object.keys(captions).length ? captions : undefined,
            }),
          });
          const capJson = await capRes.json();
          if (capRes.ok && capJson.captions) {
            setCaptions(capJson.captions);
            setCaptionsOrigin(capJson.captionsOrigin || "coded");
          } else if (!Object.keys(captions).length) {
            const draftRes = await fetch("/api/captions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "draft",
                intent,
                brief: { ...brief, extraNotes: voiceNote || brief.extraNotes },
                channels,
                beat: beat || undefined,
                captionLanguage: "en",
              }),
            });
            const draftJson = await draftRes.json();
            if (draftRes.ok && draftJson.captions) {
              setCaptions(draftJson.captions);
              setCaptionsOrigin("coded");
            }
          }
        }
      }

      setPosterOrigin(nextPosterOrigin);
      setPreviews(made.filter((item) => Boolean(item.dataUrl)));
      goToStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not design the post");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!intent) return;
    if (!brief.scheduledFor) {
      setError("Choose a date and time before sending for approval.");
      goToStep(4);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          brief: { ...brief, extraNotes: voiceNote || brief.extraNotes },
          channels,
          beat: beat || undefined,
          campaignId,
          assetIds: brief.photoIds,
          scheduledFor: brief.scheduledFor,
          captions,
          captionsOrigin,
          provenance: { voice: voiceNote ? "voice" : "dropdown" },
        }),
      });
      const job = await res.json();
      if (!res.ok) throw new Error(job.error || "Could not save");
      if (previews.length) {
        const saved = await fetch(`/api/jobs/${job.id}/outputs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outputs: previews.map((p) => ({
              format: p.format,
              channel: p.channel,
              dataUrl: p.dataUrl,
            })),
          }),
        });
        if (!saved.ok) {
          const payload = await saved.json().catch(() => ({}));
          throw new Error(
            payload.error ||
              "The post was saved but the graphic did not upload. Open it and press Redesign layout."
          );
        }
      }
      clearCreateDraft();
      await reload();
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function rewriteCaptions() {
    if (!intent) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "polish",
          intent,
          brief: { ...brief, extraNotes: voiceNote || brief.extraNotes },
          channels,
          beat: beat || undefined,
          captionLanguage: "en",
          captions,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Could not rewrite captions");
      setCaptions(payload.captions);
      setCaptionsOrigin("gemini");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rewrite captions");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {step === 0 ? (
        <div className="space-y-4">
          {resumable ? (
            <div className="card flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                You have an unfinished{" "}
                <span className="font-semibold">
                  {INTENTS.find((item) => item.id === resumable.intent)?.label ??
                    "post"}
                </span>{" "}
                brief in this tab.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => resumeDraft(resumable)}
                >
                  Continue it
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    clearCreateDraft();
                    setResumable(null);
                  }}
                >
                  Start fresh
                </button>
              </div>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {INTENTS.map((item) => (
              <IntentCard
                key={item.id}
                id={item.id}
                label={item.label}
                hint={item.hint}
                active={intent === item.id}
                onClick={() => {
                  if (item.id !== intent) {
                    setIntent(item.id);
                    setChannels(DEFAULT_CHANNELS[item.id]);
                    setBeat("");
                    setCaptions({});
                    setCaptionsOrigin("coded");
                    setPreviews([]);
                    setImageSource(null);
                    setAskingImageSource(false);
                    setEditingCutout(false);
                    setCutoutDataUrl(null);
                    // A different intent is a different brief. Only what is
                    // true of any post survives the switch.
                    setBrief((prev) => ({
                      campus: prev.campus ?? db.school.campuses[0],
                      photoIds: prev.photoIds,
                      photoTreatment:
                        item.id === "photos_to_post" ? "as_is" : undefined,
                    }));
                  }
                  setResumable(null);
                  goToStep(1);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {step === 1 && intent ? (
        <div className="space-y-6">
          {intent === "event" || intent === "admissions" ? (
            <label className="block max-w-md">
              <span className="mb-1 block text-sm">
                {campaignId ? "This post in the campaign" : "Campaign post (optional)"}
              </span>
              <select
                className="field"
                value={beat}
                onChange={(e) => setBeat((e.target.value as CampaignBeat) || "")}
              >
                <option value="">One-off post</option>
                {(intent === "event" ? EVENT_BEATS : ADMISSIONS_BEATS).map((item) => (
                  <option key={item.beat} value={item.beat}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <BriefFields
            intent={intent}
            db={db}
            brief={brief}
            onChange={fill}
            onUploaded={reload}
            onSpoken={(text) => setVoiceNote(text)}
          />
          {missing.length ? (
            <p className="text-sm text-amber-800">
              Still needed: {missing.join(", ")}
            </p>
          ) : null}
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={goBackStep}>
              Back
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={missing.length > 0}
              onClick={() => goToStep(2)}
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 && intent ? (
        <div className="space-y-4">
          {busy ? (
            <section className="card space-y-2">
              <h2 className="font-medium">Creating the post</h2>
              <p className="text-sm text-[var(--muted)]">
                Alara is designing from your brief
                {imageSource === "cutout"
                  ? " and the areas you marked"
                  : ""}
                . This can take a minute. The result will open as a Facebook
                and Instagram preview.
              </p>
            </section>
          ) : null}
          {!busy && !editingCutout && !askingImageSource ? (
            <>
              <p className="text-sm text-[var(--muted)]">
                Easiest first. Download always works. Instagram and Facebook next.
              </p>
              {(["download", "ig_post", "ig_story", "facebook", "whatsapp", "linkedin"] as Channel[]).map(
                (ch) => (
                  <label key={ch} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={channels.includes(ch)}
                      onChange={(e) =>
                        setChannels((prev) =>
                          e.target.checked
                            ? [...prev, ch]
                            : prev.filter((x) => x !== ch)
                        )
                      }
                    />
                    <span className="capitalize">{ch.replace("_", " ")}</span>
                  </label>
                )
              )}
            </>
          ) : null}
          {!busy && editingCutout && intent && pickPosterPhoto(db, intent, brief.photoIds) ? (
            <CutoutEditor
              src={pickPosterPhoto(db, intent, brief.photoIds) as string}
              onCancel={() => {
                setEditingCutout(false);
                setAskingImageSource(true);
              }}
              onReady={(dataUrl) => {
                setCutoutDataUrl(dataUrl);
                setEditingCutout(false);
                void makePreview({ source: "cutout", cutout: dataUrl });
              }}
            />
          ) : !busy && askingImageSource ? (
            <section className="card space-y-4">
              <h2 className="font-medium">Does this photo’s background need to change?</h2>
              <p className="text-sm">
                If the real picture is the post, keep it. If you want a designed
                event behind someone in the photo, mark what to take out.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--navy)]">
                <li>
                  Keep as taken: the photo stays inside Alara, used as photographed.
                </li>
                <li>
                  Mark to remove: paint the background (and anyone who should
                  not appear). Unpainted faces stay as shot. Alara takes out
                  the pink and designs the event around who you kept.
                </li>
              </ul>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => setAskingImageSource(false)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => requestCreate("photo")}
                >
                  {busy ? "Creating with Alara…" : "No — use the photo as taken"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => requestCreate("cutout")}
                >
                  Yes — I’ll mark what to remove
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => requestCreate("artwork")}
                >
                  Don’t use this photo — create artwork
                </button>
              </div>
            </section>
          ) : !busy ? (
            <div className="flex gap-3">
              <button type="button" className="btn-secondary" onClick={() => {
              setAskingImageSource(false);
              goBackStep();
            }}>
                Back
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || channels.length === 0}
                onClick={() => requestCreate()}
              >
                {busy ? "Creating with Alara…" : "Create post"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-6">
          {shouldAskImageSource() ? (
            <div className="flex flex-wrap gap-4">
              {imageSource !== "photo" ? (
                <button
                  type="button"
                  className="text-sm font-semibold text-[var(--navy)] underline-offset-2 hover:underline"
                  disabled={busy}
                  onClick={() => requestCreate("photo")}
                >
                  Use the real photo instead
                </button>
              ) : null}
              {imageSource !== "artwork" ? (
                <button
                  type="button"
                  className="text-sm font-semibold text-[var(--navy)] underline-offset-2 hover:underline"
                  disabled={busy}
                  onClick={() => requestCreate("artwork")}
                >
                  Create artwork instead
                </button>
              ) : null}
              {imageSource !== "cutout" ? (
                <button
                  type="button"
                  className="text-sm font-semibold text-[var(--navy)] underline-offset-2 hover:underline"
                  disabled={busy}
                  onClick={() => requestCreate("cutout")}
                >
                  Mark what to remove instead
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-6 md:grid-cols-2">
            {previews.map((p) => (
              <ChannelPostPreview
                key={p.channel}
                channel={p.channel}
                imageUrl={p.dataUrl}
                caption={captions[p.channel]}
                schoolName={db.school.name}
                logoUrl={db.brand.logoUrl}
                facebookName={db.school.socials.facebook}
                instagramHandle={db.school.socials.instagram}
              />
            ))}
          </div>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <p className="text-sm text-[var(--muted)]">
            {posterOrigin === "gemini"
              ? imageSource === "cutout"
                ? "Alara took out what you marked and designed the event around who you kept."
                : "Alara drew this from your brief. Your photographs were not sent anywhere and were not used on it."
              : imageSource === "cutout"
                ? "Alara placed your marked photo on the school's brand layout."
                : "Alara placed your photo whole on the school's brand layout. Nothing was cropped or retouched."}
          </p>
          {posterOrigin === "alara" && !brief.photoIds?.length ? (
            <p className="text-sm text-[var(--muted)]">
              No photo was attached, so this is a graphic layout. Go back to Details
              to add one — Alara places the whole photo on the poster.
            </p>
          ) : null}
          {imageSource === "photo" &&
          photoEditRequest(brief.extraNotes, brief.parentActionNote) ? (
            <p className="text-sm text-[var(--navy)]">
              Your notes asked for a photo edit. Alara keeps every photo exactly as
              photographed — no background removal, cut-outs, cropping through
              faces, or retouching. It places the whole photo on the branded
              layout instead, and it left that instruction out of the captions.
            </p>
          ) : null}
          <section className="card space-y-3">
            <h2 className="font-medium">Captions + hashtags</h2>
            <p className="text-sm text-[var(--muted)]">
              {captionsOrigin === "gemini"
                ? "Alara wrote these from your brief. Edit if you want, then send for approval."
                : "Written from your brief. Tap Rewrite caption for a fresh version."}
            </p>
            {channels.map((ch) => (
              <div key={ch} className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  {CHANNEL_META.find((item) => item.id === ch)?.label ?? ch}
                </p>
                <textarea
                  className="field min-h-28"
                  value={captions[ch]?.en ?? ""}
                  onChange={(e) => {
                    setCaptions((prev) => ({
                      ...prev,
                      [ch]: { ...prev[ch], en: e.target.value },
                    }));
                    setCaptionsOrigin("human");
                  }}
                />
                {captions[ch]?.hashtags?.length ? (
                  <p className="text-sm text-[var(--navy)]">
                    {captions[ch]?.hashtags?.join(" ")}
                  </p>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={rewriteCaptions}
            >
              {busy ? "Working…" : "Rewrite caption"}
            </button>
          </section>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={goBackStep}>
              Back
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() =>
                void makePreview({
                  source: imageSource ?? undefined,
                  cutout: cutoutDataUrl ?? undefined,
                })
              }
            >
              {busy ? "Creating with Alara…" : "Create another version"}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !previews.length}
              onClick={() => goToStep(4)}
            >
              Continue to schedule
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {previews.map((p) => (
              <ChannelPostPreview
                key={p.channel}
                channel={p.channel}
                imageUrl={p.dataUrl}
                caption={captions[p.channel]}
                schoolName={db.school.name}
                logoUrl={db.brand.logoUrl}
                facebookName={db.school.socials.facebook}
                instagramHandle={db.school.socials.instagram}
              />
            ))}
          </div>
          <section className="card space-y-3 max-w-md">
            <h2 className="font-medium">Schedule</h2>
            <p className="text-sm text-[var(--muted)]">
              Choose when this post should go live after approval.
            </p>
            <label className="block text-sm">
              Date and time
              <input
                className="field mt-1"
                type="datetime-local"
                value={brief.scheduledFor ?? ""}
                onChange={(e) => fill({ scheduledFor: e.target.value || undefined })}
                required
              />
            </label>
            {brief.scheduledFor ? (
              <p className="rounded-xl bg-[var(--paper)] px-3 py-2 text-sm text-[var(--navy)]">
                Will publish{" "}
                <span className="font-semibold">
                  {formatScheduleConfirm(brief.scheduledFor)}
                </span>
                , after approval.
              </p>
            ) : (
              <p className="text-sm text-amber-800">Pick a date and time to continue.</p>
            )}
          </section>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={goBackStep}>
              Back
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !brief.scheduledFor}
              onClick={submit}
            >
              {busy ? "Saving…" : "Send for approval"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BriefFields({
  intent,
  db,
  brief,
  onChange,
  onUploaded,
  onSpoken,
}: {
  intent: Intent;
  db: Database;
  brief: Brief;
  onChange: (b: Brief) => void;
  onUploaded?: () => Promise<void>;
  onSpoken?: (text: string) => void;
}) {
  const campuses = db.school.campuses;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {intent === "event" ? (
        <>
          <Select
            label="Event type"
            value={brief.eventType ?? ""}
            onChange={(v) => onChange({ eventType: v, eventName: nameForEventType(v, brief) })}
            options={EVENT_TYPES}
          />
          <Field
            label={brief.eventType === "Other" ? "Event name" : "Event name (optional)"}
            value={brief.eventName ?? ""}
            onChange={(v) => onChange({ eventName: v })}
            required={brief.eventType === "Other"}
            placeholder={
              brief.eventType === "Other" ? "e.g. Founders' Day" : undefined
            }
          />
          <Select label="Campus" value={brief.campus ?? ""} onChange={(v) => onChange({ campus: v })} options={campuses} />
          <Field label="Date" type="date" value={brief.date ?? ""} onChange={(v) => onChange({ date: v })} />
          <Field
            label="Time (optional)"
            type="time"
            value={brief.time ?? ""}
            onChange={(v) => onChange({ time: v })}
          />
          <Select
            label="What should parents do?"
            value={brief.parentAction ?? ""}
            onChange={(v) =>
              onChange({
                parentAction: v,
                parentActionNote: v === "I'll tell you" ? brief.parentActionNote : "",
              })
            }
            options={[
              "Just inform",
              "Register",
              "Bring students in sports kit",
              "I'll tell you",
            ]}
          />
          {brief.parentAction === "I'll tell you" ? (
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm">Tell Alara what to do</span>
              <textarea
                className="field min-h-24"
                value={brief.parentActionNote ?? ""}
                onChange={(e) => onChange({ parentActionNote: e.target.value })}
                placeholder="e.g. Ask parents to confirm attendance on WhatsApp by Friday"
              />
            </label>
          ) : null}
          <fieldset className="md:col-span-2">
            <legend className="mb-2 text-sm">Grades</legend>
            <div className="flex flex-wrap gap-2">
              {GRADE_OPTIONS.map((g) => {
                const on = brief.grades?.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-sm ${on ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)]"}`}
                    onClick={() => {
                      const next = new Set(brief.grades ?? []);
                      if (on) next.delete(g);
                      else next.add(g);
                      onChange({ grades: [...next] });
                    }}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </>
      ) : null}

      {intent === "announcement" ? (
        <>
          <Select label="Type" value={brief.announcementType ?? ""} onChange={(v) => onChange({ announcementType: v })} options={ANNOUNCEMENT_TYPES} />
          <Select label="Audience" value={brief.audience ?? ""} onChange={(v) => onChange({ audience: v })} options={["All parents", "Specific grades", "Staff", "Public"]} />
          <Select label="Severity" value={brief.severity ?? ""} onChange={(v) => onChange({ severity: v })} options={["Info", "Important", "Urgent"]} />
          <Field label="Date" type="date" value={brief.date ?? ""} onChange={(v) => onChange({ date: v })} />
          <Field label="End date (if closure)" type="date" value={brief.endDate ?? ""} onChange={(v) => onChange({ endDate: v })} />
          <Field className="md:col-span-2" label="Facts" value={brief.bodyFacts ?? ""} onChange={(v) => onChange({ bodyFacts: v })} />
        </>
      ) : null}

      {intent === "achievement" ? (
        <>
          <Select label="Who" value={brief.who ?? ""} onChange={(v) => onChange({ who: v })} options={["Student", "Class", "Team", "Teacher", "School"]} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!brief.showName} onChange={(e) => onChange({ showName: e.target.checked })} />
            Show the name on the graphic (off unless you turn it on)
          </label>
          {brief.showName ? (
            <Field label="Name" value={brief.personName ?? ""} onChange={(v) => onChange({ personName: v })} />
          ) : null}
          <Field className="md:col-span-2" label="Achievement" value={brief.achievement ?? ""} onChange={(v) => onChange({ achievement: v })} />
        </>
      ) : null}

      {intent === "admissions" ? (
        <>
          <Select label="Goal" value={brief.admissionsGoal ?? ""} onChange={(v) => onChange({ admissionsGoal: v })} options={["Enquiries", "Awareness", "Deadline", "Tour", "Program spotlight"]} />
          <Select label="Program" value={brief.program ?? ""} onChange={(v) => onChange({ program: v })} options={["Primary", "Middle", "College", "All"]} />
          <Field label="Deadline" type="date" value={brief.deadline ?? ""} onChange={(v) => onChange({ deadline: v })} />
          <Select label="Call to action" value={brief.cta ?? ""} onChange={(v) => onChange({ cta: v })} options={["Enquire", "Apply", "Book a tour", "Call"]} />
        </>
      ) : null}

      {intent === "showcase" ? (
        <Select label="Showcase" value={brief.showcaseType ?? ""} onChange={(v) => onChange({ showcaseType: v })} options={SHOWCASE_TYPES} />
      ) : null}

      {intent === "other" ? (
        <Select label="Category" value={brief.otherCategory ?? ""} onChange={(v) => onChange({ otherCategory: v })} options={OTHER_CATEGORIES} />
      ) : null}

      {intent === "photos_to_post" ? (
        <PhotoPostFields db={db} brief={brief} onChange={onChange} onUploaded={onUploaded} />
      ) : intent === "event" ||
        intent === "showcase" ||
        intent === "achievement" ||
        intent === "admissions" ? (
        <BriefPhotoPicker
          db={db}
          brief={brief}
          onChange={onChange}
          onUploaded={onUploaded}
          hint="Optional. Add a photo if you want the real picture on the post."
        />
      ) : null}

      <div className="md:col-span-2 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">What you want in the image</span>
          <VoiceMic
            compact
            onText={(text) => {
              const current = brief.extraNotes?.trim() ?? "";
              onChange({ extraNotes: current ? `${current} ${text}` : text });
              onSpoken?.(text);
            }}
          />
        </div>
        <textarea
          className="field min-h-28"
          placeholder="Explain the picture you want — scene, mood, colours, who should appear, what to take out."
          value={brief.extraNotes ?? ""}
          onChange={(e) => onChange({ extraNotes: e.target.value })}
        />
      </div>
    </div>
  );
}

function PhotoPostFields({
  db,
  brief,
  onChange,
  onUploaded,
}: {
  db: Database;
  brief: Brief;
  onChange: (b: Brief) => void;
  onUploaded?: () => Promise<void>;
}) {
  const treatment = brief.photoTreatment ?? "as_is";
  return (
    <BriefPhotoPicker
      db={db}
      brief={brief}
      onChange={onChange}
      onUploaded={onUploaded}
      hint="Add the photograph you want to share. Alara keeps it exactly as taken."
    >
      <div className="grid gap-3 md:grid-cols-3">
        {(
          [
            {
              id: "as_is" as const,
              title: "Use original",
              hint: "The photo is the post. Caption sits underneath.",
            },
            {
              id: "captioned" as const,
              title: "Original + caption bar",
              hint: "Same untouched photo, a little more school text.",
            },
            {
              id: "designed" as const,
              title: "Event background",
              hint: "Branded canvas around the original photo. Faces stay whole.",
            },
          ]
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            className={`rounded-2xl border px-3 py-3 text-left ${
              treatment === option.id
                ? "border-[var(--navy)] bg-white"
                : "border-[var(--line)] bg-[var(--paper)]"
            }`}
            onClick={() => onChange({ photoTreatment: option.id })}
          >
            <p className="text-sm font-semibold text-[var(--navy)]">{option.title}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{option.hint}</p>
          </button>
        ))}
      </div>
    </BriefPhotoPicker>
  );
}

function BriefPhotoPicker({
  db,
  brief,
  onChange,
  onUploaded,
  hint,
  children,
}: {
  db: Database;
  brief: Brief;
  onChange: (b: Brief) => void;
  onUploaded?: () => Promise<void>;
  hint: string;
  children?: ReactNode;
}) {
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [viewing, setViewing] = useState<Asset | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const usable = db.assets.filter(isPosterSafeAsset);
  const chosen = (brief.photoIds ?? [])
    .map((id) => db.assets.find((asset) => asset.id === id))
    .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const ids: string[] = [];
      for (const file of [...files]) {
        const form = new FormData();
        form.set("file", file);
        form.set("flag", "marketing");
        form.set("keepOriginal", "true");
        form.set("folderId", db.folders.find((folder) => folder.kind === "event")?.id || "");
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const asset = await res.json();
        if (res.ok && asset.id) ids.push(asset.id);
      }
      if (ids.length) {
        onChange({ photoIds: ids, photoTreatment: brief.photoTreatment ?? "as_is" });
      }
      await onUploaded?.();
    } finally {
      setUploading(false);
    }
  }

  function pick(id: string) {
    onChange({ photoIds: [id], photoTreatment: brief.photoTreatment ?? "as_is" });
    setViewing(null);
    setLibraryOpen(false);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setPickerError(null);
    try {
      await deleteRecord(`/api/assets/${pendingDelete.id}`);
      if (brief.photoIds?.includes(pendingDelete.id)) {
        onChange({
          photoIds: (brief.photoIds ?? []).filter((id) => id !== pendingDelete.id),
        });
      }
      setPendingDelete(null);
      setViewing((current) =>
        current?.id === pendingDelete.id ? null : current
      );
      await onUploaded?.();
    } catch (err) {
      setPickerError(err instanceof Error ? err.message : "Could not delete that photo");
    } finally {
      setDeleting(false);
    }
  }

  function PhotoTile({ photo }: { photo: Asset }) {
    const on = brief.photoIds?.includes(photo.id);
    return (
      <figure
        className={`overflow-hidden rounded-xl border-2 bg-white ${
          on
            ? "border-[var(--navy)] ring-4 ring-[var(--gold)] shadow-[var(--shadow)]"
            : "border-[var(--line)]"
        }`}
      >
        <button type="button" className="block w-full" onClick={() => setViewing(photo)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt=""
            className="aspect-square w-full bg-[var(--navy)] object-contain"
          />
        </button>
        <figcaption className="flex flex-wrap gap-2 px-2 py-1.5 text-[11px] font-semibold">
          {on ? (
            <span className="rounded-full bg-[var(--navy)] px-2 py-0.5 text-white">
              Selected
            </span>
          ) : null}
          <button type="button" className="text-[var(--navy)]" onClick={() => setViewing(photo)}>
            Expand
          </button>
          <button type="button" className="text-[var(--navy)]" onClick={() => pick(photo.id)}>
            Use
          </button>
          <button
            type="button"
            className="text-rose-700"
            onClick={() => setPendingDelete(photo)}
          >
            Delete
          </button>
        </figcaption>
      </figure>
    );
  }

  return (
    <div className="md:col-span-2 space-y-4">
      <p className="text-sm text-[var(--muted)]">{hint}</p>
      <div className="flex flex-wrap gap-3">
        <label className="btn-secondary inline-block cursor-pointer">
          {uploading ? "Uploading…" : "Upload new"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              void upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          className="btn-secondary"
          disabled={!usable.length}
          onClick={() => setLibraryOpen(true)}
        >
          Choose from existing
        </button>
      </div>
      {!usable.length ? (
        <p className="text-sm text-[var(--muted)]">
          Nothing in the library yet. Upload a new photo to start.
        </p>
      ) : null}

      {chosen.length ? (
        <div className="flex flex-wrap gap-3">
          {chosen.map((photo) => (
            <figure
              key={photo.id}
              className="relative w-36 overflow-hidden rounded-xl border-4 border-[var(--navy)] bg-white shadow-[var(--shadow)] ring-4 ring-[var(--gold)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                className="aspect-square w-full bg-[var(--navy)] object-contain"
              />
              <span className="absolute left-1 top-1 rounded-full bg-[var(--navy)] px-2 py-0.5 text-[10px] font-bold text-white">
                Selected
              </span>
              <figcaption className="flex items-center justify-end gap-1 px-2 py-1">
                <button
                  type="button"
                  className="text-[11px] font-semibold text-[var(--navy)]"
                  onClick={() => onChange({ photoIds: [] })}
                >
                  Remove
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      {chosen.length ? <PhotoPrivacyNote /> : null}
      {children}

      {libraryOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--navy)]/40 p-4"
          role="presentation"
          onClick={() => setLibraryOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="photo-library-title"
            className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-[var(--line)] bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
              <h2 id="photo-library-title" className="font-semibold text-[var(--navy)]">
                Choose a photo
              </h2>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setLibraryOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="space-y-5 overflow-y-auto p-5">
              {db.folders.map((folder) => {
                const photos = usable.filter((photo) => photo.folderId === folder.id);
                if (!photos.length) return null;
                return (
                  <section key={folder.id} className="space-y-2">
                    <h3 className="text-sm font-semibold text-[var(--navy)]">
                      {folder.name}
                    </h3>
                    <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
                      {photos.map((photo) => (
                        <PhotoTile key={photo.id} photo={photo} />
                      ))}
                    </div>
                  </section>
                );
              })}
              {usable.some((photo) => !db.folders.some((folder) => folder.id === photo.folderId)) ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-[var(--navy)]">Other photos</h3>
                  <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
                    {usable
                      .filter(
                        (photo) =>
                          !db.folders.some((folder) => folder.id === photo.folderId)
                      )
                      .map((photo) => (
                        <PhotoTile key={photo.id} photo={photo} />
                      ))}
                  </div>
                </section>
              ) : null}
            </div>
            {pickerError ? (
              <p className="border-t border-[var(--line)] px-5 py-3 text-sm text-rose-700">
                {pickerError}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {viewing ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--navy)]/55 p-4"
          role="presentation"
          onClick={() => setViewing(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Expanded photo"
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewing.url}
              alt={viewing.name || "School photo"}
              className="max-h-[75vh] w-full bg-[var(--navy)] object-contain"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <p className="text-sm text-[var(--muted)]">
                {viewing.name || "Library photo"}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => pick(viewing.id)}
                >
                  Use this photo
                </button>
                <button
                  type="button"
                  className="btn-delete"
                  onClick={() => setPendingDelete(viewing)}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setViewing(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this photo?"
        busy={deleting}
        confirmLabel="Delete"
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={() => void confirmDelete()}
      >
        <p>
          Remove{" "}
          <span className="font-semibold">
            {pendingDelete?.name || "this photo"}
          </span>{" "}
          from the library? It will not be used on new posters.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function PhotoPrivacyNote() {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--navy)]">
      <li>
        Children’s faces stay inside the school. This photo is not shared
        outside Alara.
      </li>
      <li>
        By default the photograph is used exactly as taken — no retouching,
        and no cropping through faces. You can later mark a background to
        remove if you want a designed scene instead.
      </li>
    </ul>
  );
}

function nameForEventType(nextType: string, brief: Brief) {
  const current = brief.eventName?.trim() ?? "";
  const copiedFromType =
    !current || current === brief.eventType || current.toLowerCase() === "other";
  if (nextType === "Other") return copiedFromType ? "" : current;
  return copiedFromType ? nextType : current;
}

function hasRequiredEventName(brief: Brief) {
  const name = brief.eventName?.trim() ?? "";
  return name.length > 0 && name.toLowerCase() !== "other";
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  className = "",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm">{label}</span>
      <input
        className="field"
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        step={type === "time" ? "60" : undefined}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[] | string[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm">{label}</span>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function missingFields(intent: Intent | null, brief: Brief) {
  if (!intent) return ["intent"];
  const need: string[] = [];
  if (intent === "event") {
    if (!brief.eventType) need.push("event type");
    if (brief.eventType === "Other" && !hasRequiredEventName(brief)) {
      need.push("event name");
    }
    if (!brief.campus) need.push("campus");
    if (!brief.date) need.push("date");
    if (!brief.grades?.length) need.push("grades");
    if (!brief.parentAction) need.push("parent action");
    if (brief.parentAction === "I'll tell you" && !brief.parentActionNote?.trim()) {
      need.push("what to do");
    }
  }
  if (intent === "announcement") {
    if (!brief.announcementType) need.push("type");
    if (!brief.audience) need.push("audience");
    if (!brief.bodyFacts) need.push("facts");
  }
  if (intent === "achievement" && !brief.achievement) need.push("achievement");
  if (intent === "admissions" && !brief.admissionsGoal) need.push("goal");
  if (intent === "showcase" && !brief.showcaseType) need.push("showcase");
  if (intent === "other" && !brief.otherCategory) need.push("category");
  if (intent === "photos_to_post" && !brief.photoIds?.length) need.push("a photo");
  return need;
}

function briefFromParams(
  params: { get: (key: string) => string | null },
  db: Database,
  startIntent: Intent | null,
  startPhoto: string | null
): Brief {
  const eventName = params.get("eventName") || undefined;
  return {
    campus: params.get("campus") || db.school.campuses[0],
    eventName,
    eventType:
      params.get("eventType") ||
      (EVENT_TYPES.includes((eventName || "") as (typeof EVENT_TYPES)[number])
        ? eventName
        : undefined),
    date: params.get("date") || undefined,
    photoIds: startPhoto ? [startPhoto] : undefined,
    photoTreatment: startIntent === "photos_to_post" ? "as_is" : undefined,
  };
}

function isIntent(value: unknown): value is Intent {
  return INTENTS.some((item) => item.id === value);
}

function readCreateDraft(): CreateDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CreateDraft>;
    const intent = isIntent(parsed.intent) ? parsed.intent : null;
    const step =
      typeof parsed.step === "number" && parsed.step >= 0 && parsed.step <= MAX_STEP
        ? parsed.step
        : 0;
    return {
      step: intent ? step : 0,
      intent,
      brief: parsed.brief && typeof parsed.brief === "object" ? parsed.brief : {},
      beat: parsed.beat || "",
      channels: Array.isArray(parsed.channels) ? parsed.channels : [],
      voiceNote: typeof parsed.voiceNote === "string" ? parsed.voiceNote : "",
      captions: parsed.captions && typeof parsed.captions === "object" ? parsed.captions : {},
      captionsOrigin:
        parsed.captionsOrigin === "gemini" || parsed.captionsOrigin === "human"
          ? parsed.captionsOrigin
          : "coded",
      imageSource:
        parsed.imageSource === "photo" ||
        parsed.imageSource === "artwork" ||
        parsed.imageSource === "cutout"
          ? parsed.imageSource
          : undefined,
    };
  } catch {
    return null;
  }
}

function writeCreateDraft(draft: CreateDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Private mode or quota.
  }
}

function formatScheduleConfirm(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clearCreateDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
