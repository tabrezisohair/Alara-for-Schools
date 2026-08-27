"use client";

import { useState } from "react";
import { SchoolLogo } from "./SchoolLogo";
import { CHANNEL_META } from "@/lib/constants";
import type { CaptionSet, Channel } from "@/lib/types";

type Props = {
  channel: Channel;
  imageUrl: string;
  caption?: CaptionSet;
  schoolName: string;
  logoUrl?: string;
  facebookName?: string;
  instagramHandle?: string;
};

export function ChannelPostPreview(props: Props) {
  if (props.channel === "facebook") return <FacebookPost {...props} />;
  if (props.channel === "ig_post") return <InstagramPost {...props} />;
  if (props.channel === "ig_story") return <InstagramStory {...props} />;
  if (props.channel === "download") return <DownloadPack {...props} />;
  return <PlainPost {...props} />;
}

function FacebookPost({
  imageUrl,
  caption,
  schoolName,
  logoUrl,
  facebookName,
}: Props) {
  const { body, tags } = splitCaption(caption);
  const name = facebookName || schoolName;
  return (
    <article className="overflow-hidden rounded-2xl bg-[#242526] text-white shadow-[var(--shadow)]">
      <header className="flex items-center gap-3 px-4 pt-3 pb-2">
        <Avatar src={logoUrl} name={name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight">{name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-[#b0b3b8]">
            Just now · <GlobeIcon />
          </p>
        </div>
        <DotsIcon />
      </header>
      {(body || tags) ? (
        <p className="whitespace-pre-wrap px-4 pb-3 text-[15px] leading-snug">
          {body}
          {tags ? (
            <>
              {body ? " " : ""}
              <span className="text-[#2e89ff]">{tags}</span>
            </>
          ) : null}
        </p>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="" className="w-full bg-black object-cover" />
      <footer className="grid grid-cols-3 border-t border-white/10 text-[13px] text-[#b0b3b8]">
        <span className="flex items-center justify-center gap-2 py-3">
          <ThumbIcon /> Like
        </span>
        <span className="flex items-center justify-center gap-2 py-3">
          <CommentIcon /> Comment
        </span>
        <span className="flex items-center justify-center gap-2 py-3">
          <ShareIcon /> Share
        </span>
      </footer>
    </article>
  );
}

function InstagramPost({
  imageUrl,
  caption,
  schoolName,
  logoUrl,
  instagramHandle,
}: Props) {
  const { body, tags } = splitCaption(caption);
  const handle = igHandle(instagramHandle, schoolName);
  return (
    <article className="overflow-hidden rounded-2xl bg-black text-white shadow-[var(--shadow)]">
      <header className="flex items-center gap-3 px-3 py-2.5">
        <Avatar src={logoUrl} name={schoolName} ring />
        <p className="min-w-0 flex-1 truncate text-[14px] font-semibold">{handle}</p>
        <DotsIcon />
      </header>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="" className="aspect-square w-full bg-neutral-900 object-cover" />
      <div className="flex items-center justify-between px-3 py-2">
        <span className="flex items-center gap-4">
          <HeartIcon />
          <CommentIcon />
          <SendIcon />
        </span>
        <BookmarkIcon />
      </div>
      {(body || tags) ? (
        <p className="px-3 pb-3 text-[14px] leading-snug">
          <span className="font-semibold">{handle}</span>{" "}
          {body}
          {tags ? (
            <>
              {body ? " " : ""}
              <span className="text-[#e0f1ff]">{tags}</span>
            </>
          ) : null}
        </p>
      ) : (
        <p className="px-3 pb-3 text-[14px]">
          <span className="font-semibold">{handle}</span>
        </p>
      )}
    </article>
  );
}

function InstagramStory({ imageUrl, schoolName, logoUrl }: Props) {
  return (
    <article className="mx-auto max-w-[280px] overflow-hidden rounded-[1.6rem] bg-black text-white shadow-[var(--shadow)]">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="aspect-[9/16] w-full object-cover" />
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/55 to-transparent px-3 pt-3 pb-8">
          <Avatar src={logoUrl} name={schoolName} />
          <p className="truncate text-xs font-semibold">{schoolName}</p>
          <span className="text-[11px] text-white/70">Just now</span>
        </div>
      </div>
    </article>
  );
}

function DownloadPack({ imageUrl, schoolName }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      await saveImageFile(imageUrl, fileNameFor(schoolName, imageUrl));
    } catch {
      setError("Could not download the graphic. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <figure className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="Download pack" className="w-full" />
      <figcaption className="space-y-2 px-3 py-3">
        <p className="text-sm font-semibold text-[var(--navy)]">Download pack</p>
        <p className="text-xs text-[var(--muted)]">
          The finished graphic, ready to save and print or post by hand.
        </p>
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => void download()}
        >
          {busy ? "Preparing…" : "Download image"}
        </button>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </figcaption>
    </figure>
  );
}

function fileNameFor(schoolName: string, imageUrl: string) {
  const slug =
    schoolName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "alara";
  const ext =
    imageUrl.includes("image/png") || imageUrl.toLowerCase().includes(".png")
      ? "png"
      : "jpg";
  return `${slug}-poster.${ext}`;
}

async function saveImageFile(url: string, fileName: string) {
  const a = document.createElement("a");
  a.rel = "noopener";
  a.download = fileName;
  if (url.startsWith("data:")) {
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not fetch the graphic");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  a.href = objectUrl;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function PlainPost({ channel, imageUrl }: Props) {
  const label =
    CHANNEL_META.find((item) => item.id === channel)?.label ?? channel;
  return (
    <figure className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={label} className="w-full" />
      <figcaption className="px-3 py-2 text-sm">{label}</figcaption>
    </figure>
  );
}

function Avatar({
  src,
  name,
  ring,
}: {
  src?: string;
  name: string;
  ring?: boolean;
}) {
  return (
    <span
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ${
        ring ? "ring-2 ring-white/80 ring-offset-1 ring-offset-black" : ""
      }`}
    >
      <SchoolLogo
        src={src}
        alt={name}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

function splitCaption(caption?: CaptionSet) {
  const raw = caption?.en?.trim() ?? "";
  const fromSet = caption?.hashtags?.filter(Boolean).join(" ");
  if (!raw) return { body: "", tags: fromSet || "" };
  const lines = raw.split("\n");
  const last = lines[lines.length - 1] ?? "";
  if (/^(\s*#\w+)+\s*$/.test(last)) {
    return {
      body: lines.slice(0, -1).join("\n").trim(),
      tags: fromSet || last.trim(),
    };
  }
  return { body: raw, tags: fromSet || "" };
}

function igHandle(handle: string | undefined, schoolName: string) {
  const raw = handle?.replace(/^@/, "").trim();
  if (raw) return raw.replace(/\s+/g, "").toLowerCase();
  return schoolName.replace(/[^a-z0-9]+/gi, "").toLowerCase() || "school";
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3 fill-current" aria-hidden>
      <path d="M8 1.3A6.7 6.7 0 1 0 8 14.7 6.7 6.7 0 0 0 8 1.3Zm0 1.4a5.2 5.2 0 0 1 4.2 2.1H10A8.7 8.7 0 0 0 8.2 2.7H8Zm-1.1.1C6 4.3 5.2 5.7 4.8 7.4H2.8A5.3 5.3 0 0 1 6.9 2.8ZM2.7 8.6h2.2c.3 1.8 1 3.2 1.9 4.2A5.3 5.3 0 0 1 2.7 8.6Zm4.4 4.7c.6-1 1.2-2.5 1.5-4.1H7.2c.3 1.6.9 3.1 1.5 4.1H7.1Zm2.4-.5c1-1 1.7-2.4 2-4.2h2.2a5.3 5.3 0 0 1-4.2 4.2Zm2-5.4c-.3-1.7-1-3.1-1.9-4.2A5.3 5.3 0 0 1 13.2 7.4h-2.1Z" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-white/80" aria-hidden>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

function ThumbIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M7 11v9H4v-9h3Zm3 9h7.2a2 2 0 0 0 1.9-1.4l1.4-5.2A1.5 1.5 0 0 0 19 11h-5l.8-3.7a1.6 1.6 0 0 0-3.1-.7L9.5 11H10v9Z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-4 3.2V16H7.5A2.5 2.5 0 0 1 5 13.5v-7Z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M14 7h5v5M19 7l-8 8M10 7H7.5A2.5 2.5 0 0 0 5 9.5v7A2.5 2.5 0 0 0 7.5 19h7A2.5 2.5 0 0 0 17 16.5V14" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10Z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M4 11.5 20 4l-6.5 16-2.2-6.3L4 11.5Z" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M7 4.5h10A1.5 1.5 0 0 1 18.5 6v14L12 16.2 5.5 20V6A1.5 1.5 0 0 1 7 4.5Z" />
    </svg>
  );
}
